// Prova del progetto collegato a un file (Chrome ed Edge) e del ripiego con lo scaricamento (altri browser).
//   node strumenti/prova-file.mjs
// Le finestre "Salva" e "Apri" del sistema non si possono usare senza interfaccia: la prova le sostituisce con un
// file vero nello spazio privato del browser (OPFS). Scrittura, rilettura, permessi e ripresa sono quelli veri.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOCE = path.join(ROOT, 'strumenti/prova/voce-prova.flac');
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };

// le API dei file vogliono un indirizzo sicuro: un piccolo server su localhost
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL0 = 'http://127.0.0.1:' + server.address().port + '/index.html';

const browser = await chromium.launch();
const errori = [];
async function nuovaPagina(context) {
  const page = await context.newPage();
  page.on('pageerror', e => errori.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
  page.on('dialog', d => { console.log('finestra del browser:', d.type(), d.message().slice(0, 120)); d.accept(); });
  page.on('crash', () => console.log('PAGINA ANDATA IN CRASH'));
  page.on('close', () => console.log('pagina chiusa'));
  page.on('console', m => { if (process.env.TUTTO) console.log('console:', m.type(), m.text().slice(0, 200)); });
  return page;
}
const S = page => page.evaluate(() => ({ ops: window.__studio.S.ops.length, flag: document.querySelector('#fileFlag').hidden ? '' : document.querySelector('#fileFlag').textContent, stato: document.querySelector('#fileFlag').dataset.state || '', lead: document.querySelector('#projLead').textContent, status: document.querySelector('#projStatus').textContent }));
// legge il file nell'OPFS e conta le modifiche salvate in progetto.json
const nelFile = page => page.evaluate(async () => {
  const d = await navigator.storage.getDirectory(); let h; try { h = await d.getFileHandle('prova.sottovoce'); } catch { return null; }
  const f = await h.getFile(); if (!f.size) return { size: 0 };
  const z = window.__studio.readZip(await f.arrayBuffer()), st = JSON.parse(new TextDecoder().decode(z['progetto.json']));
  return { size: f.size, ops: st.ops.length, originali: st.sources.length, wav: Object.keys(z).filter(n => n.endsWith('.wav')).length };
});
const attendi = async (page, fn, arg, ms) => {
  try { return await page.waitForFunction(fn, arg, { timeout: ms || 60000 }); }
  catch (e) { console.log('ATTESA SCADUTA:', String(fn), JSON.stringify(await S(page).catch(e => 'S fallita: ' + e.message.slice(0, 300))), errori); throw e; }
};
const pickers = () => {
  localStorage.setItem('sottovoce-studio.benvenuto.v1', '1');
  window.showSaveFilePicker = async o => { window.__sceltoSalva = (window.__sceltoSalva || 0) + 1; const d = await navigator.storage.getDirectory(); return d.getFileHandle('prova.sottovoce', { create: true }); };
  window.showOpenFilePicker = async () => { const d = await navigator.storage.getDirectory(); return [await d.getFileHandle('prova.sottovoce')]; };
};

// ---------- Chrome ed Edge: file collegato ----------
const ctx = await browser.newContext({ acceptDownloads: true });
await ctx.addInitScript(pickers);
let page = await nuovaPagina(ctx);
await page.goto(URL0);
await attendi(page, () => typeof window.studioTest === 'function');
let s = await S(page);
check(/scegli un file sul computer/.test(s.lead), 'scheda Progetto: spiega che si può collegare un file');
await page.setInputFiles('#fileVoice', VOCE);
await attendi(page, () => window.__studio.S.vlen > 0);
await page.click('#stepper [data-go="project"]');
await page.click('#btnSaveProj');
await attendi(page, () => /si salvano da sole/.test(document.querySelector('#projStatus').textContent));
let f = await nelFile(page); s = await S(page);
check(f && f.ops === 1 && f.wav === 1, 'primo salvataggio: file scritto con 1 modifica e l\'originale (' + JSON.stringify(f) + ')');
check(/^salvato in “prova\.sottovoce”/.test(s.flag), 'indicatore in alto: «' + s.flag + '»');
check(/collegato al file “prova\.sottovoce”/.test(s.lead), 'scheda Progetto: dice a quale file è collegato');
check(await page.isVisible('#btnSaveAs'), 'compare «Salva con un altro nome»');

// una modifica si salva da sola
await page.evaluate(() => window.__studio.pushOp({ type: 'silence', a: 48000, b: 96000, label: 'Silenzio di prova' }));
await attendi(page, () => window.__studio.S.ops.length === 2);
await attendi(page, () => ['pending', 'saving'].includes(document.querySelector('#fileFlag').dataset.state), null, 5000).catch(() => {});
s = await S(page);
check(/modifiche da salvare|salvataggio/.test(s.flag), 'dopo una modifica l\'indicatore lo segnala: «' + s.flag + '»');
const t0 = Date.now();
await attendi(page, () => document.querySelector('#fileFlag').dataset.state === 'saved', null, 40000);
f = await nelFile(page);
check(f && f.ops === 2, 'salvataggio automatico dopo ' + Math.round((Date.now() - t0) / 1000) + ' s: nel file ci sono 2 modifiche');
check(await page.evaluate(() => window.__sceltoSalva) === 1, 'la finestra «Salva» si è aperta una volta sola');

// ricarica: si riprende il lavoro e il file si ricollega con un clic sull'indicatore.
// Il clic qui non si prova: nel Chromium delle prove rileggere dal database un collegamento a un file OPFS fa crollare
// il browser (difetto del browser, verificato con una pagina minima). Si controlla che l'avvio non lo rilegga da solo.
await page.reload();
await attendi(page, () => document.querySelector('#restoreDlg').open);
await page.click('#restoreYes');
await attendi(page, () => window.__studio.S.ops.length === 2 && !document.querySelector('#fileFlag').hidden);
await page.waitForTimeout(1500);
s = await S(page);
check(/riprendi il salvataggio in “prova\.sottovoce”/.test(s.flag) && s.stato === 'perm', 'dopo la ricarica: lavoro ripreso, il file si ricollega con un clic: «' + s.flag + '»');
check(/era collegato al file “prova\.sottovoce”/.test(s.lead), 'scheda Progetto: spiega come ricollegare il file');
check(await page.evaluate(() => !document.querySelector('#dirtyFlag').hidden) === false, 'non compaiono due indicatori insieme');

// nuovo progetto: il file si scollega; apri: si ricollega
await page.click('#stepper [data-go="project"]');
await page.click('#btnNewProj');
await attendi(page, () => window.__studio.S.ops.length === 0 && /Nuovo progetto pronto/.test(document.querySelector('#projStatus').textContent));
s = await S(page);
check(!s.flag && /scegli un file sul computer/.test(s.lead), 'nuovo progetto: nessun file collegato' + (s.flag || !/scegli/.test(s.lead) ? ' — indicatore «' + s.flag + '», scheda «' + s.lead + '»' : ''));
f = await nelFile(page);
check(f && f.ops === 2, 'nuovo progetto: il file salvato resta com\'era');
await page.click('#stepper [data-go="project"]');
await page.click('#btnOpenProj');
await attendi(page, () => window.__studio.S.ops.length === 2 && !document.querySelector('#fileFlag').hidden);
s = await S(page);
check(/collegato al file “prova\.sottovoce”/.test(s.lead), '«Apri un progetto» riapre il file e lo ricollega');
await page.evaluate(() => window.__studio.pushOp({ type: 'silence', a: 144000, b: 192000, label: 'Silenzio di prova' }));
await attendi(page, () => document.querySelector('#fileFlag').dataset.state === 'pending', null, 5000).catch(() => {});
await attendi(page, () => document.querySelector('#fileFlag').dataset.state === 'saved', null, 40000);
f = await nelFile(page);
check(f && f.ops === 3, 'dopo «Apri» il salvataggio automatico continua: 3 modifiche nel file');
await ctx.close();

// ---------- altri browser: scaricamento ----------
const ctx2 = await browser.newContext({ acceptDownloads: true });
await ctx2.addInitScript(() => { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); delete window.showSaveFilePicker; delete window.showOpenFilePicker; window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
page = await nuovaPagina(ctx2);
await page.goto(URL0);
await attendi(page, () => typeof window.studioTest === 'function');
s = await S(page);
check(/cartella dei download/.test(s.lead), 'senza le API dei file: la scheda Progetto parla dello scaricamento');
await page.setInputFiles('#fileVoice', VOCE);
await attendi(page, () => window.__studio.S.vlen > 0);
await page.click('#stepper [data-go="project"]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnSaveProj')]);
check(/\.sottovoce$/.test(dl.suggestedFilename()), 'senza le API dei file: «Salva il progetto» scarica ' + dl.suggestedFilename());
check(!(await page.isVisible('#btnSaveAs')) && (await S(page)).flag === '', 'senza le API dei file: niente «Salva con un altro nome» né indicatore del file');
await ctx2.close();

check(!errori.length, 'nessun errore nella console' + (errori.length ? ': ' + errori.slice(0, 4).join(' | ') : ''));
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close(); server.close();
process.exit(ko.length ? 1 : 0);
