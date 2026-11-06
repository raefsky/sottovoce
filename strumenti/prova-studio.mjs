// Prova della modalità Studio, con il microfono finto di Chromium.
//   node strumenti/prova-studio.mjs
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] });
await ctx.addInitScript(() => { try { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); } catch (e) {} });
await ctx.route(/^(https?|wss?):/, r => r.abort());
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push(e.message)); page.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => typeof window.studioTest === 'function');
const st = () => page.evaluate(() => { const s = window.__studio.S, d = document.querySelector('#studio'); return {
  aperto: d.open, registra: s.recording, prova: s.monitoring, voce: +(s.vlen / 48000).toFixed(1), titolo: document.querySelector('#stTitle').textContent,
  tempo: document.querySelector('#stTime').textContent, livello: parseFloat(document.querySelector('#stLevel').style.width) || 0, frase: document.querySelector('#stHint').textContent,
  pulsante: document.querySelector('#stRecL').textContent, dove: document.querySelector('#stWhere').textContent }; });

check(await page.isVisible('#emptyStudio') && await page.isVisible('#btnStudio'), 'lo studio si apre dall\'alto e dalla schermata iniziale');
await page.click('#btnStudio');
await page.waitForFunction(() => window.__studio.S.monitoring, null, { timeout: 10000 });
await page.waitForTimeout(1200);
let s = await st();
check(s.aperto && s.prova && s.titolo === 'Pronto a registrare', 'entrando: schermata a tutto schermo, microfono aperto per provare il livello (' + s.titolo + ')');
check(s.livello > 5 && s.frase.length > 10, 'il livello si vede già prima di registrare (' + s.livello.toFixed(0) + '%, «' + s.frase + '»)');
check(/va in fondo alla voce/.test(s.dove), 'dice dove andrà la registrazione: «' + s.dove + '»');
check(await page.evaluate(() => document.activeElement.id) === 'stRec', 'il pulsante rosso ha il focus');

// R: registra
await page.keyboard.press('r');
await page.waitForFunction(() => window.__studio.S.recording, null, { timeout: 10000 });
await page.waitForTimeout(2200);
s = await st();
check(s.registra && s.titolo === 'Sto registrando' && s.pulsante === 'Ferma' && /^0:0[12],\d$/.test(s.tempo), 'R: registra; titolo, pulsante e tempo cambiano (' + s.tempo + ')');
const rossi = await page.evaluate(() => { const cv = document.querySelector('#stWave'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) n++; return n; });
check(rossi > 300, 'la forma d\'onda della registrazione si vede (' + rossi + ' pixel)');
await page.screenshot({ path: path.join(os.tmpdir(), 'sottovoce-studio.png') });
// Esc durante la registrazione: non esce
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
s = await st();
check(s.aperto && s.registra && /Prima ferma la registrazione/.test(s.frase), 'Esc durante la registrazione non esce e lo spiega');
// barra spaziatrice: ferma
await page.keyboard.press('Space');
await page.waitForFunction(() => !window.__studio.S.recording && window.__studio.S.vlen > 0, null, { timeout: 10000 });
await page.waitForFunction(() => window.__studio.S.monitoring, null, { timeout: 10000 });
s = await st();
const v1 = s.voce;
check(v1 >= 2 && s.titolo === 'Pronto per la prossima registrazione' && s.prova && s.pulsante === 'Registra', 'barra spaziatrice: ferma, la registrazione è nella voce (' + v1 + ' s), il livello torna visibile');
// con il mouse: una seconda registrazione, in fondo
await page.click('#stRec'); await page.waitForFunction(() => window.__studio.S.recording, null, { timeout: 10000 });
await page.waitForTimeout(1500);
await page.click('#stRec'); await page.waitForFunction(() => !window.__studio.S.recording, null, { timeout: 10000 });
await page.waitForTimeout(300);
s = await st();
check(s.voce > v1 + 1, 'con il pulsante: seconda registrazione aggiunta in fondo (' + v1 + ' → ' + s.voce + ' s)');
// Esc: esce e chiude il microfono
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
s = await st();
check(!s.aperto && !s.prova, 'Esc: esce dallo studio e chiude il microfono');
check(await page.evaluate(() => window.__studio.S.ops.length) === 2, 'nella cronologia due registrazioni');

check(!errori.length, 'nessun errore nella console' + (errori.length ? ': ' + errori.slice(0, 3).join(' | ') : ''));
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
