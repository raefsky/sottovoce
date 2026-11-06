/* ========================= Progetto collegato a un file ========================= */
// Con Chrome ed Edge (File System Access) il progetto si collega a un file scelto da chi lavora: "Salva il progetto"
// lo scrive, e da lì ogni modifica si salva da sola nello stesso file, qualche secondo dopo l'ultima modifica.
// Con gli altri browser resta lo scaricamento di sempre. Il collegamento si ricorda nel browser, in un database a parte
// (sottovoce-file). Dopo una ricarica si rilegge solo con un clic sull'indicatore in alto, che serve comunque al browser
// per ridare il permesso di scrittura: così un eventuale difetto del browser nel rileggerlo non blocca l'avvio
// (nel Chromium delle prove automatiche rileggere un collegamento a un file OPFS fa crollare il browser).
const FILE = {
  ok: typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function',
  handle: null,        // il file collegato
  pending: '',         // dopo una ripresa: nome del file collegato, da ricollegare con un clic
  perm: false,         // permesso di scrittura concesso in questa sessione
  saving: false, again: false, timer: null,
  last: 0,             // ora dell'ultimo salvataggio riuscito
  error: ''
};
const FILE_WAIT = 4000;        // si salva quando non si tocca nulla da 4 s
const FILE_GAP = 20000;        // e comunque non più spesso di una volta ogni 20 s
const PICK_TYPES = [{ description: 'Progetto di ' + APP_NAME, accept: { 'application/zip': ['.sottovoce'] } }];

// database a parte per il collegamento al file
function fileDb(mode, fn) {
  return new Promise((res, rej) => {
    if (!window.indexedDB) { rej(new Error('IndexedDB non disponibile')); return; }
    const r = indexedDB.open('sottovoce-file', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => { const d = r.result, tx = d.transaction('h', mode), q = fn(tx.objectStore('h')); tx.oncomplete = () => { d.close(); res(q && q.result); }; tx.onerror = tx.onabort = () => { d.close(); rej(tx.error); }; };
  });
}
async function canWrite(h, ask) {
  if (!h || typeof h.queryPermission !== 'function') return !!h;
  try {
    if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
    return ask ? (await h.requestPermission({ mode: 'readwrite' })) === 'granted' : false;
  } catch { return false; }
}
// collega (o scollega, con null) il file e lo ricorda nel browser
async function linkFile(h) {
  FILE.handle = h; FILE.pending = ''; FILE.perm = h ? await canWrite(h, false) : false; FILE.error = ''; clearTimeout(FILE.timer);
  try { await fileDb('readwrite', s => h ? s.put(h, 'file') : s.delete('file')); } catch { }
  updateFileFlag(); updateProjText();
}
// alla ripresa del lavoro: si ricorda solo il nome; il collegamento si rilegge al clic (fileFlagClick)
function restoreFileLink(st) {
  FILE.handle = null; FILE.perm = false; FILE.pending = FILE.ok && st && st.fileLinked && st.projFileName ? st.projFileName : '';
  updateFileFlag(); updateProjText();
}
// "Salva il progetto": la prima volta (o con "Salva con un altro nome") si sceglie il file
async function saveToFile(other) {
  if (!other && !FILE.handle && FILE.pending) { await fileFlagClick(); if (FILE.handle) return; }   // dopo una ripresa: il file di prima
  let h = FILE.handle;
  if (!h || other) {
    try { h = await window.showSaveFilePicker({ suggestedName: fileBase('progetto') + '.sottovoce', types: PICK_TYPES }); }
    catch (e) { if (e && e.name !== 'AbortError') $('#projStatus').textContent = 'Non è stato possibile scegliere il file: ' + (e.message || e.name) + '.'; return; }
    await linkFile(h);
  }
  if (!await canWrite(h, true)) { FILE.perm = false; updateFileFlag(); $('#projStatus').textContent = 'Il browser non ha dato il permesso di scrivere nel file. Riprova con “Salva il progetto”.'; return; }
  FILE.perm = true;
  const done = await writeFile(true);
  if (done) {
    $('#projStatus').textContent = 'Progetto salvato in “' + h.name + '”. Da ora le modifiche si salvano da sole in questo file.';
    toast('Progetto salvato. Da ora le modifiche si salvano da sole in “' + h.name + '”.');
  }
}
// scrive il progetto nel file collegato; shown: con la barra di avanzamento (salvataggio chiesto a mano)
async function writeFile(shown) {
  const h = FILE.handle; if (!h || !FILE.perm) return false;
  if (FILE.saving) { FILE.again = true; return false; }
  FILE.saving = true; FILE.error = ''; updateFileFlag();
  const sig = projSig();                     // le modifiche fatte durante la scrittura restano "da salvare"
  if (shown) { stopIfPlaying(); busy(true, 'Salvataggio del progetto…', 0.1); }
  try {
    const blob = await projectBlob(shown ? (m, p) => busy(true, m, p) : null);
    if (shown) busy(true, 'Scrittura di “' + h.name + '”…', 0.95);
    const w = await h.createWritable(); await w.write(blob); await w.close();
    projFileName = h.name; S.savedSig = sig; FILE.last = Date.now();
    return true;
  } catch (e) {
    FILE.error = (e && e.name === 'NotAllowedError') ? 'permesso' : (e && e.message) || 'errore';
    if (FILE.error === 'permesso') FILE.perm = false;
    $('#projStatus').textContent = 'Salvataggio in “' + h.name + '” non riuscito: ' + (FILE.error === 'permesso' ? 'il browser non dà più il permesso di scrivere. Clicca l’indicatore in alto per riprenderlo.' : FILE.error + '.');
    return false;
  } finally {
    if (shown) busy(false);
    FILE.saving = false; updateDirty(); scheduleSave();
    if (FILE.again) { FILE.again = false; scheduleFileSave(); }
  }
}
// salvataggio automatico: dopo FILE_WAIT di calma, mai durante registrazione o ascolto
function scheduleFileSave() {
  if (!FILE.handle || !FILE.perm || !isDirty()) return;
  clearTimeout(FILE.timer);
  const wait = Math.max(FILE_WAIT, FILE.last + FILE_GAP - Date.now());
  FILE.timer = setTimeout(() => {
    if (S.recording || S.playing || $('#busy').classList.contains('on')) { scheduleFileSave(); return; }
    writeFile(false);
  }, wait);
}
// "Apri un progetto" con Chrome ed Edge: il file aperto resta collegato
async function openWithPicker() {
  let h; try { [h] = await window.showOpenFilePicker({ types: PICK_TYPES, multiple: false }); }
  catch (e) { if (e && e.name !== 'AbortError') $('#fileProj').click(); return; }
  const file = await h.getFile();
  await canWrite(h, true);                    // si chiede subito, finché il clic è recente; se no si chiederà al primo salvataggio
  await openProject(file, h);
}
// indicatore in alto, accanto al nome del progetto
function updateFileFlag() {
  const f = $('#fileFlag'); if (!f) return;
  const h = FILE.handle || (FILE.pending ? { name: FILE.pending } : null);
  if (!h || !hasWork()) { f.hidden = true; return; }
  f.hidden = false; f.disabled = FILE.perm && !FILE.error;
  const at = FILE.last ? new Date(FILE.last).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
  f.dataset.state = FILE.saving ? 'saving' : !FILE.perm ? 'perm' : FILE.error ? 'error' : isDirty() ? 'pending' : 'saved';
  f.textContent = FILE.saving ? 'salvataggio…'
    : !FILE.perm ? 'riprendi il salvataggio in “' + h.name + '”'
    : FILE.error ? 'salvataggio non riuscito: riprova'
    : isDirty() ? 'modifiche da salvare in “' + h.name + '”'
    : 'salvato in “' + h.name + '”' + (at ? ' alle ' + at : '');
}
async function fileFlagClick() {
  if (!FILE.handle && FILE.pending) {
    let h = null; try { h = await fileDb('readonly', s => s.get('file')); } catch { }
    if (!h) { FILE.pending = ''; updateFileFlag(); updateProjText(); toast('Il collegamento al file non c’è più. Usa “Salva il progetto” per sceglierlo di nuovo.'); return; }
    FILE.handle = h; FILE.pending = '';
  }
  if (!FILE.handle) return;
  FILE.perm = await canWrite(FILE.handle, true); FILE.error = ''; updateFileFlag(); updateProjText();
  if (FILE.perm) { if (isDirty()) writeFile(false); else { FILE.last = FILE.last || Date.now(); updateFileFlag(); } }
}
// testi della scheda Progetto, secondo il browser e il collegamento
function updateProjText() {
  const lead = $('#projLead'), as = $('#btnSaveAs');
  if (as) as.hidden = !FILE.ok || !FILE.handle;
  if (!lead) return;
  lead.textContent = !FILE.ok ? 'Il lavoro si salva da solo in questo browser. Per una copia sicura usa “Salva il progetto”: il file finisce nella cartella dei download.'
    : FILE.pending ? 'Il progetto era collegato al file “' + FILE.pending + '”. Per continuare a salvarlo lì, clicca “riprendi il salvataggio” in alto.'
    : FILE.handle ? 'Il progetto è collegato al file “' + FILE.handle.name + '”: ogni modifica si salva da sola lì, qualche secondo dopo.'
    : 'Il lavoro si salva da solo in questo browser. Con “Salva il progetto” scegli un file sul computer: da lì ogni modifica si salva da sola in quel file.';
}
