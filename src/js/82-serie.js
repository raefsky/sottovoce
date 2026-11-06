/* ========================= Modelli di serie ========================= */
// Un modello conserva ciò che si ripete in ogni episodio di una serie: sigla e chiusura (con volume, dissolvenze e
// taglio), musica di sottofondo, tutte le regolazioni, autore, nome della serie, anno e copertina, e il numero del
// prossimo episodio. "Nuovo episodio" crea un progetto con tutto già al suo posto: manca solo la voce.
// I modelli stanno nel browser (database sottovoce-modelli) e si possono scaricare come file .serie
// (uno zip come il progetto: modello.json, gli originali in WAV a 32 bit, la copertina).
const SERIE_EXT = '.serie';
const SERIE_FX = ['gainDb', 'in', 'out', 'len', 'loop', 'fadeIn', 'fadeOut', 'env', 'pan', 'rate', 'rev', 'lp', 'name', 'color', 'mute', 'duck'];
const SERIE_META = ['artist', 'album', 'year'];

function serieDb(mode, fn) {
  return new Promise((res, rej) => {
    if (!window.indexedDB) { rej(new Error('il browser non permette di salvare i modelli')); return; }
    const r = indexedDB.open('sottovoce-modelli', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('m', { keyPath: 'id' });
    r.onerror = () => rej(r.error);
    r.onsuccess = () => { const d = r.result, tx = d.transaction('m', mode), q = fn(tx.objectStore('m')); tx.oncomplete = () => { d.close(); res(q && q.result); }; tx.onerror = tx.onabort = () => { d.close(); rej(tx.error); }; };
  });
}
const serieAll = () => serieDb('readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => x.name.localeCompare(y.name, 'it')));
const serieGet = id => serieDb('readonly', s => s.get(id));
const seriePut = m => serieDb('readwrite', s => s.put(m));
const serieDel = id => serieDb('readwrite', s => s.delete(id));

// cosa c'è nel progetto aperto che vale la pena tenere in un modello
function serieContent() {
  const sig = anchoredFx('start'), end = anchoredFx('end');
  return { sig, end, music: S.musicId ? S.sources.get(S.musicId) : null, meta: SERIE_META.some(k => META[k]) || !!META.cover };
}
function serieSummary(j) {
  const p = [j.sigla && 'sigla', j.music && 'musica', j.chiusura && 'chiusura', j.cover && 'copertina'].filter(Boolean);
  return (p.length ? p.join(', ') + ' e regolazioni' : 'regolazioni') + (j.META && j.META.album ? ' · ' + j.META.album : '') + ' · prossimo episodio: ' + j.nextTrack;
}
const trackNum = t => { const m = String(t || '').match(/^\s*(\d+)/); return m ? +m[1] : 0; };

// crea il modello (zip) dal progetto aperto
async function buildSerie(name, onProg) {
  const c = serieContent(), src = new Map(), used = [c.sig && c.sig.src, c.end && c.end.src, c.music && c.music.id].filter(Boolean);
  const pick = e => { const o = { src: e.src }; for (const k of SERIE_FX) if (e[k] != null) o[k] = e[k]; return o; };
  const p = {}; Object.keys(P).forEach(k => { if (!PSKIP.has(k) && k !== 'micId' && k !== 'expSelOnly') p[k] = P[k]; });
  const meta = {}; SERIE_META.forEach(k => { meta[k] = META[k]; });
  const j = {
    app: 'sottovoce-studio', kind: 'modello', version: 1, appVersion: APP_VERSION, name, saved: new Date().toISOString(),
    P: p, META: meta, nextTrack: trackNum(META.track) + 1, cover: META.cover ? 'copertina.jpg' : null,
    sigla: c.sig ? pick(c.sig) : null, chiusura: c.end ? pick(c.end) : null, music: c.music ? { src: c.music.id } : null, sources: []
  };
  const entries = [];
  for (let i = 0; i < used.length; i++) {
    const s = S.sources.get(used[i]); if (!s || src.has(s.id)) continue; src.set(s.id, 1);
    if (onProg) onProg('Preparazione di ' + s.name + '…', 0.1 + 0.8 * i / used.length); await yieldUI();
    j.sources.push({ id: s.id, name: s.name, nch: s.chs.length, len: s.len, file: 'originali/' + s.id + '.wav' });
    entries.push({ name: 'originali/' + s.id + '.wav', data: wavFloat(s.chs) });
  }
  entries.unshift({ name: 'modello.json', data: new TextEncoder().encode(JSON.stringify(j, null, 1)) });
  if (META.cover) entries.push({ name: 'copertina.jpg', data: META.cover });
  return { j, blob: makeZip(entries) };
}
// legge un modello (zip) e controlla che sia valido
async function readSerie(blob) {
  let files; try { files = readZip(await blob.arrayBuffer()); } catch { throw new Error('non è un file di modello (.serie)'); }
  if (!files['modello.json']) throw new Error('non è un modello di serie');
  let j; try { j = JSON.parse(new TextDecoder().decode(files['modello.json'])); } catch { throw new Error('il file modello.json al suo interno è rovinato'); }
  if (j.app !== 'sottovoce-studio' || j.kind !== 'modello') throw new Error('non è un modello di ' + APP_NAME);
  for (const s of j.sources) if (!files[s.file]) throw new Error('manca l’originale ' + s.name);
  return { j, files };
}

// "Salva come modello di serie"
async function saveSerie() {
  const c = serieContent();
  if (!c.sig && !c.end && !c.music && !c.meta) { toast('Per un modello servono almeno una sigla, una chiusura, una musica o i dati della serie.'); return; }
  const name = ($('#serieName').value || '').trim() || META.album || 'La mia serie';
  stopIfPlaying(); busy(true, 'Preparazione del modello…', 0.1);
  try {
    const { j, blob } = await buildSerie(name, (m, p) => busy(true, m, p));
    const all = await serieAll(), same = all.find(m => m.name === name);
    const rec = { id: same ? same.id : uid(), name, saved: j.saved, nextTrack: j.nextTrack, summary: serieSummary(j), blob };
    await seriePut(rec);
    busy(false); $('#serieName').value = '';
    $('#serieStatus').textContent = 'Modello “' + name + '” ' + (same ? 'aggiornato' : 'salvato') + ' (' + fmtBytes(blob.size) + '): ' + rec.summary + '.';
    renderSerie();
  } catch (e) { busy(false); $('#serieStatus').textContent = 'Il modello non si è salvato: ' + (e && e.message ? e.message : 'errore') + '.'; }
}
// "Nuovo episodio": un progetto nuovo con tutto ciò che il modello contiene
async function newEpisode(id) {
  const rec = await serieGet(id); if (!rec) { renderSerie(); return; }
  if (hasWork() && isDirty() && !confirm('Iniziare un nuovo episodio di “' + rec.name + '”? Il lavoro attuale viene tolto da questo browser. Se ti serve, prima usa “Salva il progetto”.')) return;
  stopIfPlaying(); if (S.recording) await stopRecording();
  try {
    busy(true, 'Preparazione dell’episodio…', 0.1);
    const { j, files } = await readSerie(rec.blob);
    j.nextTrack = rec.nextTrack || j.nextTrack || 1;     // il numero aggiornato sta nel browser, non nel file
    await newProject(true);
    // regolazioni (solo quelle che questa versione conosce, dello stesso tipo)
    Object.keys(j.P || {}).forEach(k => { if (k in P && typeof j.P[k] === typeof P[k]) P[k] = j.P[k]; });
    const map = new Map();
    for (const s of j.sources) { const w = decodeWav(files[s.file].slice().buffer); const nid = addSource(s.name, s.id === (j.music && j.music.src) ? 'musica' : 'effetto', w.chs); map.set(s.id, nid); saveSource(nid); }
    SERIE_META.forEach(k => { if (j.META && j.META[k] != null) META[k] = j.META[k]; });
    META.title = ''; META.comment = ''; META.track = String(j.nextTrack || 1);
    META.cover = j.cover && files[j.cover] ? files[j.cover].slice() : null;
    if (j.music && map.has(j.music.src)) { S.musicId = map.get(j.music.src); const m = S.sources.get(S.musicId); $('#nameMusic').textContent = m.name + ' (' + fmtDur(m.len / SR) + (m.chs.length > 1 ? ', stereo' : ', mono') + ')'; await updateCarve(); }
    const ops = [];
    for (const [kind, f] of [['start', j.sigla], ['end', j.chiusura]]) if (f && map.has(f.src)) { const e = Object.assign({}, f); delete e.src; ops.push(anchoredOp(kind, map.get(f.src), f.gainDb || 0, e)); }
    syncAll(); showCover();
    if (ops.length) pushOp({ type: 'multi', ops, label: 'Dal modello “' + rec.name + '”: ' + ops.map(o => o.anchor === 'start' ? 'sigla' : 'chiusura').join(' e ') });
    else afterEdit(null);
    S.fit = true; drawAll(); markSaved(); scheduleSave();
    rec.nextTrack = (j.nextTrack || 1) + 1; j.nextTrack = rec.nextTrack; rec.summary = serieSummary(j);
    await seriePut(rec).catch(() => { });
    busy(false); renderSerie(); flowShowTab('rec');
    $('#projStatus').textContent = 'Episodio ' + META.track + ' di “' + rec.name + '” pronto.';
    toast('Episodio ' + META.track + ' di “' + rec.name + '” pronto: ' + serieSummary(j).split(' · ')[0] + ' sono al loro posto. Ora registra o importa la voce.');
  } catch (e) { busy(false); toast('Il nuovo episodio non si è creato: ' + (e && e.message ? e.message : 'errore') + '.'); }
}
// il file scaricato porta il nome e il numero del prossimo episodio di adesso
async function downloadSerie(id) {
  const rec = await serieGet(id); if (!rec) return;
  try {
    const { j, files } = await readSerie(rec.blob);
    j.nextTrack = rec.nextTrack || j.nextTrack || 1; j.name = rec.name;
    const entries = [{ name: 'modello.json', data: new TextEncoder().encode(JSON.stringify(j, null, 1)) }];
    Object.keys(files).forEach(n => { if (n !== 'modello.json') entries.push({ name: n, data: files[n] }); });
    downloadBlob(rec.name.replace(/[\\/:*?"<>|]+/g, '').trim() + SERIE_EXT, makeZip(entries));
  } catch (e) { $('#serieStatus').textContent = 'Non è stato possibile scaricare il modello: ' + (e && e.message ? e.message : 'errore') + '.'; }
}
async function deleteSerie(id) {
  const rec = await serieGet(id); if (!rec) return;
  if (!confirm('Eliminare il modello “' + rec.name + '” da questo browser? Gli episodi già fatti non cambiano.')) return;
  await serieDel(id); renderSerie(); $('#serieStatus').textContent = 'Modello “' + rec.name + '” eliminato.';
}
// "Aggiungi un modello da file"
async function importSerie(file) {
  if (!file) return;
  try {
    const { j } = await readSerie(file);
    const all = await serieAll(); let name = j.name || file.name.replace(/\.[^.]+$/, ''), n = 2;
    while (all.some(m => m.name === name)) name = (j.name || 'Modello') + ' (' + n++ + ')';
    await seriePut({ id: uid(), name, saved: j.saved, nextTrack: j.nextTrack || 1, summary: serieSummary(j), blob: file });
    $('#serieStatus').textContent = 'Modello “' + name + '” aggiunto.'; renderSerie();
  } catch (e) { $('#serieStatus').textContent = 'Questo file non è un modello valido: ' + (e && e.message ? e.message : 'errore') + '.'; }
}
async function renderSerie() {
  const ul = $('#serieList'); if (!ul) return;
  let all = []; try { all = await serieAll(); } catch { }
  ul.innerHTML = '';
  if (!all.length) { const li = document.createElement('li'); li.className = 'serie-empty'; li.textContent = 'Ancora nessun modello. Prepara un episodio con sigla, musica, chiusura e copertina, poi salvalo come modello.'; ul.appendChild(li); }
  for (const m of all) {
    const li = document.createElement('li'); li.className = 'serie-item';
    const t = document.createElement('div'); t.className = 'serie-text';
    const b = document.createElement('b'); b.textContent = m.name; const s = document.createElement('span'); s.textContent = m.summary;
    t.append(b, s);
    const row = document.createElement('div'); row.className = 'btnrow';
    const mk = (txt, cls, fn) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'btn' + (cls ? ' ' + cls : ''); x.textContent = txt; x.addEventListener('click', fn); row.appendChild(x); return x; };
    mk('Nuovo episodio', 'primary', () => newEpisode(m.id)).setAttribute('aria-label', 'Nuovo episodio di ' + m.name);
    mk('Scarica', '', () => downloadSerie(m.id)).setAttribute('aria-label', 'Scarica il modello ' + m.name);
    mk('Elimina', '', () => deleteSerie(m.id)).setAttribute('aria-label', 'Elimina il modello ' + m.name);
    li.append(t, row); ul.appendChild(li);
  }
}
