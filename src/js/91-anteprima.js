/* ========================= Ascolta 10 s: anteprima di uno stile della voce ========================= */
// Prende 10 secondi della voce montata (dal cursore, se è dentro la voce; altrimenti dall'inizio del parlato),
// li passa nella catena di miglioramento con le regolazioni dello stile e li fa ascoltare, portati al volume
// dell'obiettivo della voce: così tutti gli stili si confrontano allo stesso volume. Lo stile non viene applicato.
// La catena legge le regolazioni globali (P): durante il calcolo si cambiano e poi si rimettono com'erano;
// intanto il salvataggio automatico aspetta (STYLE_PV.busy), così non si salvano regolazioni provvisorie.
const STYLE_PV = { busy: false, node: null, id: null, cache: new Map() };
const PV_LEN = 10;
function pvStart() {
  const lay = layout(), n = PV_LEN * SR, cur = S.cur - lay.intro;
  if (cur > 0.2 * SR && cur < S.vlen - SR) return Math.round(Math.min(cur, Math.max(0, S.vlen - n)));
  // dall'inizio del parlato: il primo tratto di 50 ms sopra -45 dBFS, meno mezzo secondo
  const x = renderVoice(0, Math.min(S.vlen, 60 * SR), false), w = SR / 20;
  for (let i = 0; i + w <= x.length; i += w) { let e = 0; for (let k = i; k < i + w; k++) e += x[k] * x[k]; if (e / w > 3.2e-5) return Math.max(0, Math.min(i - SR / 2, S.vlen - n)); }
  return 0;
}
function stopStylePreview() {
  if (STYLE_PV.node) { try { STYLE_PV.node.onended = null; STYLE_PV.node.stop(); } catch { } STYLE_PV.node.disconnect(); }
  STYLE_PV.node = null; STYLE_PV.id = null; updatePvButtons();
}
function updatePvButtons() {
  $$('.style-pv').forEach(b => {
    const on = b.dataset.style === STYLE_PV.id;
    b.textContent = on ? 'Ferma' : 'Ascolta 10 s'; b.setAttribute('aria-pressed', String(on));
    b.disabled = !S.vlen || S.recording || (STYLE_PV.busy && !on);
  });
}
async function stylePreview(st) {
  if (STYLE_PV.id === st.id) { stopStylePreview(); return; }
  if (!S.vlen || STYLE_PV.busy) return;
  stopIfPlaying(); stopStylePreview(); stopFxPreview();
  const a = pvStart(), n = Math.min(PV_LEN * SR, S.vlen - a), key = [st.id, a, n, S.version, improveKey()].join('|');
  let y = STYLE_PV.cache.get(key);
  if (!y) {
    STYLE_PV.busy = true; updatePvButtons();
    const old = {}; Object.keys(st.v).forEach(k => { old[k] = P[k]; P[k] = st.v[k]; });
    try {
      busy(true, 'Anteprima dello stile “' + st.name + '”…', 0);
      const x = renderVoice(a, n, false);
      y = await processSource(x, f => busy(true, 'Anteprima dello stile “' + st.name + '”…', f));
      const l = lufs(y, true); if (l > -90) y = scaleArr(y, dbToGain(P.target - l));
      const pk = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0); if (pk > 0.98) y = scaleArr(y, 0.98 / pk);
      if (STYLE_PV.cache.size > 8) STYLE_PV.cache.delete(STYLE_PV.cache.keys().next().value);
      STYLE_PV.cache.set(key, y);
    } catch (e) { toast('Anteprima non riuscita' + (e && e.message ? ': ' + e.message : '.')); return; }
    finally { Object.assign(P, old); STYLE_PV.busy = false; busy(false); updatePvButtons(); }
  }
  const c = ctx(), buf = c.createBuffer(1, y.length, SR); buf.copyToChannel(y, 0);
  const node = c.createBufferSource(); node.buffer = buf; node.connect(c.destination);
  node.onended = () => { if (STYLE_PV.node === node) { STYLE_PV.node = null; STYLE_PV.id = null; updatePvButtons(); } };
  if (c.state === 'suspended') await c.resume();
  node.start(); STYLE_PV.node = node; STYLE_PV.id = st.id; updatePvButtons();
  $('#styleStatus').textContent = 'Ascolti “' + st.name + '” su ' + fmtDur(n / SR) + ' della tua voce, da ' + fmtSec(a) + '. Per sceglierlo, clicca la scheda e poi “Applica i miglioramenti”.';
}
