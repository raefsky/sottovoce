/* ========================= Importazione della voce ========================= */
// replaceAll: il file prende il posto di tutta la voce; musica, effetti, titolo e impostazioni restano
// una seconda voce caricata dal riquadro o trascinata: si chiede se prende il posto di quella che c'è o va in fondo.
// Con "Al cursore" o "Al posto della selezione" scelti a mano non si chiede nulla
function askVoiceImport(file) {
  return new Promise(res => {
    const d = $('#voiceAsk'); let v = null;
    const cur = [...new Set(S.segs.filter(g => g.src).map(g => S.sources.get(g.src)).filter(Boolean).map(s => s.name))];
    $('#vaText').textContent = 'C’è già una voce' + (cur.length === 1 ? ' (' + cur[0] + ', ' + fmtSec(S.vlen) + ')' : ' di ' + fmtSec(S.vlen)) + '. Cosa fare con «' + file.name + '»?';
    $('#vaReplace').onclick = () => { v = 'replace'; d.close(); }; $('#vaAppend').onclick = () => { v = 'append'; d.close(); };
    d.addEventListener('close', () => res(v), { once: true }); d.showModal(); $('#vaReplace').focus();
  });
}
async function importVoice(file, replaceAll) {
  if (!file || S.recording) return;
  if (!replaceAll && S.vlen && P.recWhere === 'end') { const c = await askVoiceImport(file); if (!c) return; replaceAll = c === 'replace'; }
  stopIfPlaying(); busy(true, 'Lettura di ' + file.name + '…', 0.2);
  try {
    const d = await decodeFile(file), x = toMono(d.chs);
    const id = addSource(file.name, 'voce', [x]); saveSource(id);
    const lay = layout(), clip = [{ src: id, s: 0, len: x.length, f: [] }], what = '“' + file.name + '” (' + fmtDur(x.length / SR) + ')';
    const r = selVoice();
    if ((replaceAll || P.recWhere === 'all') && S.vlen) {
      pushOp({ type: 'replace', a: 0, b: S.vlen, clip, label: 'Voce sostituita con ' + what }); S.cur = layout().intro; S.sel = null;
      // l'analisi e il riepilogo erano della voce di prima
      PROPOSALS = null; PODCAST = null; FLOW.analyzed = false; const pb = $('#proposeBox'); pb.hidden = true; pb.innerHTML = '';
    }
    else if (P.recWhere === 'replace' && r) pushOp({ type: 'replace', a: r[0], b: r[1], clip, label: 'Importato ' + what + ' al posto della selezione' });
    else if (P.recWhere === 'cursor' && S.vlen) { const at = clamp(S.cur - lay.intro, 0, S.vlen); pushOp({ type: 'insert', at, clip, label: 'Importato ' + what + ' a ' + fmtSec(at) }); }
    else pushOp({ type: 'insert', at: S.vlen, clip, label: 'Importato ' + what + (S.vlen ? ' in fondo' : '') });
    $('#nameVoice').textContent = file.name + (d.chs.length > 1 ? ' (stereo convertita in mono)' : '') + '. Per cambiarla, trascina qui un altro file.';
    S.fit = true; drawAll();
    busy(false);
    if (S.procActive) await improveSources();
    else toast(replaceAll || P.recWhere === 'all' ? 'Voce sostituita. Musica, effetti e titolo restano; per tornare alla voce di prima premi Annulla.' : 'Voce importata. Ora puoi montarla o migliorarla nella scheda 2.');
  } catch (e) { busy(false); toast('Questo file non si può leggere. Prova con un WAV, MP3, M4A o FLAC.'); }
}

/* ========================= Zip semplice (senza compressione) ========================= */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8, c) { c = c == null ? 0xFFFFFFFF : c; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return c; }
function makeZip(entries) {      // entries: [{ name, data: Uint8Array }] oppure [{ name, blob, crc, size }] già pronti
  const dt = new Date(), dosTime = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1);
  const dosDate = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
  const body = [], central = []; let offset = 0;
  for (const e of entries) {
    const nm = new TextEncoder().encode(e.name), crc = e.blob ? e.crc : (crc32(e.data) ^ 0xFFFFFFFF) >>> 0, size = e.blob ? e.size : e.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, nm.length, true);
    body.push(lh, nm, e.blob || e.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(12, dosTime, true); cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, size, true); cd.setUint32(24, size, true); cd.setUint16(28, nm.length, true); cd.setUint32(42, offset, true);
    central.push(cd, nm); offset += 30 + nm.length + size;
  }
  let cdSize = 0; central.forEach(c => { cdSize += c.byteLength; });
  const eo = new DataView(new ArrayBuffer(22));
  eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, entries.length, true); eo.setUint16(10, entries.length, true); eo.setUint32(12, cdSize, true); eo.setUint32(16, offset, true);
  return new Blob(body.concat(central, [eo]), { type: 'application/zip' });
}
function readZip(ab) {
  const dv = new DataView(ab), u8 = new Uint8Array(ab), out = {};
  let e = ab.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('non è un progetto valido');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('archivio danneggiato');
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    if (method !== 0) throw new Error('il file “' + name + '” è compresso: questo progetto non è stato creato da ' + APP_NAME);
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    out[name] = u8.subarray(ds, ds + size);
    p += 46 + nl + xl + cl;
  }
  return out;
}
function wavFloat(chs) {
  const nc = chs.length, n = chs[0].length, ab = new ArrayBuffer(44 + n * nc * 4), dv = new DataView(ab), f = new Float32Array(ab, 44);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * nc * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 3, true); dv.setUint16(22, nc, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * nc * 4, true); dv.setUint16(32, nc * 4, true); dv.setUint16(34, 32, true); w(36, 'data'); dv.setUint32(40, n * nc * 4, true);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) f[i * nc + c] = chs[c][i];
  return new Uint8Array(ab);
}

/* ========================= Modifiche non salvate ========================= */
// Impronta del lavoro: montaggio ed effetti (l'elenco delle operazioni), musica, impostazioni, titolo e copertina.
// Non contano cursore, zoom e vista (vzoom, match, specView) né il microfono scelto. Si confronta con l'impronta
// dell'ultimo "Salva il progetto" (o dell'apertura di un progetto): se è diversa, ci sono modifiche non salvate su file.
// Con Chrome ed Edge, dopo il primo "Salva il progetto" il file si aggiorna da solo (81-file.js); con gli altri browser
// non c'è salvataggio automatico su file: l'indicatore e l'avviso all'uscita servono a ricordarlo.
let projFileName = '';                                  // nome dell'ultimo file di progetto salvato o aperto
function projSig() {
  const p = {}; Object.keys(P).forEach(k => { if (!PSKIP.has(k)) p[k] = P[k]; });
  const m = Object.assign({}, META, { cover: META.cover ? META.cover.length : 0 });
  return JSON.stringify([S.ops, p, m, S.musicId, S.procActive]);
}
const hasWork = () => !!(S.ops.length || S.musicId);
const isDirty = () => hasWork() && projSig() !== S.savedSig;
function markSaved() { S.savedSig = projSig(); updateDirty(); if (FLOW.step === 'fatto') flowUpdate(); }   // salvato dopo l'esportazione: percorso completo
function updateDirty() {
  const bar = $('#projBar'); if (!bar) return;
  bar.hidden = !hasWork();
  $('#projName').textContent = META.title || projFileName.replace(/\.sottovoce$/i, '') || 'Progetto senza nome';
  const d = isDirty(); $('#dirtyFlag').hidden = !d || !!(FILE.handle || FILE.pending);
  bar.title = d ? 'Ci sono modifiche non ancora salvate in un file di progetto. Il browser conserva il lavoro, ma per una copia sicura usa “Salva il progetto” nella scheda Progetto.' : 'Tutto salvato nel file di progetto.';
  updateFileFlag();
}

/* ========================= Progetto su file ========================= */
function projectState() {
  const used = new Set(S.ops.flatMap(o => (o.clip || []).map(g => g.src).concat(o.src ? [o.src] : [])).filter(Boolean));
  if (S.musicId) used.add(S.musicId);
  return {
    app: 'sottovoce-studio', version: 1, appVersion: APP_VERSION, saved: new Date().toISOString(),
    ops: S.ops, P: Object.assign({}, P, { micId: '' }), procActive: S.procActive, META: Object.assign({}, META, { cover: null }), musicId: S.musicId, cur: S.cur,
    sources: [...used].filter(id => S.sources.has(id)).map(id => { const s = S.sources.get(id); return { id, name: s.name, kind: s.kind, nch: s.chs.length, len: s.len, gain: s.gain, file: 'originali/' + id + '.wav' }; }),
    cover: META.cover ? 'copertina.jpg' : null
  };
}
// il file di progetto: progetto.json, gli originali in WAV a 32 bit e la copertina. Gli originali non cambiano mai,
// quindi il loro pezzo di zip si prepara una volta sola (ZIPSRC) e i salvataggi successivi rifanno solo progetto.json
const ZIPSRC = new Map();
async function projectBlob(onProg) {
  const st = projectState(), entries = [{ name: 'progetto.json', data: new TextEncoder().encode(JSON.stringify(st, null, 1)) }];
  for (let i = 0; i < st.sources.length; i++) {
    const s = st.sources[i]; let z = ZIPSRC.get(s.id);
    if (!z) {
      if (onProg) onProg('Salvataggio di ' + s.name + '…', 0.1 + 0.8 * i / st.sources.length);
      await yieldUI(); const data = wavFloat(S.sources.get(s.id).chs);
      z = { blob: new Blob([data]), crc: (crc32(data) ^ 0xFFFFFFFF) >>> 0, size: data.length }; ZIPSRC.set(s.id, z);
    }
    entries.push({ name: s.file, blob: z.blob, crc: z.crc, size: z.size });
  }
  for (const id of ZIPSRC.keys()) if (!S.sources.has(id)) ZIPSRC.delete(id);
  if (META.cover) entries.push({ name: 'copertina.jpg', data: META.cover });
  return makeZip(entries);
}
async function saveProject(e, other) {
  if (!S.ops.length && !S.musicId) return;
  if (FILE.ok) { await saveToFile(!!other); return; }
  stopIfPlaying(); busy(true, 'Preparazione del progetto…', 0.1);
  try {
    const blob = await projectBlob((m, p) => busy(true, m, p)), name = fileBase('progetto') + '.sottovoce';
    busy(false); downloadBlob(name, blob); projFileName = name; markSaved(); scheduleSave();
    $('#projStatus').textContent = 'Progetto salvato come “' + name + '” (' + fmtBytes(blob.size) + ') nella cartella dei download.';
  } catch (e) { busy(false); $('#projStatus').textContent = 'Salvataggio non riuscito' + (e && e.message ? ': ' + e.message : '.'); }
}
// avviso gentile per un progetto salvato da una versione più recente: si apre lo stesso (i progetti senza appVersion sono più vecchi)
function newerNote(st) {
  return st && st.appVersion && cmpVersion(st.appVersion, APP_VERSION) > 0
    ? ' Nota: è stato salvato con la versione ' + st.appVersion + ', più recente di questa (' + APP_VERSION + '). Si apre lo stesso; se qualcosa non torna, usa la versione più recente.' : '';
}
async function openProject(file, handle) {
  if (!file) return;
  if ((S.ops.length || S.musicId) && !confirm('Aprire il progetto “' + file.name + '”? Il lavoro attuale viene sostituito (resta salvato solo se hai usato “Salva il progetto”).')) return;
  stopIfPlaying(); busy(true, 'Apertura di ' + file.name + '…', 0.1);
  try {
    const files = readZip(await file.arrayBuffer());
    if (!files['progetto.json']) throw new Error('manca progetto.json');
    let st; try { st = JSON.parse(new TextDecoder().decode(files['progetto.json'])); } catch { throw new Error('il file progetto.json al suo interno è rovinato'); }
    if (st.app !== 'sottovoce-studio') throw new Error('non è un progetto di ' + APP_NAME);
    const sources = new Map();
    for (const s of st.sources) {
      const d = files[s.file]; if (!d) throw new Error('manca l’originale ' + s.name);
      const w = decodeWav(d.slice().buffer);
      sources.set(s.id, { id: s.id, name: s.name, kind: s.kind, chs: w.chs, len: w.chs[0].length, gain: s.gain });
    }
    await loadState(st, sources, st.cover && files[st.cover] ? files[st.cover].slice() : null);
    projFileName = file.name; markSaved();
    busy(false); await clearDb(); await saveAllToDb();
    await linkFile(handle || null);
    $('#projStatus').textContent = 'Progetto “' + file.name + '” aperto: ' + st.ops.length + ' modifiche, salvato il ' + new Date(st.saved).toLocaleString('it-IT') + '.' + newerNote(st);
    toast(newerNote(st) ? 'Progetto aperto. È stato salvato con una versione più recente: leggi la nota nella scheda Progetto.' : 'Progetto aperto.');
  } catch (e) { busy(false); $('#projStatus').textContent = 'Il progetto non si è aperto: ' + (e && e.message ? e.message : 'file non valido') + '.'; }
}
async function loadState(st, sources, cover) {
  SRC_GAIN.clear();
  S.sources = sources; S.ops = st.ops || []; S.redo = []; S.improved = new Map(); S.procActive = false; S.procKey = ''; S.mode = 'orig'; VAD.clear(); vadFail = false; fxCachePrune(true);
  // le impostazioni che il file non contiene (progetti salvati prima che esistessero) prendono il valore predefinito
  Object.assign(P, missingDefaults(st.P));
  Object.keys(st.P || {}).forEach(k => { if (k in P && typeof st.P[k] === typeof P[k]) P[k] = st.P[k]; });
  Object.keys(st.META || {}).forEach(k => { if (k in META && k !== 'cover') META[k] = st.META[k]; });
  META.cover = cover || null;
  S.musicId = st.musicId && S.sources.has(st.musicId) ? st.musicId : null;
  replay(); S.cur = clamp(st.cur || 0, 0, layout().total); S.sel = null; S.fit = true;
  CARVE.key = ''; if (S.musicId) { const m = S.sources.get(S.musicId); $('#nameMusic').textContent = m.name; await updateCarve(); }
  syncAll(); showCover(); FLOW.quiet = true; afterEdit(null);
  if (st.procActive && S.vlen) await improveSources();   // i miglioramenti si ricalcolano: nel file ci sono solo gli originali
  flowReset();                    // percorso guidato: il passo si ricalcola senza spostare le schede
}
async function newProject() {
  if ((S.ops.length || S.musicId) && !confirm('Iniziare un progetto nuovo? Il lavoro attuale viene tolto da questo browser. Se ti serve, prima usa “Salva il progetto”.')) return;
  stopIfPlaying(); if (S.recording) await stopRecording();
  S.sources = new Map(); S.ops = []; S.redo = []; S.improved = new Map(); S.procActive = false; S.procKey = ''; S.mode = 'orig'; S.musicId = null; S.clip = null; VAD.clear(); vadFail = false; fxCachePrune(true);
  META.title = ''; META.album = ''; META.track = ''; META.comment = ''; META.cover = null;
  replay(); S.cur = 0; S.sel = null; S.fit = true; S.lastExport = null;
  $('#nameVoice').textContent = 'Trascina qui un file o clicca per sceglierlo'; $('#nameMusic').textContent = 'Trascina qui un file o clicca per sceglierlo';
  $('#reportBody').innerHTML = '<p class="status">Ancora nessuna esportazione.</p>';
  syncAll(); showCover(); await clearDb(); afterEdit(null); flowReset(); flowShowTab('rec');
  projFileName = ''; await linkFile(null); markSaved();
  $('#projStatus').textContent = 'Nuovo progetto pronto.';
}

/* ========================= Salvataggio automatico nel browser ========================= */
let DB = null;
function db() {
  if (DB) return DB;
  DB = new Promise((res, rej) => {
    if (!window.indexedDB) { rej(new Error('IndexedDB non disponibile')); return; }
    const r = indexedDB.open('sottovoce-studio', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('src', { keyPath: 'id' }); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return DB;
}
const idb = (store, mode, fn) => db().then(d => new Promise((res, rej) => { const tx = d.transaction(store, mode), st = tx.objectStore(store), r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }));
function saveSource(id) {
  const s = S.sources.get(id); if (!s) return;
  idb('src', 'readwrite', st => st.put({ id, name: s.name, kind: s.kind, chs: s.chs, gain: s.gain })).catch(() => { $('#projStatus').textContent = 'Il browser non ha spazio per il salvataggio automatico: usa “Salva il progetto”.'; });
}
let saveT = null;
function scheduleSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    // nel salvataggio automatico del browser si ricordano anche l'impronta e il nome dell'ultimo file salvato (non nel file di progetto)
    const st = projectState(); st.coverBytes = META.cover || null; st.savedSig = S.savedSig || null; st.projFileName = projFileName; st.fileLinked = !!(FILE.handle || FILE.pending);
    idb('kv', 'readwrite', s => s.put(st, 'stato')).catch(() => { });
    updateDirty(); scheduleFileSave();
    try { localStorage.setItem('sottovoce-studio.impostazioni.v1', JSON.stringify(Object.assign({}, P, { micId: P.micId }))); } catch { }
  }, 600);
}
async function clearHistory() {
  if (!S.ops.length || S.recording) return;
  if ((S.ops.length < 2 || S.ops.every(o => o.collapsed)) && !S.redo.length) { toast('La cronologia è già svuotata.'); return; }
  if (!confirm('Svuotare la cronologia? Il montaggio attuale resta identico, ma non potrai più tornare alle versioni precedenti. Se ti serve una copia, prima usa “Salva il progetto” nella scheda 5.')) return;
  stopIfPlaying();
  const n = S.ops.length + S.redo.length;
  collapseHistory();
  await clearDb(); await saveAllToDb();
  S.sel = null; afterEdit(null);
  toast('Cronologia svuotata: ' + n + ' modifiche riunite nel montaggio attuale.');
}
async function saveAllToDb() { for (const id of S.sources.keys()) saveSource(id); scheduleSave(); }
async function clearDb() { try { await idb('src', 'readwrite', s => s.clear()); await idb('kv', 'readwrite', s => s.clear()); } catch { } }
async function offerRestore() {
  let st = null;
  try { st = await idb('kv', 'readonly', s => s.get('stato')); } catch { return; }
  if (!st || (!(st.ops && st.ops.length) && !st.musicId)) return;
  const when = new Date(st.saved).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  $('#restoreMsg').textContent = 'C’è un lavoro salvato in questo browser il ' + when + ': ' + st.ops.length + ' modifiche' + (st.META && st.META.title ? ', “' + st.META.title + '”' : '') + '.';
  const dlg = $('#restoreDlg');
  const yes = await new Promise(res => { $('#restoreYes').onclick = () => { dlg.close(); res(true); }; $('#restoreNo').onclick = () => { dlg.close(); res(false); }; dlg.addEventListener('cancel', () => res(false), { once: true }); dlg.showModal(); });
  if (!yes) { await clearDb(); return; }
  busy(true, 'Ripresa del lavoro…', 0.3);
  try {
    const sources = new Map();
    for (const s of st.sources) { const r = await idb('src', 'readonly', x => x.get(s.id)); if (r) sources.set(s.id, { id: r.id, name: r.name, kind: r.kind, chs: r.chs, len: r.chs[0].length, gain: r.gain }); }
    const missing = st.sources.filter(s => !sources.has(s.id));
    await loadState(st, sources, st.coverBytes || null);
    S.savedSig = st.savedSig || null; projFileName = st.projFileName || ''; restoreFileLink(st); updateDirty();
    busy(false);
    toast(missing.length ? 'Lavoro ripreso, ma mancano ' + missing.length + ' originali: il browser non li aveva salvati.' : 'Lavoro ripreso da dove l’avevi lasciato.' + newerNote(st));
  } catch { busy(false); toast('Non è stato possibile riprendere il lavoro salvato. Prova ad aprire un progetto.'); }
}

