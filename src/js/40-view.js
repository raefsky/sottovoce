/* ========================= Disegno della forma d'onda ========================= */
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// caratteri del canvas: gli stessi dell'interfaccia (numeri in Plex Mono)
const FONT_MONO = "11px 'IBM Plex Mono', ui-monospace, monospace", FONT_SANS = "12px 'IBM Plex Sans', system-ui, sans-serif";
function sizeCanvas(cv) {
  const dpr = window.devicePixelRatio || 1, w = cv.parentElement.clientWidth, h = cv.parentElement.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, W: w, H: h };
}
// altezze delle corsie: più basse sul telefono; con la timeline vuota resta un'area per lo stato iniziale
function geom() {
  const W = $('#wrap').clientWidth, small = window.innerWidth < 700, gap = 4;
  // la corsia degli effetti si alza di una fila per ogni livello di sovrapposizione (massimo 4 file)
  const rows = fxLayout().rows, ruler = small ? 20 : 24, vh = small ? 96 : 136, mh = S.musicId ? (small ? 44 : 58) : 0, fh = (S.fx.length || S.musicId) ? (small ? 32 : 40) + (rows - 1) * (small ? 14 : 18) : 0;
  let H = ruler + vh + (mh ? gap + mh : 0) + (fh ? gap + fh : 0) + 4;
  if (!layout().total) H = small ? 180 : 250;
  const vy = ruler, my = vy + vh + gap, fy = (mh ? my + mh + gap : vy + vh + gap);
  return { W, H, ruler, vy, vh, my, mh, fy, fh };
}
function fitWrapHeight() { const gm = geom(), w = $('#wrap'); if (parseInt(w.style.height) !== gm.H) w.style.height = gm.H + 'px'; }
const span = () => Math.max(1, S.view[1] - S.view[0]);
const xOfT = (t, W) => (t - S.view[0]) / span() * W;
const tOfX = (x, W) => S.view[0] + x / W * span();
function niceStep(sec, W) { const target = sec / (W / 95), steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]; for (const s of steps) if (s >= target) return s; return 3600; }
function vScale(which) {
  const z = +P.vzoom;
  if (z > 0) return z;
  const pk = voicePeak(which === 'proc');
  return pk > 0 ? clamp(0.92 / pk, 1, 64) : 1;
}

function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// etichetta della corsia: quadratino del colore della traccia, nome e un dettaglio in grigio
function laneLabel(g, x, y, color, name, extra, cLane, cInk, cMut) {
  g.font = FONT_SANS; const w1 = g.measureText(name).width, w2 = extra ? g.measureText(extra).width + 8 : 0;
  g.fillStyle = cLane; g.globalAlpha = 0.86; rrect(g, x - 4, y - 12, 22 + w1 + w2, 18, 4); g.fill(); g.globalAlpha = 1;
  g.fillStyle = color; rrect(g, x, y - 7, 8, 8, 2); g.fill();
  g.fillStyle = cInk; g.fillText(name, x + 14, y);
  if (extra) { g.fillStyle = cMut; g.fillText(extra, x + 22 + w1, y); }
}
// forma d'onda piena: barre speculari arrotondate, una ogni 3 pixel
function drawBars(g, W, cy, half, color, peakAt, x0) {
  g.fillStyle = color; x0 = x0 || 0;
  for (let x = 0; x < W; x += 3) {
    const a = peakAt(x, x + 3); if (a <= 0) continue;
    const h = Math.max(1, clamp(a, 0, 1) * half);
    rrect(g, x0 + x, cy - h, 2, 2 * h, 1); g.fill();
  }
}
function drawBase() {
  fitWrapHeight();
  const cv = $('#cvBase'), { g, W, H } = sizeCanvas(cv), gm = geom(), lay = layout();
  const cLane = cssv('--lane'), cLane2 = cssv('--lane2'), cMut = cssv('--muted'), cLine = cssv('--line'), cInk = cssv('--ink'), cBg = cssv('--bg');
  g.clearRect(0, 0, W, H);
  $('#emptyHint').hidden = !!lay.total;
  if (P.specView !== 'off') scheduleSpec(250);   // ricalcola solo se è cambiato qualcosa, altrimenti ridisegna
  if (!lay.total) return;
  // corsie
  g.fillStyle = cLane; rrect(g, 0, gm.vy, W, gm.vh, 4); g.fill();
  if (gm.mh) { rrect(g, 0, gm.my, W, gm.mh, 4); g.fill(); }
  if (gm.fh) { rrect(g, 0, gm.fy, W, gm.fh, 4); g.fill(); }
  if (S.fit) S.view = [0, Math.max(lay.total, SR)];
  const sp = span(), v0 = S.view[0], step = niceStep(sp / SR, W), spp = sp / W, r = [0, 0];
  // righello dei tempi
  g.font = FONT_MONO; g.lineWidth = 1;
  for (let i = Math.ceil(v0 / SR / step); i * step * SR <= S.view[1]; i++) {
    const t = i * step * SR, x = Math.round(xOfT(t, W)) + 0.5;
    g.strokeStyle = cLine; g.beginPath(); g.moveTo(x, gm.ruler - 6); g.lineTo(x, gm.ruler - 1); g.stroke();
    g.globalAlpha = 0.45; g.beginPath(); g.moveTo(x, gm.ruler); g.lineTo(x, H); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = cMut; g.fillText(fmtTime(i * step, step < 0.1 ? 2 : step < 1 ? 1 : 0).replace(/,0+$/, ''), x + 4, gm.ruler - 9);
  }
  // voce
  const which = BL.on ? 'orig' : S.mode, useProc = which === 'proc', cy = gm.vy + gm.vh / 2, half = gm.vh / 2 - 10, k = vScale(which), cV = cssv('--voice');
  if (lay.intro) { g.fillStyle = cMut; g.globalAlpha = 0.07; g.fillRect(0, gm.vy, xOfT(lay.intro, W), gm.vh); g.globalAlpha = 1; }
  if (spp < 3) {
    // molto ingrandito: si disegnano i singoli campioni, già con dissolvenze e incroci
    const a = Math.floor(v0) - 1, n = Math.ceil(sp) + 3, d = renderVoice(a - lay.intro, n, useProc);
    g.strokeStyle = cV; g.lineWidth = 1.4; g.beginPath();
    for (let i = 0; i < n; i++) { const x = xOfT(a + i, W), y = cy - clamp(d[i] * k, -1, 1) * half; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke(); g.lineWidth = 1;
  } else if (S.segs.length) {
    drawBars(g, W, cy, half, cV, (xa, xb) => {
      const ta = v0 + xa * spp - lay.intro, tb = v0 + xb * spp - lay.intro;
      if (tb <= 0 || ta >= S.vlen) return 0;
      let pk = 0;
      for (let i = segIndexAt(Math.max(0, ta)); i < S.segs.length && S.segT[i] < tb; i++) {
        const sgm = S.segs[i], T = S.segT[i]; if (T + sgm.len <= ta || !sgm.src) continue;
        const pa = Math.max(ta, T) - T, pb = Math.min(tb, T + sgm.len) - T;
        minMax(voiceData(sgm.src, useProc), sgm.s + pa, sgm.s + pb, r);
        const gg = (sgm.f.length ? fadeGain(sgm.f, (pa + pb) / 2) : 1) * srcGain(sgm.src, useProc);
        pk = Math.max(pk, -r[0] * gg, r[1] * gg);
      }
      return pk * k;
    });
  }
  // punti di taglio e silenzi inseriti
  g.save(); g.setLineDash([3, 3]); g.strokeStyle = cMut; g.globalAlpha = 0.7;
  for (let i = 0; i < S.segs.length; i++) {
    const sgm = S.segs[i], T = S.segT[i] + lay.intro;
    if (!sgm.src) { const x1 = xOfT(T, W), x2 = xOfT(T + sgm.len, W); g.fillStyle = cMut; g.globalAlpha = 0.1; g.fillRect(x1, gm.vy, x2 - x1, gm.vh); g.globalAlpha = 0.7; }
    if (i && !contiguous(S.segs[i - 1], sgm)) { const x = Math.round(xOfT(T, W)) + 0.5; if (x > 0 && x < W) { g.beginPath(); g.moveTo(x, gm.vy); g.lineTo(x, gm.vy + gm.vh); g.stroke(); } }
  }
  g.restore();
  laneLabel(g, 10, gm.vy + 16, cV, 'Voce', BL.on ? 'alla cieca' : (which === 'proc' ? 'migliorata' : 'originale') + (k !== 1 ? ', altezza × ' + fmtNum(k, k < 10 ? 1 : 0) : ''), cLane, cInk, cMut);
  // musica: ampiezza con il livello e il ducking, e la linea tratteggiata del volume
  if (gm.mh) {
    const m = S.sources.get(S.musicId), C = musicCurves(which), off = Math.round(P.musicOffset * SR), my = gm.my + gm.mh / 2, mhalf = gm.mh / 2 - 6;
    const mk = 0.9 / Math.max(1e-6, peaksOfMusic(m)), base = dbToGain(P.musicDb || 0);
    drawBars(g, W, my, mhalf, cssv('--music'), (xa, xb) => {
      const ta = v0 + xa * spp, tb = v0 + xb * spp; if (ta >= lay.total || tb <= 0) return 0;
      let a = ta + off, b = tb + off;
      if (P.loop) { a = ((a % m.len) + m.len) % m.len; b = a + (tb - ta); if (b > m.len) b = m.len; } else if (a >= m.len) return 0;
      minMax(m.chs[0], a, b, r);
      const gg = C.gain[Math.min(C.gain.length - 1, Math.max(0, Math.floor((ta + tb) / 2 / 480)))] / base;
      return Math.max(-r[0], r[1]) * mk * gg;
    });
    g.strokeStyle = cssv('--duck'); g.lineWidth = 1.5; g.setLineDash([5, 3]); g.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const t = v0 + x * spp, db = C.duck[Math.min(C.duck.length - 1, Math.max(0, Math.floor(t / 480)))] + 0;
      const y = gm.my + 5 + (gm.mh - 10) * clamp(-db / 30, 0, 1);
      if (x) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke(); g.setLineDash([]); g.lineWidth = 1;
    laneLabel(g, 10, gm.my + 16, cssv('--music'), 'Musica', m.name, cLane, cInk, cMut);
  }
  // effetti: blocchi arrotondati con la forma d'onda del tratto usato e il nome; il selezionato ha il bordo e le maniglie
  if (gm.fh) {
    const cFx = cssv('--fx');
    const anySolo = S.fx.some(x => x.solo);
    for (const e0 of S.fx) {
      const e = DRAG.fx && DRAG.fx.id === e0.id ? DRAG.fx.prev : e0, src = S.sources.get(e.src); if (!src) continue;
      const span = fxSpan(e), box = fxBox(e, W), x1 = box.x1, x2 = box.x2; if (x2 < 0 || x1 > W) continue;
      const bw = Math.max(6, x2 - x1), y0 = box.y0, bh = box.bh, sel = S.fxSel === e0.id, cFx = cssv('--' + (e.color || 'fx'));
      const off = e.mute || (anySolo && !e.solo);      // non si sente: sbiadito
      g.globalAlpha = off ? 0.4 : 1;
      g.fillStyle = cFx; g.globalAlpha *= 0.22; rrect(g, x1, y0, bw, bh, 4); g.fill(); g.globalAlpha = off ? 0.4 : 1;
      const dry = fxDry(e), dw = dry / span * bw, dragging = DRAG.fx && DRAG.fx.id === e0.id;
      {   // forma d'onda: dal suono già calcolato; durante il trascinamento letta dall'originale, senza ricalcolare
        const pk = fxSrcPeak(src), spx = span / bw, c = dragging || fxPlain(e) || span > FX_LONG ? null : fxRender(e);   // effetto lungo: dall'originale, senza calcolarlo tutto
        const [a, b] = fxRange(e, src), rate = fxRate(e), seg = fxSeg(e, src), step = e.loop ? seg - Math.max(1, Math.min(Math.round(FX_XF * SR), seg >> 2)) : seg;
        const l = c ? c.L : src.chs[0], r = c ? c.R : (src.chs[1] || src.chs[0]);
        const idx = c ? (i => i) : (i => i < dry ? Math.min(b - 1, a + Math.round((e.loop ? i % step : i) * rate)) : -1);
        drawBars(g, bw, y0 + bh / 2, bh / 2 - 2, cFx, (p, q) => { let m = 0; const i0 = Math.floor(p * spx), i1 = Math.min(span, Math.ceil(q * spx)), st = Math.max(1, ((i1 - i0) / 48) | 0); for (let i = i0; i < i1; i += st) { const k = idx(i); if (k < 0) continue; const v = Math.max(Math.abs(l[k]), Math.abs(r[k])); if (v > m) m = v; } return m / pk; }, x1);
      }
      if (span > dry) { g.strokeStyle = cFx; g.setLineDash([4, 3]); g.lineWidth = 1; const xx = Math.round(x1 + dw) + 0.5; g.beginPath(); g.moveTo(xx, y0 + 2); g.lineTo(xx, y0 + bh - 2); g.stroke(); g.setLineDash([]); }   // inizio della coda del riverbero
      if (e.loop && span > 0) {          // giunture del loop: lineette tratteggiate
        const seg = fxSeg(e, src), step = seg - Math.max(1, Math.min(Math.round(FX_XF * SR), seg >> 2));
        g.strokeStyle = cInk; g.globalAlpha = 0.45; g.setLineDash([2, 3]); g.lineWidth = 1;
        for (let s = step; s < dry; s += step) { const xx = Math.round(x1 + s / span * bw) + 0.5; g.beginPath(); g.moveTo(xx, y0 + 2); g.lineTo(xx, y0 + bh - 2); g.stroke(); }
        g.setLineDash([]); g.globalAlpha = 1;
      }
      {   // dissolvenze: curva dal basso all'alto (entrata) e dall'alto al basso (uscita)
        const [fi, fo] = fxFades(e, dry), fiw = fi / span * bw, fow = fo / span * bw;
        g.strokeStyle = cInk; g.globalAlpha = 0.7; g.lineWidth = 1.2;
        const curve = (xa, w, up) => { if (w < 3) return; g.beginPath(); for (let k = 0; k <= 16; k++) { const u = k / 16, v = Math.sin(Math.PI / 2 * u) ** 2, yy = y0 + bh - 2 - (up ? v : 1 - v) * (bh - 4); if (k) g.lineTo(xa + u * w, yy); else g.moveTo(xa + u * w, yy); } g.stroke(); };
        curve(x1, fiw, true); curve(x1 + dw - fow, fow, false); g.globalAlpha = 1;
        if (sel) { g.fillStyle = cInk; for (const hx of [x1 + fiw, x1 + dw - fow]) { rrect(g, hx - 4, y0 - 1, 8, 8, 2); g.fill(); } }
      }
      if (sel || (e.env && e.env.length)) {   // curva di volume: linea a 0 dB tratteggiata se non ci sono punti, punti sul selezionato
        const env = e.env || [], ey = d => fxEnvY(d, y0, bh);
        g.strokeStyle = cInk; g.lineWidth = 1.2; g.globalAlpha = env.length ? 0.85 : 0.35; if (!env.length) g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(x1, ey(fxEnvAt(env, 0)));
        for (const [pt, pd] of env) g.lineTo(x1 + pt * SR / span * bw, ey(pd));
        g.lineTo(x1 + dw, ey(fxEnvAt(env, dry / SR))); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        if (sel) env.forEach(([pt, pd], k) => { const px = x1 + pt * SR / span * bw, py = ey(pd), out = DRAG.fx && DRAG.fx.remove === k; g.fillStyle = out ? cMut : cInk; g.beginPath(); g.arc(px, py, 4, 0, 2 * Math.PI); g.fill(); g.fillStyle = cLane; g.beginPath(); g.arc(px, py, 1.6, 0, 2 * Math.PI); g.fill(); });
      }
      g.globalAlpha = 1;
      if (e.mute) { g.strokeStyle = cMut; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x1 + 3, y0 + bh - 3); g.lineTo(x1 + bw - 3, y0 + 3); g.stroke(); }   // silenziato: barrato
      g.strokeStyle = sel ? cInk : cFx; g.lineWidth = sel ? 1.5 : 1; rrect(g, x1 + 0.5, y0 + 0.5, bw - 1, bh - 1, 4); g.stroke();
      if (sel) { const hh = Math.min(14, bh - 4); g.fillStyle = cInk; rrect(g, x1 + 2, y0 + bh / 2 - hh / 2, 3, hh, 1.5); g.fill(); rrect(g, x1 + bw - 5, y0 + bh / 2 - hh / 2, 3, hh, 1.5); g.fill(); }
      g.font = FONT_SANS; const nm = (e.solo ? 'Solo · ' : e.mute ? 'Muto · ' : '') + fxName(e) + (e.pan ? (e.pan < 0 ? ' · S ' : ' · D ') + Math.round(Math.abs(e.pan) * 100) : ''), tw = g.measureText(nm).width;   // con la posizione stereo: S o D e la percentuale
      if (tw + 18 <= bw) { g.fillStyle = cLane; g.globalAlpha = 0.8; rrect(g, x1 + 8, y0 + 1, tw + 6, Math.min(15, bh - 2), 3); g.fill(); g.globalAlpha = 1; g.fillStyle = cInk; g.fillText(nm, x1 + 11, y0 + Math.min(12, bh - 3)); }
      else { g.fillStyle = cInk; g.fillText(nm, x1 + bw + 6, y0 + bh / 2 + 4); }   // blocco corto: il nome accanto
    }
    if (!S.fx.length) { g.fillStyle = cMut; g.font = FONT_SANS; g.fillText('Effetti: nessuno', 10, gm.fy + gm.fh / 2 + 4); }
    else if (!S.fx.some(e => xOfT(e.at, W) < 90 && xOfT(e.at + fxSpan(e), W) > 0)) laneLabel(g, 10, gm.fy + gm.fh / 2 + 4, cFx, 'Effetti', '', cLane, cInk, cMut);
  }
  updateScroll();
}
const musicPeakCache = new WeakMap();
function peaksOfMusic(m) { let p = musicPeakCache.get(m); if (p == null) { p = samplePeak(m.chs); musicPeakCache.set(m, p); } return p; }

function drawTop() {
  const cv = $('#cvTop'), { g, W, H } = sizeCanvas(cv), gm = geom(), lay = layout();
  g.clearRect(0, 0, W, H);
  if (!lay.total) return;
  const lanesH = H - gm.ruler - 4;
  // selezione: riempimento ambra al 16 % e due bordi pieni
  if (S.sel && S.sel[1] > S.sel[0]) {
    const x1 = xOfT(S.sel[0], W), x2 = xOfT(S.sel[1], W), sel = cssv('--sel');
    g.globalAlpha = 0.16; g.fillStyle = sel; g.fillRect(x1, gm.ruler, x2 - x1, lanesH); g.globalAlpha = 1;
    g.fillStyle = sel; g.fillRect(Math.round(x1) - 1, gm.ruler, 1.5, lanesH); g.fillRect(Math.round(x2) - 0.5, gm.ruler, 1.5, lanesH);
  }
  // anteprima di "Crea silenzio": il tratto della voce appare già piatto, con la stessa durata
  if (EB.preview && S.sel && S.sel[1] > S.sel[0]) {
    const x1 = Math.max(0, xOfT(S.sel[0], W)), x2 = Math.min(W, xOfT(S.sel[1], W)), cy = gm.vy + gm.vh / 2;
    if (x2 > x1) {
    g.fillStyle = cssv('--bg'); g.globalAlpha = 0.9; g.fillRect(x1, gm.vy, x2 - x1, gm.vh); g.globalAlpha = 1;
    g.fillStyle = cssv('--sel'); g.fillRect(x1, cy - 0.75, x2 - x1, 1.5);
    g.font = '500 12px ' + cssv('--f-sans'); g.textAlign = 'center'; g.fillStyle = cssv('--ink');
    if (x2 - x1 > 90) g.fillText('Silenzio, stessa durata', (x1 + x2) / 2, cy - 8); g.textAlign = 'start';
    }
  }
  if (S.recording) {
    const x0 = xOfT(REC.at + lay.intro, W), per = 4096, cy = gm.vy + gm.vh / 2, half = gm.vh / 2 - 10;
    g.fillStyle = cssv('--rec'); g.globalAlpha = 0.12; g.fillRect(x0, gm.vy, xOfT(REC.at + lay.intro + REC.len, W) - x0, gm.vh); g.globalAlpha = 0.9;
    for (let i = 0; i < REC.pks.length; i++) {
      const xa = xOfT(REC.at + lay.intro + i * per, W), xb = xOfT(REC.at + lay.intro + (i + 1) * per, W); if (xb < 0 || xa > W) continue;
      const h = clamp(REC.pks[i] * vScale('orig'), 0, 1) * half; g.fillRect(xa, cy - h, Math.max(1, xb - xa), 2 * h);
    }
    g.globalAlpha = 1;
  }
  // cursore di lettura: linea di 1,5 px con la testina a triangolo nel righello
  const pos = S.playing ? playPos() : S.recording ? REC.at + lay.intro + REC.len : S.cur, x = xOfT(pos, W);
  if (S.playing && S.cur !== pos) { const xc = xOfT(S.cur, W); g.fillStyle = cssv('--muted'); g.globalAlpha = 0.6; g.fillRect(Math.round(xc), gm.ruler, 1, lanesH); g.globalAlpha = 1; }
  if (x >= -6 && x <= W + 6) {
    g.fillStyle = S.recording ? cssv('--rec') : cssv('--ink'); g.fillRect(x - 0.75, gm.ruler - 2, 1.5, H - gm.ruler);
    g.beginPath(); g.moveTo(x - 5.5, gm.ruler - 9); g.lineTo(x + 5.5, gm.ruler - 9); g.lineTo(x, gm.ruler - 1); g.closePath(); g.fill();
  }
  const tl = $('#cvTop'); tl.setAttribute('aria-valuemax', String(Math.round(lay.total / SR * 10) / 10)); tl.setAttribute('aria-valuenow', String(Math.round(pos / SR * 10) / 10));
  tl.setAttribute('aria-valuetext', 'Cursore a ' + fmtSec(S.cur) + ' su ' + fmtSec(lay.total) + (S.sel ? ', selezione da ' + fmtSec(S.sel[0]) + ' a ' + fmtSec(S.sel[1]) : ''));
}
function drawAll() { drawBase(); drawTop(); updateSelInfo(); }

/* ---------- vista: zoom e scorrimento ---------- */
function setView(a, b) {
  const lay = layout(), T = Math.max(lay.total, SR);
  let sp = clamp(b - a, 64, T), v0 = a;
  if (v0 < 0) v0 = 0; if (v0 + sp > T) v0 = Math.max(0, T - sp);
  S.view = [v0, v0 + sp]; S.fit = sp >= T - 1; drawBase(); drawTop();
}
function zoomAt(f, center) { const sp = span() * f, c = center == null ? (S.playing ? playPos() : (S.view[0] + S.view[1]) / 2) : center, k = (c - S.view[0]) / span(); setView(c - k * sp, c - k * sp + sp); }
function fitView() { S.fit = true; drawBase(); drawTop(); }
function zoomSel() { if (S.sel) { const m = (S.sel[1] - S.sel[0]) * 0.05; setView(S.sel[0] - m, S.sel[1] + m); } }
function followPlayhead(pos) {
  const sp = span(), lay = layout(); if (S.fit || sp >= lay.total) return;
  if (pos > S.view[1] || pos < S.view[0]) { const a = clamp(pos - sp * 0.05, 0, Math.max(0, lay.total - sp)); S.view = [a, a + sp]; drawBase(); }
}
function updateScroll() {
  const lay = layout(), h = $('#hscroll'), T = Math.max(lay.total, 1), sp = span();
  h.disabled = S.fit || sp >= T; h.hidden = !lay.total;
  h.value = String(Math.round(T - sp > 0 ? S.view[0] / (T - sp) * 1000 : 0)); sliderFill(h);
}

/* ---------- mouse, trackpad e tastiera sulla forma d'onda ---------- */
const DRAG = { on: false, x0: 0, y0: 0, moved: false, fx: null, seek: false, wasPlaying: false };
// zona in cui trascinare sposta il cursore invece di selezionare: la riga dei tempi in alto e la linea del cursore
function seekZone(x, y, W) { const gm = geom(), cx = xOfT(S.playing ? playPos() : S.cur, W); return y < gm.ruler || Math.abs(x - cx) <= 6; }
function laneAt(y) { const gm = geom(); if (gm.fh && y >= gm.fy && y < gm.fy + gm.fh) return 'fx'; if (gm.mh && y >= gm.my && y < gm.my + gm.mh) return 'music'; return 'voice'; }
// file della corsia effetti: un effetto va nella prima fila libera nel suo tempo; con più di 4 sovrapposti si condivide l'ultima
function fxLayout() {
  const row = new Map(), ends = [];
  for (const e of S.fx.slice().sort((p, q) => p.at - q.at)) {
    let r = ends.findIndex(t => t <= e.at); if (r < 0) r = Math.min(ends.length, 3);
    row.set(e.id, r); ends[r] = Math.max(ends[r] || 0, e.at + fxSpan(e));
  }
  return { row, rows: Math.max(1, ends.length) };
}
// rettangolo di un effetto sulla timeline
function fxBox(e, W) {
  const gm = geom(), lay = fxLayout(), r = lay.row.get(e.id) || 0, rh = (gm.fh - 10) / lay.rows;
  return { x1: xOfT(e.at, W), x2: xOfT(e.at + fxSpan(e), W), y0: gm.fy + 5 + r * rh, bh: rh - (lay.rows > 1 ? 2 : 0) };
}
function fxAt(t, y) {
  const W = $('#cvTop').clientWidth;
  for (let i = S.fx.length - 1; i >= 0; i--) { const e = S.fx[i]; if (t >= e.at && t < e.at + fxSpan(e)) { if (y == null) return e; const b = fxBox(e, W); if (y >= b.y0 - 2 && y <= b.y0 + b.bh + 2) return e; } }
  return null;
}
// effetto e azione sotto il puntatore: vicino a un bordo si accorcia o si allunga, dentro si sposta (prima il selezionato)
// curva di volume sul blocco: +6 dB in alto, -40 dB in basso
const fxEnvY = (d, y0, bh) => y0 + 2 + (FX_ENV_TOP - clamp(d, FX_ENV_BOT, FX_ENV_TOP)) / (FX_ENV_TOP - FX_ENV_BOT) * (bh - 4);
const fxEnvDb = (y, y0, bh) => Math.round(clamp(FX_ENV_TOP - (y - y0 - 2) / (bh - 4) * (FX_ENV_TOP - FX_ENV_BOT), FX_ENV_BOT, FX_ENV_TOP) * 2) / 2;
function fxHit(x, W, touch, y) {
  const tol = touch ? 14 : 7;
  // punti della curva di volume del selezionato: vengono prima di tutto il resto
  const sv = S.fx.find(e => e.id === S.fxSel);
  if (sv && sv.env && y != null) {
    const bx = fxBox(sv, W), y0 = bx.y0, bh = bx.bh, span = fxSpan(sv), x1 = bx.x1, bw = bx.x2 - x1;
    for (let k = 0; k < sv.env.length; k++) { const px = x1 + sv.env[k][0] * SR / span * bw, py = fxEnvY(sv.env[k][1], y0, bh); if (Math.abs(x - px) <= tol && Math.abs(y - py) <= tol) return { e: sv, mode: 'env', k }; }
  }
  // maniglie delle dissolvenze, solo sull'effetto selezionato, nella fascia alta del blocco
  const se = S.fx.find(e => e.id === S.fxSel);
  if (se && y != null) {
    const bx = fxBox(se, W), y0 = bx.y0, span = fxSpan(se), dry = fxDry(se), [fi, fo] = fxFades(se, dry), x1 = bx.x1, x2 = bx.x2;
    if (y >= y0 - 6 && y <= y0 + Math.min(touch ? 16 : 10, bx.bh / 2)) {
      const hi = x1 + fi / span * (x2 - x1), ho = x1 + (dry - fo) / span * (x2 - x1);
      if (Math.abs(x - hi) <= tol && Math.abs(x - hi) <= Math.abs(x - ho)) return { e: se, mode: 'fadeIn' };
      if (Math.abs(x - ho) <= tol) return { e: se, mode: 'fadeOut' };
    }
  }
  const list = S.fx.slice().sort((p, q) => (p.id === S.fxSel) - (q.id === S.fxSel));
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i], bx = fxBox(e, W), x1 = bx.x1, x2 = bx.x2;
    if (y != null && (y < bx.y0 - 2 || y > bx.y0 + bx.bh + 2)) continue;
    if (x2 - x1 > 2 * tol || e.id === S.fxSel) { if (Math.abs(x - x1) <= tol) return { e, mode: 'left' }; if (Math.abs(x - x2) <= tol) return { e, mode: 'right' }; }
  }
  const e = fxAt(tOfX(x, W), y); return e ? { e, mode: 'move' } : null;
}
// trascinamento di un bordo: nuovo inizio o nuova fine del tratto usato, senza toccare il file originale
function fxDragTo(f, t, y) {
  const s = f.start, src = S.sources.get(s.src), p = Object.assign({}, s), [a0, b0] = fxRange(s, src), min = Math.round(FX_MIN * SR);
  if (f.mode === 'move') {
    p.at = Math.max(0, t - f.grab);
    // aggancio ai bordi delle pause della voce: l'inizio o la fine del blocco, se arriva entro 8 pixel
    if (P.fxSnap) {
      const tol = span() / $('#cvTop').clientWidth * 8, len = fxSpan(s); let best = null;
      for (const ed of voicePauseEdges()) for (const d of [ed - p.at, ed - (p.at + len)]) if (Math.abs(d) <= tol && (best == null || Math.abs(d) < Math.abs(best))) best = d;
      if (best != null) p.at = Math.max(0, Math.round(p.at + best));
    }
  }
  else if (f.mode === 'env') {
    // punto della curva: si sposta tra i suoi vicini; portato ben fuori dal blocco, al rilascio si toglie
    const bx = fxBox(s, $('#cvTop').clientWidth), y0 = bx.y0, bh = bx.bh, env = s.env.map(q => q.slice()), k = f.k, span = fxDry(s) / SR;
    const lo = k > 0 ? env[k - 1][0] + 0.001 : 0, hi = k < env.length - 1 ? env[k + 1][0] - 0.001 : span;
    f.remove = (y < y0 - 18 || y > y0 + bh + 18) ? k : null;
    env[k] = [Math.round(clamp((t - s.at) / SR, lo, hi) * 1000) / 1000, fxEnvDb(y, y0, bh)];
    p.env = f.remove != null ? env.filter((q, j) => j !== k) : env;
  }
  else if (f.mode === 'fadeIn' || f.mode === 'fadeOut') {
    const span = fxDry(s), other = f.mode === 'fadeIn' ? (s.fadeOut || 0) : (s.fadeIn || 0), v = f.mode === 'fadeIn' ? t - s.at : s.at + span - t;
    p[f.mode] = Math.round(clamp(v / SR, 0, Math.max(0, span / SR - other)) * 1000) / 1000;
  }
  else if (f.mode === 'right') {
    // il bordo destro è la fine della coda del riverbero: la parte asciutta finisce prima
    const rate = fxRate(s), ns = Math.max(min, t - s.at - fxTail(s));
    if (s.loop) p.len = ns / SR;
    else { p.out = (a0 + Math.min(Math.round(ns * rate), src.len - a0)) / SR; delete p.len; }
  } else {
    // spostando l'inizio di d campioni sulla timeline, nel file ci si sposta di d volte la velocità
    const rate = fxRate(s); let d = clamp(t - s.at, -a0 / rate, (b0 - min * rate - a0) / rate); if (s.at + d < 0) d = -s.at; d = Math.round(d);
    p.in = (a0 + Math.round(d * rate)) / SR; p.at = s.at + d; if (p.out == null) p.out = b0 / SR;
    if (s.len != null) p.len = Math.max(FX_MIN, s.len - d / SR);
  }
  f.prev = p;
}
function initTimeline() {
  const top = $('#cvTop'), W = () => top.clientWidth;
  const pt = e => { const r = top.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  top.addEventListener('pointerdown', e => {
    const lay = layout(); if (!lay.total || S.recording) return;
    top.focus({ preventScroll: true });
    const { x, y } = pt(e), t = clamp(Math.round(tOfX(x, W())), 0, lay.total);
    top.setPointerCapture(e.pointerId);
    DRAG.on = true; DRAG.x0 = x; DRAG.y0 = y; DRAG.moved = false; DRAG.fx = null; DRAG.seek = false;
    // sulla corsia degli effetti i blocchi e i loro bordi vengono prima della linea del cursore
    const hit = laneAt(y) === 'fx' && y >= geom().ruler ? fxHit(x, W(), e.pointerType === 'touch', y) : null;
    if (!e.shiftKey && !hit && seekZone(x, y, W())) {
      DRAG.seek = true; DRAG.wasPlaying = S.playing; if (S.playing) stopPlayback();
      S.cur = t; S.anchor = t; S.sel = null; drawTop(); updateSelInfo(); return;
    }
    if (hit) { const h = hit; { const fx = h.e; selectFx(fx.id); DRAG.fx = { id: fx.id, mode: h.mode, k: h.k, grab: t - fx.at, start: Object.assign({}, fx), prev: Object.assign({}, fx) }; return; } }
    if (e.shiftKey && (S.sel || S.cur != null)) { const a = S.anchor; S.sel = [Math.min(a, t), Math.max(a, t)]; DRAG.moved = true; }
    else S.anchor = t;
    drawTop(); updateSelInfo();
  });
  top.addEventListener('pointermove', e => {
    if (!DRAG.on) {
      // la freccia del mouse mostra cosa succede trascinando
      const { x, y } = pt(e), lay = layout(); if (!lay.total) { top.style.cursor = 'default'; return; }
      const h = laneAt(y) === 'fx' ? fxHit(x, W(), false, y) : null;
      top.style.cursor = h ? (h.mode === 'move' ? 'grab' : h.mode === 'left' || h.mode === 'right' ? 'col-resize' : h.mode === 'env' ? 'move' : 'ew-resize') : seekZone(x, y, W()) ? 'ew-resize' : 'text';
      return;
    }
    const { x, y } = pt(e), lay = layout(), t = clamp(Math.round(tOfX(x, W())), 0, lay.total);
    if (DRAG.seek) { S.cur = t; S.anchor = t; drawTop(); updateSelInfo(); return; }
    if (Math.abs(x - DRAG.x0) > 3 || (DRAG.fx && DRAG.fx.mode === 'env' && Math.abs(y - DRAG.y0) > 3)) DRAG.moved = true;   // i punti della curva si spostano anche solo in verticale
    if (!DRAG.moved) return;
    if (DRAG.fx) { fxDragTo(DRAG.fx, t, y); drawBase(); return; }
    S.sel = [Math.min(S.anchor, t), Math.max(S.anchor, t)]; S.cur = S.sel[0];
    drawTop(); updateSelInfo();
  });
  const end = e => {
    if (!DRAG.on) return; DRAG.on = false;
    if (DRAG.seek) { DRAG.seek = false; if (DRAG.wasPlaying) { PB.selPlay = false; startPlayback(S.cur, layout().total); } updateButtons(); return; }
    if (DRAG.fx) {
      const f = DRAG.fx; DRAG.fx = null;
      const s = f.start, p = f.prev, src = S.sources.get(s.src), set = {};
      for (const k of ['at', 'in', 'out', 'len', 'fadeIn', 'fadeOut']) if (p[k] !== s[k]) set[k] = p[k] == null ? null : p[k];
      if (JSON.stringify(p.env || []) !== JSON.stringify(s.env || [])) set.env = p.env || null;
      if (!DRAG.moved || !Object.keys(set).length) drawBase();
      else if (f.mode === 'move') pushOp({ type: 'fxmove', id: f.id, at: p.at, label: 'Effetto “' + src.name + '” spostato a ' + fmtSec(p.at) });
      else if (f.mode === 'env') pushOp({ type: 'fxedit', id: f.id, set, label: 'Effetto “' + src.name + '”: ' + (f.remove != null ? 'tolto un punto della curva di volume' : 'curva di volume, punto a ' + fmtNum(p.env[f.k][0], 2) + ' s e ' + fmtNum(p.env[f.k][1], 1) + ' dB') });
      else if (f.mode === 'fadeIn' || f.mode === 'fadeOut') pushOp({ type: 'fxedit', id: f.id, set, label: 'Effetto “' + src.name + '”: ' + (f.mode === 'fadeIn' ? 'entrata graduale di ' : 'uscita graduale di ') + fmtNum(p[f.mode] || 0, 2) + ' s' });
      else { const longer = fxSpan(p) > fxSpan(s); pushOp({ type: 'fxedit', id: f.id, set, label: 'Effetto “' + src.name + '” ' + (longer ? 'allungato' : 'accorciato') + (f.mode === 'left' ? ' all’inizio' : ' alla fine') + ' (' + fmtNum(fxSpan(p) / SR, 2) + ' s)' }); }
      return;
    }
    if (!DRAG.moved) { S.cur = S.anchor; S.sel = null; if (S.playing) { PB.selPlay = false; startPlayback(S.cur, layout().total); } }
    else if (S.sel && S.sel[1] - S.sel[0] < 2) S.sel = null;
    drawTop(); updateSelInfo(); updateButtons();
  };
  top.addEventListener('pointerup', end); top.addEventListener('pointercancel', end);
  top.addEventListener('dblclick', e => {
    // doppio clic su un effetto: aggiunge un punto alla curva di volume dove si clicca
    { const { x, y } = pt(e), tm = tOfX(x, W()), fx = laneAt(y) === 'fx' ? fxAt(tm, y) : null;
      if (fx) { const bx = fxBox(fx, W()), span = fxDry(fx), rt = Math.round(clamp((tm - fx.at) / SR, 0, span / SR) * 1000) / 1000, d = fxEnvDb(y, bx.y0, bx.bh), src = S.sources.get(fx.src);
        const env = (fx.env || []).filter(q => Math.abs(q[0] - rt) > 0.001).concat([[rt, d]]).sort((p, q) => p[0] - q[0]);
        selectFx(fx.id); pushOp({ type: 'fxedit', id: fx.id, set: { env }, label: 'Effetto “' + src.name + '”: aggiunto un punto alla curva di volume (' + fmtNum(rt, 2) + ' s, ' + fmtNum(d, 1) + ' dB)' }); return; } }
    const lay = layout(), { x } = pt(e), t = tOfX(x, W()) - lay.intro;
    if (t < 0 || t >= S.vlen) return;
    // seleziona il pezzo tra due tagli
    let i = segIndexAt(t), a = i, b = i;
    while (a > 0 && contiguous(S.segs[a - 1], S.segs[a])) a--;
    while (b < S.segs.length - 1 && contiguous(S.segs[b], S.segs[b + 1])) b++;
    S.sel = [S.segT[a] + lay.intro, S.segT[b + 1] + lay.intro]; S.cur = S.sel[0]; S.anchor = S.sel[0];
    drawTop(); updateSelInfo(); updateButtons();
  });
  // rotellina: da sola scorre la pagina; con ⌘ o Ctrl (e con il pizzico del trackpad) fa zoom; in orizzontale scorre la forma d'onda
  top.addEventListener('wheel', e => {
    const lay = layout(); if (!lay.total) return;
    const r = top.getBoundingClientRect(), x = e.clientX - r.left;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(Math.exp(e.deltaY * (e.ctrlKey && !e.metaKey ? 0.01 : 0.002)), tOfX(x, r.width)); }
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) { e.preventDefault(); const d = (e.deltaX || e.deltaY) / r.width * span(); setView(S.view[0] + d, S.view[1] + d); }
  }, { passive: false });
  $('#hscroll').addEventListener('input', e => { const lay = layout(), sp = span(), v0 = (+e.target.value / 1000) * Math.max(0, lay.total - sp); S.fit = false; S.view = [v0, v0 + sp]; drawBase(); drawTop(); });
  new ResizeObserver(() => drawAll()).observe($('#wrap'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawAll(); });
  // trascinare un file sulla forma d'onda lo importa come voce
  const wrap = $('#wrap');
  ['dragenter', 'dragover'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); }));
  wrap.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) importVoice(f); });
}

/* ---------- comandi di montaggio ---------- */
// selezione e cursore sono in tempo del mix; le operazioni lavorano in tempo della voce
function selVoice() {
  if (!S.sel) return null;
  const lay = layout(), a = clamp(S.sel[0] - lay.intro, 0, S.vlen), b = clamp(S.sel[1] - lay.intro, 0, S.vlen);
  return b - a >= 1 ? [a, b] : null;
}
const rangeTxt = r => fmtSec(r[0]) + ' - ' + fmtSec(r[1]);
function needSel() { const r = selVoice(); if (!r) toast('Prima seleziona un tratto della voce: trascina sulla forma d’onda.'); return r; }
function doDelete() { const r = needSel(); if (!r) return; stopIfPlaying(); pushOp({ type: 'delete', a: r[0], b: r[1], label: 'Eliminato ' + rangeTxt(r) + ' (' + fmtDur((r[1] - r[0]) / SR) + ')' }); const lay = layout(); S.cur = r[0] + lay.intro; S.sel = null; drawAll(); }
function doCopy(silent) { const r = needSel(); if (!r) return null; S.clip = sliceRange(S.segs, r[0], r[1]); updateButtons(); if (!silent) toast('Copiato: ' + fmtDur((r[1] - r[0]) / SR) + '.'); return r; }
function doCut() { const r = doCopy(true); if (!r) return; stopIfPlaying(); pushOp({ type: 'delete', a: r[0], b: r[1], label: 'Tagliato ' + rangeTxt(r) + ' (' + fmtDur((r[1] - r[0]) / SR) + ')' }); const lay = layout(); S.cur = r[0] + lay.intro; S.sel = null; drawAll(); }
function doPaste() {
  if (!S.clip || !S.clip.length) { toast('Gli appunti sono vuoti: prima copia o taglia un tratto.'); return; }
  stopIfPlaying();
  const lay = layout(), len = segsLen(S.clip), r = selVoice();
  if (r) pushOp({ type: 'replace', a: r[0], b: r[1], clip: cloneSegs(S.clip), label: 'Incollato ' + fmtDur(len / SR) + ' al posto di ' + rangeTxt(r) });
  else { const at = clamp(S.cur - lay.intro, 0, S.vlen); pushOp({ type: 'insert', at, clip: cloneSegs(S.clip), label: 'Incollato ' + fmtDur(len / SR) + ' a ' + fmtSec(at) }); }
  const a = r ? r[0] : clamp(S.cur - lay.intro, 0, S.vlen);
  S.sel = [a + lay.intro, a + len + lay.intro]; S.cur = S.sel[0]; S.anchor = S.sel[0]; drawAll();
}
function doSilence() { const r = needSel(); if (!r) return; stopIfPlaying(); pushOp({ type: 'silence', a: r[0], b: r[1], label: 'Silenzio al posto di ' + rangeTxt(r) }); drawAll(); }
function doFade(dir) { const r = needSel(); if (!r) return; stopIfPlaying(); pushOp({ type: 'fade', a: r[0], b: r[1], dir, label: (dir === 'in' ? 'Dissolvenza in entrata ' : 'Dissolvenza in uscita ') + rangeTxt(r) }); drawAll(); }
function selectAll() { const lay = layout(); if (!S.vlen) return; S.sel = [lay.intro, lay.intro + S.vlen]; S.cur = S.sel[0]; S.anchor = S.sel[0]; drawTop(); updateSelInfo(); updateButtons(); }
function stopIfPlaying() { if (S.playing) stopPlayback(); }

function moveCursor(d, extend) {
  const lay = layout(); if (!lay.total) return;
  const t = clamp(Math.round((extend && S.sel ? (S.sel[0] === S.anchor ? S.sel[1] : S.sel[0]) : S.cur) + d), 0, lay.total);
  if (extend) { S.sel = [Math.min(S.anchor, t), Math.max(S.anchor, t)]; if (S.sel[1] - S.sel[0] < 1) S.sel = null; }
  else { S.cur = t; S.anchor = t; S.sel = null; }
  if (!extend) followPlayhead(S.cur); else followPlayhead(t);
  if (S.playing && !extend) startPlayback(S.cur, lay.total);
  drawTop(); updateSelInfo(); updateButtons();
}
function initKeys() {
  window.addEventListener('keydown', e => {
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if ($('dialog[open]')) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'x') { e.preventDefault(); doCut(); return; }
    if (mod && k === 'c') { if (S.sel) { e.preventDefault(); doCopy(); } return; }
    if (mod && k === 'v') { e.preventDefault(); doPaste(); return; }
    if (mod && k === 'a') { if (S.vlen) { e.preventDefault(); selectAll(); } return; }
    if (mod && k === 'l') { e.preventDefault(); doSilence(); return; }
    if (mod || e.altKey && !k.startsWith('arrow')) return;
    if (e.code === 'Space') { if (tag === 'BUTTON') return; e.preventDefault(); togglePlay(); return; }
    if (k === 'r' && !e.repeat) { e.preventDefault(); toggleRecord(); return; }
    if (k === 'delete' || k === 'backspace') { if (S.sel) { e.preventDefault(); doDelete(); } return; }
    if (k === 'escape') { if (S.recording) stopRecording(); else if (S.playing) { stopPlayback(); drawTop(); } else { S.sel = null; drawTop(); updateSelInfo(); updateButtons(); } return; }
    if (k === 'arrowright' || k === 'arrowleft') { e.preventDefault(); const step = e.altKey ? SR / 10 : SR; moveCursor((k === 'arrowright' ? 1 : -1) * step, e.shiftKey); return; }
    if (k === 'home') { e.preventDefault(); if (S.playing) startPlayback(0, layout().total); S.cur = 0; S.anchor = 0; if (!e.shiftKey) S.sel = null; followPlayhead(0); drawTop(); updateSelInfo(); return; }
    if (k === 'end') { e.preventDefault(); const T = layout().total; S.cur = T; S.anchor = T; S.sel = null; followPlayhead(T); drawTop(); updateSelInfo(); return; }
    if (k === '+' || k === '=') { e.preventDefault(); zoomAt(0.5); return; }
    if (k === '-') { e.preventDefault(); zoomAt(2); return; }
  });
}

