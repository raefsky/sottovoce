// Prova degli stili come schede e di "Ascolta 10 s".
//   node strumenti/prova-stili.mjs
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); } catch (e) {} });
await ctx.route(/^(https?|wss?):/, r => r.abort());
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push(e.message)); page.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => typeof window.studioTest === 'function');
await page.setInputFiles('#fileVoice', path.join(ROOT, 'strumenti/prova/voce-prova.flac'));
await page.waitForFunction(() => window.__studio.S.vlen > 0);
await page.click('#stepper [data-go="improve"]');
if (await page.evaluate(() => document.querySelector('#advGroup').classList.contains('collapsed'))) await page.click('#advToggle');
await page.waitForTimeout(300);

// schede
const sc = await page.evaluate(() => ({
  voce: [...document.querySelectorAll('#voiceStyles .style-card')].map(c => ({ nome: c.querySelector('b').textContent, desc: c.querySelector('.style span').offsetHeight > 0, pv: !!c.querySelector('.style-pv') && !c.querySelector('.style-pv').disabled })),
  musica: [...document.querySelectorAll('#musicStyles .style-card')].map(c => ({ nome: c.querySelector('b').textContent, desc: c.querySelector('.style span').offsetHeight > 0, pv: !!c.querySelector('.style-pv') })),
  reazione: document.querySelectorAll('#duckReact .style-card').length }));
check(sc.voce.length === 5 && sc.voce.every(c => c.desc && c.pv), 'stili della voce: 5 schede con descrizione visibile e «Ascolta 10 s» attivo (' + sc.voce.map(c => c.nome).join(', ') + ')');
await page.click('#stepper [data-go="tracks"]');
const mus = await page.evaluate(() => [...document.querySelectorAll('#musicStyles .style-card')].map(c => ({ desc: c.querySelector('.style span').offsetHeight > 0, pv: !!c.querySelector('.style-pv') })));
check(mus.length === 3 && mus.every(c => c.desc && !c.pv), 'livelli della musica: 3 schede con descrizione, senza anteprima');
await page.click('#stepper [data-go="improve"]');
check(sc.reazione === 0, 'la reazione della musica resta una fila compatta');

// anteprima: nessuna regolazione cambia, lo stile non si applica
const prima = await page.evaluate(() => JSON.stringify(window.__studio.P));
const salvatePrima = await page.evaluate(() => localStorage.getItem('sottovoce-studio.impostazioni.v1'));
await page.click('#voiceStyles .style-pv[data-style="calda"]');
await page.waitForFunction(() => window.__studio.STYLE_PV.id === 'calda', null, { timeout: 60000 });
const a = await page.evaluate(() => { const st = window.__studio, y = [...st.STYLE_PV.cache.values()].pop(); return { n: y.length / 48000, lufs: st.lufs(y, true), target: st.P.target, testo: document.querySelector('#voiceStyles .style-pv[data-style="calda"]').textContent, stato: document.querySelector('#styleStatus').textContent, scelta: document.querySelector('#voiceStyles .style-card.on b') ? document.querySelector('#voiceStyles .style-card.on b').textContent : '' }; });
check(Math.abs(a.n - 10) < 0.01, 'l\'anteprima dura 10 s (' + a.n.toFixed(2) + ' s)');
check(Math.abs(a.lufs - a.target) < 0.6, 'l\'anteprima suona al volume dell\'obiettivo (' + a.lufs.toFixed(1) + ' LUFS, obiettivo ' + a.target + ')');
check(a.testo === 'Ferma' && /Ascolti “Voce calda”/.test(a.stato), 'mentre suona il pulsante dice «Ferma» e sotto si spiega cosa si ascolta');
check(await page.evaluate(() => JSON.stringify(window.__studio.P)) === prima, 'dopo l\'anteprima tutte le regolazioni sono come prima');
check(a.scelta !== 'Voce calda', 'l\'anteprima non applica lo stile (scheda accesa: «' + a.scelta + '»)');
await page.waitForTimeout(900);
check(await page.evaluate(() => localStorage.getItem('sottovoce-studio.impostazioni.v1')) === salvatePrima, 'il salvataggio automatico non ha registrato regolazioni provvisorie');
await page.click('#voiceStyles .style-pv[data-style="calda"]');
check(await page.evaluate(() => window.__studio.STYLE_PV.id === null), '«Ferma» ferma l\'anteprima');

// due stili suonano diversi
await page.click('#voiceStyles .style-pv[data-style="radio"]');
await page.waitForFunction(() => window.__studio.STYLE_PV.id === 'radio', null, { timeout: 60000 });
const diff = await page.evaluate(() => { const v = [...window.__studio.STYLE_PV.cache.values()], x = v[v.length - 2], y = v[v.length - 1]; let d = 0, e = 0; for (let i = 0; i < x.length; i++) { d += (x[i] - y[i]) ** 2; e += x[i] ** 2; } return 10 * Math.log10(d / e); });
check(diff > -30, '«Voce calda» e «Radiofonica» suonano diversi (differenza ' + diff.toFixed(1) + ' dB rispetto al segnale)');
await page.click('#voiceStyles .style-pv[data-style="radio"]');
// una seconda volta l'anteprima è pronta subito
const t0 = Date.now(); await page.click('#voiceStyles .style-pv[data-style="calda"]');
await page.waitForFunction(() => window.__studio.STYLE_PV.id === 'calda'); const dt = Date.now() - t0;
check(dt < 500, 'riascoltare uno stile è immediato (' + dt + ' ms)');
// Riproduci ferma l'anteprima
await page.click('#btnPlay'); await page.waitForTimeout(200);
check(await page.evaluate(() => window.__studio.STYLE_PV.id === null), '«Riproduci» ferma l\'anteprima');
await page.click('#btnPlay');

// cliccare la scheda sceglie lo stile
await page.click('#voiceStyles .style[data-style="calda"]');
const sc2 = await page.evaluate(() => ({ on: document.querySelector('#voiceStyles .style-card.on b').textContent, low: window.__studio.P.lowShelf }));
check(sc2.on === 'Voce calda' && sc2.low === 2, 'cliccando la scheda lo stile si sceglie e la scheda si accende (' + JSON.stringify(sc2) + ')');
await page.locator('#voiceStyles').screenshot({ path: path.join(os.tmpdir(), 'sottovoce-stili.png') });

const t = await page.evaluate(() => studioTest());
check(t.superati === t.totale, 'controlli interni dell\'app: ' + t.superati + ' su ' + t.totale);
check(!errori.length, 'nessun errore nella console' + (errori.length ? ': ' + errori.slice(0, 3).join(' | ') : ''));
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
