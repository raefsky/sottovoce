/* ========================= Utilità ========================= */
// Nome del programma: si cambia solo qui. build.py lo legge da questa riga e lo mette anche nelle parti fisse della pagina
// (titolo, intestazione, piè di pagina, commenti). I nomi interni restano "sottovoce-studio" (chiavi del browser,
// formato dei progetti e dei preset): così progetti, preset e impostazioni salvati continuano a funzionare.
const APP_NAME = 'Sottovoce Officina Sonora';
// numero di versione del programma (anche questo letto da build.py); nei progetti va accanto al numero di formato, che resta 1
const APP_VERSION = '2.0.0';
// confronto tra versioni scritte come 1.2.3: positivo se a è più recente di b
const cmpVersion = (a, b) => { const x = String(a).split('.').map(n => parseInt(n, 10) || 0), y = String(b).split('.').map(n => parseInt(n, 10) || 0); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
// frase di chiarezza, testuale (verificata nel codice: nessuna richiesta di rete, nessun invio di dati, nessuna analisi esterna)
const APP_DISCLAIMER = "Strumento gratuito, offerto così com'è, senza garanzie. L'audio non lascia il tuo computer.";
// contatto per le segnalazioni: si scrive solo qui (indirizzo o pagina), compare nella finestra Informazioni
const APP_CONTACT = 'kenoma.records@gmail.com';   // contatto per segnalazioni e suggerimenti
const APP_SLUG = APP_NAME.toLowerCase().replace(/\s+/g, '-');   // per i nomi di file suggeriti: sottovoce-officina-sonora
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const SR = 48000;                       // tutto il programma lavora a 48 kHz, senza doppie conversioni
// sistema operativo, per scorciatoie e istruzioni giuste (per le prove: ?os=win, ?os=linux, ?os=mac)
const OS = (() => {
  const q = (location.search.match(/[?&]os=(mac|win|linux)\b/) || [])[1]; if (q) return q;
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
  if (/mac|iphone|ipad/i.test(p)) return 'mac';
  if (/win/i.test(p)) return 'win';
  return 'linux';
})();
const MOD = OS === 'mac' ? '⌘' : 'Ctrl';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const dbToGain = d => Math.pow(10, d / 20);
const gainToDb = g => 20 * Math.log10(Math.max(g, 1e-12));
const yieldUI = () => new Promise(r => setTimeout(r, 0));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// numeri all'italiana: virgola decimale
function fmtNum(v, dec) { return (+v).toFixed(dec == null ? 1 : dec).replace('.', ',').replace(/^-0(,0+)?$/, '0$1'); }
function fmtDb(v, dec) { return v <= -99 ? '-inf' : fmtNum(v, dec == null ? 1 : dec); }
// tempo: si arrotonda prima ai decimi, così 59,96 s diventa 1:00,0 e non 0:60,0
function fmtTime(t, dec) {
  dec = dec == null ? 1 : dec;
  if (!isFinite(t) || t < 0) t = 0;
  const k = Math.pow(10, dec), u = Math.round(t * k);
  const h = Math.floor(u / (3600 * k)), m = Math.floor((u % (3600 * k)) / (60 * k)), s = (u % (60 * k)) / k;
  const ss = (s < 10 ? '0' : '') + s.toFixed(dec).replace('.', ',');
  return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
}
const fmtSec = n => fmtTime(n / SR);
function fmtDur(sec) { return sec < 60 ? fmtNum(sec, 1) + ' s' : fmtTime(sec); }
function fmtBytes(b) { return b < 1048576 ? fmtNum(b / 1024, 0) + ' KB' : fmtNum(b / 1048576, 1) + ' MB'; }

let toastT = null;
function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 4800);
}
function busy(on, msg, p) {
  $('#busy').classList.toggle('on', !!on);
  if (msg) $('#busyMsg').textContent = msg;
  if (p != null) { const v = Math.round(clamp(p, 0, 1) * 100); $('#busyBar').style.width = v + '%'; $('#busyBarBox').setAttribute('aria-valuenow', String(v)); }
}
const progress = (msg, a, b) => f => busy(true, msg, a + (b - a) * f);

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
// nome per i file: il titolo; se manca, il nome del file della prima voce del montaggio; poi il nome di riserva
function fileBase(def) {
  const t = safeName(META.title, ''); if (t) return t;
  const g = S.segs.find(x => x.src && S.sources.get(x.src)), s = g && S.sources.get(g.src);
  const v = s ? safeName(s.name.replace(/\.[^.]+$/, ''), '') : '';
  return v || safeName(APP_NAME + ' ' + def, def);     // senza titolo né voce: Sottovoce_Officina_Sonora_voce
}
function safeName(s, def) {
  const n = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
  return n || def;
}

