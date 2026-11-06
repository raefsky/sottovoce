/* ========================= Musica, ducking ed effetti ========================= */
// "Spazio per la voce": la musica perde un po' di 2,8 kHz, dove vive la voce (filtrata una volta e conservata)
const CARVE = { key: '', chs: null };
function musicChs() {
  const m = S.sources.get(S.musicId); if (!m) return null;
  const key = S.musicId + '|' + P.carve;
  return (CARVE.key === key && CARVE.chs) ? CARVE.chs : m.chs;
}
async function updateCarve() {
  const m = S.sources.get(S.musicId); if (!m) return;
  const key = S.musicId + '|' + P.carve; if (CARVE.key === key) return;
  if (!P.carve) { CARVE.key = key; CARVE.chs = m.chs; return; }
  const chs = [];
  for (const c of m.chs) chs.push(await renderChain(c, (oc, src) => { const f = peaking(oc, 2800, 0.8, -P.carve); src.connect(f); return f; }));
  CARVE.key = key; CARVE.chs = chs; drawBase();
}

// curva della musica a 100 punti al secondo, in tempo del mix: livello di base, ducking, dissolvenze
const MC = { key: '', val: null };
function voiceEnvelope(which) {
  // livello della voce montata a blocchi di 10 ms, già al volume d'ascolto
  const n = Math.ceil(S.vlen / 480), env = new Float32Array(n), g = voiceGain(which), blk = new Float32Array(480);
  for (let b = 0; b < n; b++) {
    blk.fill(0); renderVoice(b * 480, 480, which === 'proc', blk);
    let s = 0; for (let i = 0; i < 480; i++) s += blk[i] * blk[i];
    env[b] = s / 480 * g * g;
  }
  const out = new Float32Array(n);
  for (let b = 0; b < n; b++) { let a = 0, c = 0; for (let k = -1; k <= 1; k++) { const q = b + k; if (q >= 0 && q < n) { a += env[q]; c++; } } out[b] = 10 * Math.log10(a / c + 1e-12); }
  return out;
}
function musicCurves(which) {
  const lay = layout();
  const key = [S.version, which, S.procKey, P.match, P.target, P.voiceNorm, P.normEach, P.musicDb, P.fadeIn, P.fadeOut, P.intro, P.tail, P.duckOn, P.duckThrAuto, P.duckThr, P.duckDepth, P.duckAtk, P.duckRel, P.duckHold, P.duckLook, lay.total, lay.mStart, lay.mEnd, P.vadMode === 'ai' ? 'vad' + P.vadSens + (vadReady() ? '' : '-attesa') : '', fxDuckKey()].join('|');
  if (MC.key === key) return MC.val;
  const n = Math.ceil(lay.total / 480) + 2, duck = new Float32Array(n), gain = new Float32Array(n);
  if (S.vlen && P.duckOn) {
    // "Intelligente": la voce c'è dove RNNoise la riconosce; finché il calcolo non è pronto resta il livello
    const ai = P.vadMode === 'ai' && vadReady(), vv = ai ? voiceVad() : null, vt = vadThr();
    if (P.vadMode === 'ai' && !ai) ensureVad();
    const env = ai ? vv : voiceEnvelope(which), off = Math.round(lay.intro / 480);
    let thr = P.duckThr;
    if (!ai && P.duckThrAuto && env.length > 20) {
      const s = Float32Array.from(env).sort(), p10 = s[Math.floor(s.length * 0.1)], p90 = s[Math.floor(s.length * 0.9)];
      thr = Math.round(clamp(p10 + 0.4 * (p90 - p10), -70, -15));
      S.duckThrAutoVal = thr;
    }
    const hold = Math.round(P.duckHold / 10), la = Math.round(P.duckLook / 10), act = new Uint8Array(n + la + 2);
    let last = -1e9;
    for (let i = 0; i < env.length; i++) { if (ai ? vv[i] > vt : env[i] > thr) last = i; if (i - last <= hold) { const j = i + off; if (j < act.length) act[j] = 1; } }
    const ca = Math.exp(-1 / Math.max(0.5, P.duckAtk / 10)), cr = Math.exp(-1 / Math.max(0.5, P.duckRel / 10));
    let cur = 0;
    for (let j = 0; j < n; j++) { const tgt = act[j + la] ? P.duckDepth : 0, c = tgt < cur ? ca : cr; cur = tgt + (cur - tgt) * c; duck[j] = cur; }
  }
  // effetti che abbassano la musica mentre suonano (scelta per effetto; senza, il ducking resta solo della voce, come prima).
  // Stessi anticipo, discesa e risalita della voce; vale l'abbassamento più forte tra voce ed effetti.
  const fxd = S.fx.filter(fxAudible).filter(e => e.duck < 0);
  if (fxd.length) {
    const la = Math.round(P.duckLook / 10), tgt = new Float32Array(n + la + 2);
    for (const e of fxd) { const a = Math.floor(e.at / 480), b = Math.ceil((e.at + fxSpan(e)) / 480); for (let j = Math.max(0, a); j < Math.min(tgt.length, b); j++) tgt[j] = Math.min(tgt[j], e.duck); }
    const ca = Math.exp(-1 / Math.max(0.5, P.duckAtk / 10)), cr = Math.exp(-1 / Math.max(0.5, P.duckRel / 10));
    let cur = 0;
    for (let j = 0; j < n; j++) { const t = tgt[j + la], c = t < cur ? ca : cr; cur = t + (cur - t) * c; if (cur < duck[j]) duck[j] = cur; }
  }
  // dissolvenze all'inizio e alla fine del tratto della musica (dopo la sigla, prima della chiusura)
  const ms = lay.mStart / 480, total = lay.mEnd / 480, fi = P.fadeIn * 100, fo = P.fadeOut * 100;
  for (let j = 0; j < n; j++) {
    let lin = dbToGain(P.musicDb + duck[j]);
    if (fi > 0 && j - ms < fi) { const x = clamp((j - ms) / fi, 0, 1); lin *= x * x * (3 - 2 * x); }
    if (fo > 0 && j > total - fo) { const x = clamp((total - j) / fo, 0, 1); lin *= x * x * (3 - 2 * x); }
    gain[j] = lin;
  }
  MC.key = key; MC.val = { duck, gain, thr: S.duckThrAutoVal };
  return MC.val;
}
// un secondo file nel riquadro della musica: si chiede se è la sigla, la chiusura o la nuova musica di sottofondo
function askMusicImport(file) {
  return new Promise(res => {
    const d = $('#musicAsk'), m = S.sources.get(S.musicId); let v = null;
    $('#maText').textContent = 'C’è già la musica di sottofondo «' + m.name + '». Cosa fare con «' + file.name + '»?';
    $('#maSig').onclick = () => { v = 'start'; d.close(); }; $('#maEnd').onclick = () => { v = 'end'; d.close(); }; $('#maReplace').onclick = () => { v = 'replace'; d.close(); };
    d.addEventListener('close', () => res(v), { once: true }); d.showModal(); $('#maSig').focus();
  });
}
async function importMusic(file) {
  if (!file) return;
  if (S.musicId && S.sources.has(S.musicId)) {
    const c = await askMusicImport(file); if (!c) return;
    if (c !== 'replace') { await importAnchored(file, c); return; }
  }
  stopIfPlaying(); busy(true, 'Lettura di ' + file.name + '…', 0.2);
  try {
    const d = await decodeFile(file);
    const id = addSource(file.name, 'musica', d.chs);
    S.musicId = id; saveSource(id);
    $('#nameMusic').textContent = file.name + ' (' + fmtDur(d.chs[0].length / SR) + (d.chs.length > 1 ? ', stereo' : ', mono') + ')';
    if (P.musicAuto) autoMusic();
    await updateCarve();
    S.fit = true; afterEdit();
    toast('Musica caricata. Il volume è impostato in automatico e scende quando parli.');
  } catch { toast('Questo file non si può leggere. Prova con un MP3, WAV, M4A o FLAC.'); }
  finally { busy(false); }
}
function autoMusic() {
  const m = S.sources.get(S.musicId); if (!m) return;
  // si misura al massimo un tratto centrale di 5 minuti
  const max = SR * 300, a = m.len > max ? Math.floor((m.len - max) / 2) : 0, b = Math.min(m.len, a + max);
  const l = lufs(m.chs.map(c => c.subarray(a, b)), m.chs.length === 1);
  if (l > -80) {
    P.musicDb = Math.round(clamp(P.musicTarget - l, -30, 12) * 2) / 2;
    $('#musicStatus').textContent = 'La musica misura ' + fmtNum(l, 1) + ' LUFS. Volume impostato a ' + (P.musicDb >= 0 ? '+' : '') + fmtNum(P.musicDb, 1) + ' dB per arrivare a ' + fmtNum(P.musicTarget, 0) + ' LUFS.';
  } else $('#musicStatus').textContent = 'La musica sembra silenziosa e non si può misurare. Controlla il file.';
  syncKey('musicDb');
}
function removeMusic() { if (!S.musicId) return; stopIfPlaying(); S.musicId = null; $('#nameMusic').textContent = 'Trascina qui un file o clicca per sceglierlo'; $('#musicStatus').textContent = ''; S.fit = true; afterEdit(); toast('Musica tolta dal mix.'); }

async function importFx(file) {
  if (!file) return;
  stopIfPlaying(); busy(true, 'Lettura di ' + file.name + '…', 0.3);
  try {
    const d = await decodeFile(file);
    if (d.chs[0].length > SR * 120) toast('Questo effetto dura più di due minuti: se è una musica, caricalo come musica.');
    const id = addSource(file.name, 'effetto', d.chs); saveSource(id);
    const at = Math.max(0, Math.round(S.cur));
    const fid = uid(); S.fxSel = fid;
    pushOp({ type: 'fxadd', id: fid, src: id, at, gainDb: 0, fadeIn: FX_FADE_NEW, fadeOut: FX_FADE_NEW, label: 'Effetto “' + file.name + '” a ' + fmtSec(at) });
  } catch { toast('Questo file non si può leggere. Prova con un MP3, WAV, M4A o FLAC.'); }
  finally { busy(false); }
}
/* ---------- sigla e chiusura ---------- */
// Sono effetti ancorati: anchor 'start' (la sigla, all'inizio, con la voce che parte dopo) o 'end' (la chiusura, dopo
// la coda della musica). La posizione la decide layout(); volume, dissolvenze e taglio si regolano come per ogni effetto.
const anchoredFx = kind => S.fx.find(e => e.anchor === kind);
const ANCHOR_NAME = { start: 'Sigla', end: 'Chiusura' };
// volume che porta il file al livello della voce (obiettivo della voce, in LUFS)
function anchorGain(chs) {
  const max = SR * 120, n = chs[0].length, a = n > max ? Math.floor((n - max) / 2) : 0, b = Math.min(n, a + max);
  const l = lufs(chs.map(c => c.subarray(a, b)), chs.length === 1);
  return l > -80 ? Math.round(clamp(P.target - l, -30, 12) * 2) / 2 : 0;
}
// la base dell'operazione: si usa per un file nuovo e per i modelli di serie
function anchoredOp(kind, srcId, gainDb, extra) {
  return Object.assign({ type: 'fxadd', id: uid(), src: srcId, at: 0, anchor: kind, gainDb, fadeIn: FX_FADE_NEW, fadeOut: FX_FADE_NEW, name: ANCHOR_NAME[kind], color: 'fx3' }, extra || {});
}
async function importAnchored(file, kind) {
  if (!file) return;
  stopIfPlaying(); busy(true, 'Lettura di ' + file.name + '…', 0.3);
  try {
    const d = await decodeFile(file);
    if (d.chs[0].length > SR * 180) toast('Questo file dura più di tre minuti: se è un sottofondo, caricalo come musica.');
    const id = addSource(file.name, 'effetto', d.chs); saveSource(id);
    const g = anchorGain(d.chs), add = anchoredOp(kind, id, g), old = anchoredFx(kind), what = (kind === 'start' ? 'Sigla' : 'Chiusura') + ' “' + file.name + '”';
    S.fxSel = add.id;
    pushOp(old ? { type: 'multi', ops: [{ type: 'fxdel', id: old.id }, add], label: what + ' al posto di quella di prima' } : Object.assign(add, { label: what }));
    $('#siglaStatus').textContent = what + ': volume ' + (g >= 0 ? '+' : '') + fmtNum(g, 1) + ' dB per stare al livello della voce.';
    toast(kind === 'start' ? 'Sigla aggiunta: la voce parte dopo.' : 'Chiusura aggiunta: suona alla fine e si sposta da sola se la voce cambia.');
  } catch { toast('Questo file non si può leggere. Prova con un MP3, WAV, M4A o FLAC.'); }
  finally { busy(false); }
}
function removeAnchored(kind) {
  const e = anchoredFx(kind); if (!e) return;
  stopIfPlaying(); pushOp({ type: 'fxdel', id: e.id, label: kind === 'start' ? 'Tolta la sigla' : 'Tolta la chiusura' });
}
function updateAnchoredUI() {
  const box = $('#pSigla'); if (!box) return;
  for (const [kind, nm, btn] of [['start', '#nameSig', '#btnSigRemove'], ['end', '#nameEnd', '#btnEndRemove']]) {
    const e = anchoredFx(kind), src = e && S.sources.get(e.src);
    $(nm).textContent = src ? src.name + ' (' + fmtDur(fxSpan(e) / SR) + ')' : 'Trascina qui un file o clicca per sceglierlo';
    $(btn).disabled = !e;
  }
}
// elenco degli effetti (un clic sceglie quello da modificare) e pannello dell'effetto selezionato
const FX_HELP = {
  gain: 'Quanto forte suona questo effetto, rispetto agli altri. Per esempio -6 dB per un gong che deve restare sullo sfondo.',
  in: 'Da quale punto del file parte l’effetto. Il file originale non cambia: per esempio salti un silenzio iniziale. Si regola anche trascinando il bordo sinistro del blocco.',
  out: 'Dove finisce il tratto usato del file. Per esempio tieni solo il primo colpo di un campanello. Si regola anche trascinando il bordo destro del blocco.',
  loop: 'Ripete il tratto scelto finché dura il blocco, con una breve sfumatura di 0,1 s a ogni giunzione per non sentire scatti. Utile per pioggia, vento o un ticchettio di fondo.',
  fadeIn: 'Quanto tempo impiega l’effetto a salire dal silenzio al suo volume. Per esempio 1 s per una pioggia che arriva piano. Gli effetti nuovi partono con 5 ms, che bastano a evitare uno scatto. Si regola anche trascinando la maniglia in alto a sinistra del blocco.',
  fadeOut: 'Quanto tempo impiega l’effetto a sparire. Per esempio 2 s per un vento che si allontana, oppure per chiudere un tratto tagliato senza un colpo secco. Si regola anche con la maniglia in alto a destra del blocco.',
  duck: 'Se l’effetto deve farsi sentire sopra la musica, per esempio un gong importante o una voce registrata, la musica scende mentre suona e poi risale, come fa con la tua voce. Usa la stessa rapidità di discesa e risalita del ducking. Predefinito: non la abbassa.',
  duckDb: 'Di quanto scende la musica mentre suona questo effetto. -10 dB la tiene ben in sottofondo; se l’effetto è già forte, -6 dB può bastare.',
  mute: 'Spegne questo effetto senza toglierlo, in ascolto e nel file esportato. Per esempio per provare il capitolo senza il gong.',
  solo: 'Fa sentire solo questo effetto tra gli effetti (voce e musica restano). Vale anche nell’esportazione: ricordati di toglierlo prima di esportare.',
  name: 'Un nome per riconoscerlo sulla timeline e nell’elenco, per esempio “porta del capitolo 3”. Il file non cambia.',
  color: 'Il colore del blocco sulla timeline, per distinguere a colpo d’occhio, per esempio, i passi dalle porte.',
  pan: 'Da quale lato arriva l’effetto: per esempio una porta che si chiude a sinistra o passi che vanno verso destra. Il volume percepito resta lo stesso in ogni posizione. Se esporti in mono la posizione non conta e l’effetto esce come al centro. Doppio clic sul cursore per tornare al centro.',
  lp: 'Fa sembrare l’effetto più lontano o dietro qualcosa, togliendo gli acuti: a 30 % è in un’altra stanza, a 80 % dietro una porta chiusa. Doppio clic sul cursore per tornare vicino.',
  rev: 'Aggiunge l’eco di un ambiente: stanza piccola per un rumore in casa, sala grande per una chiesa o un teatro, caverna per qualcosa di enorme o di sogno. La coda continua dopo la fine del blocco, che sulla timeline si allunga e mostra una linea tratteggiata dove comincia.',
  revMix: 'Quanto si sente l’ambiente rispetto al suono diretto. 30 % è naturale, 100 % è solo eco.',
  rate: 'Cambia insieme velocità e altezza, come un nastro: × 0,5 è il doppio più lento e un’ottava più grave, × 2 il doppio più veloce e più acuto. Utile per un passo più pesante o un campanello più piccolo. La durata del blocco cambia di conseguenza. Doppio clic sul cursore per tornare a × 1.',
  env: 'Disegna il volume nel tempo: per esempio un temporale che cresce e poi si allontana, oppure un effetto che si abbassa mentre parli. Sulla timeline fai doppio clic sul blocco per aggiungere un punto, trascinalo per spostarlo, portalo fuori dal blocco per toglierlo. Qui sotto puoi scrivere i valori a mano. Si somma al volume e alle dissolvenze.',
  len: 'Quanto dura il blocco sulla timeline quando il tratto si ripete. Si regola anche trascinando il bordo destro del blocco.'
};
// una riga sotto ogni controllo dell'effetto, nello stesso tono di HINT
const FX_HINT = {
  gain: 'Quanto forte suona, rispetto agli altri effetti.',
  in: 'Da dove parte il suono nel file.',
  out: 'Dove finisce il tratto usato del file.',
  loop: 'Ripete il tratto, per pioggia, vento o ticchettii.',
  fadeIn: 'Il suono arriva piano invece che di colpo.',
  fadeOut: 'Il suono sfuma invece di fermarsi di colpo.',
  duck: 'Può abbassare la musica mentre suona.',
  duckDb: 'Quanto scende la musica mentre suona.',
  mute: 'Lo spegne senza toglierlo.',
  solo: 'Fa sentire solo questo, tra gli effetti.',
  name: 'Per riconoscerlo sulla timeline.',
  color: 'Per distinguerlo a colpo d’occhio.',
  pan: 'Da quale lato arriva il suono.',
  lp: 'Lo fa sembrare lontano o dietro una porta.',
  rev: 'Aggiunge l’eco di un ambiente.',
  revMix: 'Quanto si sente l’ambiente.',
  rate: 'Più lento e grave, o più veloce e acuto.',
  env: 'Il volume che cambia nel tempo.',
  len: 'Quanto dura il blocco che si ripete.'
};
const fxHintOf = help => FX_HINT[Object.keys(FX_HELP).find(k => FX_HELP[k] === help)];
function fxRow(label, help, ctl, adv) {
  const row = document.createElement('div'); row.className = 'row' + (adv ? ' adv' : '');
  const top = document.createElement('div'); top.className = 'row-top';
  const lab = document.createElement('span'); lab.className = 'lab'; lab.append(ctl.label, makeInfo(help, ctl.label.textContent));
  top.append(lab); if (ctl.out) top.append(ctl.out); row.append(top, ctl.input); addHint(row, fxHintOf(help)); return row;
}
function fxSlider(id, text, min, max, step, val, fmt, onCommit) {
  const label = document.createElement('label'); label.htmlFor = id; label.textContent = text;
  const input = document.createElement('input'); input.type = 'range'; input.id = id; input.min = min; input.max = max; input.step = step; input.value = val; input.style.setProperty('--c', 'var(--fx)');
  const out = document.createElement('output'); out.className = 'val'; out.htmlFor = id; out.textContent = fmt(+val);
  input.addEventListener('input', () => { out.textContent = fmt(+input.value); sliderFill(input); });
  input.addEventListener('change', () => onCommit(+input.value)); sliderFill(input);
  return { label, input, out };
}
function renderFxList() {
  updateAnchoredUI();
  const ul = $('#fxList'), box = $('#fxEdit'); ul.innerHTML = ''; box.innerHTML = '';
  if (S.fxSel && !S.fx.some(e => e.id === S.fxSel)) S.fxSel = null;
  if (!S.fx.length) { const li = document.createElement('li'); li.textContent = 'Nessun effetto inserito.'; ul.appendChild(li); return; }
  S.fx.forEach(e => {
    const src = S.sources.get(e.src); if (!src) return;
    const li = document.createElement('li'); if (e.id === S.fxSel) li.className = 'cur';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'linkbtn t'; b.setAttribute('aria-pressed', String(e.id === S.fxSel));
    b.textContent = fxName(e) + ', a ' + fmtSec(e.at) + ', ' + fmtNum(fxSpan(e) / SR, 2) + ' s' + (e.mute ? ', silenziato' : '') + (e.solo ? ', in solo' : '');
    b.addEventListener('click', () => selectFx(e.id));
    const dot = document.createElement('span'); dot.className = 'fxdot'; dot.setAttribute('aria-hidden', 'true'); dot.style.background = 'var(--' + (e.color || 'fx') + ')';
    b.prepend(dot); li.append(b); ul.appendChild(li);
  });
  const e = S.fx.find(x => x.id === S.fxSel);
  if (!e) { const p = document.createElement('p'); p.className = 'note'; p.textContent = 'Clicca un effetto sulla timeline o nell’elenco per modificarlo.'; box.appendChild(p); return; }
  if (FXPV.id && FXPV.id !== e.id) stopFxPreview();
  const src = S.sources.get(e.src), name = fxName(e), dur = src.len / SR, [a, b] = fxRange(e, src), sec = v => fmtNum(v, 2) + ' s';
  const edit = (set, label) => pushOp({ type: 'fxedit', id: e.id, set, label: 'Effetto “' + name + '”: ' + label });
  const h = document.createElement('h3'); h.className = 'fx-h'; h.textContent = name; box.appendChild(h);
  // gestione: silenzia (anche in Semplice), poi nome, colore e solo in Avanzata
  const chk = (id, text, help, val, onCh, adv) => { const d = document.createElement('div'); d.className = 'check' + (adv ? ' adv' : ''); d.innerHTML = '<label class="chk"><input type="checkbox" id="' + id + '"><span></span></label><span class="lab"></span>'; d.querySelector('span').textContent = text; d.querySelector('.lab').appendChild(makeInfo(help, text)); const c = d.querySelector('input'); c.checked = !!val; c.addEventListener('change', () => onCh(c.checked)); addHint(d, fxHintOf(help)); return d; };
  box.appendChild(chk('fx_mute', 'Silenzia', FX_HELP.mute, e.mute, v => edit({ mute: v || null }, v ? 'silenziato' : 'di nuovo udibile')));
  box.appendChild(chk('fx_solo', 'Solo', FX_HELP.solo, e.solo, v => edit({ solo: v || null }, v ? 'in solo' : 'non più in solo'), true));
  const nr = document.createElement('div'); nr.className = 'row adv';
  nr.innerHTML = '<div class="row-top"><span class="lab"><label for="fx_name">Nome</label></span></div><input type="text" id="fx_name" maxlength="40">';
  nr.querySelector('.lab').appendChild(makeInfo(FX_HELP.name, 'Nome')); const ni = nr.querySelector('input'); ni.value = e.name || ''; ni.placeholder = src.name.replace(/\.[^.]+$/, ''); addHint(nr, FX_HINT.name);
  ni.addEventListener('change', () => edit({ name: ni.value.trim() || null }, ni.value.trim() ? 'si chiama “' + ni.value.trim() + '”' : 'di nuovo con il nome del file')); box.appendChild(nr);
  const cr = document.createElement('div'); cr.className = 'row adv';
  cr.innerHTML = '<div class="row-top"><span class="lab">Colore</span></div><div class="fxcolors" role="radiogroup" aria-label="Colore dell’effetto"></div>';
  cr.querySelector('.lab').appendChild(makeInfo(FX_HELP.color, 'Colore'));
  FX_COLORS.forEach(([k, label]) => { const sw = document.createElement('button'); sw.type = 'button'; sw.className = 'fxsw'; sw.setAttribute('role', 'radio'); sw.setAttribute('aria-checked', String((e.color || 'fx') === k)); sw.setAttribute('aria-label', label); sw.title = label; sw.style.background = 'var(--' + k + ')';
    sw.addEventListener('click', () => { if ((e.color || 'fx') !== k) edit({ color: k }, 'colore ' + label.toLowerCase()); }); cr.querySelector('.fxcolors').appendChild(sw); });
  addHint(cr, FX_HINT.color); box.appendChild(cr);
  box.appendChild(fxRow('Volume', FX_HELP.gain, fxSlider('fx_gain', 'Volume', -24, 12, 0.5, e.gainDb, v => (v > 0 ? '+' : '') + fmtNum(v, 1) + ' dB',
    v => pushOp({ type: 'fxgain', id: e.id, gainDb: v, label: 'Volume dell’effetto “' + name + '” a ' + fmtNum(v, 1) + ' dB' }))));
  box.appendChild(fxRow('Inizio', FX_HELP.in, fxSlider('fx_in', 'Inizio nel file', 0, Math.max(0, (b / SR) - FX_MIN).toFixed(2), 0.01, (a / SR).toFixed(2), sec,
    v => edit({ in: v, out: b / SR }, 'inizio a ' + sec(v)))));
  box.appendChild(fxRow('Fine', FX_HELP.out, fxSlider('fx_out', 'Fine nel file', (a / SR + FX_MIN).toFixed(2), dur.toFixed(2), 0.01, (b / SR).toFixed(2), sec,
    v => edit({ in: a / SR, out: v }, 'fine a ' + sec(v)))));
  const spanS = fxDry(e) / SR, fmtF = v => v < 0.1 ? fmtNum(v * 1000, 0) + ' ms' : fmtNum(v, 2) + ' s';
  box.appendChild(fxRow('Entrata', FX_HELP.fadeIn, fxSlider('fx_fi', 'Entrata graduale', 0, Math.max(0.005, spanS - (e.fadeOut || 0)).toFixed(3), 0.005, e.fadeIn || 0, fmtF,
    v => edit({ fadeIn: v }, 'entrata graduale di ' + fmtF(v)))));
  box.appendChild(fxRow('Uscita', FX_HELP.fadeOut, fxSlider('fx_fo', 'Uscita graduale', 0, Math.max(0.005, spanS - (e.fadeIn || 0)).toFixed(3), 0.005, e.fadeOut || 0, fmtF,
    v => edit({ fadeOut: v }, 'uscita graduale di ' + fmtF(v)))));
  const fmtPan = v => Math.abs(v) < 0.001 ? 'Centro' : (v < 0 ? 'Sinistra ' : 'Destra ') + Math.round(Math.abs(v) * 100) + ' %';
  const pan = fxSlider('fx_pan', 'Posizione stereo', -1, 1, 0.05, e.pan || 0, fmtPan, v => edit({ pan: Math.round(v * 100) / 100 }, 'posizione ' + fmtPan(v).toLowerCase()));
  pan.input.addEventListener('dblclick', () => { if (e.pan) edit({ pan: null }, 'posizione al centro'); });
  box.appendChild(fxRow('Posizione', FX_HELP.pan, pan, true));
  // carattere del suono (Avanzata): lontano, riverbero, velocità e intonazione
  const LP_MIN = 400, lpPct = f => f ? Math.round(Math.log(20000 / f) / Math.log(20000 / LP_MIN) * 100) : 0, lpHz = v => Math.round(20000 * Math.pow(LP_MIN / 20000, v / 100) / 10) * 10;
  const fmtLp = v => v < 1 ? 'Vicino' : v + ' %, acuti tolti sopra ' + (lpHz(v) >= 1000 ? fmtNum(lpHz(v) / 1000, 1) + ' kHz' : lpHz(v) + ' Hz');
  const lps = fxSlider('fx_lp', 'Lontano', 0, 100, 1, lpPct(e.lp), fmtLp, v => edit({ lp: v < 1 ? null : lpHz(v) }, v < 1 ? 'di nuovo vicino' : 'lontano ' + v + ' %'));
  lps.input.addEventListener('dblclick', () => { if (e.lp) edit({ lp: null }, 'di nuovo vicino'); });
  box.appendChild(fxRow('Lontano', FX_HELP.lp, lps, true));
  const rv = document.createElement('div'); rv.className = 'row adv';
  rv.innerHTML = '<div class="row-top"><span class="lab"><label for="fx_rev">Riverbero</label></span></div><select id="fx_rev"><option value="">Nessuno</option><option value="small">Stanza piccola</option><option value="large">Sala grande</option><option value="cave">Caverna</option></select>';
  rv.querySelector('.lab').appendChild(makeInfo(FX_HELP.rev, 'Riverbero'));
  const rs = rv.querySelector('select'); rs.value = e.rev ? e.rev.type : '';
  rs.addEventListener('change', () => edit({ rev: rs.value ? { type: rs.value, mix: e.rev ? e.rev.mix : 0.3 } : null }, rs.value ? 'riverbero ' + rs.options[rs.selectedIndex].text.toLowerCase() : 'senza riverbero'));
  addHint(rv, FX_HINT.rev); box.appendChild(rv);
  if (e.rev) box.appendChild(fxRow('Quantità', FX_HELP.revMix, fxSlider('fx_revmix', 'Quantità di riverbero', 0, 100, 1, Math.round(e.rev.mix * 100), v => v + ' %',
    v => edit({ rev: { type: e.rev.type, mix: v / 100 } }, 'riverbero al ' + v + ' %')), true));
  const fmtRate = v => '× ' + fmtNum(v, 2);
  const rts = fxSlider('fx_rate', 'Velocità e intonazione', 0.5, 2, 0.01, fxRate(e), fmtRate, v => edit({ rate: Math.abs(v - 1) < 0.001 ? null : v }, 'velocità × ' + fmtNum(v, 2)));
  rts.input.addEventListener('dblclick', () => { if (e.rate) edit({ rate: null }, 'velocità normale'); });
  box.appendChild(fxRow('Velocità', FX_HELP.rate, rts, true));
  // rapporto con la musica (Avanzata): per scelta non la abbassa, come prima
  const dk = document.createElement('div'); dk.className = 'row adv';
  dk.innerHTML = '<div class="row-top"><span class="lab"><label for="fx_duck">Musica</label></span></div><select id="fx_duck"><option value="">Non la abbassa</option><option value="on">La abbassa mentre suona</option></select>';
  dk.querySelector('.lab').appendChild(makeInfo(FX_HELP.duck, 'Musica'));
  const ds = dk.querySelector('select'); ds.value = e.duck < 0 ? 'on' : '';
  ds.addEventListener('change', () => { edit({ duck: ds.value ? -10 : null }, ds.value ? 'abbassa la musica di 10 dB' : 'non abbassa più la musica'); restartIfPlaying(); });
  addHint(dk, FX_HINT.duck); box.appendChild(dk);
  if (e.duck < 0) box.appendChild(fxRow('Abbassamento', FX_HELP.duckDb, fxSlider('fx_duckdb', 'Abbassamento della musica', -30, -3, 0.5, e.duck, v => fmtNum(v, 1) + ' dB',
    v => { edit({ duck: v }, 'abbassa la musica di ' + fmtNum(-v, 1) + ' dB'); restartIfPlaying(); }), true));
  const lp = document.createElement('div'); lp.className = 'check adv';
  lp.innerHTML = '<label class="chk"><input type="checkbox" id="fx_loop"><span>Ripeti il tratto</span></label><span class="lab"></span>';
  lp.querySelector('.lab').appendChild(makeInfo(FX_HELP.loop, 'Ripeti il tratto'));
  const ck = lp.querySelector('input'); ck.checked = !!e.loop;
  ck.addEventListener('change', () => edit(ck.checked ? { loop: true, len: fxDry(e) / SR } : { loop: null, len: null }, ck.checked ? 'si ripete' : 'non si ripete più'));
  addHint(lp, FX_HINT.loop); box.appendChild(lp);
  if (e.loop) box.appendChild(fxRow('Durata', FX_HELP.len, fxSlider('fx_len', 'Durata del blocco', 0.1, Math.max(600, Math.ceil(fxDry(e) / SR)), 0.1, (fxDry(e) / SR).toFixed(1), sec,
    v => edit({ len: v }, 'dura ' + sec(v))), true));
  // curva di volume (Avanzata): punti modificabili anche da tastiera
  const ev = document.createElement('div'); ev.className = 'fxenv adv';
  const eh = document.createElement('div'); eh.className = 'row-top'; const el = document.createElement('span'); el.className = 'lab'; el.textContent = 'Curva di volume'; el.appendChild(makeInfo(FX_HELP.env, 'Curva di volume')); eh.appendChild(el); ev.appendChild(eh); addHint(ev, FX_HINT.env);
  const env = e.env || [], setEnv = (list, label) => edit({ env: list.slice().sort((p, q) => p[0] - q[0]) }, label);
  if (!env.length) { const p = document.createElement('p'); p.className = 'note'; p.textContent = 'Nessun punto: volume costante. Doppio clic sul blocco per aggiungerne uno.'; ev.appendChild(p); }
  env.forEach(([pt, pd], k) => {
    const r = document.createElement('div'); r.className = 'envpt';
    const num = (v, st, mn, mx, lab) => { const i = document.createElement('input'); i.type = 'number'; i.step = st; i.min = mn; i.max = mx; i.value = v; i.setAttribute('aria-label', lab); return i; };
    const it = num(pt, 0.01, 0, (fxDry(e) / SR).toFixed(2), 'Tempo del punto ' + (k + 1) + ' in secondi'), id = num(pd, 0.5, FX_ENV_BOT, FX_ENV_TOP, 'Volume del punto ' + (k + 1) + ' in dB');
    const commit = () => { const v = [clamp(+it.value || 0, 0, fxDry(e) / SR), clamp(+id.value || 0, FX_ENV_BOT, FX_ENV_TOP)], l = env.map(q => q.slice()); l[k] = v; setEnv(l, 'curva di volume, punto ' + (k + 1) + ' a ' + fmtNum(v[0], 2) + ' s e ' + fmtNum(v[1], 1) + ' dB'); };
    it.addEventListener('change', commit); id.addEventListener('change', commit);
    const del = document.createElement('button'); del.className = 'btn small'; del.textContent = 'Togli'; del.setAttribute('aria-label', 'Togli il punto ' + (k + 1));
    del.addEventListener('click', () => setEnv(env.filter((q, j) => j !== k), 'tolto un punto della curva di volume'));
    const t1 = document.createElement('span'); t1.textContent = (k + 1) + '. a'; const t2 = document.createElement('span'); t2.textContent = 's,'; const t3 = document.createElement('span'); t3.textContent = 'dB';
    r.append(t1, it, t2, id, t3, del); ev.appendChild(r);
  });
  const er = document.createElement('div'); er.className = 'btnrow';
  const add = document.createElement('button'); add.className = 'btn small'; add.textContent = 'Aggiungi un punto al cursore';
  add.addEventListener('click', () => { if (S.cur < e.at || S.cur > e.at + fxDry(e)) { toast('Porta prima il cursore dentro il blocco dell’effetto.'); return; } const rt = Math.round((S.cur - e.at) / SR * 1000) / 1000; setEnv(env.filter(q => Math.abs(q[0] - rt) > 0.001).concat([[rt, Math.round(fxEnvAt(env, rt) * 2) / 2]]), 'aggiunto un punto alla curva di volume a ' + fmtNum(rt, 2) + ' s'); });
  er.appendChild(add);
  if (env.length) { const clr = document.createElement('button'); clr.className = 'btn small'; clr.textContent = 'Togli la curva'; clr.addEventListener('click', () => edit({ env: null }, 'tolta la curva di volume')); er.appendChild(clr); }
  ev.appendChild(er); box.appendChild(ev);
  const row = document.createElement('div'); row.className = 'btnrow';
  const pv = document.createElement('button'); pv.className = 'btn small'; pv.id = 'fxPreview'; pv.textContent = FXPV.id === e.id ? 'Ferma l’ascolto' : 'Ascolta l’effetto'; pv.addEventListener('click', () => fxPreview(e)); row.appendChild(pv);
  const dup = document.createElement('button'); dup.className = 'btn small'; dup.textContent = 'Duplica'; dup.setAttribute('aria-label', 'Duplica l’effetto ' + name); dup.addEventListener('click', () => duplicateFx(e)); row.appendChild(dup);
  const go = document.createElement('button'); go.className = 'btn small'; go.textContent = 'Vai'; go.setAttribute('aria-label', 'Vai all’effetto ' + name);
  go.addEventListener('click', () => { S.cur = e.at; S.sel = null; followPlayhead(e.at); drawTop(); updateSelInfo(); });
  row.appendChild(go);
  if (e.in != null || e.out != null || e.len != null || e.loop) { const rs = document.createElement('button'); rs.className = 'btn small'; rs.textContent = 'Usa tutto il file'; rs.addEventListener('click', () => edit({ in: null, out: null, len: null, loop: null }, 'di nuovo tutto il file')); row.appendChild(rs); }
  const del = document.createElement('button'); del.className = 'btn small'; del.textContent = 'Togli'; del.setAttribute('aria-label', 'Togli l’effetto ' + name);
  del.addEventListener('click', () => pushOp({ type: 'fxdel', id: e.id, label: 'Tolto l’effetto “' + name + '”' }));
  row.appendChild(del); box.appendChild(row);
  const note = document.createElement('p'); note.className = 'note';
  note.textContent = 'Usati ' + sec((b - a) / SR) + ' su ' + sec(dur) + ' del file' + (fxRate(e) !== 1 ? ', a velocità × ' + fmtNum(fxRate(e), 2) : '') + (e.loop ? ', ripetuti fino a ' + sec(fxDry(e) / SR) : '') + (e.rev ? ', più ' + sec(fxTail(e) / SR) + ' di coda del riverbero' : '') + '. Sulla timeline trascina i bordi del blocco per accorciarlo.';
  box.appendChild(note);
}

