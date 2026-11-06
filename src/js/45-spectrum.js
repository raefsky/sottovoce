/* ========================= Spettro e spettrogramma ========================= */
// Vista in frequenza sotto la forma d'onda, a scelta: spettro medio della voce oppure spettrogramma del tratto visibile.
// Originale e migliorata a confronto, allo stesso volume d'ascolto; frequenze in scala logaritmica da 20 Hz a 20 kHz.
// Resta leggera: pochi fotogrammi FFT (240 per lo spettro medio, una colonna ogni 2 pixel per lo spettrogramma),
// calcolati a pezzi nei momenti liberi del browser; un calcolo nuovo annulla quello in corso e i risultati restano in memoria.
const SPEC = { t: null, job: 0, key: '', data: null, win: {} };
const SPEC_LO = 20, SPEC_HI = 20000, SPEC_DECADES = Math.log10(SPEC_HI / SPEC_LO);
const specFx = (f, W) => Math.log10(f / SPEC_LO) / SPEC_DECADES * W;      // frequenza -> pixel
const specFof = (x, W) => SPEC_LO * Math.pow(10, x / W * SPEC_DECADES);     // pixel -> frequenza
const specIdle = () => new Promise(r => window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 0));
function specWindow(N) { if (!SPEC.win[N]) { const w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); SPEC.win[N] = { w, fft: makeFFT(N) }; } return SPEC.win[N]; }
// potenza per ogni bin di un fotogramma di voce montata, al volume d'ascolto di quella versione
function specFrame(t, N, which, g) {
  const { w, fft } = specWindow(N), x = renderVoice(t, N, which === 'proc'), re = new Float64Array(N), im = new Float64Array(N);
  let e = 0; for (let i = 0; i < N; i++) { const v = x[i] * g; e += v * v; re[i] = v * w[i]; }
  fft(re, im, false);
  const p = new Float32Array(N / 2); for (let k = 0; k < N / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k];
  return { p, e };
}
function scheduleSpec(delay) {
  clearTimeout(SPEC.t);
  const box = $('#specBox'); if (box) box.hidden = P.specView === 'off' || !S.vlen;
  if (P.specView === 'off' || !S.vlen) { SPEC.job++; return; }
  SPEC.t = setTimeout(drawSpec, delay == null ? 400 : delay);
}
async function drawSpec() {
  const cv = $('#cvSpec'); if (!cv || P.specView === 'off' || !S.vlen) return;
  const gram = P.specView === 'gram', W = cv.parentElement.clientWidth, lay = layout();
  const vers = S.procActive ? ['orig', 'proc'] : ['orig'];
  const base = [S.version, S.procKey, S.procActive, P.xfadeMs, P.normEach, P.target, P.voiceNorm, P.match, P.specView].join('|');
  const key = gram ? base + '|' + Math.round(S.view[0]) + '|' + Math.round(S.view[1]) + '|' + W : base;
  if (SPEC.key !== key) {
    const job = ++SPEC.job, data = {};
    for (const which of vers) {
      const g = voiceGain(which);
      if (!gram) {
        // spettro medio: 240 fotogrammi da 4096 campioni sparsi su tutta la voce, tenendo i più forti (le pause non contano)
        const N = 4096, M = 240, fr = [];
        for (let k = 0; k < M; k++) {
          fr.push(specFrame(Math.round((k + 0.5) / M * Math.max(0, S.vlen - N)), N, which, g));
          if (k % 24 === 23) { await specIdle(); if (job !== SPEC.job) return; }
        }
        fr.sort((a, b) => b.e - a.e);
        const keep = fr.slice(0, Math.max(1, Math.round(M * 0.7))), avg = new Float32Array(N / 2);
        for (const f of keep) for (let k = 0; k < N / 2; k++) avg[k] += f.p[k] / keep.length;
        data[which] = { N, avg };
      } else {
        // spettrogramma del tratto visibile: una colonna ogni 2 pixel, fotogrammi da 2048 campioni
        const N = 2048, cols = Math.max(10, Math.min(600, Math.floor(W / 2))), v0 = S.view[0] - lay.intro, v1 = S.view[1] - lay.intro, colP = [];
        for (let c = 0; c < cols; c++) {
          const t = Math.round(v0 + (c + 0.5) / cols * (v1 - v0)) - N / 2;
          colP.push(t + N < 0 || t > S.vlen ? null : specFrame(t, N, which, g).p);
          if (c % 40 === 39) { await specIdle(); if (job !== SPEC.job) return; }
        }
        data[which] = { N, cols: colP };
      }
    }
    SPEC.key = key; SPEC.data = data;
  }
  paintSpec();
}
// colore dalla mappa del tema: fondo della corsia, poi accento, poi inchiostro per i punti più forti
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function paintSpec() {
  const cv = $('#cvSpec'), d = SPEC.data; if (!cv || !d) return;
  const gram = P.specView === 'gram', H = gram ? (d.proc ? 156 : 80) : 160;
  cv.parentElement.style.height = H + 'px';
  const { g, W } = sizeCanvas(cv), cLane = cssv('--lane'), cMut = cssv('--muted'), cLine = cssv('--line'), cInk = cssv('--ink'), cAcc = cssv('--accent');
  g.clearRect(0, 0, W, H); g.font = FONT_MONO;
  // nello spettro le frequenze sono in orizzontale (asse in basso); nello spettrogramma in orizzontale c'è il tempo,
  // allineato alla forma d'onda, e le frequenze sono in verticale
  const AX = gram ? 0 : 16, plotH = H - AX, ticks = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const tickLab = f => f >= 1000 ? (f / 1000) + 'k' : String(f);
  g.fillStyle = cLane; rrect(g, 0, 0, W, plotH, 4); g.fill();
  if (!gram) { g.fillStyle = cMut; g.textAlign = 'center'; for (const f of ticks) g.fillText(tickLab(f), specFx(f, W), H - 3); g.textAlign = 'left'; }
  const db = (p, N) => 10 * Math.log10(p / (N * N / 16) + 1e-20);      // 0 dB = sinusoide a fondo scala
  if (!gram) {
    // curva per pixel: media dei bin che cadono in quel pixel
    // dove un pixel è più stretto di un bin (le frequenze basse) si interpola tra i due bin vicini, così la curva non fa scalini
    const curve = v => { const out = new Float32Array(W), bw = SR / v.N; for (let x = 0; x < W; x++) {
      const fa = specFof(x, W) / bw, fb = specFof(x + 1, W) / bw;
      if (fb - fa < 1) { const c = Math.max(1, (fa + fb) / 2), k = Math.floor(c), t = c - k; out[x] = db(v.avg[k] * (1 - t) + (v.avg[k + 1] || v.avg[k]) * t, v.N); continue; }
      const a = Math.max(1, Math.floor(fa)), b = Math.max(a + 1, Math.ceil(fb)); let s = 0; for (let k = a; k < b && k < v.avg.length; k++) s += v.avg[k]; out[x] = db(s / (b - a), v.N); } return out; };
    const cu = {}; let top = -200; for (const w of Object.keys(d)) { cu[w] = curve(d[w]); for (const v of cu[w]) top = Math.max(top, v); }
    top = Math.ceil(top / 10) * 10; const range = 70, y = v => clamp((top - v) / range, 0, 1) * (plotH - 8) + 4;
    g.strokeStyle = cLine; g.lineWidth = 1;
    for (const f of ticks) { const x = Math.round(specFx(f, W)) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, plotH); g.stroke(); }
    for (let v = top - 10; v > top - range; v -= 20) { const yy = Math.round(y(v)) + 0.5; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); g.fillStyle = cMut; g.fillText(v + ' dB', 6, yy - 3); }
    const line = (arr, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let x = 0; x < W; x++) { const yy = y(arr[x]); if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); };
    line(cu.orig, cMut, 1.5); if (cu.proc) line(cu.proc, cAcc, 2);
  } else {
    // due fasce: sopra l'originale, sotto la migliorata; righe in scala logaritmica, 70 dB di dinamica
    const bands = d.proc ? ['orig', 'proc'] : ['orig'], gap = 4, bh = Math.floor((plotH - gap * (bands.length - 1)) / bands.length);
    let top = -200; for (const w of bands) for (const c of d[w].cols) if (c) for (let k = 1; k < c.length; k++) top = Math.max(top, db(c[k], d[w].N));
    const c0 = hexRgb(cLane), c1 = hexRgb(cAcc), c2 = hexRgb(cInk), mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    bands.forEach((w, bi) => {
      const v = d[w], cols = v.cols.length, img = g.createImageData(cols, bh), bw = SR / v.N, y0 = bi * (bh + gap);
      for (let r = 0; r < bh; r++) {
        const fa = specFof((bh - 1 - r) / bh * W, W), fb = specFof((bh - r) / bh * W, W), a = Math.max(1, Math.floor(fa / bw)), b = Math.max(a + 1, Math.ceil(fb / bw));
        for (let c = 0; c < cols; c++) {
          const col = v.cols[c], o = (r * cols + c) * 4; let s = 0;
          if (col) for (let k = a; k < b && k < col.length; k++) s += col[k];
          const t = col ? clamp((db(s / (b - a), v.N) - (top - 70)) / 70, 0, 1) : 0, rgb = t < 0.7 ? mix(c0, c1, t / 0.7) : mix(c1, c2, (t - 0.7) / 0.3);
          img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
        }
      }
      const off = document.createElement('canvas'); off.width = cols; off.height = bh; off.getContext('2d').putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true; g.drawImage(off, 0, y0, W, bh);
      g.fillStyle = cLane; g.globalAlpha = 0.86; rrect(g, 4, y0 + 4, w === 'orig' ? 78 : 86, 18, 4); g.fill(); g.globalAlpha = 1;
      g.fillStyle = cInk; g.font = FONT_SANS; g.fillText(w === 'orig' ? 'Originale' : 'Migliorata', 10, y0 + 17); g.font = FONT_MONO;
      // frequenze sulla fascia, a destra, su un fondino per leggerle sopra i colori
      for (const f of [100, 1000, 10000]) { const yy = y0 + bh - specFx(f, bh); g.fillStyle = cLane; g.globalAlpha = 0.86; rrect(g, W - 34, yy - 7, 30, 14, 3); g.fill(); g.globalAlpha = 1; g.fillStyle = cMut; g.fillText(tickLab(f), W - 30, yy + 4); }
    });
  }
  const note = $('#specNote');
  if (note) note.textContent = gram ? (d.proc ? 'Spettrogramma del tratto visibile: in alto l’originale, in basso la migliorata. Più intenso il colore, più forte il suono; in verticale le frequenze, da 20 Hz a 20 kHz.' : 'Spettrogramma del tratto visibile dell’originale. Dopo “Applica i miglioramenti” compare anche la migliorata.')
    : (d.proc ? 'Spettro medio della voce: grigio l’originale, colorata la migliorata, allo stesso volume d’ascolto.' : 'Spettro medio della voce originale. Dopo “Applica i miglioramenti” compare anche la migliorata.');
}

