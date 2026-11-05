/* ========================= Elaborazione del suono ========================= */
function makeFFT(N) {
  const levels = Math.round(Math.log2(N));
  const rev = new Uint32Array(N);
  for (let i = 0; i < N; i++) { let r = 0, x = i; for (let b = 0; b < levels; b++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
  const cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / N); sn[i] = Math.sin(2 * Math.PI * i / N); }
  return function fft(re, im, inverse) {
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const wr = cs[k], wi = inverse ? sn[k] : -sn[k];
          const l = j + half;
          const tr = re[l] * wr - im[l] * wi;
          const ti = re[l] * wi + im[l] * wr;
          re[l] = re[j] - tr; im[l] = im[j] - ti;
          re[j] += tr; im[j] += ti;
        }
      }
    }
    if (inverse) { for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; } }
  };
}

// Riduzione del rumore con filtro di Wiener "decision-directed" e stima dell'eco tardivo (da Rifinitura).
async function denoise(x, sr, range, reduceDb, alpha, reverb, onProg) {
  const N = 2048, H = 1024, half = N / 2;
  const fft = makeFFT(N);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = Math.sin(Math.PI * (i + 0.5) / N);
  const len = x.length;
  const re = new Float64Array(N), im = new Float64Array(N);
  const Ar = new Float64Array(half + 1), Ai = new Float64Array(half + 1);
  const Br = new Float64Array(half + 1), Bi = new Float64Array(half + 1);
  const noiseP = new Float64Array(half + 1);
  let nFr = 0;
  {
    const a = Math.max(0, Math.floor(range[0] * sr)), b = Math.min(len, Math.floor(range[1] * sr));
    const starts = [];
    for (let s = a; s + N <= b; s += H) starts.push(s);
    for (let i = 0; i < starts.length; i += 2) {
      const s1 = starts[i], s2 = (i + 1 < starts.length) ? starts[i + 1] : -1;
      for (let n = 0; n < N; n++) { re[n] = x[s1 + n] * win[n]; im[n] = s2 >= 0 ? x[s2 + n] * win[n] : 0; }
      fft(re, im, false);
      for (let k = 0; k <= half; k++) {
        const kk = (N - k) & (N - 1);
        const ar = (re[k] + re[kk]) / 2, ai = (im[k] - im[kk]) / 2;
        const br = (im[k] + im[kk]) / 2, bi = (re[kk] - re[k]) / 2;
        noiseP[k] += ar * ar + ai * ai;
        if (s2 >= 0) noiseP[k] += br * br + bi * bi;
      }
      nFr += s2 >= 0 ? 2 : 1;
    }
  }
  if (nFr < 3) throw new Error('Il tratto di rumore è troppo breve: serve almeno mezzo secondo di sola stanza.');
  for (let k = 0; k <= half; k++) noiseP[k] /= nFr;
  const out = new Float32Array(len);
  const gmin = Math.pow(10, -reduceDb / 20), DD = 0.95;
  const late = reverb > 0 ? reverb * Math.pow(10, -6 * (2 * H / sr) / 0.5) : 0;
  const raw = new Float64Array(half + 1), pw = new Float64Array(half + 1);
  const prevClean = new Float64Array(half + 1), hist1 = new Float64Array(half + 1), hist2 = new Float64Array(half + 1);
  const GA = new Float64Array(half + 1), GB = new Float64Array(half + 1);
  function gains(R, I, G) {
    for (let k = 0; k <= half; k++) {
      const p = R[k] * R[k] + I[k] * I[k]; pw[k] = p;
      const pn = noiseP[k] + late * hist2[k] + 1e-18;
      const gamma = p / pn;
      const xi = DD * prevClean[k] / pn + (1 - DD) * Math.max(gamma - 1, 0);
      let g = alpha <= 0 ? 1 : xi / (xi + alpha);
      if (g < gmin) g = gmin;
      raw[k] = g;
    }
    for (let k = 0; k <= half; k++) {
      const a = raw[k > 0 ? k - 1 : 0], c = raw[k < half ? k + 1 : half];
      G[k] = 0.25 * a + 0.5 * raw[k] + 0.25 * c;
    }
    for (let k = 0; k <= half; k++) { prevClean[k] = G[k] * G[k] * pw[k]; hist2[k] = hist1[k]; hist1[k] = pw[k]; }
  }
  const F = Math.ceil(len / H) + 1;
  let pair = 0;
  for (let f = 0; f < F; f += 2) {
    const s1 = (f - 1) * H, s2 = f * H, has2 = (f + 1) < F;
    for (let n = 0; n < N; n++) {
      const p1 = s1 + n; re[n] = (p1 >= 0 && p1 < len) ? x[p1] * win[n] : 0;
      const p2 = s2 + n; im[n] = (has2 && p2 >= 0 && p2 < len) ? x[p2] * win[n] : 0;
    }
    fft(re, im, false);
    for (let k = 0; k <= half; k++) {
      const kk = (N - k) & (N - 1);
      Ar[k] = (re[k] + re[kk]) / 2; Ai[k] = (im[k] - im[kk]) / 2;
      Br[k] = (im[k] + im[kk]) / 2; Bi[k] = (re[kk] - re[k]) / 2;
    }
    gains(Ar, Ai, GA);
    if (has2) gains(Br, Bi, GB); else GB.fill(1);
    for (let k = 0; k <= half; k++) {
      const kk = (N - k) & (N - 1);
      const ar = Ar[k] * GA[k], ai = Ai[k] * GA[k], br = Br[k] * GB[k], bi = Bi[k] * GB[k];
      re[k] = ar - bi; im[k] = ai + br;
      if (kk !== k) { re[kk] = ar + bi; im[kk] = br - ai; }
    }
    fft(re, im, true);
    for (let n = 0; n < N; n++) {
      const p1 = s1 + n; if (p1 >= 0 && p1 < len) out[p1] += re[n] * win[n];
      if (has2) { const p2 = s2 + n; if (p2 >= 0 && p2 < len) out[p2] += im[n] * win[n]; }
    }
    if ((++pair & 63) === 0) { if (onProg) onProg(f / F); await yieldUI(); }
  }
  return out;
}
function autoNoiseRange(d, sr) {
  const w = Math.round(0.1 * sr), n = Math.floor(d.length / w);
  if (n < 6) throw new Error('La registrazione è troppo corta per pulirla.');
  const e = new Float64Array(n);
  for (let s = 0; s < n; s++) { let sum = 0; for (let i = s * w; i < (s + 1) * w; i++) sum += d[i] * d[i]; e[s] = sum / w; }
  let best = -1, bestV = Infinity;
  for (let s = 0; s + 4 <= n; s++) { const v = e[s] + e[s + 1] + e[s + 2] + e[s + 3]; if (v > 4e-12 && v < bestV) { bestV = v; best = s; } }
  if (best < 0) best = 0;
  return [best * 0.1, best * 0.1 + 0.4];
}

/* ---------- misure ---------- */
// Volume integrato ITU-R BS.1770. I filtri di pesatura K si calcolano per la frequenza del segnale
// (a 48 kHz danno esattamente i coefficienti pubblicati nella norma).
// chs: elenco di canali. Con un solo canale e dual = true conta come mono su due casse (+3 dB), come Sottovoce.
const KW = {};
function kCoeffs(sr) {
  if (KW[sr]) return KW[sr];
  let K = Math.tan(Math.PI * 1681.974450955533 / sr), Q = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const b = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a = [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  K = Math.tan(Math.PI * 38.13547087602444 / sr); Q = 0.5003270373238773; a0 = 1 + K / Q + K * K;
  const h = [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  return (KW[sr] = { b, a, h });
}
function lufs(chs, dual, sr) {
  if (!Array.isArray(chs)) chs = [chs];
  sr = sr || SR;
  const { b: K1b, a: K1a, h: K2a } = kCoeffs(sr);
  const seg = Math.round(sr / 10), len = chs[0].length, nSeg = Math.floor(len / seg);
  if (nSeg < 4) return -100;
  const e = new Float64Array(nSeg), w = (chs.length === 1 && dual !== false) ? 2 : 1;
  for (const x of chs) {
    let a1 = 0, a2 = 0, c1 = 0, c2 = 0;
    for (let s = 0; s < nSeg; s++) {
      let sum = 0;
      for (let i = s * seg, end = i + seg; i < end; i++) {
        const v = x[i];
        const y1 = K1b[0] * v + a1; a1 = K1b[1] * v - K1a[0] * y1 + a2; a2 = K1b[2] * v - K1a[1] * y1;
        const y2 = y1 + c1; c1 = -2 * y1 - K2a[0] * y2 + c2; c2 = y1 - K2a[1] * y2;
        sum += y2 * y2;
      }
      e[s] += sum / seg * w;
    }
  }
  const nb = nSeg - 3, bl = new Float64Array(nb);
  for (let i = 0; i < nb; i++) bl[i] = (e[i] + e[i + 1] + e[i + 2] + e[i + 3]) / 4;
  const lu = v => -0.691 + 10 * Math.log10(v);
  let sum = 0, cnt = 0;
  for (let i = 0; i < nb; i++) if (bl[i] > 0 && lu(bl[i]) > -70) { sum += bl[i]; cnt++; }
  if (!cnt) return -100;
  const thr = lu(sum / cnt) - 10;
  sum = 0; cnt = 0;
  for (let i = 0; i < nb; i++) if (bl[i] > 0 && lu(bl[i]) > thr) { sum += bl[i]; cnt++; }
  return cnt ? lu(sum / cnt) : -100;
}
// Picco vero: valori tra un campione e l'altro stimati con sovracampionamento ×4 (sinc finestrato, 12 punti)
const TP_TAPS = (() => {
  const M = 6, out = [];
  for (let p = 1; p < 4; p++) {
    const h = new Float64Array(2 * M);
    for (let j = 0; j < 2 * M; j++) {
      const m = j - M + 1, d = p / 4 - m;
      const sinc = d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d);
      h[j] = sinc * 0.5 * (1 + Math.cos(Math.PI * d / M));
    }
    out.push(h);
  }
  return out;
})();
function interPeak(x, n) {
  // il massimo tra x[n] e i tre valori stimati tra n e n+1
  let pk = Math.abs(x[n]); const len = x.length;
  for (let p = 0; p < 3; p++) {
    const h = TP_TAPS[p]; let v = 0;
    for (let j = 0; j < 12; j++) { const k = n + j - 5; if (k >= 0 && k < len) v += x[k] * h[j]; }
    if (v < 0) v = -v; if (v > pk) pk = v;
  }
  return pk;
}
function truePeak(chs) {
  if (!Array.isArray(chs)) chs = [chs];
  let pk = 0;
  for (const x of chs) {
    const n = x.length;
    for (let i = 0; i < n; i++) {
      const a = Math.max(x[i] < 0 ? -x[i] : x[i], i + 1 < n ? Math.abs(x[i + 1]) : 0);
      // il picco vero supera quello dei campioni al massimo di qualche dB: si calcola solo vicino ai campioni forti
      if (a * 2.2 > pk) { const v = interPeak(x, i); if (v > pk) pk = v; }
    }
  }
  return pk;
}
const truePeakDb = chs => gainToDb(truePeak(chs));
function samplePeak(chs) { if (!Array.isArray(chs)) chs = [chs]; let pk = 0; for (const x of chs) for (let i = 0; i < x.length; i++) { const a = x[i] < 0 ? -x[i] : x[i]; if (a > pk) pk = a; } return pk; }

// Limitatore con anticipo sui picchi veri: nessun picco sopra il tetto, nemmeno tra un campione e l'altro
async function limitTruePeak(chs, ceilDb, onProg) {
  const n = chs[0].length, ceil = dbToGain(ceilDb), g = new Float32Array(n).fill(1);
  for (const x of chs) {
    for (let i = 0; i < n; i++) {
      const a = Math.max(x[i] < 0 ? -x[i] : x[i], i + 1 < n ? Math.abs(x[i + 1]) : 0);
      if (a * 2.2 > ceil) { const v = interPeak(x, i); if (v > ceil) { const r = ceil / v; if (r < g[i]) g[i] = r; if (i + 1 < n && r < g[i + 1]) g[i + 1] = r; } }
      if ((i & 0xfffff) === 0 && onProg) { onProg(0.5 * i / n); await yieldUI(); }
    }
  }
  const up = 1 / (0.0015 * SR);                      // attacco: 1,5 ms di anticipo
  for (let i = n - 2; i >= 0; i--) if (g[i] > g[i + 1] + up) g[i] = g[i + 1] + up;
  const rel = 1 - Math.exp(-1 / (0.06 * SR));        // rilascio: circa 60 ms
  for (let i = 1; i < n; i++) { const r = g[i - 1] + (1 - g[i - 1]) * rel; if (g[i] > r) g[i] = r; }
  for (const x of chs) for (let i = 0; i < n; i++) x[i] *= g[i];
  // verifica finale: se un picco vero supera ancora il tetto, si abbassa tutto di quel poco
  const tp = truePeak(chs);
  if (tp > ceil) { const k = ceil / tp * 0.999; for (const x of chs) for (let i = 0; i < n; i++) x[i] *= k; for (let i = 0; i < n; i++) g[i] *= k; }
  if (onProg) onProg(1);
  chs.limitGain = g;          // la curva di guadagno applicata: serve per dare lo stesso trattamento alle tracce separate
  return chs;
}

function percentile(arr, p) {
  const s = Float32Array.from(arr).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
}
function blockLevels(x) {
  const B = 480, n = Math.floor(x.length / B), L = new Float32Array(n);
  for (let b = 0; b < n; b++) { let sum = 0; for (let i = b * B, end = i + B; i < end; i++) sum += x[i] * x[i]; L[b] = 10 * Math.log10(sum / B + 1e-12); }
  return L;
}
/* ---------- plosivi: p e b esplosive ---------- */
function biquadLP(f0, Q) {
  const w0 = 2 * Math.PI * f0 / SR, c = Math.cos(w0), a = Math.sin(w0) / (2 * Q), a0 = 1 + a;
  return [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - a) / a0];
}
// Banda bassa a fase zero: filtro in avanti e poi all'indietro (24 dB per ottava), così x meno la banda è un passa alto esatto.
function lowZeroPhase(x, fc) {
  const n = x.length, co = biquadLP(fc, 0.707), low = new Float32Array(n);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) { const v = x[i], y = co[0] * v + p1; p1 = co[1] * v - co[3] * y + p2; p2 = co[2] * v - co[4] * y; low[i] = y; }
  p1 = 0; p2 = 0;
  for (let i = n - 1; i >= 0; i--) { const v = low[i], y = co[0] * v + p1; p1 = co[1] * v - co[3] * y + p2; p2 = co[2] * v - co[4] * y; low[i] = y; }
  return low;
}
// Abbassa solo la banda sotto fc, e solo dove c'è un colpo: l'uscita è x meno (1 - g) volte la banda bassa,
// quindi dove g vale 1 il campione esce identico. Il colpo si cerca più in basso, sotto 0,4 fc (60 Hz con 150),
// cioè sotto la fondamentale della voce (provato anche con vocali sintetiche a 85-95 Hz): le vocali gravi vivono sopra, il soffio delle p e delle b sotto.
// È un colpo quando, insieme: quella banda è forte rispetto al suo livello abituale nella voce (secondo la sensibilità),
// domina sulle frequenze sopra fc e sale di colpo rispetto alla sua media lenta.
function dePlosive(x, fc, sens, maxDb) {
  const n = x.length, low = lowZeroPhase(x, fc), det = lowZeroPhase(x, fc * 0.4);
  const D = blockLevels(det), A = blockLevels(x), act = []; for (let b = 0; b < D.length; b++) if (A[b] > -70) act.push(D[b]);
  if (act.length < 20) return x;
  const thr = percentile(act, 0.9) + 6 - sens * 0.12, rThr = 12 - sens * 0.1, jump = 12 - sens * 0.08;
  const aF = 1 - Math.exp(-1 / (0.001 * SR)), rF = 1 - Math.exp(-1 / (0.015 * SR)), aS = 1 - Math.exp(-1 / (0.15 * SR));
  const g = new Float32Array(n); let eD = 0, eH = 0, eS = 1e-10, gg = 1;
  for (let i = 0; i < n; i++) {
    const dw = det[i] * det[i], hv = x[i] - low[i], hw = hv * hv;
    eD += (dw - eD) * (dw > eD ? aF : rF); eH += (hw - eH) * (hw > eH ? aF : rF); eS += (dw - eS) * aS;
    const dD = 10 * Math.log10(eD + 1e-14), over = Math.min(dD - thr, dD - 10 * Math.log10(eH + 1e-14) - rThr, dD - 10 * Math.log10(eS + 1e-14) - jump);
    const tg = dbToGain(-clamp(over * 2, 0, maxDb));
    gg += (tg - gg) * (tg < gg ? 0.02 : 1 / (0.04 * SR)); g[i] = gg;
  }
  const LA = Math.round(0.004 * SR), out = new Float32Array(n);     // 4 ms di anticipo: il colpo comincia prima che il rilevatore lo veda
  for (let i = 0; i < n; i++) out[i] = x[i] - (1 - g[Math.min(n - 1, i + LA)]) * low[i];
  return out;
}

/* ---------- click di bocca ---------- */
// Un click è un picco di acuti (sopra 2,5 kHz) brevissimo e isolato: molto più forte degli acuti intorno
// (mediana di 45 ms) e anche di ogni altro picco nei 10 ms prima e dopo. Così i picchi regolari delle corde vocali,
// che si ripetono ogni pochi millesimi, e le consonanti come t, k e s, che durano di più, restano come sono.
// Riparazione: da 0,5 ms prima a 1,5 ms dopo il picco si toglie solo la parte acuta, con bordi sfumati;
// i bassi e i medi della voce continuano.
function deClick(x, sens) {
  const n = x.length, low = lowZeroPhase(x, 2500), hp = new Float32Array(n);
  for (let i = 0; i < n; i++) hp[i] = Math.abs(x[i] - low[i]);
  const B = 240, nb = Math.ceil(n / B), rms = new Float32Array(nb), ref = new Float32Array(nb);
  for (let b = 0; b < nb; b++) { let s = 0, c = 0; for (let i = b * B; i < Math.min(n, b * B + B); i++) { s += hp[i] * hp[i]; c++; } rms[b] = Math.sqrt(s / Math.max(1, c)); }
  const win = [];
  for (let b = 0; b < nb; b++) { win.length = 0; for (let j = Math.max(0, b - 4); j <= Math.min(nb - 1, b + 4); j++) win.push(rms[j]); win.sort((p, q) => p - q); ref[b] = win[win.length >> 1]; }
  // sotto i 30 dB dal parlato un ticchettio non si sente: si lascia stare (evita di "riparare" le pause silenziose)
  const lv = Array.from(blockLevels(x)).filter(v => v > -100); if (lv.length < 20) return Object.assign(Float32Array.from(x), { clicks: 0, at: [] });
  const floorAbs = dbToGain(percentile(lv, 0.9) - 30);
  const k = 10 - sens * 0.05, m = 4 - sens * 0.025, NEAR = 24, SIDE = 480, GUARD = 96, PRE = 24, POST = 72;
  const out = Float32Array.from(x), at = []; let count = 0, lastEnd = -1;
  for (let i = NEAR; i < n - NEAR; i++) {
    const v = hp[i]; if (v < floorAbs || v <= k * ref[(i / B) | 0]) continue;
    let peak = true; for (let j = i - NEAR; j <= i + NEAR; j++) if (hp[j] > v) { peak = false; break; }
    if (!peak) continue;
    let side = 0;
    for (let j = Math.max(0, i - SIDE); j < i - GUARD; j++) if (hp[j] > side) side = hp[j];
    for (let j = i + GUARD; j < Math.min(n, i + SIDE); j++) if (hp[j] > side) side = hp[j];
    if (v <= m * side) continue;
    const s0 = Math.max(lastEnd + 1, i - PRE), e0 = Math.min(n - 1, i + POST), L = e0 - s0;
    for (let t = s0; t <= e0; t++) { const p = (t - s0) / L, w = p < 0.25 ? Math.sin(Math.PI * 2 * p) ** 2 : p > 0.75 ? Math.sin(Math.PI * 2 * (1 - p)) ** 2 : 1; out[t] = x[t] - w * (x[t] - low[t]); }
    lastEnd = e0; count++; at.push(i); i += NEAR;
  }
  out.clicks = count; out.at = at;      // quanti e dove: per il resoconto e i controlli
  return out;
}

/* ---------- respiri tra le frasi ---------- */
// Un respiro è un tratto da 0,1 a 1,2 s che: non è voce per RNNoise, è sopra il rumore di fondo ma sotto il parlato
// ed è soffiato (molta energia sopra 1 kHz). Non si cancella: si abbassa di db, con rampe di 20 ms.
function lowerBreaths(x, vad, db, sens) {
  const n = x.length, L = blockLevels(x), low = lowZeroPhase(x, 1000), hp = new Float32Array(n);
  for (let i = 0; i < n; i++) hp[i] = x[i] - low[i];
  const Hh = blockLevels(hp), act = Array.from(L).filter(v => v > -100), nF = L.length;
  if (act.length < 50 || db <= 0) return Object.assign(Float32Array.from(x), { breaths: 0 });
  const floor = percentile(act, 0.1), speech = percentile(act, 0.9);
  const vthr = 0.3 + sens * 0.005, over = 12 - sens * 0.08, hfMin = -4 - sens * 0.06;
  const cand = new Uint8Array(nF);
  for (let b = 0; b < nF; b++) cand[b] = (vad ? (vad[b] || 0) < vthr : true) && L[b] > floor + over && L[b] < speech - 3 && Hh[b] - L[b] > hfMin ? 1 : 0;
  const gain = new Float32Array(nF).fill(1), segs = [];
  for (let b = 0; b < nF; b++) {
    if (!cand[b]) continue;
    let e = b; while (e + 1 < nF && (cand[e + 1] || (e + 3 < nF && (cand[e + 2] || cand[e + 3])))) e++;
    const dur = (e - b + 1) * 10; if (dur >= 100 && dur <= 1200) segs.push([b, e]);
    b = e;
  }
  const g = dbToGain(-db), out = new Float32Array(n), R = 0.02 * SR;
  const cur = new Float32Array(n).fill(1);
  for (const [b, e] of segs) {
    const s = b * 480, t = Math.min(n, (e + 1) * 480);
    for (let i = Math.max(0, s - R); i < Math.min(n, t + R); i++) {
      const w = i < s ? 0.5 - 0.5 * Math.cos(Math.PI * (i - (s - R)) / R) : i >= t ? 0.5 + 0.5 * Math.cos(Math.PI * (i - t) / R) : 1;
      cur[i] = Math.min(cur[i], 1 - w * (1 - g));
    }
  }
  for (let i = 0; i < n; i++) out[i] = x[i] * cur[i];
  out.breaths = segs.length;
  return out;
}

/* ---------- livellatore lento ---------- */
// Pareggia piano e forte: misura il volume della voce su finestre di 2 s, contando solo i tratti di voce
// (sopra la soglia del gate e non oltre 25 dB sotto il parlato), e porta ogni tratto verso il volume medio
// della voce, di amt (da 0 a 1) e al massimo di ±maxDb. Nelle pause il guadagno non sale sopra 0 dB (salvo i raccordi
// di 30 ms), così il rumore di fondo non si alza. La curva si leviga in avanti e all'indietro (300 ms), senza ritardo.
function levelSlow(x, amt, maxDb, overDb) {
  const L = blockLevels(x), nF = L.length, act = Array.from(L).filter(v => v > -100);
  if (act.length < 100 || amt <= 0) return Object.assign(Float32Array.from(x), { range: 0 });
  // voce: sopra la soglia del gate e al massimo 25 dB sotto il parlato forte, così il rumore delle pause non conta mai come voce piano
  const thr = Math.max(percentile(act, 0.10) + overDb, percentile(act, 0.9) - 25);
  const pw = new Float64Array(nF + 1), cnt = new Float64Array(nF + 1);
  let tot = 0, nv = 0;
  for (let b = 0; b < nF; b++) { const v = L[b] > thr; pw[b + 1] = pw[b] + (v ? Math.pow(10, L[b] / 10) : 0); cnt[b + 1] = cnt[b] + (v ? 1 : 0); if (v) { tot += Math.pow(10, L[b] / 10); nv++; } }
  if (nv < 50) return Object.assign(Float32Array.from(x), { range: 0 });
  const T = 10 * Math.log10(tot / nv), H = 100, gdb = new Float32Array(nF);
  let held = 0, lo = 0, hi = 0;
  for (let b = 0; b < nF; b++) {
    const a = Math.max(0, b - H), e = Math.min(nF, b + H + 1), c = cnt[e] - cnt[a];
    if (c >= 20) held = clamp((T - 10 * Math.log10((pw[e] - pw[a]) / c)) * amt, -maxDb, maxDb);
    gdb[b] = L[b] > thr ? held : Math.min(held, 0);
    lo = Math.min(lo, gdb[b]); hi = Math.max(hi, gdb[b]);
  }
  const k = 1 - Math.exp(-1 / 30);               // 30 blocchi da 10 ms = 300 ms
  for (let b = 1; b < nF; b++) gdb[b] += (gdb[b - 1] - gdb[b]) * (1 - k);
  for (let b = nF - 2; b >= 0; b--) gdb[b] += (gdb[b + 1] - gdb[b]) * (1 - k);
  // la levigatura porterebbe un po' di guadagno nelle pause vicine alle frasi alzate: lì si torna a 0 dB al massimo,
  // con un raccordo di 30 ms per non creare scalini
  for (let b = 0; b < nF; b++) if (L[b] <= thr) gdb[b] = Math.min(gdb[b], 0);
  const k2 = 1 - Math.exp(-1 / 3);
  for (let b = 1; b < nF; b++) gdb[b] += (gdb[b - 1] - gdb[b]) * (1 - k2);
  for (let b = nF - 2; b >= 0; b--) gdb[b] += (gdb[b + 1] - gdb[b]) * (1 - k2);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) { const p = i / 480 - 0.5, b = clamp(Math.floor(p), 0, nF - 1), b2 = Math.min(nF - 1, b + 1), f = clamp(p - b, 0, 1); out[i] = x[i] * dbToGain(gdb[b] + (gdb[b2] - gdb[b]) * f); }
  out.range = hi - lo;
  return out;
}

/* ---------- ronzio elettrico: filtro e rilevamento ---------- */
// Filtri a campana stretti e profondi sulla frequenza di rete e sulle sue armoniche, tutti larghi bwHz (misurata a metà
// della riduzione). Con 2 Hz e 30 dB: ronzio giù di 30 dB, 25 dB se la rete sbanda di 0,1 Hz; a 10 Hz di distanza circa -1,3 dB.
function humBuild(oc, src, base, harm, depthDb, bwHz) {
  let last = src;
  for (let k = 1; k <= harm; k++) {
    const f = oc.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = base * k; f.Q.value = base * k / (bwHz || 2); f.gain.value = -depthDb;
    last.connect(f); last = f;
  }
  return last;
}
// Cerca il ronzio nelle pause: potenza alle armoniche di 50 e 60 Hz contro le frequenze vicine (±12 Hz), finestre di 0,25 s.
// Restituisce la rete più probabile, quanto spicca ogni armonica in dB e quante armoniche conviene togliere.
function detectHum(x) {
  const W = 12000, nW = Math.floor(x.length / W); if (nW < 4) return null;
  const lv = new Float32Array(nW);
  for (let w = 0; w < nW; w++) { let s = 0; for (let i = w * W; i < (w + 1) * W; i++) s += x[i] * x[i]; lv[w] = 10 * Math.log10(s / W + 1e-12); }
  const act = Array.from(lv).filter(v => v > -100); if (act.length < 4) return null;
  const lim = percentile(act, 0.25) + 3, pick = []; for (let w = 0; w < nW; w++) if (lv[w] > -100 && lv[w] <= lim) pick.push(w);
  const win = new Float32Array(W); for (let i = 0; i < W; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (W - 1));
  const goertzel = (o, f) => { const c = 2 * Math.cos(2 * Math.PI * f / SR); let s1 = 0, s2 = 0; for (let i = 0; i < W; i++) { const s0 = x[o + i] * win[i] + c * s1 - s2; s2 = s1; s1 = s0; } return s1 * s1 + s2 * s2 - c * s1 * s2; };
  const res = {};
  for (const base of [50, 60]) {
    const on = [0, 0, 0, 0], off = [0, 0, 0, 0];
    for (const w of pick.slice(0, 80)) for (let k = 1; k <= 4; k++) { on[k - 1] += goertzel(w * W, base * k); off[k - 1] += (goertzel(w * W, base * k - 12) + goertzel(w * W, base * k + 12)) / 2; }
    res[base] = on.map((p, i) => 10 * Math.log10((p + 1e-20) / (off[i] + 1e-20)));
  }
  const score = b => res[b].reduce((a, v) => a + Math.max(0, v), 0), base = score(60) > score(50) ? 60 : 50, prom = res[base];
  let harm = 0; prom.forEach((v, i) => { if (v > 6) harm = i + 1; });
  return { base, prom, harm, found: Math.max(...prom) > 10, windows: pick.length };
}
function estimateDecayMs(L, speech, noise) {
  const hi = speech - 6, lo = Math.max(noise + 6, speech - 30), res = [];
  for (let i = 1; i < L.length - 90; i++) {
    if (L[i] >= hi && L[i + 1] < hi && L[i - 1] >= hi) {
      let j = i + 1; while (j < i + 80 && L[j] > lo) j++;
      res.push((j - i) * 10); i += 15;
    }
  }
  if (res.length < 8) return null;
  res.sort((p, q) => p - q);
  return res[Math.floor(res.length / 2)];
}
// Sibilanti: quanto spiccano le s. Banda 5-9 kHz a fase zero, a blocchi di 10 ms, solo dove c'è voce (entro 25 dB dal parlato):
// il 95° percentile della banda (le s più forti) meno il 90° percentile del parlato intero. Più è alto, più le s pungono.
function measureSib(x) {
  const hi = lowZeroPhase(x, 9000), lo = lowZeroPhase(x, 5000), band = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) band[i] = hi[i] - lo[i];
  const L = blockLevels(x), Bd = blockLevels(band), act = Array.from(L).filter(v => v > -100); if (act.length < 50) return null;
  const sp = percentile(act, 0.9), sel = []; for (let b = 0; b < L.length; b++) if (L[b] > sp - 25) sel.push(Bd[b]);
  return sel.length < 20 ? null : percentile(sel, 0.95) - sp;
}
// misure della voce, a pezzi: diagnose le usa tutte insieme, l'analisi guidata una alla volta con la barra di avanzamento
function diagNoise(x) {
  const n = x.length; let run = 0, clip = 0;
  for (let i = 0; i < n; i++) { const a = x[i] < 0 ? -x[i] : x[i]; if (a >= 0.999) { run++; if (run === 3) clip++; } else run = 0; }
  const L = blockLevels(x), active = Array.from(L).filter(v => v > -100);
  const noise = active.length ? percentile(active, 0.10) : -100, speech = active.length ? percentile(active, 0.90) : -100;
  return { clipRuns: clip, noiseDb: noise, speechDb: speech, snr: speech - noise, decayMs: estimateDecayMs(L, speech, noise), durSec: n / SR };
}
const diagLevel = x => ({ lufs: lufs(x, true), tp: truePeakDb(x) });
const diagHum = x => { const hum = detectHum(x); return { hum, humDb: hum ? Math.max(0, ...hum.prom) : null }; };
function diagnose(x) {
  return Object.assign(diagNoise(x), diagLevel(x), { sibDb: measureSib(x) }, diagHum(x));
}

/* ---------- filtri e dinamica ---------- */
function biquadHP(f0, Q) {
  const w0 = 2 * Math.PI * f0 / SR, c = Math.cos(w0), a = Math.sin(w0) / (2 * Q), a0 = 1 + a;
  return [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - a) / a0];
}
// De-esser: riconosce le "s" dalla banda sopra 5,5 kHz (filtro ripido, come prima) e le abbassa sottraendo la parte acuta
// separata con un filtro a fase zero. Prima si sottraeva la banda del filtro di riconoscimento, sfasata: tra 5 e 9 kHz la
// sottrazione sommava (circa +2 dB con 6 dB di riduzione). Ora la voce è sempre g · acuti + gravi: abbassa e basta.
function deEss(x, belowDb, maxRedDb) {
  const L = blockLevels(x), act = Array.from(L).filter(v => v > -100);
  if (!act.length) return x;
  const thr = percentile(act, 0.9) - belowDb;
  const co = biquadHP(5500, 0.707), n = x.length, band = new Float32Array(n);
  let p1 = 0, p2 = 0, q1 = 0, q2 = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    const y = co[0] * v + p1; p1 = co[1] * v - co[3] * y + p2; p2 = co[2] * v - co[4] * y;
    const z = co[0] * y + q1; q1 = co[1] * y - co[3] * z + q2; q2 = co[2] * y - co[4] * z;
    band[i] = z;
  }
  const low = lowZeroPhase(x, 5500), out = new Float32Array(n), aA = 1 - Math.exp(-1 / (0.0005 * SR)), aR = 1 - Math.exp(-1 / (0.02 * SR));
  let e = 0, g = 1;
  for (let i = 0; i < n; i++) {
    const pw = band[i] * band[i]; e += (pw - e) * (pw > e ? aA : aR);
    const db = 10 * Math.log10(e + 1e-14), red = clamp((db - thr) * 0.75, 0, maxRedDb), tg = dbToGain(-red);
    g += (tg - g) * (tg < g ? 0.2 : 0.004);
    out[i] = x[i] - (1 - g) * (x[i] - low[i]);
  }
  return out;
}
// vad e vthr: con "Intelligente" la voce si riconosce dalla probabilità di RNNoise invece che dalla soglia di livello
function applyGate(x, overDb, redDb, vad, vthr) {
  const L = blockLevels(x), act = Array.from(L).filter(v => v > -100);
  if (!act.length || redDb <= 0) return x;
  const p10 = percentile(act, 0.10);
  if (!vad && percentile(act, 0.90) - p10 < 20) return x;     // quasi senza pause: il rumore non si stima, meglio non intervenire
  const thr = p10 + overDb, nF = L.length;
  const on = vad ? (j => (vad[j] || 0) > vthr) : (j => L[j] > thr);
  const curve = new Float32Array(nF + 1).fill(1);
  const ca = Math.exp(-1 / 0.5), cr = Math.exp(-1 / 10);
  let cur = 0, last = -1e9;
  for (let i = 0; i < nF; i++) {
    if (on(Math.min(nF - 1, i + 3))) last = i;
    const tgt = (i - last <= 12) ? 0 : -redDb, c = tgt > cur ? ca : cr;
    cur = tgt + (cur - tgt) * c; curve[i] = dbToGain(cur);
  }
  curve[nF] = curve[nF - 1];
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const p = i / 480, k = Math.min(nF - 1, Math.floor(p)), f = p - k;
    out[i] = x[i] * (curve[k] + (curve[k + 1] - curve[k]) * f);
  }
  return out;
}
async function renderChain(x, build) {
  const oc = new OfflineAudioContext(1, Math.max(1, x.length), SR), b = oc.createBuffer(1, Math.max(1, x.length), SR);
  b.copyToChannel(x, 0);
  const src = oc.createBufferSource(); src.buffer = b;
  const last = build(oc, src); last.connect(oc.destination); src.start();
  const r = await oc.startRendering();
  return r.getChannelData(0).slice(0, x.length);
}
function scaleArr(x, g) { const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x[i] * g; return o; }

/* ---------- file WAV ---------- */
// chs: canali; bits 16 (con dither triangolare) o 24; info: titolo, autore, commento, anno, album (blocco LIST INFO)
function encodeWav(chs, bits, sr, info) {
  const nc = chs.length, n = chs[0].length, bps = bits / 8, frame = nc * bps, dataLen = n * frame;
  const enc = new TextEncoder(), parts = [];
  if (info) {
    [['INAM', info.title], ['IART', info.artist], ['IPRD', info.album], ['ICRD', info.year], ['ICMT', info.comment], ['ISFT', APP_NAME]].forEach(([id, v]) => {
      if (!v) return; const b = enc.encode(String(v)); parts.push([id, b]);
    });
  }
  let listLen = 0; parts.forEach(([, b]) => { listLen += 8 + b.length + 1 + ((b.length + 1) & 1); });
  const listChunk = parts.length ? 8 + 4 + listLen : 0;
  const total = 12 + 24 + listChunk + 8 + dataLen + (dataLen & 1);
  const ab = new ArrayBuffer(total), dv = new DataView(ab), u8 = new Uint8Array(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, total - 8, true); w(8, 'WAVE');
  w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nc, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * frame, true); dv.setUint16(32, frame, true); dv.setUint16(34, bits, true);
  let o = 36;
  if (listChunk) {
    w(o, 'LIST'); dv.setUint32(o + 4, 4 + listLen, true); w(o + 8, 'INFO'); o += 12;
    parts.forEach(([id, b]) => { w(o, id); dv.setUint32(o + 4, b.length + 1, true); u8.set(b, o + 8); o += 8 + b.length + 1; if ((b.length + 1) & 1) o++; });
  }
  w(o, 'data'); dv.setUint32(o + 4, dataLen, true); o += 8;
  let seed = 22222;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      let v = chs[c][i]; v = v < -1 ? -1 : v > 1 ? 1 : v;
      if (bits === 16) {
        let q = Math.round(v * 32767 + (rnd() - rnd())); q = q < -32768 ? -32768 : q > 32767 ? 32767 : q;
        dv.setInt16(o, q, true); o += 2;
      } else {
        const q = Math.round(v * 8388607);
        u8[o] = q & 255; u8[o + 1] = (q >> 8) & 255; u8[o + 2] = (q >> 16) & 255; o += 3;
      }
    }
  }
  return ab;
}
// Lettura semplice di un WAV PCM 16/24/32 bit o float 32 (per i progetti salvati)
function decodeWav(ab) {
  const dv = new DataView(ab), tag = o => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('non è un WAV');
  let o = 12, fmt = null, data = null;
  while (o + 8 <= ab.byteLength) {
    const id = tag(o), len = dv.getUint32(o + 4, true);
    if (id === 'fmt ') fmt = { format: dv.getUint16(o + 8, true), nc: dv.getUint16(o + 10, true), sr: dv.getUint32(o + 12, true), bits: dv.getUint16(o + 22, true) };
    if (id === 'data') { data = { o: o + 8, len }; break; }
    o += 8 + len + (len & 1);
  }
  if (!fmt || !data) throw new Error('WAV incompleto');
  const bps = fmt.bits / 8, n = Math.floor(data.len / (bps * fmt.nc)), chs = [];
  for (let c = 0; c < fmt.nc; c++) chs.push(new Float32Array(n));
  let p = data.o;
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.nc; c++) {
    let v;
    if (fmt.format === 3) { v = dv.getFloat32(p, true); p += 4; }
    else if (fmt.bits === 16) { v = dv.getInt16(p, true) / 32768; p += 2; }
    else if (fmt.bits === 24) { let q = dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getInt8(p + 2) << 16); v = q / 8388608; p += 3; }
    else { v = dv.getInt32(p, true) / 2147483648; p += 4; }
    chs[c][i] = v;
  }
  return { sr: fmt.sr, chs };
}
async function resampleChs(chs, from, to) {
  if (from === to) return chs;
  const n = chs[0].length, oc = new OfflineAudioContext(chs.length, Math.ceil(n * to / from), to), b = oc.createBuffer(chs.length, n, from);
  chs.forEach((c, i) => b.copyToChannel(c, i));
  const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start();
  const r = await oc.startRendering();
  return chs.map((_, i) => r.getChannelData(i).slice());
}

