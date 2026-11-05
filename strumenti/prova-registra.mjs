// Prova della registrazione: la forma d'onda si vede mentre si registra, anche la prima volta.
//   node strumenti/prova-registra.mjs
// Usa il microfono finto di Chromium (un segnale acustico a impulsi).
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
await ctx.addInitScript(() => { try { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); } catch (e) {} });
await ctx.route(/^(https?|wss?):/, r => r.abort());
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push(e.message)); page.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => typeof window.studioTest === 'function');

// pixel del colore della registrazione (--rec) sulla tela in primo piano, e stato della vista
const stato = () => page.evaluate(() => {
  const st = window.__studio, cv = document.querySelector('#cvTop'), g = cv.getContext('2d');
  const t = document.createElement('canvas').getContext('2d'); t.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--rec').trim(); t.fillRect(0, 0, 1, 1);
  const [r, gg, b] = t.getImageData(0, 0, 1, 1).data, d = g.getImageData(0, 0, cv.width, cv.height).data; let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100 && Math.abs(d[i] - r) < 40 && Math.abs(d[i + 1] - gg) < 40 && Math.abs(d[i + 2] - b) < 40) n++;
  return { rossi: n, visibile: !!cv.offsetParent && cv.getBoundingClientRect().height > 50, vuoto: document.querySelector('#app').classList.contains('is-empty'),
    vista: st.S.view.map(v => +(v / 48000).toFixed(1)), voce: +(st.S.vlen / 48000).toFixed(1), reg: +(st.REC.len / 48000).toFixed(1), fit: st.S.fit };
});
const registra = async ms => { await page.click('#btnRec'); await page.waitForTimeout(ms); const s = await stato(); await page.click('#btnRec'); await page.waitForFunction(() => !window.__studio.S.recording); await page.waitForTimeout(400); return s; };

// 1. prima registrazione, progetto vuoto
check(await page.evaluate(() => document.querySelector('#app').classList.contains('is-empty')), 'all\'inizio si vede «Comincia dalla voce»');
let s = await registra(2500);
check(!s.vuoto && s.visibile, 'prima registrazione: la linea del tempo compare subito (' + JSON.stringify({ vuoto: s.vuoto, visibile: s.visibile }) + ')');
check(s.rossi > 500, 'prima registrazione: la forma d\'onda rossa si vede mentre si registra (' + s.rossi + ' pixel)');
check(s.vista[0] === 0 && s.vista[1] >= s.reg, 'prima registrazione: la vista comprende tutta la registrazione (' + s.vista.join('–') + ' s, registrati ' + s.reg + ' s)');
let v = await page.evaluate(() => window.__studio.S.vlen / 48000);
check(v > 2, 'dopo lo stop la registrazione è nella voce (' + v.toFixed(1) + ' s)');

// 2. seconda registrazione, in fondo: si vede anche quella di prima
s = await registra(2500);
check(s.rossi > 500 && s.fit && s.vista[0] === 0 && s.vista[1] >= s.voce + s.reg, 'seconda registrazione: si vede in rosso insieme alla voce di prima (' + s.vista.join('–') + ' s, voce ' + s.voce + ' s + ' + s.reg + ' s)');

// 3. vista ingrandita: segue la fine della registrazione
await page.evaluate(() => { const st = window.__studio; st.S.fit = false; st.S.view = [0, 48000 * 1.5]; });
s = await registra(3000);
check(!s.fit && s.vista[1] >= s.voce + s.reg - 0.2 && s.vista[1] - s.vista[0] < 2, 'vista ingrandita: scorre per seguire la registrazione (' + s.vista.join('–') + ' s)');
check(s.rossi > 200, 'vista ingrandita: la forma d\'onda rossa si vede (' + s.rossi + ' pixel)');

check(!errori.length, 'nessun errore nella console' + (errori.length ? ': ' + errori.slice(0, 3).join(' | ') : ''));
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
