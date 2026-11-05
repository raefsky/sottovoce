/* ========================= Correggi selezione ========================= */
// La barra sotto la forma d'onda compare con la selezione: ascolta, taglia, elimina, silenzio, respiro, click e
// "Correggi selezione", che analizza il tratto e propone l'azione. Tutto è un'operazione dell'elenco: non distruttiva,
// annullabile in un passo. I tempi sono della voce (campioni a 48 kHz).
const EB = { report: null, key: '', preview: false };
const LONG_PAUSE = 1.0, KEEP_PAUSE = 0.6;
// livelli di riferimento di tutta la voce (rumore e parlato), ricalcolati solo quando cambia il montaggio
let ebRef = { v: -1 };
function voiceRef() {
  if (ebRef.v === S.version) return ebRef;
  const act = Array.from(blockLevels(renderVoice(0, S.vlen, false))).filter(v => v > -100);
  ebRef = { v: S.version, noise: act.length ? percentile(act, 0.1) : -90, speech: act.length ? percentile(act, 0.9) : -20 };
  return ebRef;
}
// tutti i tratti continui (buchi fino a 20 ms) lunghi tra min e max blocchi da 10 ms: mai un intervallo che scavalca le parole
function runsOf(flags, i0, i1, min, max) {
  const out = [];
  for (let k = i0; k < i1; k++) {
    if (!flags[k]) continue;
    let e = k; while (e + 1 < i1 && (flags[e + 1] || (e + 3 < i1 && (flags[e + 2] || flags[e + 3])))) e++;
    if (e - k + 1 >= min && e - k + 1 <= max) out.push([k, e + 1]);
    k = e;
  }
  return out;
}
// tratti da abbassare: i pezzi vicini si uniscono se tra loro non c'è voce, e ogni tratto si allarga di pad blocchi per lato
// (senza entrare nelle parole), così le rampe morbide cadono fuori dal respiro o dal rumore e non ne resta un bordo
function spansOf(flags, voiced, i0, i1, min, pad) {
  const out = [];
  for (const r of runsOf(flags, i0, i1, 1, 1e9)) {
    const p = out[out.length - 1];
    let free = !!p; if (p) for (let k = p[1]; k < r[0]; k++) if (voiced[k]) { free = false; break; }
    if (free) p[1] = r[1]; else out.push(r.slice());
  }
  return out.filter(r => r[1] - r[0] >= min).map(r => {
    let a = r[0], b = r[1];
    for (let k = 0; k < pad && a > i0 && !voiced[a - 1]; k++) a--;
    for (let k = 0; k < pad && b < i1 && !voiced[b]; k++) b++;
    return [a, b, r[0], r[1]];
  });
}
// Ogni tratto si abbassa in una volta sola, quanto serve secondo la sua intensità: il respiro fino a 5 dB sopra il fondo
// della stanza (resta, ma discreto), il rumore fino al fondo. Così una seconda analisi non trova più niente da fare.
// blocchi di 10 ms del tratto: voce (RNNoise), respiro e rumore. Il respiro segue le regole di "Abbassa i respiri" con la
// sensibilità impostata: non voce, sopra il rumore di fondo, sotto il parlato, soffiato (energia sopra 1 kHz)
async function analyzeSelection(a, b, step) {
  const ref = voiceRef(), M = Math.round(0.3 * SR), a0 = Math.max(0, a - M), b0 = Math.min(S.vlen, b + M);
  const x = renderVoice(a0, b0 - a0, false), L = blockLevels(x), lo = lowZeroPhase(x, 1000), hp = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) hp[i] = x[i] - lo[i];
  const Hh = blockLevels(hp);
  await step(0.35, 'Riconoscimento della voce nella selezione…');
  const vad = await analyzeVad(x, () => { });
  const i0 = Math.floor((a - a0) / 480), i1 = Math.min(L.length, Math.ceil((b - a0) / 480)), n = Math.max(1, i1 - i0);
  const sens = P.breathSens, vthr = 0.3 + sens * 0.005, over = 12 - sens * 0.08, hfMin = -4 - sens * 0.06;
  // tratti già abbassati o riparati: non si propongono di nuovo, così una correzione non si somma a un'altra
  const done = (t, dir) => { const i = segIndexAt(t), g = S.segs[i]; if (!g) return false; const p = t - S.segT[i]; return g.f.some(d => d.dir === dir && p >= d.a && p < d.b); };
  const voiced = [], breath = [], noise = [];
  for (let k = 0; k < L.length; k++) {
    const p = vad[k] || 0, dipped = done(a0 + k * 480 + 240, 'dip');
    voiced[k] = p > 0.6 && L[k] > ref.noise + 6;
    breath[k] = !dipped && p < vthr && L[k] > ref.noise + over && L[k] < ref.speech - 3 && Hh[k] - L[k] > hfMin;
    noise[k] = !dipped && p < vthr && L[k] > ref.noise + 10 && !breath[k];
  }
  await step(0.6, 'Ricerca dei click…');
  const ck = deClick(x, P.clickSens).at.filter(i => i >= a - a0 && i < b - a0 && !done(a0 + i, 'fix'));
  let nv = 0; for (let k = i0; k < i1; k++) if (voiced[k]) nv++;
  const at = k => a0 + k * 480, lvl = (r, q) => percentile(Array.from(L.slice(r[0], r[1])), q);
  let br = spansOf(breath, voiced, i0, i1, 5, 3).filter(r => r[3] - r[2] <= 150); if (!br.some(r => r[3] - r[2] >= 10)) br = [];
  const nz = br.length || nv / n >= 0.1 ? [] : spansOf(noise, voiced, i0, i1, 3, 3);
  const span = (r, q, top) => ({ a: Math.max(a, at(r[0])), b: Math.min(b, at(r[1])), db: Math.round(clamp(lvl([r[2], r[3]], q) - top, 6, 40)) });
  return { a, b, speech: nv / n, clicks: ck.length, dur: (b - a) / SR, over: lvl([i0, i1], 0.9) - (ref.noise + 5),
    breath: br.map(r => span(r, 0.9, ref.noise + 5)).map(d => Object.assign(d, { db: Math.min(d.db, 18) })),
    noise: nz.map(r => span(r, 0.95, ref.noise + 2)).map(d => Object.assign(d, { db: Math.max(d.db, 10) })) };
}
// dalle misure alle proposte: righe "Nella selezione" e operazioni da applicare insieme
function selectionPlan(r) {
  const rows = [], ops = [], say = [], fixed = [];
  const dips = list => list.forEach(d => ops.push({ type: 'dip', a: d.a, b: d.b, db: d.db })), most = list => Math.max(...list.map(d => d.db));
  if (r.breath.length) { rows.push(r.breath.length > 1 ? r.breath.length + ' respiri' : 'Respiro'); dips(r.breath); fixed.push(r.breath.length > 1 ? 'respiri' : 'respiro'); say.push((r.breath.length > 1 ? 'abbassare i respiri' : 'abbassare il respiro') + ' fino a ' + most(r.breath) + ' dB, senza ' + (r.breath.length > 1 ? 'toglierli' : 'toglierlo')); }
  if (r.noise.length) { rows.push('Rumore tra le parole'); dips(r.noise); fixed.push('rumore'); say.push('abbassare il rumore fino al fondo della stanza'); }
  if (r.clicks) { rows.push(r.clicks > 1 ? r.clicks + ' click della bocca' : 'Click della bocca'); ops.push({ type: 'fix', a: Math.max(0, r.a - 480), b: Math.min(S.vlen, r.b + 480), sens: P.clickSens }); fixed.push(r.clicks > 1 ? r.clicks + ' click' : 'click'); say.push(r.clicks > 1 ? 'riparare i click' : 'riparare il click'); }
  if (!r.breath.length && !r.noise.length && r.speech < 0.05 && r.dur > LONG_PAUSE) {
    rows.push('Pausa lunga (' + fmtNum(r.dur, 1) + ' s)'); const h = Math.round(KEEP_PAUSE * SR / 2);
    ops.push({ type: 'delete', a: r.a + h, b: r.b - h }); fixed.push('pausa accorciata'); say.push('accorciare la pausa a ' + fmtNum(KEEP_PAUSE, 1) + ' s');
  }
  if (r.speech >= 0.05) rows.push(r.speech > 0.5 ? 'Parole' : 'Anche qualche parola');
  const text = ops.length ? say.join(', ').replace(/^./, c => c.toUpperCase()) + '.'
    : r.speech >= 0.05 ? 'Nessun problema da correggere: qui c’è voce. Per toglierla usa Elimina.' : 'Nessun problema da correggere in questo tratto.';
  return { rows, ops, text, fixed };
}
// passi con barra e messaggio; ognuno resta almeno 0,25 s, così si legge
function ebSteps() {
  let last = 0;
  return async (p, msg) => { const w = 250 - (performance.now() - last); if (last && w > 0) await new Promise(r => setTimeout(r, w)); busy(true, msg, p); last = performance.now(); await yieldUI(); };
}
async function ebRun(fn) {
  const r = needSel(); if (!r) return; stopIfPlaying();
  const step = ebSteps();
  try { await step(0.1, 'Analisi della selezione…'); await fn(r, step, await analyzeSelection(r[0], r[1], step)); }
  catch (e) { toast(e && e.message ? e.message : 'Analisi della selezione non riuscita.'); }
  finally { busy(false); }
}
async function ebApply(op, msg, step) {
  await step(0.85, msg); pushOp(op);
  await step(0.95, 'Aggiornamento della forma d’onda…'); drawAll(); await step(1, 'Fatto.');
}
const ebLabel = r => ' ' + rangeTxt(r);
function correctSelection() {
  return ebRun(async (r, step, an) => {
    await step(0.8, 'Preparazione della proposta…');
    const plan = selectionPlan(an); EB.report = { plan, sel: r }; EB.key = r.join(); renderEbReport();
  });
}
async function applyCorrection() {
  const rep = EB.report; if (!rep || !rep.plan.ops.length) return;
  const step = ebSteps(); stopIfPlaying();
  try {
    const ops = rep.plan.ops.map(o => Object.assign({}, o)), sorted = ops.filter(o => o.type !== 'delete').concat(ops.filter(o => o.type === 'delete'));
    await ebApply({ type: 'multi', ops: sorted, label: 'Correzione: ' + rep.plan.fixed.join(', ') + ebLabel(rep.sel) },
      rep.plan.rows.some(t => /Respiro/.test(t)) ? 'Riduzione del respiro…' : rep.plan.ops.some(o => o.type === 'fix') ? 'Riparazione dei click…' : 'Correzione della selezione…', step);
    if (sorted.some(o => o.type === 'delete')) { S.sel = null; updateButtons(); }
    toast('Correzione applicata. Ascolta il risultato; si annulla con un clic.');
  } finally { busy(false); }
  EB.report = null; renderEbReport();
}
function reduceBreath() {
  return ebRun(async (r, step, an) => {
    if (an.breath.length) return ebApply({ type: 'multi', ops: an.breath.map(d => ({ type: 'dip', a: d.a, b: d.b, db: d.db })), label: (an.breath.length > 1 ? an.breath.length + ' respiri abbassati' : 'Respiro abbassato di ' + an.breath[0].db + ' dB') + ebLabel(r) }, 'Riduzione del respiro…', step);
    if (an.speech >= 0.15) { toast('Nella selezione c’è soprattutto voce: per non abbassare le parole, seleziona solo il respiro.'); return; }
    const db = Math.round(clamp(an.over, 0, 18)); if (db < 3) { toast('Il tratto è già discreto, vicino al fondo della stanza: non serve abbassarlo.'); return; }
    return ebApply({ type: 'dip', a: r[0], b: r[1], db, label: 'Tratto abbassato di ' + db + ' dB' + ebLabel(r) }, 'Riduzione del respiro…', step);
  });
}
function repairClicks() {
  return ebRun(async (r, step, an) => {
    if (!an.clicks) { toast('Nessun click trovato nella selezione.'); return; }
    await ebApply({ type: 'fix', a: Math.max(0, r[0] - 480), b: Math.min(S.vlen, r[1] + 480), sens: P.clickSens, label: (an.clicks > 1 ? an.clicks + ' click riparati' : 'Click riparato') + ebLabel(r) }, 'Riparazione dei click…', step);
  });
}
function playSelection() { if (S.playing) { stopPlayback(); drawTop(); } else togglePlay(); updateEditBar(); }
// risultato dell'analisi sotto la barra
function renderEbReport() {
  const box = $('#ebReport'), rep = EB.report; box.innerHTML = ''; box.hidden = !rep; if (!rep) return;
  const h = document.createElement('p'); h.className = 'eb-h'; h.textContent = rep.plan.rows.length ? 'Nella selezione:' : 'Analisi della selezione';
  box.appendChild(h); if (rep.plan.rows.length) box.appendChild(arList(rep.plan.rows.map(t => [t, '', true])));
  const s = document.createElement('p'); s.className = 'eb-sug'; s.innerHTML = rep.plan.ops.length ? '<b>Azione consigliata:</b> ' : ''; s.append(rep.plan.text); box.appendChild(s);
  const row = document.createElement('div'); row.className = 'btnrow';
  if (rep.plan.ops.length) { const b = document.createElement('button'); b.className = 'btn primary'; b.type = 'button'; b.id = 'ebApply'; b.textContent = 'Applica correzione'; b.addEventListener('click', applyCorrection); row.appendChild(b); }
  const c = document.createElement('button'); c.className = 'linkbtn'; c.type = 'button'; c.textContent = rep.plan.ops.length ? 'Lascia com’è' : 'Chiudi'; c.addEventListener('click', () => { EB.report = null; renderEbReport(); }); row.appendChild(c);
  box.appendChild(row); const f = $('#ebApply'); if (f) f.focus();
}
// stato della barra: con la selezione compaiono i comandi; Annulla e Ripristina restano sempre
function updateEditBar() {
  const bar = $('#editBar'); if (!bar) return;
  const r = selVoice(); bar.classList.toggle('has-sel', !!r);
  $('#ebState').textContent = r ? 'Area selezionata pronta per la modifica: ' + fmtDur((r[1] - r[0]) / SR) + '.' : 'Seleziona una porzione della registrazione per modificarla.';
  $$('#ebTools .btn').forEach(b => { b.disabled = !r || S.recording; });
  $('#ebPlay span').textContent = S.playing && PB.selPlay ? 'Ferma' : 'Ascolta selezione';
  $('#ebUndo').disabled = !S.ops.length; $('#ebRedo').disabled = !S.redo.length;
  if (EB.report && (!r || r.join() !== EB.key)) { EB.report = null; renderEbReport(); }
}
// anteprima di "Crea silenzio": passando sul pulsante la selezione si mostra piatta, della stessa durata
function setSilencePreview(on) { if (EB.preview !== on) { EB.preview = on; drawTop(); } }
function initEditBar() {
  const on = (id, f) => $(id).addEventListener('click', f);
  on('#ebFix', correctSelection); on('#ebPlay', playSelection); on('#ebCut', doCut); on('#ebDel', doDelete); on('#ebSil', doSilence);
  on('#ebBreath', reduceBreath); on('#ebClick', repairClicks); on('#ebUndo', undo); on('#ebRedo', redo);
  ['#ebSil', '#tSil'].forEach(id => { const b = $(id); ['mouseenter', 'focus'].forEach(e => b.addEventListener(e, () => setSilencePreview(!b.disabled))); ['mouseleave', 'blur', 'click'].forEach(e => b.addEventListener(e, () => setSilencePreview(false))); });
  updateEditBar();
}

