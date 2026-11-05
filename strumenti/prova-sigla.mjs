// Prova di sigla e chiusura (effetti ancorati) e del tratto della musica.
//   node strumenti/prova-sigla.mjs
// File di prova riconoscibili dal tono: sigla 440 Hz (3 s), chiusura 660 Hz (2 s), musica 220 Hz.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = n => path.join(ROOT, 'strumenti/prova', n);
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };
const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addInitScript(() => { try { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); } catch (e) {} });
await ctx.route(/^(https?|wss?):/, r => r.abort());
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push(e.message)); page.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => typeof window.studioTest === 'function');
const L = () => page.evaluate(() => { const st = window.__studio, l = st.layout(), s = x => +(x / 48000).toFixed(2); return { intro: s(l.intro), total: s(l.total), mStart: s(l.mStart), mEnd: s(l.mEnd), fx: st.S.fx.map(e => ({ anchor: e.anchor || '', at: s(e.at), name: e.name || '', gain: e.gainDb })), ops: st.S.ops.length }; });
const waitOps = n => page.waitForFunction(n => window.__studio.S.ops.length === n, n, { timeout: 30000 });

await page.setInputFiles('#fileVoice', P('voce-prova.flac')); await waitOps(1);
await page.click('[data-tab="tracks"]');
await page.setInputFiles('#fileSig', P('sigla-440.flac')); await waitOps(2);
let l = await L();
check(l.intro === 3 && l.fx[0].anchor === 'start' && l.fx[0].at === 0 && l.fx[0].name === 'Sigla', 'sigla: all\'inizio, la voce parte dopo 3 s (' + JSON.stringify(l.fx[0]) + ', intro ' + l.intro + ')');
check(l.fx[0].gain > 0, 'sigla: volume regolato da solo al livello della voce (' + l.fx[0].gain + ' dB)');
await page.setInputFiles('#fileEnd', P('chiusura-660.flac')); await waitOps(3);
l = await L();
check(l.fx[1].anchor === 'end' && l.fx[1].at === 13 && l.total === 15, 'chiusura: dopo la voce, a 13 s; totale 15 s (' + l.fx[1].at + ', ' + l.total + ')');
check(await page.textContent('#nameSig') !== await page.textContent('#nameEnd') && /sigla-440/.test(await page.textContent('#nameSig')), 'i riquadri mostrano i due file');

// la voce cambia lunghezza: la chiusura la segue
await page.evaluate(() => window.__studio.pushOp({ type: 'delete', a: 48000, b: 96000, label: 'prova' })); await waitOps(4);
l = await L();
check(l.fx[1].at === 12 && l.total === 14, 'voce accorciata di 1 s: la chiusura si sposta a 12 s (' + l.fx[1].at + ')');
await page.evaluate(() => window.__studio.undo()); await waitOps(3);
l = await L(); check(l.fx[1].at === 13, 'annulla: la chiusura torna a 13 s');
// trascinarle non le sposta
await page.evaluate(() => { const st = window.__studio; st.pushOp({ type: 'fxmove', id: st.S.fx[0].id, at: 5 * 48000, label: 'prova' }); });
l = await L(); check(l.fx[0].at === 0 && l.intro === 3, 'uno spostamento della sigla non ha effetto');
await page.evaluate(() => window.__studio.undo());

// con la musica: sigla, intro musicale, voce, coda, chiusura
await page.setInputFiles('#fileMusic', P('musica-220.flac'));
await page.waitForFunction(() => !!window.__studio.S.musicId);
l = await L();
check(l.mStart === 3 && l.intro === 9 && l.fx[1].at === 25 && l.mEnd === 25 && l.total === 27, 'con la musica: musica da 3 a 25 s, voce da 9 s, chiusura a 25 s (' + JSON.stringify({ mStart: l.mStart, intro: l.intro, chiusura: l.fx[1].at, mEnd: l.mEnd, total: l.total }) + ')');
// un secondo file nel riquadro della musica: si chiede cosa farne
const ordine = await page.evaluate(() => { const a = document.getElementById('pSigla'), b = document.getElementById('pMusic'); return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); });
check(ordine, 'il riquadro «Sigla e chiusura» viene prima della Musica');
const opsPrima = (await L()).ops;
await page.setInputFiles('#fileMusic', P('chiusura-660.flac'));
await page.waitForFunction(() => document.querySelector('#musicAsk').open);
check(/musica-220\.flac.*chiusura-660\.flac/.test(await page.textContent('#maText')), 'seconda musica: compare la domanda con i due nomi');
await page.click('#musicAsk .ep-close button');
await page.waitForFunction(() => !document.querySelector('#musicAsk').open);
l = await L(); check(l.ops === opsPrima && (await page.evaluate(() => window.__studio.S.sources.get(window.__studio.S.musicId).name)) === 'musica-220.flac', '«Lascia tutto com’è»: non cambia nulla');
await page.setInputFiles('#fileMusic', P('chiusura-660.flac'));
await page.waitForFunction(() => document.querySelector('#musicAsk').open);
await page.click('#maEnd');
await page.waitForFunction(n => window.__studio.S.ops.length === n + 1, opsPrima);
l = await L();
check(l.fx.filter(e => e.anchor === 'end').length === 1 && (await page.evaluate(() => window.__studio.S.sources.get(window.__studio.S.musicId).name)) === 'musica-220.flac', '«Usalo come chiusura»: prende il posto della chiusura, la musica resta');
await page.evaluate(() => window.__studio.undo());

// cosa suona dove: ampiezza dei tre toni nel mix, in dB
const mix = await page.evaluate(() => {
  const st = window.__studio, SR = 48000;
  const g = (a, b, f) => {
    const n = Math.round((b - a) * SR), [x] = st.renderMix(Math.round(a * SR), n, 'orig'); let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const w = 2 * Math.PI * f * i / SR; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w); }
    return +(20 * Math.log10(2 * Math.hypot(re, im) / n + 1e-9)).toFixed(1);
  };
  return { sig440: g(0.5, 2.5, 440), sig220: g(0.5, 2.5, 220), mus220: g(4, 8, 220), end660: g(25.5, 26.5, 660), end220: g(25.5, 26.5, 220) };
});
console.log('Toni nel mix (dB):', JSON.stringify(mix));
check(mix.sig440 > -30 && mix.sig220 < -60, 'nella sigla suona solo la sigla, la musica non c\'è ancora');
check(mix.mus220 > -45, 'dopo la sigla parte la musica');
check(mix.end660 > -30 && mix.end220 < -60, 'nella chiusura suona solo la chiusura, la musica è già finita');

// cronologia svuotata: sigla e chiusura restano ancorate
await page.evaluate(() => window.__studio.collapseHistory());
await page.evaluate(() => window.__studio.replay());
l = await L(); check(l.fx.map(e => e.anchor).join() === 'start,end' && l.fx[1].at === 25, 'dopo «Svuota la cronologia» restano ancorate');
// togliere
await page.click('#btnEndRemove');
l = await L(); check(l.fx.length === 1 && l.total === 25, 'togli la chiusura: il mix finisce con la coda della musica');

const t = await page.evaluate(() => studioTest());
check(t.superati === t.totale, 'controlli interni dell\'app: ' + t.superati + ' su ' + t.totale);
check(!errori.length, 'nessun errore nella console' + (errori.length ? ': ' + errori.slice(0, 3).join(' | ') : ''));
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
