/* ========================= Audio: ascolto, registrazione, livelli ========================= */
let ACTX = null, OUT = null, ANALYSER = null;
function ctx() {
  if (!ACTX) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ACTX = new AC({ sampleRate: SR, latencyHint: 'interactive' });
    OUT = ACTX.createGain();
    const safety = ACTX.createDynamicsCompressor();   // solo per l'ascolto: evita distorsioni forti in cuffia
    safety.threshold.value = -1; safety.knee.value = 0; safety.ratio.value = 20; safety.attack.value = 0.001; safety.release.value = 0.08;
    ANALYSER = ACTX.createAnalyser(); ANALYSER.fftSize = 2048;
    OUT.connect(safety); safety.connect(ANALYSER); ANALYSER.connect(ACTX.destination);
  }
  if (ACTX.state === 'suspended') ACTX.resume();
  return ACTX;
}
// apre un file audio a 48 kHz, qualunque sia la sua frequenza: il browser lo converte una volta sola
async function decodeFile(file) {
  const ab = await file.arrayBuffer();
  const tmp = new OfflineAudioContext(1, 1, SR);
  const buf = await tmp.decodeAudioData(ab);
  const chs = []; for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chs.push(buf.getChannelData(c).slice());
  return { chs, srcRate: null, dur: buf.duration };
}
const toMono = chs => { if (chs.length === 1) return chs[0]; const o = new Float32Array(chs[0].length); for (let i = 0; i < o.length; i++) o[i] = (chs[0][i] + chs[1][i]) / 2; return o; };

/* ---------- livelli della voce montata (per lo stesso volume) ---------- */
const LV = { key: '', orig: -100, proc: -100 };
function voiceLevels() {
  const k = S.version + '|' + S.procKey + '|' + P.xfadeMs + '|' + P.normEach;
  if (LV.key !== k) {
    LV.key = k;
    LV.orig = S.vlen ? lufs(renderVoice(0, S.vlen, false), true) : -100;
    LV.proc = (S.vlen && S.procActive) ? lufs(renderVoice(0, S.vlen, true), true) : -100;
  }
  return LV;
}
// guadagno della voce in ascolto, nel mix e nell'esportazione
function voiceGain(which) {
  const lv = voiceLevels(), l = which === 'proc' ? lv.proc : lv.orig;
  // normalizzazione: la voce montata, originale o migliorata, va all'obiettivo in LUFS
  if (P.voiceNorm) return l > -90 ? dbToGain(P.target - l) : 1;
  // senza normalizzazione la migliorata resta com'è uscita dalla catena; l'originale si pareggia solo per il confronto
  if (which === 'orig' && P.match && S.procActive && lv.orig > -90 && lv.proc > -90) return dbToGain(lv.proc - lv.orig);
  return 1;
}

/* ---------- mix di voce, musica ed effetti ---------- */
// only: 'voice', 'music' o 'fx' per calcolare una traccia sola (tracce separate); senza, il mix completo
function renderMix(t0, n, which, curves, only) {
  const Lo = new Float32Array(n), Ro = new Float32Array(n), lay = layout();
  if (S.vlen && (!only || only === 'voice')) {
    const v = renderVoice(t0 - lay.intro, n, which === 'proc'), g = voiceGain(which);
    for (let i = 0; i < n; i++) { const s = v[i] * g; Lo[i] = s; Ro[i] = s; }
  }
  if (S.musicId && (!only || only === 'music')) {
    const m = S.sources.get(S.musicId), mc = musicChs(), C = curves || musicCurves(which), off = Math.round(P.musicOffset * SR);
    const ml = mc[0], mr = mc[1] || mc[0], len = m.len;
    for (let i = 0; i < n; i++) {
      const t = t0 + i; if (t < lay.mStart || t >= lay.mEnd) continue;
      let p = t - lay.mStart + off; if (P.loop) p %= len; else if (p >= len) continue;
      const q = t / 480, k = Math.min(C.gain.length - 2, Math.floor(q)), f = q - k, gg = C.gain[k] + (C.gain[k + 1] - C.gain[k]) * f;
      Lo[i] += ml[p] * gg; Ro[i] += mr[p] * gg;
    }
  }
  // effetti: tutti dalla stessa funzione (65-fxrender.js), in ascolto, esportazione e tracce separate
  if (!only || only === 'fx') for (const e of S.fx) fxMixInto(e, t0, n, Lo, Ro);
  return [Lo, Ro];
}

/* ---------- ascolto ---------- */
const PB = { timer: null, nodes: [], from: 0, end: 0, nextT: 0, nextAt: 0, startAt: 0, curves: null };
const CHUNK = SR / 2;
function playPos() {
  if (!S.playing) return S.cur;
  return Math.min(PB.end, PB.from + Math.max(0, (ACTX.currentTime - PB.startAt)) * SR);
}
function startPlayback(from, end) {
  stopPlayback(true); stopFxPreview();
  const c = ctx(), lay = layout();
  if (!lay.total) return;
  PB.from = clamp(Math.round(from), 0, lay.total); PB.end = clamp(Math.round(end == null ? lay.total : end), PB.from, lay.total);
  if (PB.end - PB.from < SR * 0.05) { PB.from = 0; PB.end = lay.total; }
  voiceLevels();
  PB.curves = S.musicId ? musicCurves(S.mode) : null;
  PB.nextT = PB.from; PB.startAt = c.currentTime + 0.08; PB.nextAt = PB.startAt;
  S.playing = true;
  pump();
  PB.timer = setInterval(pump, 60);
  requestAnimationFrame(tick); startMeter();
  updateTransport();
}
function pump() {
  const c = ACTX;
  while (PB.nextT < PB.end && PB.nextAt - c.currentTime < 0.7) {
    const n = Math.min(CHUNK, PB.end - PB.nextT), [L, R] = renderMix(PB.nextT, n, S.mode, PB.curves);
    const b = c.createBuffer(2, n, SR); b.copyToChannel(L, 0); b.copyToChannel(R, 1);
    const s = c.createBufferSource(); s.buffer = b; s.connect(OUT); s.start(PB.nextAt);
    s.onended = () => { PB.nodes = PB.nodes.filter(x => x !== s); };
    PB.nodes.push(s); PB.nextT += n; PB.nextAt += n / SR;
  }
  if (PB.nextT >= PB.end && c.currentTime >= PB.nextAt) {
    const endedAt = PB.end; stopPlayback(); S.cur = PB.selPlay ? S.cur : endedAt; drawTop(); updateTransport();
  }
}
function stopPlayback(keepPos) {
  if (PB.timer) { clearInterval(PB.timer); PB.timer = null; }
  PB.nodes.forEach(s => { try { s.stop(); } catch { } try { s.disconnect(); } catch { } });
  PB.nodes = [];
  if (S.playing && !keepPos) { /* il cursore resta dov'era: si riparte da lì */ }
  S.playing = false; updateTransport();
}
function togglePlay() {
  if (S.recording) return;
  if (S.playing) { stopPlayback(); drawTop(); return; }
  const lay = layout(); if (!lay.total) return;
  if (S.sel && S.sel[1] - S.sel[0] > SR * 0.05) { PB.selPlay = true; startPlayback(S.sel[0], S.sel[1]); }
  else { PB.selPlay = false; if (S.cur >= lay.total - SR * 0.05) S.cur = 0; startPlayback(S.cur, lay.total); }
}
function restartIfPlaying() { if (S.playing) { const p = playPos(); startPlayback(p, PB.selPlay ? PB.end : layout().total); } }
function tick() {
  if (S.playing) {
    followPlayhead(playPos());
    $('#timeNow').textContent = fmtSec(playPos());
    drawTop();
    requestAnimationFrame(tick);
  }
}

/* ---------- registrazione ---------- */
const WORKLET_SRC = `class RecProc extends AudioWorkletProcessor{
constructor(){super();this.on=false;this.buf=new Float32Array(4096);this.n=0;this.pk=0;this.port.onmessage=e=>{this.on=e.data;};}
process(inputs){const inp=inputs[0];if(!inp||!inp.length)return true;const a=inp[0],b=inp[1];
for(let i=0;i<a.length;i++){const v=b?(a[i]+b[i])/2:a[i];const q=v<0?-v:v;if(q>this.pk)this.pk=q;this.buf[this.n++]=v;
if(this.n===4096){this.port.postMessage({pk:this.pk,d:this.on?this.buf:null},this.on?[this.buf.buffer]:[]);this.buf=new Float32Array(4096);this.n=0;this.pk=0;}}
return true;}}
registerProcessor('rec-proc',RecProc);`;
const REC = { stream: null, node: null, src: null, chunks: [], len: 0, pks: [], at: 0, mode: 'end', a: 0, b: 0, clips: 0, t0: 0, ready: false };
let workletLoaded = null;      // null: non ancora provato; 'blob' o 'data': caricato; false: non disponibile
async function loadWorklet(c) {
  if (!c.audioWorklet) return false;
  try { await c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' }))); return 'blob'; } catch { }
  try { await c.audioWorklet.addModule('data:text/javascript;charset=utf-8,' + encodeURIComponent(WORKLET_SRC)); return 'data'; } catch { }
  return false;
}
async function openMic() {
  const c = ctx();
  if (REC.stream && REC.stream.active) return;
  const constraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } };
  if (P.micId) constraints.audio.deviceId = { exact: P.micId };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('navigator.mediaDevices non disponibile'), { name: 'NoMediaDevices' });
  try { REC.stream = await navigator.mediaDevices.getUserMedia(constraints); }
  catch (e) {
    if (P.micId && e && e.name === 'OverconstrainedError') { P.micId = ''; return openMic(); }
    throw e;
  }
  REC.src = c.createMediaStreamSource(REC.stream);
  REC.mute = c.createGain(); REC.mute.gain.value = 0;   // collegato in silenzio, così il browser lo fa lavorare sempre
  REC.mute.connect(c.destination);
  const onBlock = (pk, d) => {
    METER.inPk = Math.max(METER.inPk, pk);
    if (pk >= 0.989) { REC.clips++; showClip(); }
    if (d && S.recording) { REC.chunks.push(d); REC.len += d.length; REC.pks.push(pk); }
  };
  // Tre modi di catturare il suono, tutti senza perdita (numeri a virgola mobile a 48 kHz).
  // Con il file aperto dal disco alcuni browser non caricano il registratore da un indirizzo "blob": si prova allora un indirizzo "data",
  // e se anche quello non va si usa il vecchio ScriptProcessor, meno preciso nei tempi ma compatibile ovunque.
  if (workletLoaded === null) workletLoaded = await loadWorklet(c);
  if (workletLoaded) {
    const node = new AudioWorkletNode(c, 'rec-proc', { numberOfInputs: 1, numberOfOutputs: 1 });
    REC.src.connect(node); node.connect(REC.mute);
    node.port.onmessage = e => onBlock(e.data.pk, e.data.d);
    REC.cap = { kind: 'worklet-' + workletLoaded, set: on => node.port.postMessage(on), close: () => { node.port.onmessage = null; node.disconnect(); } };
  } else {
    const sp = c.createScriptProcessor(4096, 1, 1); let on = false;
    sp.onaudioprocess = e => {
      const ib = e.inputBuffer, a = ib.getChannelData(0), b = ib.numberOfChannels > 1 ? ib.getChannelData(1) : null;
      const d = new Float32Array(a.length); let pk = 0;
      for (let i = 0; i < a.length; i++) { const v = b ? (a[i] + b[i]) / 2 : a[i]; d[i] = v; const q = v < 0 ? -v : v; if (q > pk) pk = q; }
      onBlock(pk, on ? d : null);
    };
    REC.src.connect(sp); sp.connect(REC.mute);
    REC.cap = { kind: 'script', set: v => { on = v; }, close: () => { sp.onaudioprocess = null; sp.disconnect(); } };
  }
  const tr = REC.stream.getAudioTracks()[0], st = tr.getSettings ? tr.getSettings() : {};
  REC.label = tr.label || 'microfono';
  REC.filtersOff = st.echoCancellation === false && st.noiseSuppression === false && st.autoGainControl === false;
  fillMics();
}
function closeMic() {
  try { if (REC.src) REC.src.disconnect(); } catch { }
  try { if (REC.cap) REC.cap.close(); } catch { }
  try { if (REC.mute) REC.mute.disconnect(); } catch { }
  if (REC.stream) REC.stream.getTracks().forEach(t => t.stop());
  REC.stream = null; REC.cap = null; REC.src = null;
}
function showClip() {
  $('#clipFlag').textContent = 'Saturazione (' + REC.clips + ')';
  if (REC.clips === 1) toast('Attenzione: il suono è saturato. Abbassa il guadagno del microfono o allontanati un po’.');
}
async function toggleMonitor() {
  if (S.recording) return;
  if (S.monitoring) { S.monitoring = false; closeMic(); updateTransport(); $('#recStatus').textContent = ''; return; }
  try {
    await openMic(); S.monitoring = true; REC.clips = 0; $('#clipFlag').textContent = '';
    $('#recStatus').textContent = 'Parla come durante la registrazione: le parole forti dovrebbero stare tra -12 e -6 dB. ' + micNote();
    updateTransport(); startMeter();
  } catch (e) { micError(e); }
}
function micNote() { return (REC.filtersOff ? 'Filtri automatici del browser spenti.' : 'Il browser non conferma lo spegnimento dei filtri automatici: la voce potrebbe essere già trattata.') + (REC.cap && REC.cap.kind === 'script' ? ' Registratore in modo compatibile.' : ''); }
// dove si dà il permesso del microfono nel sistema operativo
const SYS_MIC = {
  mac: 'Se il permesso c’è già, controlla nelle Impostazioni di Sistema del Mac, in Privacy e sicurezza, Microfono, che il tuo browser sia attivo.',
  win: 'Se il permesso c’è già, controlla nelle Impostazioni di Windows, in Privacy e sicurezza, Microfono, che siano attivi “Accesso al microfono” e “Consenti alle app desktop di accedere al microfono”.',
  linux: 'Se il permesso c’è già, controlla nelle impostazioni audio del sistema che il microfono sia l’ingresso attivo e non sia silenziato. Se il browser è installato come Flatpak o Snap, deve avere anche il permesso del microfono in quel sistema (per esempio con Flatseal o con “snap connect”).'
};
// L'errore resta visibile in una finestra, in italiano, con il dettaglio tecnico del browser sotto
function micError(e) {
  closeMic(); S.monitoring = false; S.recording = false; updateTransport();
  const n = e && e.name, tech = (n || 'Errore') + (e && e.message ? ': ' + e.message : '');
  const msg = n === 'NotAllowedError' || n === 'SecurityError'
    ? 'Il browser non ha il permesso di usare il microfono. Clicca sull’icona a sinistra dell’indirizzo, imposta Microfono su “Consenti” e ricarica la pagina. ' + SYS_MIC[OS]
    : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'Microfono non trovato. Controlla che sia collegato e acceso, poi sceglilo nell’elenco “Microfono”.'
    : n === 'NoMediaDevices' ? 'Questo browser non permette di usare il microfono da questa pagina. Apri il file direttamente dal computer con Edge, Chrome, Firefox o Safari aggiornati.'
    : n === 'NotReadableError' ? 'Il microfono è occupato da un altro programma, per esempio Audacity o una videochiamata. Chiudi quel programma e riprova.'
    : 'Il microfono non si è aperto. Ricarica la pagina e riprova. Se succede ancora, annota il dettaglio tecnico qui sotto.';
  $('#recStatus').textContent = msg;
  $('#errMsg').textContent = msg; $('#errTech').textContent = 'Dettaglio tecnico: ' + tech;
  const d = $('#errDlg'); if (!d.open) d.showModal();
}
async function toggleRecord() {
  if (S.recording) return stopRecording();
  if (S.playing) stopPlayback();
  try { await openMic(); } catch (e) { micError(e); return; }
  const lay = layout(), vcur = clamp(S.cur - lay.intro, 0, S.vlen);
  REC.mode = P.recWhere; REC.at = S.vlen;
  if (REC.mode === 'cursor') REC.at = vcur;
  if (REC.mode === 'all') { if (S.vlen) { REC.a = 0; REC.b = S.vlen; REC.at = 0; } else REC.mode = 'end'; }
  if (REC.mode === 'replace') {
    if (S.sel && S.sel[1] > S.sel[0]) { REC.a = clamp(S.sel[0] - lay.intro, 0, S.vlen); REC.b = clamp(S.sel[1] - lay.intro, 0, S.vlen); REC.at = REC.a; }
    else { REC.mode = 'cursor'; REC.at = vcur; }
  }
  REC.chunks = []; REC.len = 0; REC.pks = []; REC.clips = 0; $('#clipFlag').textContent = '';
  S.monitoring = false; S.recording = true; REC.t0 = performance.now(); REC.viewEnd = 0;
  REC.cap.set(true);
  flowRender(); drawAll();      // anche alla prima registrazione la linea del tempo compare subito, con la forma d'onda in rosso
  $('#recStatus').textContent = 'Registrazione in corso. ' + micNote();
  updateTransport(); startMeter(); requestAnimationFrame(recTick);
}
function recTick() {
  if (!S.recording) return;
  $('#timeNow').textContent = fmtSec(REC.len);
  const lay = layout(), x0 = REC.at + lay.intro, xe = x0 + REC.len;
  // vista intera: si allarga a passi mentre la registrazione cresce, così si vede tutto il progetto più la registrazione;
  // vista ingrandita: scorre per seguire la fine della registrazione
  if (S.fit) { if (xe > Math.max(lay.total, SR) * 0.92 && xe > REC.viewEnd * 0.92) { REC.viewEnd = Math.max(SR * 10, xe * 1.5); drawBase(); } }
  else if (xe > S.view[1]) { const span = S.view[1] - S.view[0]; S.view = [Math.max(0, xe - span * 0.85), Math.max(0, xe - span * 0.85) + span]; drawBase(); }
  drawTop(); requestAnimationFrame(recTick);
}
async function stopRecording() {
  S.recording = false;
  if (REC.cap) REC.cap.set(false);
  await new Promise(r => setTimeout(r, 120));            // l'ultimo pezzo in arrivo dal registratore
  closeMic(); updateTransport();
  if (REC.len < SR * 0.2) { $('#recStatus').textContent = 'Registrazione troppo breve: non è stata aggiunta.'; drawTop(); return; }
  const x = new Float32Array(REC.len); let o = 0; REC.chunks.forEach(c => { x.set(c, o); o += c.length; });
  REC.chunks = [];
  const n = [...S.sources.values()].filter(s => s.kind === 'voce').length + 1;
  const id = addSource('Registrazione ' + n, 'voce', [x]);
  saveSource(id);
  const clip = [{ src: id, s: 0, len: x.length, f: [] }], lay = layout();
  const what = 'Registrazione ' + n + ' (' + fmtDur(x.length / SR) + ')';
  if (REC.mode === 'replace') pushOp({ type: 'replace', a: REC.a, b: REC.b, clip, label: what + ' al posto della selezione' });
  else if (REC.mode === 'all') pushOp({ type: 'replace', a: REC.a, b: REC.b, clip, label: what + ' al posto di tutta la voce' });
  else pushOp({ type: 'insert', at: REC.at, clip, label: what + (REC.mode === 'end' ? ' in fondo' : ' a ' + fmtSec(REC.at)) });
  S.cur = lay.intro + REC.at + x.length; S.sel = null;
  $('#recStatus').textContent = (REC.clips ? 'Attenzione: ' + REC.clips + ' punti saturati. ' : 'Nessuna saturazione. ') + 'Durata ' + fmtDur(x.length / SR) + '.';
  drawAll(); updateTransport();
  if (S.procActive) await improveSources();
}
async function fillMics() {
  const sel = $('#p_micId'); if (!sel || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
    const cur = P.micId; sel.innerHTML = '';
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Quello predefinito del sistema'; sel.appendChild(o0);
    devs.forEach((d, i) => { if (!d.deviceId || d.deviceId === 'default') return; const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || 'Microfono ' + (i + 1); sel.appendChild(o); });
    sel.value = Array.from(sel.options).some(o => o.value === cur) ? cur : '';
  } catch { }
}

/* ---------- indicatore di livello ---------- */
const METER = { db: -90, inPk: 0, running: false };
// soglia inferiore di ciascun segmento, in dB
const METER_SEG = [-72, -60, -50, -42, -36, -30, -24, -18, -15, -12, -9, -6, -4.5, -3, -2, -1];
function startMeter() { if (!METER.running) { METER.running = true; requestAnimationFrame(meterLoop); } }
function meterLoop() {
  const cv = $('#meter'), g = cv.getContext('2d'), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
  let pk = 0;
  if (S.recording || S.monitoring) {
    // il registratore manda un valore ogni 85 ms circa: tra un valore e l'altro si tiene l'ultimo
    if (METER.inPk > 0) { METER.last = METER.inPk; METER.lastT = performance.now(); METER.inPk = 0; }
    pk = performance.now() - (METER.lastT || 0) < 150 ? METER.last : 0;
  }
  else if (S.playing && ANALYSER) {
    const a = METER.buf || (METER.buf = new Float32Array(ANALYSER.fftSize)); ANALYSER.getFloatTimeDomainData(a);
    for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > pk) pk = v; }
  }
  const db = pk > 0 ? 20 * Math.log10(pk) : -100; METER.db = Math.max(db, METER.db - 0.6);
  // misuratore a 16 segmenti: chiari fino a -12 dB, ambra fino a -3, corallo oltre; il picco resta acceso circa un secondo
  const now = performance.now();
  if (METER.db >= (METER.peak || -100) || now - (METER.peakT || 0) > 1000) { METER.peak = METER.db; METER.peakT = now; }
  const n = METER_SEG.length, gap = 2, sw = (w - gap * (n - 1)) / n;
  const cInk = cssv('--ink'), cAcc = cssv('--accent'), cHot = cssv('--duck'), cOff = cssv('--muted');
  for (let i = 0; i < n; i++) {
    const lo = METER_SEG[i], lit = METER.db >= lo, pkSeg = !lit && METER.peak >= lo && (i === n - 1 || METER.peak < METER_SEG[i + 1]);
    g.fillStyle = (lit || pkSeg) ? (lo >= -3 ? cHot : lo >= -12 ? cAcc : cInk) : cOff;
    g.globalAlpha = pkSeg ? 0.75 : (lit ? 1 : 0.28);   // i segmenti spenti restano visibili, tenui
    g.fillRect(Math.round(i * (sw + gap)), 0, Math.max(1, Math.round(sw)), h);
  }
  g.globalAlpha = 1;
  $('#meterTxt').textContent = METER.db < -95 ? '-inf dB' : fmtNum(METER.db, 1) + ' dB';
  if (S.playing || S.recording || S.monitoring || METER.db > -96 || now - METER.peakT < 1100) requestAnimationFrame(meterLoop); else METER.running = false;
}

