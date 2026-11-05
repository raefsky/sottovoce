/* ========================= Impostazioni ========================= */
const P = {
  // ascolto, montaggio e registrazione
  match: true, vzoom: 0, xfadeMs: 10, recWhere: 'end', micId: '',
  // miglioramento della voce (catena di Rifinitura; pulizia al 100 % scelta con l'ascolto alla cieca)
  nrMethod: 'ia', nrMix: 100, nrDb: 12, nrAlpha: 1.2, eco: 0.4,
  hp: 100, lowMid: -4.5, mud: -1.5, lowShelf: 0, presence: 1, harsh: -2, air: 0,
  deessOn: true, deessThr: 20, deessAmt: 6,
  compOn: true, compThr: -22, compRatio: 2.5, compAtk: 10, compRel: 150,
  gateOn: true, gateOver: 10, gateRed: 12,
  // riconoscimento della voce per ducking e gate: 'level' dal livello (come prima), 'ai' con la probabilità di voce di RNNoise
  vadMode: 'level', vadSens: 30,
  // anti-ronzio: rete a 50 o 60 Hz, quante armoniche togliere (1-4), quanto abbassarle
  humOn: false, humFreq: 50, humHarm: 4, humDb: 30, humBw: 2,
  // plosivi: frequenza sotto cui si cercano i colpi, sensibilità, riduzione massima
  plosOn: false, plosFreq: 150, plosSens: 40, plosMax: 12,
  // respiri (quanto abbassarli e sensibilità) e click di bocca (sensibilità)
  breathOn: false, breathDb: 6, breathSens: 40, clickOn: false, clickSens: 30,
  // livellatore lento: quanto avvicinare le frasi al volume medio (%) e guadagno massimo in su e in giù
  levOn: false, levAmt: 50, levMax: 6,
  // vista in frequenza sotto la forma d'onda: 'off', 'mean' (spettro medio) o 'gram' (spettrogramma); non cambia l'audio
  specView: 'off',
  // accorcia i silenzi: pause più lunghe di silMin secondi diventano lunghe silMax secondi
  silMin: 1.2, silMax: 0.6,
  target: -19, voiceNorm: true, normEach: true, voiceRefined: false,
  // musica, ducking ed effetti (da Sottovoce)
  musicAuto: true, musicDb: 0, musicTarget: -24, carve: 4, loop: true, musicOffset: 0, fadeIn: 2, fadeOut: 4, intro: 6, tail: 6,
  duckOn: true, duckThrAuto: true, duckThr: -42, duckDepth: -12, duckAtk: 150, duckRel: 1000, duckHold: 450, duckLook: 150,
  fxDb: 0, fxSnap: false,
  // esportazione
  expFormat: 'mp3', expKbps: 192, expBits: 24, expSr: 48000, expCh: 'auto', expWhich: 'proc', expNorm: true, expTarget: -16, expCeil: -1, expSelOnly: false
};
// titolo, autore e copertina: appartengono al progetto, non ai preset
const META = { title: '', artist: 'Roberto Lanza', album: '', year: String(new Date().getFullYear()), track: '', comment: '', cover: null };
const IMPROVE_KEYS = ['nrMethod', 'nrMix', 'nrDb', 'nrAlpha', 'eco', 'hp', 'lowMid', 'mud', 'lowShelf', 'presence', 'harsh', 'air', 'deessOn', 'deessThr', 'deessAmt', 'compOn', 'compThr', 'compRatio', 'compAtk', 'compRel', 'gateOn', 'gateOver', 'gateRed'];
const REF_LEVEL = -19;          // livello di lavoro della catena; il volume vero lo decide "Volume della voce"
// le impostazioni nuove entrano nella chiave solo se diverse dal riposo: i progetti vecchi tengono la stessa chiave
const improveKey = () => JSON.stringify(IMPROVE_KEYS.map(k => P[k]).concat(P.gateOn && P.vadMode === 'ai' ? ['vad', P.vadSens] : [],
  P.humOn ? ['hum', P.humFreq, P.humHarm, P.humDb, P.humBw] : [],
  P.plosOn ? ['plos', P.plosFreq, P.plosSens, P.plosMax] : [],
  P.breathOn ? ['breath', P.breathDb, P.breathSens] : [], P.clickOn ? ['click', P.clickSens] : [],
  P.levOn ? ['lev', P.levAmt, P.levMax, P.gateOver] : []));

/* ========================= RNNoise ========================= */
let RN = null;
function b64ToBytes(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
async function loadRnnoise() {
  if (RN) return RN;
  const el = document.getElementById('rnnoise-wasm');
  if (!el || typeof createRNNWasmModule === 'undefined') throw new Error('Il modulo di pulizia con intelligenza artificiale non è disponibile.');
  RN = await createRNNWasmModule({ wasmBinary: b64ToBytes(el.textContent.trim()) });
  return RN;
}
// vad: se c'è, riceve la probabilità di voce di ogni frammento di 10 ms (la restituisce rnnoise_process_frame)
async function runRnnoise(x, mix, prog, vad) {
  const M = await loadRnnoise(), st = M._rnnoise_create(0), ptr = M._malloc(480 * 4), off = ptr >> 2;
  const n = x.length, frames = Math.ceil(n / 480) + 1, wet = new Float32Array(frames * 480);
  for (let f = 0; f < frames; f++) {
    const s = f * 480, H = M.HEAPF32;
    for (let j = 0; j < 480; j++) H[off + j] = (s + j < n ? x[s + j] : 0) * 32768;
    const pv = M._rnnoise_process_frame(st, ptr, ptr); if (vad) vad[f] = pv;
    const H2 = M.HEAPF32; for (let j = 0; j < 480; j++) wet[s + j] = H2[off + j] / 32768;
    if ((f & 511) === 511) { prog(f / frames); await yieldUI(); }
  }
  M._rnnoise_destroy(st); M._free(ptr);
  const out = new Float32Array(n);        // RNNoise ritarda di 480 campioni: si compensa (misurato nel banco di prova)
  for (let i = 0; i < n; i++) out[i] = x[i] * (1 - mix) + wet[i + 480] * mix;
  return out;
}

/* ========================= Riconoscimento della voce (RNNoise) ========================= */
// Per ogni registrazione originale: probabilità di voce a frammenti di 10 ms, da 0 a 1, nello stesso tempo dell'originale.
// Si calcola una volta (gratis quando la pulizia è già RNNoise) e serve a ducking e gate con "Intelligente".
const VAD = new Map();
// RNNoise valuta ogni frammento insieme al precedente: per ogni frammento si prende il valore più alto dei due vicini
function vadFromRaw(raw, n) {
  const nF = Math.ceil(n / 480), out = new Float32Array(nF);
  for (let k = 0; k < nF; k++) out[k] = Math.max(raw[k] || 0, raw[k + 1] || 0);
  return out;
}
async function analyzeVad(x, prog) {
  const M = await loadRnnoise(), st = M._rnnoise_create(0), ptr = M._malloc(480 * 4), off = ptr >> 2;
  const n = x.length, frames = Math.ceil(n / 480) + 1, raw = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const s = f * 480, H = M.HEAPF32;
    for (let j = 0; j < 480; j++) H[off + j] = (s + j < n ? x[s + j] : 0) * 32768;
    raw[f] = M._rnnoise_process_frame(st, ptr, ptr);
    if ((f & 1023) === 1023) { prog(f / frames); await yieldUI(); }
  }
  M._rnnoise_destroy(st); M._free(ptr);
  return vadFromRaw(raw, n);
}
const vadSources = () => [...S.sources.values()].filter(s => s.kind === 'voce' && S.segs.some(g => g.src === s.id));
const vadReady = () => vadSources().every(s => VAD.has(s.id));
const vadThr = () => 1 - P.vadSens / 100;          // sensibilità 30 % = voce se la probabilità supera 0,7
let vadJob = null, vadFail = false;
// calcola quello che manca; mentre lavora ducking e gate restano sul livello
function ensureVad() {
  if (vadJob) return vadJob;
  if (vadFail) return Promise.resolve();      // dopo un errore non si riprova a ogni disegno
  const todo = vadSources().filter(s => !VAD.has(s.id));
  if (!todo.length) return Promise.resolve();
  vadJob = (async () => {
    try {
      for (let i = 0; i < todo.length; i++) {
        const s = todo[i], msg = 'Riconoscimento della voce' + (todo.length > 1 ? ' ' + (i + 1) + ' di ' + todo.length : '') + '…';
        busy(true, msg, i / todo.length);
        VAD.set(s.id, await analyzeVad(s.chs[0], f => busy(true, msg, (i + f) / todo.length)));
      }
    } catch (e) { vadFail = true; toast(e && e.message ? e.message : 'Riconoscimento della voce non riuscito.'); }
    finally { busy(false); vadJob = null; }
    MC.key = ''; drawBase(); restartIfPlaying();
  })();
  return vadJob;
}
// probabilità di voce sul montaggio, a blocchi di 10 ms come voiceEnvelope; le parti silenziate valgono 0
function voiceVad() {
  const n = Math.ceil(S.vlen / 480), out = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    const t = b * 480 + 240, i = segIndexAt(Math.min(t, S.vlen - 1)), g = S.segs[i]; if (!g || !g.src) continue;
    const p = clamp(t - S.segT[i], 0, g.len - 1), v = VAD.get(g.src); if (!v) continue;
    if (g.f.length && fadeGain(g.f, p) < 0.1) continue;
    out[b] = v[Math.min(v.length - 1, Math.floor((g.s + p) / 480))] || 0;
  }
  return out;
}

/* ========================= Rileva il ronzio ========================= */
// Cerca il ronzio nelle pause della voce originale montata; se lo trova imposta rete e armoniche e accende il filtro.
// Non cambia l'audio da solo: serve poi "Applica i miglioramenti".
async function findHum() {
  const st = $('#humStatus'); if (!S.vlen) return;
  busy(true, 'Ricerca del ronzio…'); await yieldUI();
  let h = null; try { h = detectHum(rawVoice()); } finally { busy(false); }
  if (!h) { st.textContent = 'Voce troppo breve per cercare il ronzio.'; return; }
  const list = h.prom.map((v, i) => h.base * (i + 1) + ' Hz ' + fmtNum(Math.max(0, v), 0) + ' dB').join(', ');
  if (!h.found) { st.textContent = 'Nessun ronzio evidente nelle pause (' + list + ' sopra il fondo). Il filtro non serve.'; return; }
  P.humOn = true; P.humFreq = h.base; P.humHarm = Math.max(1, h.harm);
  ['humOn', 'humFreq', 'humHarm'].forEach(k => { syncKey(k); onParam(k); });
  st.textContent = 'Ronzio trovato a ' + h.base + ' Hz (' + list + ' sopra il fondo). Filtro acceso con ' + P.humHarm + (P.humHarm > 1 ? ' armoniche' : ' armonica') + ': premi “Applica i miglioramenti”.';
}

/* ========================= Analizza e proponi ========================= */
// Legge le misure dell'originale (diagnose) e imposta i cursori con regole semplici, scritte qui sotto.
// Non tocca l'audio: poi serve "Applica i miglioramenti". "Ripristina" rimette i valori di prima.
const SIB_WARN = -12, SIB_STRONG = -8;
// voce originale montata come è stata registrata, senza il guadagno di "Pareggia le registrazioni"
// (che su una voce bassa la porterebbe oltre 0 dB e farebbe vedere una saturazione che non c'è)
function rawVoice() { const each = P.normEach; P.normEach = false; try { return renderVoice(0, S.vlen, false); } finally { P.normEach = each; } }
let PROPOSE_OLD = null;
function paramLabel(k) { const l = $('label[for="p_' + k + '"]') || $('[data-row="' + k + '"] .chk > span'); return l ? l.childNodes[0].textContent.trim() : k; }
function paramText(k, v) {
  if (typeof v === 'boolean') return v ? 'acceso' : 'spento';
  const sel = $('select#p_' + k); if (sel) { const o = Array.from(sel.options).find(o => o.value === String(v)); return o ? o.textContent : String(v); }
  const f = FMT[k]; return f ? (f.signed && v > 0 ? '+' : '') + fmtNum(v, f.dec) + f.unit : String(v);
}
// Analisi a fasi, con barra e messaggi; ogni messaggio resta almeno 0,4 s, così si riesce a leggere.
// more aggiunge fasi prima della preparazione dei suggerimenti (la usa la Modalità Podcast)
async function analyzeVoice(show, more) {
  let last = 0;
  const phase = async (p, msg) => { const w = 400 - (performance.now() - last); if (last && w > 0) await new Promise(r => setTimeout(r, w)); show(p, msg); last = performance.now(); await yieldUI(); };
  await phase(0.05, 'Analisi del rumore di fondo…'); const x = rawVoice(), d = diagNoise(x);
  await phase(0.3, 'Analisi del livello della voce…'); Object.assign(d, diagLevel(x));
  await phase(0.55, 'Analisi delle sibilanti…'); d.sibDb = measureSib(x);
  await phase(0.75, 'Ricerca del ronzio elettrico…'); Object.assign(d, diagHum(x));
  if (more) await more(phase, x, d);
  await phase(0.92, 'Preparazione dei suggerimenti…');
  await phase(1, 'Fatto.');
  return d;
}
// Regole dei suggerimenti, semplici e in chiaro: calcolano cosa cambiare, senza ancora cambiarlo
function proposalsFrom(d) {
  const changes = [], notes = [], want = {};
  const set = (k, v, why) => { if (P[k] === v || k in want) return; want[k] = v; changes.push({ k, from: P[k], to: v, why }); };
  // 1. rumore: segnale/rumore sotto 35 dB, pulizia con RNNoise al 100 %
  if (d.snr < 35) {
    const why = 'Il rumore di fondo si sente: serve una pulizia piena.';
    if (P.nrMethod !== 'ia') set('nrMethod', 'ia', why);
    if (P.nrMix < 100) set('nrMix', 100, why);
  }
  // 2. eco: coda dopo le frasi oltre 180 ms, "Riduci l'eco" a 0,5 o 0,6 secondo quanto è lunga. Non oltre 0,6: sulle
  // registrazioni reali 0,7 e 0,8 non accorciano la coda misurata più di 0,5 e rischiano una voce meno naturale
  if (d.decayMs != null && d.decayMs > 180) {
    const e = clamp(0.5 + Math.floor((d.decayMs - 180) / 100) * 0.1, 0.5, 0.6);
    if (P.eco < e) set('eco', e, 'Dopo le frasi la stanza risuona per circa ' + d.decayMs + ' ms: c’è rimbombo.');
  }
  // 3. sibilanti: oltre -12 dB de-esser acceso e più deciso, oltre -8 dB ancora di più
  if (d.sibDb != null && d.sibDb > SIB_WARN) {
    const why = 'Le “s” fischiano un po’ troppo.', a = d.sibDb > SIB_STRONG ? 10 : 8;
    if (!P.deessOn) set('deessOn', true, why);
    if (P.deessAmt < a) set('deessAmt', a, why);
  }
  // 4. ronzio trovato nelle pause: anti-ronzio sulla rete e sulle armoniche trovate
  if (d.hum && d.hum.found) {
    const why = 'Nelle pause si sente il ronzio della corrente elettrica.';
    set('humOn', true, why); set('humFreq', d.hum.base, why); set('humHarm', Math.max(1, d.hum.harm), why);
  }
  // avvisi senza cambi
  if (d.clipRuns) notes.push('In ' + d.clipRuns + (d.clipRuns > 1 ? ' punti' : ' punto') + ' la registrazione è distorta perché troppo forte: non si può riparare del tutto. Se puoi, registra quei passaggi un po’ più piano.');
  if (d.lufs < -35) notes.push('La registrazione è piuttosto bassa: il volume si sistema da solo, ma la prossima volta conviene registrare un po’ più forte.');
  return { changes, notes };
}
// Righe della scheda riepilogativa, in parole semplici: ok = a posto, altrimenti da correggere o da sapere
function summaryRows(d) {
  const rows = [];
  rows.push(['Rumore di fondo', d.snr >= 35 ? 'basso' : d.snr >= 25 ? 'medio, da pulire' : 'alto, da pulire', d.snr >= 35]);
  rows.push(['Eco della stanza', d.decayMs == null ? 'non misurabile' : d.decayMs <= 120 ? 'poca' : d.decayMs <= 180 ? 'un po’' : 'molta, da ridurre', d.decayMs == null || d.decayMs <= 180]);
  rows.push(['Sibilanti (le “s”)', d.sibDb == null ? 'non misurabili' : d.sibDb > SIB_STRONG ? 'molto forti, da correggere' : d.sibDb > SIB_WARN ? 'un po’ forti, da correggere' : 'normali', d.sibDb == null || d.sibDb <= SIB_WARN]);
  rows.push(['Volume della registrazione', d.lufs < -35 ? 'basso, verrà alzato' : d.lufs > -12 ? 'alto, verrà abbassato' : 'buono', d.lufs >= -35 && d.lufs <= -12]);
  rows.push(['Ronzio elettrico', d.hum && d.hum.found ? 'presente, da togliere' : 'assente', !(d.hum && d.hum.found)]);
  rows.push(['Distorsione', d.clipRuns ? 'presente' : 'assente', !d.clipRuns]);
  return rows;
}
let PROPOSALS = null;
// elenco con ✓ (a posto) e ! (da sistemare); value può mancare
function arList(rows, ul) {
  ul = ul || document.createElement('ul'); ul.className = 'ar-rows'; ul.innerHTML = '';
  rows.forEach(([label, value, ok]) => {
    const li = document.createElement('li'); li.className = ok ? 'ok' : 'warn';
    const ic = document.createElement('span'); ic.className = 'ar-ic'; ic.textContent = ok ? '✓' : '!'; ic.setAttribute('aria-label', ok ? 'a posto' : 'da sistemare');
    const l = document.createElement('span'); l.className = 'ar-l'; l.textContent = label; li.append(ic, l);
    if (value) { const v = document.createElement('span'); v.className = 'ar-v'; v.textContent = value; li.appendChild(v); }
    ul.appendChild(li);
  });
  return ul;
}
function renderAssist(state) {
  const box = $('#proposeBox'); box.innerHTML = ''; box.hidden = false;
  if (state === 'refined') { box.textContent = 'La voce è segnata come già rifinita: resta solo il volume, non c’è niente da proporre.'; return; }
  const { d, changes, notes } = PROPOSALS;
  const h = document.createElement('h3'); h.className = 'ar-h'; h.textContent = state === 'applied' ? 'Suggerimenti applicati' : 'Risultato dell’analisi'; box.appendChild(h);
  box.appendChild(arList(summaryRows(d)));
  const sug = document.createElement('p'); sug.className = 'ar-sug';
  sug.innerHTML = state === 'applied' ? '<b>Fatto.</b> Ascolta e confronta con Originale e Migliorata, in basso.'
    : '<b>Suggerimento:</b> ' + (changes.length ? 'applicare le regolazioni consigliate. Basta un clic.' : 'la voce è già in buona forma: basta applicare i miglioramenti di base.');
  box.appendChild(sug);
  notes.forEach(t => { const p = document.createElement('p'); p.className = 'note'; p.textContent = t; box.appendChild(p); });
  if (changes.length) {
    const det = document.createElement('details'); det.className = 'ar-det';
    det.innerHTML = '<summary>Cosa cambia (' + changes.length + (changes.length > 1 ? ' regolazioni' : ' regolazione') + ')</summary>';
    const ul2 = document.createElement('ul');
    changes.forEach(c => { const li = document.createElement('li'), b = document.createElement('b'), w = document.createElement('span'); b.textContent = paramLabel(c.k) + ': ' + paramText(c.k, c.from) + ' → ' + paramText(c.k, c.to) + '. '; w.className = 'why'; w.textContent = c.why; li.append(b, w); ul2.appendChild(li); });
    det.appendChild(ul2); box.appendChild(det);
  }
  const row = document.createElement('div'); row.className = 'btnrow';
  if (state === 'applied') { if (PROPOSE_OLD) { const u = document.createElement('button'); u.className = 'btn'; u.id = 'btnProposeUndo'; u.textContent = 'Torna alle regolazioni di prima'; u.addEventListener('click', undoPropose); row.appendChild(u); } }
  else { const a = document.createElement('button'); a.className = 'btn primary cta-small'; a.id = 'btnApplyAll'; a.textContent = 'Applica tutti i suggerimenti'; a.addEventListener('click', applyAllSuggestions); row.appendChild(a); }
  if (row.children.length) box.appendChild(row);
}
async function analyzePropose() {
  if (!S.vlen) return;
  if (P.voiceRefined) { renderAssist('refined'); return; }
  const btn = $('#btnPropose'), prog = $('#assistProg'), bar = $('#assistBar'), msg = $('#assistMsg');
  btn.disabled = true; $('#proposeBox').hidden = true; prog.hidden = false;
  let d;
  try { d = await analyzeVoice((p, m) => { bar.style.width = Math.round(p * 100) + '%'; prog.setAttribute('aria-valuenow', String(Math.round(p * 100))); msg.textContent = m; }); }
  finally { prog.hidden = true; btn.disabled = !S.vlen; }
  PROPOSALS = Object.assign({ d }, proposalsFrom(d)); FLOW.analyzed = true;
  renderAssist('proposed'); updateApplyStatus();
  if (!reduceMotion()) { const b = $('#proposeBox'); b.classList.remove('ar-in'); void b.offsetWidth; b.classList.add('ar-in'); }
}
// Un clic: imposta tutte le regolazioni consigliate e migliora la voce
async function applyAllSuggestions() {
  if (!PROPOSALS) return;
  const old = {};
  PROPOSALS.changes.forEach(c => { if (!(c.k in old)) old[c.k] = P[c.k]; P[c.k] = c.to; syncKey(c.k); });
  PROPOSE_OLD = PROPOSALS.changes.length ? old : null;
  updateVis(); updateStyleCards(); scheduleSave();
  await improveSources();
  renderAssist('applied');
}
// Torna alle regolazioni di prima e rimigliora la voce con quelle
async function undoPropose() {
  if (!PROPOSE_OLD) return;
  Object.assign(P, PROPOSE_OLD); Object.keys(PROPOSE_OLD).forEach(syncKey); PROPOSE_OLD = null;
  updateVis(); updateStyleCards(); scheduleSave();
  await improveSources();
  $('#proposeBox').textContent = 'Regolazioni di prima ripristinate e applicate.';
}

/* ========================= Modalità Podcast ========================= */
// Un clic per un episodio pronto: la stessa analisi di "Analizza e proponi" più respiri, click e differenze di volume
// tra le frasi; poi lo stile Podcast, le regole dei suggerimenti, livellatore, click e respiri solo se servono, il volume
// per la pubblicazione (-16 LUFS, picchi a -1 dBTP, MP3) e la voce migliorata. Alla fine punteggio e "Episodio pronto".
// Tutto si annulla con "Torna alle regolazioni di prima"; con la voce già rifinita cambia solo il volume del file.
// il volume finale scelto da chi usa il programma resta, se è tra -20 e -14 LUFS (valori adatti ai podcast); altrimenti -16
const PODCAST_EXPORT = { expNorm: true, expCeil: -1, expFormat: 'mp3', expWhich: 'proc' };
let PODCAST = null;
// quanto cambia il volume tra le frasi: livello della voce su finestre di 2 s, differenza tra le più forti e le più deboli
function speechSpread(x) {
  const L = blockLevels(x), act = Array.from(L).filter(v => v > -100); if (act.length < 300) return 0;
  const thr = Math.max(percentile(act, 0.1) + 10, percentile(act, 0.9) - 25), lv = [];
  for (let a = 0; a + 200 <= L.length; a += 100) {
    let s = 0, c = 0; for (let b = a; b < a + 200; b++) if (L[b] > thr) { s += Math.pow(10, L[b] / 10); c++; }
    if (c >= 40) lv.push(10 * Math.log10(s / c));
  }
  return lv.length >= 4 ? percentile(lv, 0.9) - percentile(lv, 0.1) : 0;
}
// respiri, click e differenze tra le frasi: su 3 minuti al centro della voce, per restare rapidi anche su un capitolo lungo
async function podcastExtra(phase, x, d) {
  const M = 180 * SR, ex = x.length > M ? x.subarray((x.length - M) >> 1, (x.length + M) >> 1) : x, min = Math.max(ex.length / SR / 60, 0.1);
  await phase(0.8, 'Ascolto di respiri e click…');
  d.clicksMin = deClick(ex, P.clickSens).clicks / min;
  try { d.breathsMin = lowerBreaths(ex, await analyzeVad(ex, () => { }), 6, P.breathSens).breaths / min; } catch { d.breathsMin = 0; }
  await phase(0.86, 'Analisi delle differenze di volume tra le frasi…'); d.spread = speechSpread(ex);
}
// risultato, punteggio e consigli: post sono le misure della voce migliorata (null se la voce era già rifinita).
// Rimbombo, chiarezza e sibilanti si giudicano sul risultato, con le stesse soglie dell'analisi; i consigli per la
// prossima registrazione guardano invece l'originale, cioè la stanza e il microfono
const POST_ECHO_MS = 250;
function podcastResult(d, post, set) {
  const rows = [], tips = []; let bad = 0, meh = 0;
  if (post) {
    rows.push(post.snr >= 25 ? ['Rumore ridotto', '', true] : ['Rumore ridotto, ma ancora udibile', '', false]);
    if (set.humOn) rows.push(['Ronzio elettrico eliminato', '', true]);
    const echoOk = !(post.decayMs > POST_ECHO_MS), sibOk = post.sibDb == null || post.sibDb <= SIB_WARN;
    if (set.eco) rows.push(echoOk ? ['Rimbombo della stanza ridotto', '', true] : ['Rimbombo ridotto, ma ancora presente', '', false]);
    rows.push(sibOk ? ['Sibilanti sotto controllo', '', true] : ['Sibilanti un po’ evidenti: da ascoltare', '', false]);
    rows.push(['Dinamica bilanciata', '', true]);
    if (set.clickOn || set.breathOn) rows.push([set.clickOn && set.breathOn ? 'Click e respiri attenuati' : set.clickOn ? 'Click di bocca attenuati' : 'Respiri resi più discreti', '', true]);
    rows.push(post.snr >= 25 && echoOk ? ['Parole chiare', '', true] : ['Parole un po’ velate ' + (echoOk ? 'dal rumore' : 'dal rimbombo'), '', false]);
  } else rows.push(['Voce già rifinita, lasciata com’è', '', true]);
  rows.push(['Volume pronto per le app dei podcast', '', true]);
  if (d.clipRuns) { bad++; tips.push('In ' + d.clipRuns + (d.clipRuns > 1 ? ' punti' : ' punto') + ' la voce è distorta perché registrata troppo forte, e non si ripara del tutto. Se puoi, registra di nuovo quei passaggi un po’ più lontano dal microfono.'); }
  if (post && post.snr < 25) { bad++; tips.push('Il rumore di fondo si sente ancora. La prossima volta registra in un ambiente più silenzioso, lontano da ventole e finestre.'); }
  if (d.decayMs > 300) { meh++; tips.push('La stanza rimbomba molto. La prossima volta registra in una stanza con tende, tappeti o un armadio pieno di vestiti.'); }
  if (d.lufs < -40) { meh++; tips.push('La registrazione era molto bassa. La prossima volta parla più vicino al microfono.'); }
  if (post && post.sibDb > SIB_WARN) { meh++; tips.push('Dopo l’ottimizzazione le “s” si sentono di più. Ascoltale: se fischiano, apri le regolazioni avanzate e alleggerisci il Compressore, oppure la prossima volta parla leggermente di lato rispetto al microfono.'); }
  const score = bad ? 2 : meh || (post && post.snr < 40) ? 1 : 0;
  const lead = ['La tua voce è pronta per la pubblicazione.', 'La registrazione è stata ottimizzata automaticamente ed è pronta da pubblicare.',
    'La registrazione è stata ottimizzata automaticamente. Si può pubblicare, ma qualche accorgimento la renderà migliore.'][score];
  return { rows, tips, score, label: ['Ottimo', 'Buono', 'Da migliorare'][score], lead };
}
async function podcastMode() {
  if (!S.vlen) return;
  const btn = $('#btnPodcast'), alt = $('#btnPropose'), prog = $('#assistProg'), bar = $('#assistBar'), msg = $('#assistMsg');
  btn.disabled = alt.disabled = true; $('#proposeBox').hidden = true; prog.hidden = false;
  let d;
  try { d = await analyzeVoice((p, m) => { bar.style.width = Math.round(p * 100) + '%'; prog.setAttribute('aria-valuenow', String(Math.round(p * 100))); msg.textContent = m === 'Fatto.' ? 'Analisi completata.' : m === 'Preparazione dei suggerimenti…' ? 'Scelta delle regolazioni…' : m; }, podcastExtra); }
  finally { prog.hidden = true; btn.disabled = alt.disabled = !S.vlen; }
  const old = {}, set = (k, v) => { if (!(k in old)) old[k] = P[k]; P[k] = v; };
  if (!P.voiceRefined) {
    const st = VOICE_STYLES.find(s => s.id === 'podcast'); Object.keys(st.v).forEach(k => set(k, st.v[k]));
    proposalsFrom(d).changes.forEach(c => set(c.k, c.to));
    ['compOn', 'deessOn', 'gateOn', 'voiceNorm'].forEach(k => set(k, true));
    if (d.spread > 6) set('levOn', true);
    if (d.clicksMin >= 2) set('clickOn', true);
    if (d.breathsMin >= 3) set('breathOn', true);
  }
  Object.keys(PODCAST_EXPORT).forEach(k => set(k, PODCAST_EXPORT[k])); if (P.expTarget < -20 || P.expTarget > -14) set('expTarget', -16);
  const changed = {}; Object.keys(old).forEach(k => { if (old[k] !== P[k]) { changed[k] = P[k]; syncKey(k); } else delete old[k]; });
  PROPOSE_OLD = Object.keys(old).length ? old : null;
  updateVis(); updateStyleCards(); scheduleSave();
  if (!P.voiceRefined) await improveSources();
  let post = null;
  if (!P.voiceRefined) { const y = renderVoice(0, S.vlen, true); post = Object.assign(diagNoise(y), { sibDb: measureSib(y) }); }
  PODCAST = podcastResult(d, post, { humOn: changed.humOn, eco: d.decayMs > 180 && 'eco' in changed, clickOn: changed.clickOn, breathOn: changed.breathOn });
  if (!S.musicId) FLOW.musicSkipped = true;      // il prossimo passo è l'esportazione; la musica resta nella sua scheda
  renderPodcast(); flowUpdate(); openEpisode();
}
// riepilogo breve nella scheda Migliora, con il ritorno alle regolazioni di prima
function renderPodcast() {
  const box = $('#proposeBox'); box.innerHTML = ''; box.hidden = false;
  const h = document.createElement('h3'); h.className = 'ar-h'; h.textContent = 'Episodio pronto · ' + PODCAST.label; box.append(h, arList(PODCAST.rows));
  const row = document.createElement('div'); row.className = 'btnrow';
  const r = document.createElement('button'); r.className = 'btn'; r.type = 'button'; r.textContent = 'Rivedi il riepilogo'; r.addEventListener('click', openEpisode); row.appendChild(r);
  if (PROPOSE_OLD) { const u = document.createElement('button'); u.className = 'btn'; u.id = 'btnProposeUndo'; u.textContent = 'Torna alle regolazioni di prima'; u.addEventListener('click', undoPropose); row.appendChild(u); }
  box.appendChild(row);
}
// schermata "Episodio pronto"
function openEpisode() {
  const dl = $('#episode'); if (!PODCAST || !dl) return;
  $('#epLead').textContent = PODCAST.lead;
  const sc = $('#epScore'); sc.dataset.level = String(PODCAST.score); $('#epScoreV').textContent = PODCAST.label;
  arList(PODCAST.rows, $('#epRows'));
  const tl = $('#epTipList'); tl.innerHTML = ''; PODCAST.tips.forEach(t => { const li = document.createElement('li'); li.textContent = t; tl.appendChild(li); });
  $('#epTips').hidden = !PODCAST.tips.length;
  if (!dl.open) dl.showModal(); $('#epExport').focus();
}
function initEpisode() {
  $('#epExport').addEventListener('click', () => { $('#episode').close(); P.expFormat = 'mp3'; syncKey('expFormat'); updateVis(); flowShowTab('export'); flowUpdate(); doExport(); });
  $('#epAdv').addEventListener('click', () => { $('#episode').close(); flowShowTab('improve'); advOpen = true; applyAdvGroup(); flowFocus('#advToggle'); });
}

/* ---------- avvisi accanto a Esporta ---------- */
// Solo i due errori che non si vedono: voce migliorata rimasta indietro rispetto alle regolazioni, e "Solo la selezione" attivo
function updateExportWarn() {
  const box = $('#exportWarn'); if (!box) return;
  const key = improveKey(), stale = S.vlen && P.expWhich === 'proc' && !P.voiceRefined && S.procActive &&
    (S.procKey !== key || [...S.sources.values()].some(s => s.kind === 'voce' && S.segs.some(g => g.src === s.id) && !(S.improved.get(s.id) && S.improved.get(s.id).key === key)));
  const sel = P.expSelOnly ? (S.sel ? 'È attivo «Solo la selezione»: verrà esportato solo il tratto ' + fmtSec(S.sel[0]) + ' - ' + fmtSec(S.sel[1]) + ' (' + fmtDur((S.sel[1] - S.sel[0]) / SR) + ').'
    : 'È attivo «Solo la selezione», ma non c’è nessuna selezione.') : '';
  box.innerHTML = ''; box.hidden = !stale && !sel;
  if (stale) {
    const p = document.createElement('p'); p.textContent = 'La voce migliorata non è aggiornata alle ultime regolazioni: il file uscirebbe con la versione precedente. ';
    const b = document.createElement('button'); b.className = 'linkbtn'; b.type = 'button'; b.textContent = 'Aggiorna ora'; b.addEventListener('click', improveSources); p.appendChild(b); box.appendChild(p);
  }
  if (sel) { const p = document.createElement('p'); p.textContent = sel; box.appendChild(p); }
}

/* ========================= Accorcia i silenzi lunghi ========================= */
// Una pausa è un tratto della voce montata in cui RNNoise non sente voce (probabilità sotto 0,4) e il livello resta
// almeno 20 dB sotto il parlato: servono tutte e due le condizioni, così non si taglia mai dentro una parola.
// Delle pause più lunghe di silMin si tiene silMax, metà all'inizio e metà alla fine, e si toglie il centro.
// I tagli diventano una sola operazione in cronologia, con la dissolvenza sui tagli come gli altri.
const SIL = { key: '', ranges: null };
async function findSilences() {
  if (!S.vlen) return null;
  if (!vadReady()) await ensureVad();
  if (!vadReady()) return null;
  const vv = voiceVad(), L = blockLevels(rawVoice()), act = Array.from(L).filter(v => v > -100);
  if (act.length < 50) return [];
  const sp = percentile(act, 0.9), n = Math.min(vv.length, L.length), minB = Math.round(P.silMin * 100), keep = Math.round(P.silMax * SR), ranges = [];
  for (let b = 0; b < n; b++) {
    if (!(vv[b] < 0.4 && L[b] < sp - 20)) continue;
    let e = b; while (e + 1 < n && vv[e + 1] < 0.4 && L[e + 1] < sp - 20) e++;
    if (e - b + 1 >= minB) { const s0 = b * 480, s1 = (e + 1) * 480, a = s0 + (keep >> 1), z = s1 - (keep - (keep >> 1)); if (z - a > 480) ranges.push([a, z]); }
    b = e;
  }
  return ranges;
}
const silKey = () => [S.version, P.silMin, P.silMax].join('|');
async function previewSilences() {
  const st = $('#silStatus'), btn = $('#btnSilApply'); if (!S.vlen) return;
  if (P.silMax >= P.silMin) { st.textContent = 'La durata da lasciare deve essere più corta della pausa minima.'; btn.disabled = true; return; }
  busy(true, 'Ricerca delle pause…'); await yieldUI();
  let r; try { r = await findSilences(); } finally { busy(false); }
  if (!r) { st.textContent = 'Non è stato possibile riconoscere la voce: riprova.'; btn.disabled = true; return; }
  SIL.key = silKey(); SIL.ranges = r;
  const cut = r.reduce((t, [a, b]) => t + b - a, 0) / SR;
  st.textContent = r.length ? 'Trovate ' + r.length + (r.length > 1 ? ' pause' : ' pausa') + ' più lunghe di ' + fmtNum(P.silMin, 1) + ' s. Accorciandole a ' + fmtNum(P.silMax, 1) + ' s la voce passa da ' + fmtDur(S.vlen / SR) + ' a ' + fmtDur(S.vlen / SR - cut) + ': ' + fmtNum(cut, 1) + ' s in meno.'
    : 'Nessuna pausa più lunga di ' + fmtNum(P.silMin, 1) + ' s.';
  btn.disabled = !r.length;
}
function applySilences() {
  if (!SIL.ranges || !SIL.ranges.length || SIL.key !== silKey()) { $('#btnSilApply').disabled = true; $('#silStatus').textContent = 'Il montaggio o le impostazioni sono cambiati: premi di nuovo “Cerca le pause”.'; return; }
  const r = SIL.ranges, cut = r.reduce((t, [a, b]) => t + b - a, 0) / SR;
  if (S.playing) stopPlayback();
  pushOp({ type: 'cuts', ranges: r.map(x => x.slice()), label: 'Accorciate ' + r.length + (r.length > 1 ? ' pause lunghe' : ' pausa lunga') + ' (' + fmtNum(cut, 1) + ' s in meno)' });
  SIL.ranges = null; $('#btnSilApply').disabled = true;
  $('#silStatus').textContent = 'Fatto: ' + fmtNum(cut, 1) + ' s in meno. Si annulla come ogni altra modifica.';
  toast('Pause accorciate. Annulla le riporta com’erano.');
}

/* ========================= Catena di miglioramento ========================= */
function peaking(oc, f, q, g) { const n = oc.createBiquadFilter(); n.type = 'peaking'; n.frequency.value = f; n.Q.value = q; n.gain.value = g; return n; }
function eqBuild(oc, src) {
  const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = P.hp; hp.Q.value = 0.707;
  const ls = oc.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 140; ls.gain.value = P.lowShelf;
  const hs = oc.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 9000; hs.gain.value = P.air;
  const chain = [hp, peaking(oc, 220, 0.8, P.lowMid), peaking(oc, 380, 1.0, P.mud), ls, peaking(oc, 3200, 0.9, P.presence), peaking(oc, 6500, 1.3, P.harsh), hs];
  src.connect(chain[0]); for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
  return chain[chain.length - 1];
}
function compBuild(oc, src) {
  const cp = oc.createDynamicsCompressor();
  cp.threshold.value = P.compThr; cp.knee.value = 10; cp.ratio.value = P.compRatio;
  cp.attack.value = P.compAtk / 1000; cp.release.value = P.compRel / 1000;
  src.connect(cp); return cp;
}
// Una registrazione originale passa da tutta la catena; il volume finale si regola poi sulla voce montata.
// id: la registrazione da cui viene x, per riusare o salvare la probabilità di voce
async function processSource(x, prog, id) {
  const st = 6; let k = 0; const sub = f => prog((k + f) / st);
  const x0 = x;
  // click per primi: la pulizia li spalmerebbe e poi non si riconoscerebbero più
  if (P.clickOn) { x = deClick(x, P.clickSens); await yieldUI(); }
  // anti-ronzio per primo: un ronzio fisso inganna sia RNNoise sia la stima del rumore della pulizia classica
  if (P.humOn) { x = await renderChain(x, (oc, src) => humBuild(oc, src, P.humFreq, P.humHarm, P.humDb, P.humBw)); await yieldUI(); }
  if (P.nrMethod === 'ia') {
    const raw = id && !VAD.has(id) && x === x0 ? new Float32Array(Math.ceil(x.length / 480) + 1) : null;
    x = await runRnnoise(x, P.nrMix / 100, sub, raw);
    if (raw) VAD.set(id, vadFromRaw(raw, x0.length));
  }
  else if (P.nrMethod === 'classica') { try { x = await denoise(x, SR, autoNoiseRange(x, SR), P.nrDb, P.nrAlpha, P.eco, sub); } catch { } }
  k++;
  if (P.eco > 0 && P.nrMethod !== 'classica') { try { x = await denoise(x, SR, autoNoiseRange(x, SR), 10, 1.0, P.eco, sub); } catch { } }
  k++; sub(0); await yieldUI();
  // plosivi dopo la pulizia (niente falsi allarmi dal rumore basso) e prima dell'equalizzatore (che cambia i bassi)
  if (P.plosOn) { x = dePlosive(x, P.plosFreq, P.plosSens, P.plosMax); await yieldUI(); }
  x = await renderChain(x, eqBuild); k++; sub(0); await yieldUI();
  const l = lufs(x, true); if (l > -90) x = scaleArr(x, dbToGain(REF_LEVEL - l));   // livello noto prima della dinamica: il volume finale si regola dopo
  k++; sub(0); await yieldUI();
  // livellatore lento prima del compressore: pareggia le frasi, poi il compressore rifinisce
  if (P.levOn) { x = levelSlow(x, P.levAmt / 100, P.levMax, P.gateOver); await yieldUI(); }
  if (P.compOn) x = await renderChain(x, compBuild);
  // de-esser dopo il compressore: prima, il compressore rialzava le "s" di 3-4 dB abbassando le vocali
  if (P.deessOn) x = deEss(x, P.deessThr, P.deessAmt);
  k++; sub(0); await yieldUI();
  // respiri dopo il compressore, che li alza, e prima del gate; servono la probabilità di voce di RNNoise
  if (P.breathOn) {
    if (id && !VAD.has(id)) VAD.set(id, await analyzeVad(x0, () => { }));
    x = lowerBreaths(x, id ? VAD.get(id) : null, P.breathDb, P.breathSens); await yieldUI();
  }
  if (P.gateOn) {
    let vad = null;
    if (P.vadMode === 'ai' && id) { if (!VAD.has(id)) VAD.set(id, await analyzeVad(x0, () => { })); vad = VAD.get(id); }
    x = applyGate(x, P.gateOver, P.gateRed, vad, vadThr());
  }
  return x;
}
async function improveSources() {
  if (P.voiceRefined) { toast('La voce è segnata come già rifinita: la catena di miglioramento è spenta.'); return; }
  const key = improveKey(), todo = [...S.sources.values()].filter(s => s.kind === 'voce' && S.segs.some(g => g.src === s.id));
  const need = todo.filter(s => { const im = S.improved.get(s.id); return !im || im.key !== key; });
  if (S.playing) stopPlayback();
  try {
    for (let i = 0; i < need.length; i++) {
      const s = need[i], msg = 'Miglioramento ' + (need.length > 1 ? (i + 1) + ' di ' + need.length + ': ' : '') + s.name + '…';
      busy(true, msg, i / need.length);
      const data = await processSource(s.chs[0], f => busy(true, msg, (i + f) / need.length), s.id);
      S.improved.set(s.id, { key, data });
    }
    S.procKey = key; S.procActive = true; S.mode = 'proc'; S.dirtyImprove = false;
    if (need.length) toast('Fatto. Alterna Originale e Migliorata in basso per confrontare.');
  } catch (e) { toast(e && e.message ? e.message : 'Miglioramento non riuscito.'); }
  finally { busy(false); }
  drawAll(); updateTransport(); updateApplyStatus(); scheduleDiag(); scheduleSave(); updateLevelStatus();
}

/* ========================= Misure della voce montata ========================= */
let diagT = null;
function scheduleDiag() { clearTimeout(diagT); diagT = setTimeout(renderDiag, 400); }
const METRIC_HELP = {
  'Durata': 'Lunghezza della voce montata, dopo tagli e incollature.',
  'Volume (LUFS)': 'Volume percepito di tutta la voce, contata come mono su due casse come in Sottovoce. Per la voce si punta a circa -19, per pubblicare direttamente a -16.',
  'Picco vero': 'Il punto più alto del segnale, compresi i picchi tra un campione e l’altro. Vicino a 0 dB c’è rischio di distorsione.',
  'Saturazione': 'Punti in cui il segnale è stato tagliato perché troppo forte in registrazione. Non si ripara del tutto.',
  'Rumore di fondo': 'Livello delle pause tra le frasi. Più è basso (più negativo), meglio è.',
  'Segnale/rumore': 'Di quanto la voce supera il rumore. Sopra 40 dB è ottimo, sotto 25 il rumore si sente.',
  'Sibilanti': 'Quanto spiccano le s rispetto al resto della voce, misurate tra 5 e 9 kHz. Sopra -12 dB pungono, sopra -8 dB molto.',
  'Ronzio': 'Il ronzio elettrico a 50 o 60 Hz cercato nelle pause: quanto spicca sulle frequenze vicine.',
  'Coda dopo le frasi': 'Stima di quanto dura l’eco della stanza dopo che smetti di parlare. Sotto 100 ms la stanza è asciutta, sopra 180 ms è riverberante.'
};
function renderDiag() {
  const box = $('#diagBody'); if (!box) return;
  if (!S.vlen) { box.innerHTML = '<p class="status">Registra o importa la voce per vedere le misure.</p>'; return; }
  // volume, picco e saturazione dell'originale così com'è; rumore, segnale/rumore ed eco a pari volume
  const ox = rawVoice(), a = diagnose(ox), b = S.procActive ? diagnose(scaleArr(renderVoice(0, S.vlen, true), voiceGain('proc'))) : null;
  if (b && a.lufs > -90) { const eq = diagnose(scaleArr(ox, dbToGain(P.target - a.lufs))); a.noiseDb = eq.noiseDb; a.speechDb = eq.speechDb; a.snr = eq.snr; }
  const rows = [
    ['Durata', d => fmtDur(d.durSec), () => 'ok'],
    ['Volume (LUFS)', d => fmtNum(d.lufs, 1), d => d.lufs < -30 ? 'warn' : 'ok'],
    ['Picco vero', d => fmtDb(d.tp, 1) + ' dB', d => d.clipRuns ? 'bad' : d.tp > -1 ? 'warn' : 'ok'],
    ['Saturazione', d => d.clipRuns ? d.clipRuns + ' punti' : 'nessuna', d => d.clipRuns ? 'bad' : 'ok'],
    ['Rumore di fondo', d => fmtNum(d.noiseDb, 0) + ' dB', d => d.snr < 25 ? 'bad' : d.snr < 35 ? 'warn' : 'ok'],
    ['Segnale/rumore', d => fmtNum(d.snr, 0) + ' dB', d => d.snr < 25 ? 'bad' : d.snr < 35 ? 'warn' : 'ok'],
    ['Coda dopo le frasi', d => d.decayMs == null ? 'non stimabile' : d.decayMs + ' ms', d => d.decayMs != null && d.decayMs > 180 ? 'warn' : 'ok'],
    ['Sibilanti', d => d.sibDb == null ? 'non stimabili' : fmtNum(d.sibDb, 0) + ' dB', d => d.sibDb == null ? 'ok' : d.sibDb > SIB_STRONG ? 'bad' : d.sibDb > SIB_WARN ? 'warn' : 'ok'],
    ['Ronzio', d => !d.hum ? 'non stimabile' : d.hum.found ? d.hum.base + ' Hz, ' + fmtNum(d.humDb, 0) + ' dB' : 'nessuno', d => d.hum && d.hum.found ? (d.humDb > 20 ? 'bad' : 'warn') : 'ok']
  ];
  const word = { ok: 'bene', warn: 'attenzione', bad: 'problema' };
  box.innerHTML = '';
  const grid = document.createElement('div'); grid.className = 'metrics';
  rows.forEach(([name, f, cls]) => {
    const c = document.createElement('div'), st = cls(b || a); c.className = 'metric ' + st; c.dataset.tip = METRIC_HELP[name];
    const s1 = document.createElement('span'); s1.textContent = name;
    const v = document.createElement('b'); v.textContent = b ? f(a) + ' → ' + f(b) : f(a);
    const w = document.createElement('i'); w.textContent = word[st];
    c.append(s1, v, w); grid.appendChild(c);
  });
  box.appendChild(grid);
  const n = document.createElement('p'); n.className = 'note';
  n.textContent = b ? 'A sinistra l’originale, a destra la migliorata portata all’obiettivo di volume. Rumore di fondo e segnale/rumore sono confrontati a pari volume. Valori indicativi: l’ultima parola spetta all’orecchio.' : 'Misure dell’originale. Dopo “Applica i miglioramenti” compare il confronto.';
  box.appendChild(n);
  scheduleSpec(0);        // la vista in frequenza si aggiorna insieme alle misure
}
function updateApplyStatus() {
  const st = $('#applyStatus'); if (!st) return;
  $('#btnApply').disabled = !S.vlen; $('#btnHum').disabled = !S.vlen; $('#btnPropose').disabled = !S.vlen; $('#btnPodcast').disabled = !S.vlen; $('#btnSilFind').disabled = !S.vlen; if (SIL.key !== silKey()) $('#btnSilApply').disabled = true;
  const key = improveKey(), unproc = [...S.sources.values()].filter(s => s.kind === 'voce' && S.segs.some(g => g.src === s.id) && !(S.improved.get(s.id) && S.improved.get(s.id).key === key));
  let msg, dirty = false;
  if (P.voiceRefined) msg = 'Voce già rifinita: la catena di miglioramento è spenta, resta solo la normalizzazione del volume.';
  else if (!S.vlen) msg = 'Registra o importa prima la voce.';
  else if (!S.procActive) msg = 'Nessun miglioramento applicato ancora.';
  else if (S.procKey !== key) { msg = 'Hai cambiato delle impostazioni: premi di nuovo “Applica i miglioramenti”.'; dirty = true; }
  else if (unproc.length) { msg = 'Una parte della voce non è ancora migliorata: premi “Applica i miglioramenti”.'; dirty = true; }
  else msg = 'Miglioramenti applicati. Ascolta e confronta con i pulsanti in basso.';
  st.textContent = msg; st.classList.toggle('dirty', dirty);
  updateExportWarn(); flowUpdate();                    // percorso guidato: dopo i miglioramenti si propone la musica
}

