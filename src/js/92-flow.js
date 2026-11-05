/* ========================= Percorso guidato (un passo alla volta) ========================= */
// Il lavoro è un percorso in cinque passi: Voce, Migliora, Musica, Esporta, Progetto.
// Il passo attuale si ricava dallo stato del lavoro, non da un contatore: niente voce = Voce; voce non migliorata = Migliora;
// voce pronta e musica né scelta né saltata = Musica; altrimenti Esporta; dopo l'esportazione Progetto ('fatto');
// con il file esportato e il progetto salvato, tutto fatto ('finito').
// In alto, sempre visibile, la barra del percorso mostra i passi fatti (spunta), quello in corso e quelli da fare.
// Una barra "Prossimo passo" sopra le schede dice sempre cosa fare, con un solo pulsante principale; dentro il pannello
// l'azione successiva è evidenziata. Nessuna funzione sparisce: le schede restano tutte cliccabili e in modalità Semplice
// le sezioni secondarie sono solo compresse. Tutto è interfaccia: suono, progetti e preset non cambiano.
const FLOW = { step: null, analyzed: false, musicSkipped: false, exportedSig: null, quiet: false };
const FLOW_ORDER = ['voce', 'migliora', 'musica', 'esporta', 'fatto', 'finito'];
const FLOW_TAB = { voce: 'rec', migliora: 'improve', musica: 'tracks', esporta: 'export', fatto: 'project' };
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function flowStep() {
  if (!S.vlen) return 'voce';
  if (!(S.procActive || P.voiceRefined)) return 'migliora';
  if (!S.musicId && !FLOW.musicSkipped) return 'musica';
  const sig = projSig();
  if (!FLOW.exportedSig || FLOW.exportedSig !== sig) return 'esporta';
  return S.savedSig === sig ? 'finito' : 'fatto';
}
// scheda con un'animazione leggera di entrata
function flowShowTab(name) {
  showTab(name);
  const p = $('#pane-' + name); if (!p || reduceMotion()) return;
  p.classList.remove('pane-in'); void p.offsetWidth; p.classList.add('pane-in');
}
// porta lo sguardo su un elemento: lo rende visibile, lo evidenzia e ci mette il focus della tastiera
function flowFocus(sel) {
  const el = $(sel); if (!el) return;
  const panel = el.closest('.panel'); if (panel && panel.classList.contains('collapsed')) setCollapsed(panel, false);
  if (el.closest('#advGroup') && $('#advGroup').classList.contains('collapsed')) { advOpen = true; applyAdvGroup(); }
  const r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
  if (!el.disabled) el.focus({ preventScroll: true });
}
// azione principale del passo, evidenziata dentro il pannello
function flowTarget(step) {
  if (step === 'voce') return '#slotVoice';
  if (step === 'migliora') return FLOW.analyzed && $('#btnApplyAll') ? '#btnApplyAll' : '#btnPodcast';
  if (step === 'musica') return '#slotMusic';
  if (step === 'esporta') return '#btnExport';
  if (step === 'fatto') return '#btnSaveProj';
  return null;
}
// testi e pulsanti della barra "Prossimo passo"
function flowCard(step) {
  const n = { voce: 1, migliora: 2, musica: 3, esporta: 4, fatto: 5 }[step];
  const kicker = n ? 'Passo ' + n + ' di 5' : 'Tutto fatto';
  if (step === 'voce') return { kicker, text: 'Comincia dalla voce: registra con il pulsante rosso in basso, oppure importa un file audio.', main: ['Importa un file', () => { flowShowTab('rec'); $('#fileVoice').click(); }], alt: ['Registra adesso', toggleRecord] };
  if (step === 'migliora') return FLOW.analyzed
    ? { kicker, text: 'L’analisi è pronta. Con un clic si applicano tutti i suggerimenti, poi ascolti e confronti con l’originale.', main: ['Applica tutti i suggerimenti', () => { flowShowTab('improve'); applyAllSuggestions(); }], alt: ['Rivedi l’analisi', () => { flowShowTab('improve'); flowFocus('#proposeBox'); }] }
    : { kicker, text: 'Ora migliora la voce. Con la Modalità Podcast basta un clic: la registrazione diventa un episodio pronto da pubblicare.', main: ['Modalità Podcast', () => { flowShowTab('improve'); podcastMode(); }], alt: ['La voce è già rifinita', () => { P.voiceRefined = true; syncKey('voiceRefined'); onParam('voiceRefined'); }] };
  if (step === 'musica') return { kicker, text: 'La voce è pronta. Vuoi aggiungere un sottofondo musicale?', main: ['Sì, scegli la musica', () => { flowShowTab('tracks'); flowFocus('#slotMusic'); $('#fileMusic').click(); }], alt: ['No, vai all’esportazione', () => { FLOW.musicSkipped = true; flowUpdate(); flowShowTab('export'); flowFocus('#btnExport'); }] };
  if (step === 'esporta') return { kicker, text: S.musicId ? 'Musica aggiunta: scende da sola quando parli. Quando ti piace, esporta il file finale.' : 'Tutto pronto: esporta il file finale, MP3 per pubblicare o WAV per continuare a lavorare.',
    main: [$('#tab-export').getAttribute('aria-selected') === 'true' ? 'Esporta' : 'Vai all’esportazione', () => { if ($('#tab-export').getAttribute('aria-selected') === 'true') doExport(); else { flowShowTab('export'); flowFocus('#btnExport'); flowUpdate(); } }] };
  if (step === 'finito') return { kicker, text: 'Il file finale è nella cartella dei download e il progetto è salvato. Per riprenderlo, apri il file di progetto dalla scheda Progetto.', main: ['Esporta di nuovo', () => { flowShowTab('export'); flowFocus('#btnExport'); }] };
  return { kicker, text: 'Il file è nella cartella dei download. Salva anche il progetto, per poterlo riprendere e modificare.', main: ['Salva il progetto', () => { flowShowTab('project'); saveProject(); }], alt: ['Esporta di nuovo', () => { flowShowTab('export'); flowFocus('#btnExport'); }] };
}
function flowRender() {
  const step = FLOW.step, card = flowCard(step), box = $('#nextStep'); if (!box) return;
  $('#nsKicker').textContent = card.kicker; $('#nsText').textContent = card.text;
  const main = $('#nsMain'), alt = $('#nsAlt');
  main.textContent = card.main[0]; main.onclick = card.main[1];
  alt.hidden = !card.alt; if (card.alt) { alt.textContent = card.alt[0]; alt.onclick = card.alt[1]; }
  // barra del percorso e schede: passi fatti, in corso, da fare ('fatto' è il passo Progetto, 'finito' li completa tutti)
  const cur = FLOW_ORDER.indexOf(step);
  ['voce', 'migliora', 'musica', 'esporta', 'fatto'].forEach((s, i) => {
    const st = i < cur ? 'done' : i === cur ? 'current' : 'upcoming', word = st === 'done' ? 'fatto' : st === 'current' ? 'in corso' : 'da fare';
    const t = $('#tab-' + FLOW_TAB[s]); t.dataset.flow = st; t.setAttribute('aria-description', st === 'done' ? 'passo fatto' : st === 'current' ? 'passo attuale' : 'passo successivo');
    const li = $$('#stepper .st')[i], b = li.querySelector('.st-btn');
    li.dataset.state = st; b.setAttribute('aria-label', 'Passo ' + (i + 1) + ', ' + li.querySelector('.st-l').textContent + ': ' + word);
    if (st === 'current') b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  $$('.next-action').forEach(el => el.classList.remove('next-action'));
  const tsel = flowTarget(step), tg = tsel && $(tsel); if (tg) tg.classList.add('next-action');
  // un solo pulsante pieno alla volta: "Applica i miglioramenti" ed "Esporta" lo sono solo quando sono il passo da fare
  ['#btnApply', '#btnExport'].forEach(sel => $(sel).classList.toggle('primary', flowTarget(step) === sel));
  // meno elementi a schermo finché non c'è niente da montare
  $('#app').classList.toggle('is-empty', !layout().total);
}
// chiamata dopo ogni cambiamento del lavoro: aggiorna la barra e, al passaggio di passo, guida verso il successivo
function flowUpdate() {
  if (!$('#nextStep')) return;
  const prev = FLOW.step, next = flowStep();
  FLOW.step = next;
  if (prev !== next) {
    const box = $('#nextStep'); if (!reduceMotion()) { box.classList.remove('ns-change'); void box.offsetWidth; box.classList.add('ns-change'); }
    if (!FLOW.quiet && prev) {
      // dopo il primo audio: si apre Migliora e il focus va sull'azione da fare
      if (prev === 'voce' && next === 'migliora') { flowShowTab('improve'); flowRender(); flowFocus(flowTarget(next)); return; }
      // dopo i miglioramenti: la barra propone la musica e ci si porta lo sguardo
      if (prev === 'migliora' && next === 'musica') { flowRender(); flowFocus('#nsMain'); return; }
      // dopo la musica: si evidenzia l'esportazione
      if (prev === 'musica' && next === 'esporta') { flowRender(); flowFocus('#nsMain'); return; }
      // dopo il file finale: si propone di salvare il progetto
      if (prev === 'esporta' && next === 'fatto') { flowRender(); flowFocus('#nsMain'); return; }
      // altri passi in avanti (per esempio voce già rifinita: da Voce a Musica): lo sguardo va sulla barra
      if (FLOW_ORDER.indexOf(next) > FLOW_ORDER.indexOf(prev) && next !== 'finito') { flowRender(); flowFocus('#nsMain'); return; }
    }
  }
  flowRender();
}
// progetto aperto, ripreso o nuovo: il passo si ricalcola senza spostare le schede
function flowReset() { PROPOSALS = null; PODCAST = null; const pb = $('#proposeBox'); if (pb) { pb.hidden = true; pb.innerHTML = ''; } FLOW.analyzed = false; FLOW.musicSkipped = false; FLOW.exportedSig = null; FLOW.step = null; FLOW.quiet = true; flowUpdate(); FLOW.quiet = false; }

/* ---------- sezioni secondarie comprimibili (modalità Semplice) ---------- */
// In Semplice si vede per prima la sezione che serve; le altre restano a portata di un clic. In Avanzata sono tutte aperte.
// (le sezioni di Migliora stanno già tutte dentro "Regolazioni avanzate", che si apre e si chiude in blocco)
const SECONDARY = ['pSil', 'pHist', 'pDuck', 'pFx', 'pMeta', 'pReport', 'pPreset'];
const OPENED = new Set();
function setCollapsed(panel, c) {
  panel.classList.toggle('collapsed', c);
  const b = panel.querySelector('.pc-toggle'); if (b) { b.setAttribute('aria-expanded', String(!c)); b.querySelector('span').textContent = c ? 'Mostra' : 'Nascondi'; }
  const w = panel.querySelector('.pc-wrap'); if (w) w.inert = c;
}
function applyCollapse() {
  const simple = $('#app').classList.contains('simple');
  SECONDARY.forEach(id => { const p = $('#' + id); if (p) setCollapsed(p, simple && !OPENED.has(id)); });
}
function initCollapsibles() {
  SECONDARY.forEach(id => {
    const p = $('#' + id), h = p && p.querySelector('h2'); if (!h) return;
    const desc = p.querySelector('.desc'), wrap = document.createElement('div'), inner = document.createElement('div');
    wrap.className = 'pc-wrap'; wrap.id = id + '-corpo'; inner.className = 'pc-inner'; wrap.appendChild(inner);
    [...p.children].filter(c => c !== h && c !== desc).forEach(c => inner.appendChild(c));
    p.appendChild(wrap); p.classList.add('collapsible');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pc-toggle'; b.setAttribute('aria-controls', wrap.id);
    b.innerHTML = '<span>Mostra</span><i aria-hidden="true"></i>'; b.setAttribute('aria-label', 'Mostra o nascondi: ' + h.firstChild.textContent.trim());
    b.addEventListener('click', () => { const c = !p.classList.contains('collapsed'); if (c) OPENED.delete(id); else OPENED.add(id); setCollapsed(p, c); });
    h.appendChild(b);
  });
  applyCollapse();
}
/* ---------- Regolazioni avanzate (scheda Migliora) ---------- */
// Chiuse in Semplice, aperte in Avanzata; il clic sul titolo le apre o le chiude in tutte e due le modalità.
let advOpen = null;                                    // scelta fatta a mano; null = segue la modalità
function setAdvGroup(open) {
  const g = $('#advGroup'), t = $('#advToggle'); if (!g) return;
  g.classList.toggle('collapsed', !open); t.setAttribute('aria-expanded', String(open)); $('#advBody').inert = !open;
}
const applyAdvGroup = () => setAdvGroup(advOpen != null ? advOpen : !$('#app').classList.contains('simple'));
// un clic su un passo della barra apre la sua scheda; su schermi stretti la porta anche in vista
function initStepper() {
  $$('#stepper .st-btn').forEach(b => b.addEventListener('click', () => {
    flowShowTab(b.dataset.go); flowRender();
    if (window.matchMedia('(max-width:1099px)').matches) $('.side').scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }));
}
function initFlow() {
  initCollapsibles();
  initStepper();
  $('#advToggle').addEventListener('click', () => { advOpen = $('#advGroup').classList.contains('collapsed'); applyAdvGroup(); });
  $$('.mode .seg').forEach(b => b.addEventListener('click', () => { advOpen = null; applyAdvGroup(); }));
  applyAdvGroup();
  // le modalità Semplice e Avanzata aprono o comprimono le sezioni secondarie
  $$('.mode .seg').forEach(b => b.addEventListener('click', applyCollapse));
  flowUpdate();
}

