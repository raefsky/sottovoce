/* ========================= Avvio ========================= */
function bindFile(inputSel, slotSel, fn) {
  const inp = $(inputSel); inp.addEventListener('change', () => { const f = inp.files[0]; inp.value = ''; fn(f); });
  if (!slotSel) return;
  const slot = $(slotSel);
  ['dragenter', 'dragover'].forEach(ev => slot.addEventListener(ev, e => { e.preventDefault(); slot.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => slot.addEventListener(ev, e => { e.preventDefault(); slot.classList.remove('drag'); }));
  slot.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) fn(f); });
}
function init() {
  DEFAULTS = Object.assign({}, P);
  try { const saved = JSON.parse(localStorage.getItem('sottovoce-studio.impostazioni.v1') || 'null'); if (saved) Object.keys(saved).forEach(k => { if (k in P && typeof saved[k] === typeof P[k]) P[k] = saved[k]; }); } catch { }
  buildPanels(); markAdvanced(); buildStyles(); buildPresetUI(); bindControls(); syncAll();
  initHelp(); initTabs(); initLook(); initTimeline(); initKeys(); initMenus(); initWelcome(); initFlow();
  const on = (id, fn) => $(id).addEventListener('click', fn);
  on('#tUndo', undo); on('#tRedo', redo); on('#tCut', doCut); on('#tCopy', () => doCopy()); on('#tPaste', doPaste); on('#tDel', doDelete); on('#tSil', doSilence);
  on('#tFadeIn', () => doFade('in')); on('#tFadeOut', () => doFade('out')); on('#tAll', selectAll);
  on('#zIn', () => zoomAt(0.5)); on('#zOut', () => zoomAt(2)); on('#zFit', fitView); on('#zSel', zoomSel);
  on('#btnPlay', togglePlay); on('#btnRec', toggleRecord); on('#btnMonitor', toggleMonitor);
  on('#btnBack', () => moveCursor(-5 * SR, false)); on('#btnFwd', () => moveCursor(5 * SR, false));
  on('#btnEnd', () => { const T = layout().total; if (S.playing) stopPlayback(); S.cur = T; S.anchor = T; S.sel = null; followPlayhead(T); drawTop(); updateSelInfo(); updateButtons(); });
  on('#btnClearHist', clearHistory);
  on('#emptyRec', toggleRecord); on('#emptyImport', () => $('#fileVoice').click());
  on('#tNone', () => { S.sel = null; drawTop(); updateSelInfo(); updateButtons(); });
  on('#btnHome', () => { S.cur = 0; S.anchor = 0; S.sel = null; if (S.playing) startPlayback(0, layout().total); followPlayhead(0); drawTop(); updateSelInfo(); updateButtons(); });
  on('#abOrig', () => setMode(BL.on ? 'x' : 'orig')); on('#abProc', () => setMode(BL.on ? 'y' : 'proc')); on('#btnBlind', toggleBlind);
  on('#btnApply', improveSources); on('#btnHum', findHum); on('#btnPropose', analyzePropose); on('#btnPodcast', podcastMode); initEpisode(); initEditBar(); on('#btnSilFind', previewSilences); on('#btnSilApply', applySilences);
  $$('[data-spec]').forEach(b => b.addEventListener('click', () => { P.specView = b.dataset.spec; $$('[data-spec]').forEach(o => o.setAttribute('aria-pressed', String(o === b))); scheduleSpec(0); scheduleSave(); })); on('#btnExport', doExport); on('#btnStems', doStems);
  on('#btnSerieSave', saveSerie); on('#btnSerieImport', () => $('#fileSerie').click()); bindFile('#fileSerie', null, importSerie); renderSerie();
  on('#btnSaveProj', saveProject); on('#btnSaveAs', () => saveProject(null, true)); on('#fileFlag', fileFlagClick);
  on('#btnOpenProj', () => FILE.ok ? openWithPicker() : $('#fileProj').click()); on('#btnNewProj', newProject);
  on('#btnMusicRemove', removeMusic); on('#btnCover', () => $('#fileCover').click()); on('#btnCoverDel', () => { META.cover = null; showCover(); scheduleSave(); });
  on('#btnInfo', openInfo); on('#btnGuide', () => $('#guide').showModal());
  bindFile('#fileVoice', '#slotVoice', importVoice); bindFile('#fileMusic', '#slotMusic', importMusic); bindFile('#fileFx', '#slotFx', importFx);
  bindFile('#fileSig', '#slotSig', f => importAnchored(f, 'start')); bindFile('#fileEnd', '#slotEnd', f => importAnchored(f, 'end'));
  on('#btnSigRemove', () => removeAnchored('start')); on('#btnEndRemove', () => removeAnchored('end'));
  bindFile('#fileReplace', null, f => importVoice(f, true));
  on('#btnReplaceVoice', () => $('#fileReplace').click());
  bindFile('#fileProj', null, openProject); bindFile('#fileCover', null, pickCover);
  ['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => e.preventDefault()));
  // avviso prima di chiudere o ricaricare: durante la registrazione e quando ci sono modifiche non salvate in un file di progetto
  window.addEventListener('beforeunload', e => { if (S.recording || isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  replay(); afterEdit(null); showCover(); renderReport(); startMeter(); updateProjText();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawAll());   // ridisegna la timeline quando i caratteri sono pronti
  offerRestore().then(maybeWelcome, maybeWelcome);   // prima l'eventuale ripresa del lavoro, poi il benvenuto
}
init();

