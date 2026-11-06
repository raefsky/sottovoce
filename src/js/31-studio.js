/* ========================= Studio: registrare a tutto schermo ========================= */
// Una schermata sola, senza distrazioni: il tempo grande, il livello del microfono con la zona giusta (le parole forti
// tra -12 e -6 dB) e la saturazione, una frase che dice se il livello va bene, la forma d'onda della registrazione e un
// solo pulsante. Il microfono si apre entrando (prova del livello), così il livello si vede già prima di registrare.
// Barra spaziatrice o R: registra e ferma. Esc esce, ma non durante la registrazione.
const STUDIO = { open: false, raf: 0, db: -90, hold: -90, holdT: 0, lastT: 0, warn: false, clipT: -1e9 };
const ST_MIN = -60;                                   // fondo della scala del livello, in dB
const stPos = db => clamp((db - ST_MIN) / -ST_MIN, 0, 1) * 100 + '%';
async function openStudio() {
  if (STUDIO.open) return;
  stopIfPlaying(); stopStylePreview();
  const d = $('#studio'); STUDIO.open = true; STUDIO.db = STUDIO.hold = -90;
  if (!d.open) d.showModal();
  studioRender();
  if (!S.recording && !S.monitoring) await toggleMonitor();
  $('#stRec').focus();
  cancelAnimationFrame(STUDIO.raf); STUDIO.lastT = performance.now(); STUDIO.raf = requestAnimationFrame(studioLoop);
}
async function closeStudio() {
  if (S.recording) { STUDIO.warn = true; return; }
  STUDIO.open = false; cancelAnimationFrame(STUDIO.raf);
  if (S.monitoring) await toggleMonitor();
  const d = $('#studio'); if (d.open) d.close();
  drawAll();
}
async function studioToggleRec() {
  if (S.recording) { await toggleRecord(); if (STUDIO.open && !S.monitoring) await toggleMonitor(); }
  else { await toggleRecord(); }
  studioRender();
}
const REC_WHERE = { end: 'in fondo alla voce', cursor: 'nel punto del cursore', replace: 'al posto della selezione', all: 'al posto di tutta la voce' };
function studioRender() {
  const rec = S.recording;
  $('#studio').dataset.rec = String(rec);
  $('#stTitle').textContent = rec ? 'Sto registrando' : S.vlen ? 'Pronto per la prossima registrazione' : 'Pronto a registrare';
  $('#stRec').setAttribute('aria-label', rec ? 'Ferma la registrazione' : 'Inizia a registrare');
  $('#stRecL').textContent = rec ? 'Ferma' : 'Registra';
  $('#stWhere').textContent = 'La registrazione va ' + (REC_WHERE[P.recWhere] || REC_WHERE.end) + (S.vlen ? '; la voce dura ora ' + fmtDur(S.vlen / SR).replace(' ', '\u00a0') + '.' : '.');
  if (!rec) $('#stTime').textContent = fmtSec(0);
}
// verdetto sul livello: si guarda il picco più alto degli ultimi 1,5 s
function studioVerdict(db, clipped) {
  if (clipped) return ['bad', 'Saturazione: abbassa il volume del microfono o allontanati un po’.'];
  if (db < -50) return ['idle', 'Parla come durante la registrazione per provare il livello.'];
  if (db < -18) return ['low', 'Basso: avvicinati al microfono o alza il suo volume.'];
  if (db < -12) return ['low', 'Un po’ basso: avvicinati di qualche centimetro.'];
  if (db <= -6) return ['ok', 'Livello giusto.'];
  if (db < -1) return ['high', 'Un po’ forte: allontanati di qualche centimetro.'];
  return ['bad', 'Troppo forte: abbassa il volume del microfono.'];
}
function studioLoop(now) {
  if (!STUDIO.open) return;
  const dt = Math.min(0.1, (now - STUDIO.lastT) / 1000); STUDIO.lastT = now;
  const fresh = performance.now() - (METER.lastT || 0) < 150, pk = fresh ? METER.last || 0 : 0, db = pk > 0 ? 20 * Math.log10(pk) : -90;
  STUDIO.db = db > STUDIO.db ? db : Math.max(db, STUDIO.db - 24 * dt);          // sale subito, scende di 24 dB al secondo
  if (STUDIO.db >= STUDIO.hold || now - STUDIO.holdT > 1500) { STUDIO.hold = STUDIO.db; STUDIO.holdT = now; }
  $('#stLevel').style.width = stPos(STUDIO.db);
  $('#stPeak').style.left = stPos(STUDIO.hold); $('#stPeak').hidden = STUDIO.hold <= ST_MIN;
  if (pk >= 0.989) STUDIO.clipT = now;                                          // saturazione: si segnala per 3 s, poi sparisce
  const [kind, text] = studioVerdict(STUDIO.hold, now - STUDIO.clipT < 3000);
  const box = $('#studio'); if (box.dataset.level !== kind) box.dataset.level = kind;
  if (!S.recording) STUDIO.warn = false;
  const hint = STUDIO.warn ? 'Prima ferma la registrazione, poi esci dallo studio.' : text;
  if ($('#stHint').textContent !== hint) $('#stHint').textContent = hint;
  if (S.recording) { $('#stTime').textContent = fmtSec(REC.len); drawStudioWave(); }
  STUDIO.raf = requestAnimationFrame(studioLoop);
}
// forma d'onda della registrazione in corso: gli ultimi 20 secondi, un'asticella ogni blocco del registratore
function drawStudioWave() {
  const cv = $('#stWave'), { g, W, H } = sizeCanvas(cv); g.clearRect(0, 0, W, H);
  const per = 4096 / SR, span = 20, n = Math.ceil(span / per), from = Math.max(0, REC.pks.length - n), bw = W / n;
  g.fillStyle = cssv('--rec');
  for (let i = from; i < REC.pks.length; i++) {
    const h = Math.max(1, clamp(REC.pks[i] * 1.6, 0, 1) * (H / 2 - 2)), x = (i - from) * bw;
    rrect(g, x, H / 2 - h, Math.max(1, bw - 1), 2 * h, 1); g.fill();
  }
}
function initStudio() {
  const d = $('#studio');
  $('#btnStudio').addEventListener('click', openStudio);
  const e = $('#emptyStudio'); if (e) e.addEventListener('click', openStudio);
  $('#stRec').addEventListener('click', studioToggleRec);
  $('#stClose').addEventListener('click', closeStudio);
  d.addEventListener('cancel', ev => { ev.preventDefault(); closeStudio(); });          // Esc: esce, ma non mentre si registra
  d.addEventListener('keydown', ev => {
    if (ev.target && ev.target.tagName === 'SELECT') return;
    const k = ev.key.toLowerCase();
    if ((ev.code === 'Space' || k === 'r') && !ev.repeat && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); ev.stopPropagation(); studioToggleRec(); }
  });
  // la barra spaziatrice sul pulsante non deve farlo scattare una seconda volta al rilascio
  d.addEventListener('keyup', ev => { if (ev.code === 'Space') ev.preventDefault(); });
}
