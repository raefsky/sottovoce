/* ========================= Modello: originali ed elenco delle operazioni ========================= */
// Gli originali (registrazioni e file) non si modificano mai. La traccia della voce è il risultato
// dell'elenco di operazioni S.ops, riapplicato da capo a ogni modifica. Tempi in campioni a 48 kHz.
// Un segmento è {src: id dell'originale o null per il silenzio, s: inizio nell'originale, len, f: ritocchi}.
// Un ritocco è {a, b, dir} in campioni dall'inizio del segmento: dir 'in' e 'out' sono dissolvenze, 'dip' abbassa di db
// con rampe morbide (respiri, rumori), 'fix' ripara i click (lo legge renderVoice). Seguono il segmento nei tagli.
const S = {
  sources: new Map(),             // id -> { id, name, kind: 'voce' | 'musica' | 'effetto', chs: [Float32Array], len }
  ops: [], redo: [],
  segs: [], segT: new Float64Array(0), vlen: 0, version: 0,
  fx: [],                         // effetti sulla terza traccia: { id, src, at (tempo del mix), gainDb }
  musicId: null,
  cur: 0, sel: null, anchor: 0,   // cursore e selezione, in tempo del mix
  view: [0, SR * 10], fit: true,
  clip: null,                     // appunti: segmenti copiati
  improved: new Map(),            // id originale -> { key, data } versione migliorata
  procKey: '', procActive: false, mode: 'orig',
  playing: false, recording: false, monitoring: false
};

function addSource(name, kind, chs) {
  const id = uid();
  S.sources.set(id, { id, name, kind, chs, len: chs[0].length });
  return id;
}
const shiftF = (d, k) => Object.assign({}, d, { a: d.a - k, b: d.b - k });
const cloneSegs = segs => segs.map(g => ({ src: g.src, s: g.s, len: g.len, f: g.f.map(d => shiftF(d, 0)) }));
const segsLen = segs => segs.reduce((n, g) => n + g.len, 0);

// garantisce un confine in t e restituisce l'indice del segmento che inizia lì
function cutAt(segs, t) {
  let pos = 0;
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i];
    if (t === pos) return i;
    if (t < pos + g.len) {
      const k = t - pos;
      const right = { src: g.src, s: g.src ? g.s + k : 0, len: g.len - k, f: g.f.map(d => shiftF(d, k)) };
      g.len = k;
      segs.splice(i + 1, 0, right);
      return i + 1;
    }
    pos += g.len;
  }
  return segs.length;
}
function removeRange(segs, a, b) { const i = cutAt(segs, a), j = cutAt(segs, b); return segs.splice(i, j - i); }
function sliceRange(segs, a, b) { const tmp = cloneSegs(segs), i = cutAt(tmp, a), j = cutAt(tmp, b); return tmp.slice(i, j); }
function insertClip(segs, at, clip) { const i = cutAt(segs, at); segs.splice(i, 0, ...cloneSegs(clip)); }
function fadeRange(segs, a, b, dir, extra) {
  const i = cutAt(segs, a), j = cutAt(segs, b);
  let pos = a;
  for (let k = i; k < j; k++) { segs[k].f.push(Object.assign({ a: a - pos, b: b - pos, dir }, extra)); pos += segs[k].len; }
}
function sameFades(f1, f2, shift) {
  if (f1.length !== f2.length) return false;
  for (let i = 0; i < f1.length; i++) if (f1[i].dir !== f2[i].dir || f1[i].a - shift !== f2[i].a || f1[i].b - shift !== f2[i].b || f1[i].db !== f2[i].db || f1[i].sens !== f2[i].sens) return false;
  return true;
}
function mergeSegs(segs) {
  const out = [];
  for (const g of segs) {
    if (g.len <= 0) continue;
    const p = out[out.length - 1];
    if (p && p.src === g.src && (g.src === null || g.s === p.s + p.len) && sameFades(p.f, g.f, p.len)) p.len += g.len;
    else out.push(g);
  }
  return out;
}

function applyOp(st, op) {
  const segs = st.segs, total = segsLen(segs), cl = t => clamp(Math.round(t), 0, total);
  switch (op.type) {
    case 'insert': insertClip(segs, cl(op.at), op.clip); break;
    case 'replace': { const a = cl(op.a), b = cl(op.b); removeRange(segs, a, b); insertClip(segs, a, op.clip); break; }
    case 'delete': removeRange(segs, cl(op.a), cl(op.b)); break;
    // più tagli in una sola operazione (Accorcia i silenzi): intervalli in ordine, tolti dall'ultimo al primo
    case 'cuts': for (let k = op.ranges.length - 1; k >= 0; k--) removeRange(segs, cl(op.ranges[k][0]), cl(op.ranges[k][1])); break;
    case 'silence': { const a = cl(op.a), b = cl(op.b); removeRange(segs, a, b); if (b > a) insertClip(segs, a, [{ src: null, s: 0, len: b - a, f: [] }]); break; }
    case 'fade': { const a = cl(op.a), b = cl(op.b); if (b > a) fadeRange(segs, a, b, op.dir); break; }
    // Correggi selezione: abbassa un tratto (respiro, rumore) o ripara i click; 'multi' raggruppa più ritocchi in un solo passo
    case 'dip': { const a = cl(op.a), b = cl(op.b); if (b > a) fadeRange(segs, a, b, 'dip', { db: op.db }); break; }
    case 'fix': { const a = cl(op.a), b = cl(op.b); if (b > a) fadeRange(segs, a, b, 'fix', { sens: op.sens }); break; }
    case 'multi': for (const o of op.ops) applyOp(st, o); return;
    case 'fxadd': { const e = { id: op.id, src: op.src, at: op.at, gainDb: op.gainDb || 0 }; fxApplySet(e, op); st.fx.push(e); break; }   // con i campi facoltativi, se ci sono
    case 'fxmove': { const e = st.fx.find(x => x.id === op.id); if (e) e.at = op.at; break; }
    case 'fxgain': { const e = st.fx.find(x => x.id === op.id); if (e) e.gainDb = op.gainDb; break; }
    case 'fxdel': st.fx = st.fx.filter(x => x.id !== op.id); break;
    case 'fxedit': { const e = st.fx.find(x => x.id === op.id); if (e) fxApplySet(e, op.set); break; }
  }
  st.segs = mergeSegs(segs);
}
function replay() {
  const st = { segs: [], fx: [] };
  for (const op of S.ops) applyOp(st, op);
  S.segs = st.segs; S.fx = st.fx;
  S.segT = new Float64Array(S.segs.length + 1);
  for (let i = 0; i < S.segs.length; i++) S.segT[i + 1] = S.segT[i] + S.segs[i].len;
  S.vlen = S.segT[S.segs.length] || 0;
  S.version++;
  fxCachePrune();                 // effetti eliminati o con il file sparito: via il loro suono calcolato
}
function pushOp(op) {
  S.ops.push(op); S.redo = [];
  replay(); afterEdit(op);
}
// vero se annullando l'ultima operazione la voce resterebbe vuota
function undoEmptiesVoice() {
  if (!S.vlen) return false;
  const st = { segs: [], fx: [] }; for (const op of S.ops.slice(0, -1)) applyOp(st, op);
  return segsLen(st.segs) === 0;
}
function undo() {
  if (!S.ops.length) return;
  if (undoEmptiesVoice() && !confirm('Annullando togli tutta la voce (ultima modifica: ' + S.ops[S.ops.length - 1].label + '). Potrai riportarla con Ripeti. Procedo?')) return;
  const op = S.ops.pop(); S.redo.push(op); replay(); afterEdit(null); toast('Annullato: ' + op.label + '.'); }
function redo() { if (!S.redo.length) return; const op = S.redo.pop(); S.ops.push(op); replay(); afterEdit(op); toast('Ripetuto: ' + op.label + '.'); }

/* ---------- disposizione del mix ---------- */
// Con la musica, la voce entra dopo l'intro e la musica continua per la coda.
function layout() {
  const intro = S.musicId && S.vlen ? Math.round(P.intro * SR) : 0, tail = S.musicId && S.vlen ? Math.round(P.tail * SR) : 0;
  let total = S.vlen ? intro + S.vlen + tail : 0;
  if (!S.vlen && S.musicId) total = S.sources.get(S.musicId).len;
  for (const e of S.fx) total = Math.max(total, e.at + fxSpan(e));
  return { intro, tail, total };
}

/* ---------- lettura della traccia della voce ---------- */
const EMPTY = new Float32Array(0);
// "Pareggia le registrazioni": ogni originale ha il suo guadagno per arrivare allo stesso volume degli altri
const SRC_GAIN = new Map();
// guadagno di pareggio di un originale; se l'originale è stato accorciato (cronologia svuotata) resta quello di prima
function baseGain(id) {
  let g = SRC_GAIN.get(id);
  if (g == null) {
    const s = S.sources.get(id);
    if (s && s.gain != null) g = s.gain;
    else { const l = s ? lufs(s.chs[0], true) : -100; g = l > -90 ? dbToGain(-19 - l) : 1; }
    SRC_GAIN.set(id, g);
  }
  return g;
}
function srcGain(id, useProc) { return (useProc || !P.normEach || !id) ? 1 : baseGain(id); }

/* ---------- svuotare la cronologia ---------- */
// Il risultato resta identico: la voce montata diventa una sola operazione. Degli originali si tengono solo i tratti usati,
// con un margine di 0,1 s per le dissolvenze sui tagli; il guadagno di pareggio di ogni registrazione si conserva.
function collapseHistory() {
  const M = Math.round(0.1 * SR), map = new Map(), newSegs = cloneSegs(S.segs);
  for (const id of new Set(S.segs.filter(g => g.src).map(g => g.src))) {
    const s = S.sources.get(id); if (!s) continue;
    const iv = S.segs.filter(g => g.src === id).map(g => [Math.max(0, g.s - M), Math.min(s.len, g.s + g.len + M)]).sort((a, b) => a[0] - b[0]);
    const merged = []; for (const r of iv) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice()); }
    const total = merged.reduce((n, r) => n + r[1] - r[0], 0), cut = arr => { const o = new Float32Array(total); let p = 0; for (const [a, b] of merged) { o.set(arr.subarray(a, b), p); p += b - a; } return o; };
    const nid = addSource(s.name, 'voce', [cut(s.chs[0])]);
    S.sources.get(nid).gain = baseGain(id);
    const im = S.improved.get(id); if (im) S.improved.set(nid, { key: im.key, data: cut(im.data) });
    map.set(id, { nid, merged });
  }
  for (const g of newSegs) {
    if (!g.src || !map.has(g.src)) continue;
    const { nid, merged } = map.get(g.src); let base = 0;
    for (const [a, b] of merged) { if (g.s >= a && g.s < b) { g.s = base + (g.s - a); break; } base += b - a; }
    g.src = nid;
  }
  const ops = [];
  if (newSegs.length) ops.push({ type: 'insert', at: 0, clip: newSegs, label: 'Montaggio attuale (cronologia svuotata, ' + fmtDur(segsLen(newSegs) / SR) + ')', collapsed: true });
  for (const e of S.fx) { const src = S.sources.get(e.src); ops.push({ type: 'fxadd', collapsed: true, ...e, label: 'Effetto “' + (src ? src.name : '') + '” a ' + fmtSec(e.at) }); }
  // si tengono solo gli originali ancora usati
  const keep = new Set([...map.values()].map(v => v.nid).concat(S.fx.map(e => e.src), S.musicId ? [S.musicId] : []));
  for (const id of [...S.sources.keys()]) if (!keep.has(id)) { S.sources.delete(id); S.improved.delete(id); SRC_GAIN.delete(id); VAD.delete(id); }
  S.ops = ops; S.redo = []; S.clip = null;
  replay();
}
function voiceData(id, useProc) {
  if (useProc) { const im = S.improved.get(id); if (im && im.key === S.procKey) return im.data; }
  const s = S.sources.get(id); return s ? s.chs[0] : EMPTY;   // un originale mancante suona come silenzio
}
const DIP_RAMP = Math.round(0.02 * SR);           // rampe di 20 ms ai bordi di un tratto abbassato
function fadeGain(f, p) {
  let g = 1;
  for (const d of f) {
    if (d.dir === 'fix') continue;
    const x = (p - d.a) / (d.b - d.a);
    if (x < 0 || x > 1) continue;
    if (d.dir === 'dip') { const r = Math.max(1, Math.min(DIP_RAMP, (d.b - d.a) / 4)), u = Math.min(1, Math.min(p - d.a, d.b - p) / r), sm = u * u * (3 - 2 * u); g *= 1 - sm * (1 - dbToGain(-d.db)); continue; }
    const sm = x * x * (3 - 2 * x);
    g *= d.dir === 'in' ? sm : 1 - sm;
  }
  return g;
}
const contiguous = (p, g) => p && g && p.src === g.src && (g.src === null || g.s === p.s + p.len);
function segIndexAt(t) {
  let lo = 0, hi = S.segs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S.segT[m] <= t) lo = m; else hi = m - 1; }
  return lo;
}
// n campioni della voce a partire da t0 (tempo della voce), con le dissolvenze incrociate sui tagli
// click riparati: il tratto dell'originale (o della voce migliorata) passa da deClick con 100 ms di contesto per lato, in più passate;
// il risultato resta in memoria finché non cambiano originale, miglioramento o tratto
const REPAIRS = new Map();
function repairOf(src, useProc, s0, s1, sens) {
  const d = voiceData(src, useProc), key = src + '|' + (useProc ? S.procKey : '') + '|' + s0 + '|' + s1 + '|' + sens;
  let r = REPAIRS.get(key);
  if (!r) {
    // più passate finché non resta nessun click (al massimo quattro): un click forte non nasconde quelli vicini
    const a = Math.max(0, s0 - 4800), b = Math.min(d.length, s1 + 4800); let y = d.subarray(a, b), k = 0;
    do y = deClick(y, sens); while (y.clicks && ++k < 4);
    r = { s0, s1, buf: y.subarray(Math.max(0, s0 - a), Math.max(0, s1 - a)) };
    if (REPAIRS.size > 200) REPAIRS.clear(); REPAIRS.set(key, r);
  }
  return r;
}
function renderVoice(t0, n, useProc, out) {
  out = out || new Float32Array(n);
  if (!S.segs.length) return out;
  const H = Math.max(1, Math.round(P.xfadeMs / 2000 * SR));
  let i = Math.max(0, segIndexAt(Math.max(0, t0)) - 1);
  for (; i < S.segs.length; i++) {
    const g = S.segs[i], T = S.segT[i], L = g.len, prev = S.segs[i - 1], next = S.segs[i + 1];
    if (T - H >= t0 + n) break;
    const hin = (prev && !contiguous(prev, g)) ? Math.max(0, Math.min(H, L >> 1, prev.len >> 1)) : 0;
    const hout = (next && !contiguous(g, next)) ? Math.max(0, Math.min(H, L >> 1, next.len >> 1)) : 0;
    const a = Math.max(t0, T - hin), b = Math.min(t0 + n, T + L + hout);
    if (b <= a || !g.src) continue;
    const d = voiceData(g.src, useProc), dl = d.length, hasF = g.f.length > 0, sg = srcGain(g.src, useProc);
    const reps = hasF ? g.f.filter(x => x.dir === 'fix').map(x => repairOf(g.src, useProc, Math.max(0, g.s + x.a), Math.min(dl, g.s + x.b), x.sens)) : [];
    for (let t = a; t < b; t++) {
      const p = t - T, sp = g.s + p;
      if (sp < 0 || sp >= dl) continue;
      let w = 1;
      if (p < hin) w = Math.sin(Math.PI / 2 * (p + hin) / (2 * hin));
      if (p >= L - hout) w *= Math.cos(Math.PI / 2 * (p - (L - hout)) / (2 * hout));
      if (hasF) w *= fadeGain(g.f, clamp(p, 0, L - 1));
      let v = d[sp];
      for (let k = 0; k < reps.length; k++) { const r = reps[k]; if (sp >= r.s0 && sp < r.s1) { v = r.buf[sp - r.s0]; break; } }
      out[t - t0] += v * w * sg;
    }
  }
  return out;
}
function renderVoiceAll(useProc, onProg) { return renderVoice(0, S.vlen, useProc); }

/* ---------- picchi per il disegno ---------- */
const peakCache = new WeakMap();
function peaksOf(arr) {
  let p = peakCache.get(arr); if (p) return p;
  const mk = B => { const n = Math.ceil(arr.length / B), mn = new Float32Array(n), mx = new Float32Array(n);
    for (let i = 0; i < n; i++) { let lo = 1e9, hi = -1e9; for (let j = i * B, e = Math.min(arr.length, j + B); j < e; j++) { const v = arr[j]; if (v < lo) lo = v; if (v > hi) hi = v; } mn[i] = lo; mx[i] = hi; }
    return { B, mn, mx }; };
  const l1 = mk(64);
  const l2 = { B: 2048, mn: new Float32Array(Math.ceil(l1.mn.length / 32)), mx: new Float32Array(Math.ceil(l1.mn.length / 32)) };
  for (let i = 0; i < l2.mn.length; i++) { let lo = 1e9, hi = -1e9; for (let j = i * 32, e = Math.min(l1.mn.length, j + 32); j < e; j++) { if (l1.mn[j] < lo) lo = l1.mn[j]; if (l1.mx[j] > hi) hi = l1.mx[j]; } l2.mn[i] = lo; l2.mx[i] = hi; }
  p = [l1, l2]; peakCache.set(arr, p); return p;
}
// minimo e massimo di arr tra i campioni a e b
function minMax(arr, a, b, res) {
  a = Math.max(0, Math.floor(a)); b = Math.min(arr.length, Math.ceil(b));
  let lo = 0, hi = 0;
  if (b > a) {
    lo = 1e9; hi = -1e9;
    if (b - a < 256) { for (let i = a; i < b; i++) { const v = arr[i]; if (v < lo) lo = v; if (v > hi) hi = v; } }
    else {
      const lv = peaksOf(arr)[b - a > 2048 * 8 ? 1 : 0], i0 = Math.floor(a / lv.B), i1 = Math.min(lv.mn.length - 1, Math.floor((b - 1) / lv.B));
      for (let i = i0; i <= i1; i++) { if (lv.mn[i] < lo) lo = lv.mn[i]; if (lv.mx[i] > hi) hi = lv.mx[i]; }
    }
  }
  res[0] = lo; res[1] = hi; return res;
}
// massimo assoluto della voce montata (per l'altezza automatica)
function voicePeak(useProc) {
  let pk = 0; const r = [0, 0];
  for (const g of S.segs) { if (!g.src) continue; minMax(voiceData(g.src, useProc), g.s, g.s + g.len, r); const k = srcGain(g.src, useProc); pk = Math.max(pk, -r[0] * k, r[1] * k); }
  return pk;
}

