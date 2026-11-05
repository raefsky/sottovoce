/* ========================= Effetti modificabili: rendering unico ========================= */
// Un effetto è { id, src, at, gainDb } più campi facoltativi, tutti in secondi:
//   in, out  tratto del file originale usato (taglio non distruttivo; assenti = tutto il file)
//   len      durata del blocco sulla timeline; con loop può superare il tratto, che allora si ripete
//   loop     vero = il tratto si ripete fino a len, con una sfumatura incrociata alle giunture
//   fadeIn, fadeOut  entrata e uscita graduali del blocco (curva a S); gli effetti nuovi nascono con 5 ms, i vecchi senza
//   pan      posizione stereo da -1 (sinistra) a 1 (destra), legge a potenza costante; assente = centro, come prima.
//            Si applica nella somma (fuori dalla cache), così nell'esportazione mono si può ignorare
//   env      curva di volume: punti [secondi dall'inizio del blocco, dB], segmenti lineari in dB; prima del primo punto
//            vale il primo, dopo l'ultimo vale l'ultimo. Si moltiplica con gainDb e con le dissolvenze
//   rate     velocità e intonazione insieme (0,5-2; assente = 1): 2 suona il doppio più veloce e un'ottava più acuto
//   rev      riverbero { type: 'small' | 'large' | 'cave', mix: 0-1 }: la coda si aggiunge dopo la fine del blocco
//   lp       "lontano": frequenza in Hz sopra cui si tolgono gli acuti (assente = vicino, nessun filtro)
//   name, color  nome e colore per riconoscerlo (assenti = nome del file, colore degli effetti)
//   mute, solo   silenziato, oppure il solo che suona tra gli effetti: valgono in ascolto e in esportazione
//   duck     dB di cui abbassa la musica mentre suona (assente = non la abbassa, come prima)
// Ordine: taglio, velocità, ripetizione, dissolvenze, curva di volume, riverbero, lontano; posizione e volume nella somma.
// Ascolto, esportazione, tracce separate e anteprima passano tutti da fxRender, quindi non possono divergere.
// Un effetto senza campi nuovi (progetti vecchi) resta sulla somma diretta di prima: suona bit per bit uguale.
const FX_MIN = 0.05;                                   // durata minima di un tratto, in secondi
const FX_XF = 0.1;                                     // sfumatura incrociata del loop, in secondi
const FX_FADE_NEW = 0.005;                             // dissolvenze minime degli effetti nuovi, contro gli scatti
const fxPlain = e => e.in == null && e.out == null && e.len == null && !e.loop && !e.fadeIn && !e.fadeOut && !(e.env && e.env.length) && !e.rev && !e.lp && !(e.rate && e.rate !== 1);
const FX_ENV_TOP = 6, FX_ENV_BOT = -40;                 // escursione della curva di volume, in dB
// valore della curva in dB al secondo t del blocco
function fxEnvAt(env, t) {
  if (!env || !env.length) return 0;
  if (t <= env[0][0]) return env[0][1];
  for (let k = 1; k < env.length; k++) if (t <= env[k][0]) { const [t0, d0] = env[k - 1], [t1, d1] = env[k]; return t1 > t0 ? d0 + (d1 - d0) * (t - t0) / (t1 - t0) : d1; }
  return env[env.length - 1][1];
}
// durate delle dissolvenze in campioni; se insieme superano il blocco si riducono in proporzione
function fxFades(e, n) { let fi = Math.round((e.fadeIn || 0) * SR), fo = Math.round((e.fadeOut || 0) * SR); if (fi + fo > n) { const k = n / (fi + fo); fi = Math.floor(fi * k); fo = Math.floor(fo * k); } return [fi, fo]; }
// tratto usato del file, in campioni: [inizio, fine)
function fxRange(e, src) {
  const a = e.in != null ? clamp(Math.round(e.in * SR), 0, src.len - 1) : 0;
  const b = e.out != null ? clamp(Math.round(e.out * SR), a + 1, src.len) : src.len;
  return [a, b];
}
// riverberi: durata della coda (s), tempo di decadimento RT60 (s), smorzamento degli acuti (Hz), ritardo iniziale (s)
const FX_REV = { small: { t: 0.8, rt: 0.5, damp: 7000, pre: 0.006 }, large: { t: 2.6, rt: 1.9, damp: 5000, pre: 0.02 }, cave: { t: 5.5, rt: 4.2, damp: 3200, pre: 0.045 } };
const fxRate = e => e.rate > 0 ? clamp(e.rate, 0.5, 2) : 1;
const fxTail = e => e.rev && FX_REV[e.rev.type] ? Math.round(FX_REV[e.rev.type].t * SR) : 0;
// tratto usato sulla timeline (dopo la velocità), in campioni
function fxSeg(e, src) { const [a, b] = fxRange(e, src); return Math.max(1, Math.round((b - a) / fxRate(e))); }
// parte "asciutta" del blocco: il tratto, ripetuto o accorciato; senza la coda del riverbero
function fxDry(e) {
  const src = S.sources.get(e.src); if (!src) return 0;
  if (fxPlain(e)) return src.len;
  const seg = fxSeg(e, src); if (e.len == null) return seg;
  const L = Math.max(1, Math.round(e.len * SR)); return e.loop ? L : Math.min(L, seg);
}
// durata del blocco sulla timeline, in campioni, coda del riverbero compresa (la usano mix, disegno, selezione e durata totale)
const fxSpan = e => fxDry(e) + fxTail(e);
// filtro passa basso a due celle (24 dB per ottava), in place
function fxLowpass(x, f) {
  const co = biquadLP(Math.min(f, SR * 0.45), 0.707); let p1 = 0, p2 = 0, q1 = 0, q2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = co[0] * v + p1; p1 = co[1] * v - co[3] * y + p2; p2 = co[2] * v - co[4] * y; const z = co[0] * y + q1; q1 = co[1] * y - co[3] * z + q2; q2 = co[2] * y - co[4] * z; x[i] = z; }
  return x;
}
// cambio di velocità con interpolazione cubica; accelerando si tolgono prima gli acuti che non ci starebbero più
function fxResample(x, rate) {
  if (rate > 1) x = fxLowpass(Float32Array.from(x), SR * 0.45 / rate);
  const n = Math.max(1, Math.round(x.length / rate)), out = new Float32Array(n), m = x.length - 1, at = k => x[k < 0 ? 0 : k > m ? m : k];
  for (let i = 0; i < n; i++) { const p = i * rate, k = Math.floor(p), f = p - k, y0 = at(k - 1), y1 = at(k), y2 = at(k + 1), y3 = at(k + 2);
    out[i] = y1 + 0.5 * f * (y2 - y0 + f * (2 * y0 - 5 * y1 + 4 * y2 - y3 + f * (3 * (y1 - y2) + y3 - y0))); }
  return out;
}
// risposta all'impulso generata nel codice: rumore con un seme fisso (sempre uguale), decadimento esponenziale,
// acuti smorzati, energia 1; i due canali hanno semi diversi, così la coda si apre nello spazio
function fxIR(type, ch) {
  const R = FX_REV[type], n = Math.round(R.t * SR), pre = Math.round(R.pre * SR), h = new Float32Array(n), a = Math.exp(-2 * Math.PI * R.damp / SR);
  let s = ch ? 977 : 131, lp = 0, e = 0;
  for (let i = pre; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0; lp = (1 - a) * (s / 4294967296 - 0.5) + a * lp;
    const t = (i - pre) / SR, fade = i > n * 0.9 ? (n - i) / (n * 0.1) : 1;
    h[i] = lp * Math.exp(-6.91 * t / R.rt) * fade; e += h[i] * h[i];
  }
  const g = 1 / Math.sqrt(e || 1); for (let i = 0; i < n; i++) h[i] *= g;
  return h;
}
const FXIR = {};
function fxIRCached(type, ch) { const k = type + ch; return FXIR[k] || (FXIR[k] = fxIR(type, ch)); }
// convoluzione a blocchi con la FFT (sovrapposizione e somma): out ha lunghezza n
function fxConvolve(x, h, n) {
  let N = 1; while (N < 2 * h.length) N <<= 1;
  const B = N - h.length + 1, fft = makeFFT(N), Hr = new Float64Array(N), Hi = new Float64Array(N), out = new Float32Array(n);
  Hr.set(h); fft(Hr, Hi, false);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s < x.length; s += B) {
    re.fill(0); im.fill(0); const m = Math.min(B, x.length - s); for (let i = 0; i < m; i++) re[i] = x[s + i];
    fft(re, im, false);
    for (let k = 0; k < N; k++) { const r = re[k] * Hr[k] - im[k] * Hi[k]; im[k] = re[k] * Hi[k] + im[k] * Hr[k]; re[k] = r; }
    fft(re, im, true);
    for (let i = 0; i < N && s + i < n; i++) out[s + i] += re[i];
  }
  return out;
}
// suono dell'effetto, stereo a 48 kHz, con tutto applicato tranne volume e posizione (che si applicano nella somma)
const FXR = new Map();                                 // id -> { key, L, R }
function fxRender(e) {
  const src = S.sources.get(e.src); if (!src) return null;
  const key = JSON.stringify([e.src, e.in, e.out, e.len, !!e.loop, e.fadeIn || 0, e.fadeOut || 0, e.env || null, fxRate(e), e.rev || null, e.lp || 0]);
  const c = FXR.get(e.id); if (c && c.key === key) return c;
  const [a, b] = fxRange(e, src), rate = fxRate(e), dry = fxDry(e), n = dry + fxTail(e);
  // tratto del file, già alla velocità scelta
  let sl = src.chs[0].subarray(a, b), sr = (src.chs[1] || src.chs[0]).subarray(a, b);
  if (rate !== 1) { sl = fxResample(sl, rate); sr = src.chs[1] ? fxResample(sr, rate) : sl; }
  const seg = sl.length, L = new Float32Array(n), R = new Float32Array(n);
  if (!e.loop || dry <= seg) {
    for (let i = 0; i < dry; i++) { L[i] = sl[i]; R[i] = sr[i]; }
  } else {
    // ripetizioni sovrapposte di xf campioni, con sfumatura a potenza costante (seno e coseno) nel punto di giunzione
    const xf = Math.max(1, Math.min(Math.round(FX_XF * SR), seg >> 2)), step = seg - xf;
    for (let s = 0; s < dry; s += step) {
      for (let i = 0; i < seg && s + i < dry; i++) {
        let w = 1;
        if (s > 0 && i < xf) w = Math.sin(Math.PI / 2 * (i + 0.5) / xf);
        if (i >= seg - xf && s + step < dry) w *= Math.cos(Math.PI / 2 * (i - (seg - xf) + 0.5) / xf);
        L[s + i] += sl[i] * w; R[s + i] += sr[i] * w;
      }
    }
  }
  // dissolvenze sulla parte asciutta, dopo taglio e ripetizione: curva a S (seno al quadrato), senza scalini
  const [fi, fo] = fxFades(e, dry);
  for (let i = 0; i < fi; i++) { const w = Math.sin(Math.PI / 2 * (i + 0.5) / fi) ** 2; L[i] *= w; R[i] *= w; }
  for (let i = 0; i < fo; i++) { const w = Math.sin(Math.PI / 2 * (i + 0.5) / fo) ** 2, k = dry - 1 - i; L[k] *= w; R[k] *= w; }
  // curva di volume: guadagno calcolato ogni 32 campioni (0,7 ms) e interpolato in mezzo
  if (e.env && e.env.length) {
    let g0 = dbToGain(fxEnvAt(e.env, 0));
    for (let s = 0; s < dry; s += 32) {
      const g1 = dbToGain(fxEnvAt(e.env, Math.min(dry, s + 32) / SR)), m = Math.min(32, dry - s);
      for (let i = 0; i < m; i++) { const w = g0 + (g1 - g0) * i / 32; L[s + i] *= w; R[s + i] *= w; }
      g0 = g1;
    }
  }
  // riverbero: suono diretto e coda mescolati secondo la quantità; la coda continua dopo la parte asciutta
  if (e.rev && FX_REV[e.rev.type]) {
    const m = clamp(e.rev.mix, 0, 1), wl = fxConvolve(L, fxIRCached(e.rev.type, 0), n), wr = fxConvolve(R, fxIRCached(e.rev.type, 1), n);
    for (let i = 0; i < n; i++) { L[i] = L[i] * (1 - m) + wl[i] * m; R[i] = R[i] * (1 - m) + wr[i] * m; }
  }
  // lontano: toglie gli acuti sopra lp, dopo il riverbero (come un suono dietro una porta)
  if (e.lp) { fxLowpass(L, e.lp); fxLowpass(R, e.lp); }
  const out = { key, L, R }; FXR.set(e.id, out);
  return out;
}
/* ---------- effetti lunghi: calcolo a blocchi con memoria limitata ---------- */
// Oltre 5 minuti il suono intero occuperebbe troppa memoria (40 minuti stereo: 922 MB). Allora si tiene solo il tratto
// del file già alla velocità scelta e si calcolano blocchi di 10 s quando servono, tenendone in memoria al massimo 16
// (circa 61 MB). Ogni campione esce identico a fxRender: stessi passaggi, stesso ordine, stessi arrotondamenti a float32.
// Il filtro "lontano" riparte da stati salvati all'inizio di ogni blocco (calcolati una volta, in ordine, senza tenere
// l'audio); il riverbero ricalcola solo i suoi blocchi FFT che toccano il tratto richiesto, nello stesso ordine.
const FX_LONG = 5 * 60 * SR, FX_CH = 10 * SR, FX_CH_KEEP = 16, FX_BL_KEEP = 3;
const FXB = new Map();                                 // id -> stato del calcolo a blocchi
const fxKey = e => JSON.stringify([e.src, e.in, e.out, e.len, !!e.loop, e.fadeIn || 0, e.fadeOut || 0, e.env || null, fxRate(e), e.rev || null, e.lp || 0]);
const fxIsLong = e => !fxPlain(e) && fxSpan(e) > FX_LONG;
function fxBase(e) {
  const key = fxKey(e), old = FXB.get(e.id); if (old && old.key === key) return old;
  const src = S.sources.get(e.src); if (!src) return null;
  const [a, b] = fxRange(e, src), rate = fxRate(e), dry = fxDry(e), n = dry + fxTail(e);
  let sl = src.chs[0].subarray(a, b), sr = (src.chs[1] || src.chs[0]).subarray(a, b);
  if (rate !== 1) { sl = fxResample(sl, rate); sr = src.chs[1] ? fxResample(sr, rate) : sl; }
  const seg = sl.length, loop = !!e.loop && dry > seg, xf = Math.max(1, Math.min(Math.round(FX_XF * SR), seg >> 2)), [fi, fo] = fxFades(e, dry);
  const st = { key, sl, sr, seg, dry, n, loop, xf, step: seg - xf, fi, fo, env: e.env && e.env.length ? e.env : null, chunks: new Map(), ckpt: [], blocks: new Map(), lp: e.lp || 0 };
  if (e.rev && FX_REV[e.rev.type]) {
    // stessi N, B e spettro della risposta all'impulso di fxConvolve
    const h0 = fxIRCached(e.rev.type, 0), h1 = fxIRCached(e.rev.type, 1); let N = 1; while (N < 2 * h0.length) N <<= 1;
    const fft = makeFFT(N), H = [h0, h1].map(h => { const r = new Float64Array(N), i = new Float64Array(N); r.set(h); fft(r, i, false); return [r, i]; });
    st.rev = { mix: clamp(e.rev.mix, 0, 1), N, B: N - h0.length + 1, fft, H };
  }
  if (st.lp) st.co = biquadLP(Math.min(st.lp, SR * 0.45), 0.707);
  st.ckpt[0] = [[0, 0, 0, 0], [0, 0, 0, 0]];
  FXB.set(e.id, st); return st;
}
// parte asciutta (taglio, ripetizione, dissolvenze, curva) nel tratto [p0, p1): come in fxRender, campione per campione
function fxDryRange(st, p0, p1) {
  const len = p1 - p0, L = new Float32Array(len), R = new Float32Array(len), de = Math.min(p1, st.dry), { sl, sr, seg, dry } = st;
  if (!st.loop) { for (let p = p0; p < de; p++) { L[p - p0] = sl[p]; R[p - p0] = sr[p]; } }
  else {
    const { xf, step } = st;
    for (let s = Math.max(0, Math.floor((p0 - seg + 1) / step)) * step; s < dry && s < de; s += step) {
      for (let i = Math.max(0, p0 - s); i < seg && s + i < dry && s + i < de; i++) {
        let w = 1;
        if (s > 0 && i < xf) w = Math.sin(Math.PI / 2 * (i + 0.5) / xf);
        if (i >= seg - xf && s + step < dry) w *= Math.cos(Math.PI / 2 * (i - (seg - xf) + 0.5) / xf);
        L[s + i - p0] += sl[i] * w; R[s + i - p0] += sr[i] * w;
      }
    }
  }
  const { fi, fo } = st;
  for (let p = p0; p < Math.min(fi, de); p++) { const w = Math.sin(Math.PI / 2 * (p + 0.5) / fi) ** 2; L[p - p0] *= w; R[p - p0] *= w; }
  for (let p = Math.max(p0, dry - fo); p < de; p++) { const i = dry - 1 - p, w = Math.sin(Math.PI / 2 * (i + 0.5) / fo) ** 2; L[p - p0] *= w; R[p - p0] *= w; }
  if (st.env) {
    for (let s = Math.floor(p0 / 32) * 32; s < de; s += 32) {
      const g0 = dbToGain(fxEnvAt(st.env, Math.min(dry, s) / SR)), g1 = dbToGain(fxEnvAt(st.env, Math.min(dry, s + 32) / SR)), m = Math.min(32, dry - s);
      for (let i = Math.max(0, p0 - s); i < m && s + i < de; i++) { const w = g0 + (g1 - g0) * i / 32; L[s + i - p0] *= w; R[s + i - p0] *= w; }
    }
  }
  return { L, R };
}
// un blocco FFT del riverbero (uscita intera, come in fxConvolve); se ne tengono pochi, i più recenti
function fxRevBlock(st, j) {
  const hit = st.blocks.get(j); if (hit) { st.blocks.delete(j); st.blocks.set(j, hit); return hit; }
  const { N, B, fft, H } = st.rev, s = j * B, m = Math.min(B, st.n - s), x = fxDryRange(st, s, s + m), out = [];
  for (let c = 0; c < 2; c++) {
    const re = new Float64Array(N), im = new Float64Array(N), xs = c ? x.R : x.L, [Hr, Hi] = H[c];
    for (let i = 0; i < m; i++) re[i] = xs[i];
    fft(re, im, false);
    for (let k = 0; k < N; k++) { const r = re[k] * Hr[k] - im[k] * Hi[k]; im[k] = re[k] * Hi[k] + im[k] * Hr[k]; re[k] = r; }
    fft(re, im, true); out.push(re);
  }
  st.blocks.set(j, out); if (st.blocks.size > FX_BL_KEEP) st.blocks.delete(st.blocks.keys().next().value);
  return out;
}
// blocco k prima del filtro "lontano": parte asciutta, poi riverbero mescolato
function fxPreLP(st, k) {
  const p0 = k * FX_CH, p1 = Math.min(st.n, p0 + FX_CH), d = fxDryRange(st, p0, p1);
  if (!st.rev) return d;
  const { N, B, mix } = st.rev, len = p1 - p0, wl = new Float32Array(len), wr = new Float32Array(len);
  for (let j = Math.max(0, Math.ceil((p0 - N + 1) / B)); j * B < st.n && j * B < p1; j++) {
    const s = j * B, [bl, br] = fxRevBlock(st, j);
    for (let p = Math.max(p0, s); p < p1 && p < s + N; p++) { wl[p - p0] += bl[p - s]; wr[p - p0] += br[p - s]; }
  }
  for (let i = 0; i < len; i++) { d.L[i] = d.L[i] * (1 - mix) + wl[i] * mix; d.R[i] = d.R[i] * (1 - mix) + wr[i] * mix; }
  return d;
}
// filtro "lontano" su un blocco, ripartendo dallo stato salvato (stessi conti di fxLowpass)
function fxLowpassFrom(x, co, z) {
  let [p1, p2, q1, q2] = z;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = co[0] * v + p1; p1 = co[1] * v - co[3] * y + p2; p2 = co[2] * v - co[4] * y; const w = co[0] * y + q1; q1 = co[1] * y - co[3] * w + q2; q2 = co[2] * y - co[4] * w; x[i] = w; }
  return [p1, p2, q1, q2];
}
function fxKeep(st, k, c) { st.chunks.set(k, c); if (st.chunks.size > FX_CH_KEEP) st.chunks.delete(st.chunks.keys().next().value); return c; }
// blocco k finito (10 s, l'ultimo più corto); con il filtro, i blocchi prima si calcolano una volta in ordine per avere lo stato
function fxChunk(st, k) {
  const hit = st.chunks.get(k); if (hit) { st.chunks.delete(k); st.chunks.set(k, hit); return hit; }
  if (!st.lp) return fxKeep(st, k, fxPreLP(st, k));
  // dall'ultimo stato noto fino a k: ogni blocco calcolato lascia lo stato per il successivo (pochi numeri, si tengono tutti)
  let j = k; while (!st.ckpt[j]) j--;
  for (; ; j++) {
    const c = fxPreLP(st, j), z = st.ckpt[j];
    st.ckpt[j + 1] = [fxLowpassFrom(c.L, st.co, z[0]), fxLowpassFrom(c.R, st.co, z[1])];
    fxKeep(st, j, c); if (j === k) return c;
  }
}
// effetti lunghi con "lontano": gli stati del filtro si preparano in sottofondo, a passi di circa 40 ms nei momenti liberi,
// così un salto a metà ascolto non deve ricalcolare tutto da capo; se l'effetto cambia, il lavoro vecchio si ferma
function fxWarm(e) {
  const st = fxBase(e); if (!st || !st.lp || st.warming) return;
  st.warming = true; let k = 0;
  const later = f => window.requestIdleCallback ? requestIdleCallback(f, { timeout: 500 }) : setTimeout(f, 0);
  const step = () => {
    if (FXB.get(e.id) !== st) return;
    const t = performance.now();
    while (performance.now() - t < 40) { while (st.ckpt[k + 1]) k++; if (k * FX_CH >= st.n) { st.warming = false; return; } fxChunk(st, k); }
    later(step);
  };
  later(step);
}
// suono nel tratto [p0, p1) del blocco, per gli effetti lunghi (solo la parte richiesta, dai blocchi)
function fxLongRange(e, p0, p1) {
  const st = fxBase(e), L = new Float32Array(p1 - p0), R = new Float32Array(p1 - p0); if (!st) return { L, R };
  for (let k = Math.floor(p0 / FX_CH); k * FX_CH < p1 && k * FX_CH < st.n; k++) {
    const c = fxChunk(st, k), s = k * FX_CH;
    for (let p = Math.max(p0, s); p < p1 && p < s + c.L.length; p++) { L[p - p0] = c.L[p - s]; R[p - p0] = c.R[p - s]; }
  }
  return { L, R };
}
// si sente? no se è silenziato, oppure se c'è un altro effetto in solo
const fxAudible = e => !e.mute && (e.solo || !S.fx.some(x => x.solo));
// impronta degli effetti che abbassano la musica, per la cache del ducking (vuota se nessuno lo fa: chiave come prima)
const fxDuckKey = () => { const d = S.fx.filter(e => e.duck < 0 && fxAudible(e)); return d.length ? JSON.stringify(d.map(e => [e.at, fxSpan(e), e.duck])) : ''; };
// posizione stereo: guadagni dei due canali con somma delle potenze costante; al centro valgono esattamente 1, come prima
const FXMIX = { mono: false };                         // vero durante l'esportazione mono: la posizione non conta
function fxPanGains(p) {
  if (!p || FXMIX.mono) return [1, 1];
  const th = (clamp(p, -1, 1) + 1) * Math.PI / 4; return [Math.SQRT2 * Math.cos(th), Math.SQRT2 * Math.sin(th)];
}
// somma dell'effetto nel tratto [t0, t0 + n) del mix
function fxMixInto(e, t0, n, Lo, Ro) {
  const src = S.sources.get(e.src); if (!src || !fxAudible(e)) return;
  const g0 = dbToGain(e.gainDb + P.fxDb), [pl, pr] = fxPanGains(e.pan), gl = g0 * pl, gr = g0 * pr;
  if (fxPlain(e)) {
    const a = Math.max(t0, e.at), b = Math.min(t0 + n, e.at + src.len); if (b <= a) return;
    const l = src.chs[0], r = src.chs[1] || l;
    for (let t = a; t < b; t++) { Lo[t - t0] += l[t - e.at] * gl; Ro[t - t0] += r[t - e.at] * gr; }
    return;
  }
  const span = fxSpan(e), a = Math.max(t0, e.at), b = Math.min(t0 + n, e.at + span); if (b <= a) return;
  if (span > FX_LONG) {
    // effetto lungo: solo i blocchi da 10 s che servono; in ascolto si prepara il successivo nei momenti liberi
    const st = fxBase(e); if (!st) return;
    let k = Math.floor((a - e.at) / FX_CH);
    for (; e.at + k * FX_CH < b; k++) {
      const c = fxChunk(st, k), s0 = e.at + k * FX_CH;
      for (let t = Math.max(a, s0); t < b && t < s0 + c.L.length; t++) { Lo[t - t0] += c.L[t - s0] * gl; Ro[t - t0] += c.R[t - s0] * gr; }
    }
    if (S.playing && k * FX_CH < st.n && !st.chunks.has(k) && !st.wait) { st.wait = true; const kk = k, go = () => { st.wait = false; if (FXB.get(e.id) === st) fxChunk(st, kk); }; if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 300 }); else setTimeout(go, 0); }
    return;
  }
  const c = fxRender(e); if (!c) return;
  for (let t = a; t < b; t++) { Lo[t - t0] += c.L[t - e.at] * gl; Ro[t - t0] += c.R[t - e.at] * gr; }
}
// picco dell'originale intero, per disegnare la forma d'onda sempre alla stessa scala anche dopo un taglio
const FXPK = new Map();
// pulizia delle cache degli effetti: si tolgono il suono calcolato degli effetti che non ci sono più (eliminati, annullati,
// o con il file sorgente sparito) e i picchi dei file spariti; con all, tutto (un altro progetto). Il suono non cambia:
// se un effetto torna (Ripeti), si ricalcola uguale.
function fxCachePrune(all) {
  if (all) { FXR.clear(); FXPK.clear(); FXB.clear(); }
  else {
    // via anche le voci con parametri superati (l'effetto è cambiato): si ricalcolano uguali quando servono
    for (const C of [FXR, FXB]) for (const id of [...C.keys()]) { const e = S.fx.find(x => x.id === id); if (!e || !S.sources.has(e.src) || C.get(id).key !== fxKey(e) || (C === FXR && fxIsLong(e))) C.delete(id); }
    for (const e of S.fx) if (fxIsLong(e) && e.lp) fxWarm(e);
    for (const id of [...FXPK.keys()]) if (!S.sources.has(id)) FXPK.delete(id);
  }
  if (FXPV.id && !S.fx.some(x => x.id === FXPV.id)) stopFxPreview();
}
function fxSrcPeak(src) { let p = FXPK.get(src.id); if (p == null) { p = 1e-6; for (const c of src.chs) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > p) p = v; } FXPK.set(src.id, p); } return p; }
// effetto selezionato sulla timeline o nell'elenco: è quello che mostra il pannello
// nome e colore mostrati: quelli scelti, altrimenti il nome del file e il colore degli effetti
const fxName = e => e.name || (S.sources.get(e.src) || { name: '' }).name.replace(/\.[^.]+$/, '');
const FX_COLORS = [['fx', 'Viola'], ['fx2', 'Blu'], ['fx3', 'Verde'], ['fx4', 'Ruggine'], ['fx5', 'Rosa']];
// duplica: una copia identica subito dopo l'originale, che diventa la selezionata
function duplicateFx(e) {
  const id = uid(), copy = Object.assign({}, e, { id, at: e.at + fxSpan(e) }); delete copy.solo; S.fxSel = id;
  pushOp(Object.assign({ type: 'fxadd' }, copy, { label: 'Duplicato l’effetto “' + fxName(e) + '” a ' + fmtSec(copy.at) }));
}
// bordi delle pause della voce, in tempo del mix, per l'aggancio degli effetti: una pausa è un tratto di almeno 150 ms
// senza voce per RNNoise (se il riconoscimento è pronto) e con un livello basso
const FXSNAP = { key: '', edges: [] };
function voicePauseEdges() {
  const key = S.version + '|' + vadReady(); if (FXSNAP.key === key) return FXSNAP.edges;
  const edges = [], intro = layout().intro;
  if (S.vlen) {
    const L = blockLevels(rawVoice()), act = Array.from(L).filter(v => v > -100), vv = vadReady() ? voiceVad() : null;
    if (act.length > 20) {
      const sp = percentile(act, 0.9), quiet = b => (vv ? vv[b] < 0.4 && L[b] < sp - 20 : L[b] < sp - 25);
      for (let b = 0; b < L.length; b++) { if (!quiet(b)) continue; let e = b; while (e + 1 < L.length && quiet(e + 1)) e++; if (e - b + 1 >= 15) edges.push(intro + b * 480, intro + (e + 1) * 480); b = e; }
    }
  }
  FXSNAP.key = key; FXSNAP.edges = edges; return edges;
}
// anteprima: l'effetto selezionato da solo, con tutte le modifiche, volume e posizione (anche se è silenziato)
const FXPV = { node: null, id: null };
function stopFxPreview() { if (FXPV.node) { try { FXPV.node.stop(); } catch { } } FXPV.node = null; FXPV.id = null; const b = $('#fxPreview'); if (b) b.textContent = 'Ascolta l’effetto'; }
function fxPreview(e) {
  if (FXPV.id === e.id) { stopFxPreview(); return; }
  stopFxPreview(); if (S.playing) stopPlayback();
  const src = S.sources.get(e.src); if (!src) return;
  // effetto lungo: si ascolta il primo minuto, calcolato a blocchi
  const long = fxIsLong(e), c = fxPlain(e) ? { L: src.chs[0], R: src.chs[1] || src.chs[0] } : long ? fxLongRange(e, 0, Math.min(fxSpan(e), 60 * SR)) : fxRender(e), n = c.L.length;
  if (long) toast('Effetto lungo: l’anteprima fa sentire il primo minuto.');
  const g = dbToGain(e.gainDb + P.fxDb), [pl, pr] = fxPanGains(e.pan);
  const a = ctx(), buf = a.createBuffer(2, Math.max(1, n), SR), l = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { l[i] = c.L[i] * g * pl; r[i] = c.R[i] * g * pr; }
  buf.copyToChannel(l, 0); buf.copyToChannel(r, 1);
  const node = a.createBufferSource(); node.buffer = buf; node.connect(a.destination); node.onended = () => { if (FXPV.node === node) stopFxPreview(); };
  FXPV.node = node; FXPV.id = e.id; node.start(); const b = $('#fxPreview'); if (b) b.textContent = 'Ferma l’ascolto';
}
function selectFx(id) { if (S.fxSel === id) return; S.fxSel = id; renderFxList(); drawBase(); }

// campi che una modifica può impostare; null toglie il campo (torna al valore neutro)
const FX_FIELDS = ['at', 'gainDb', 'in', 'out', 'len', 'loop', 'fadeIn', 'fadeOut', 'env', 'pan', 'rate', 'rev', 'lp', 'name', 'color', 'mute', 'solo', 'duck'];
function fxApplySet(e, set) { for (const k of FX_FIELDS) if (k in set) { if (set[k] == null || set[k] === false || ((k === 'fadeIn' || k === 'fadeOut') && !(set[k] > 0)) || (k === 'env' && !set[k].length) || (k === 'pan' && !set[k]) || (k === 'rate' && set[k] === 1) || (k === 'lp' && !set[k]) || (k === 'name' && !String(set[k]).trim()) || (k === 'color' && set[k] === 'fx') || (k === 'duck' && !(set[k] < 0))) delete e[k]; else e[k] = k === 'env' ? set[k].map(p => p.slice()) : k === 'rev' ? { type: set[k].type, mix: set[k].mix } : set[k]; } if (e.gainDb == null) e.gainDb = 0; }

