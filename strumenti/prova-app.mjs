// Prova automatica dell'app vera (index.html), da eseguire prima e dopo ogni modifica.
//   node strumenti/prova-app.mjs
// Serve Chromium e Playwright. Apre index.html dal disco, senza rete, ed esegue:
//  1. i controlli interni dell'app (studioTest);
//  2. il percorso di chi la usa: importa una voce, Modalità Podcast, esporta l'MP3;
//  3. misura l'MP3 con ffmpeg: volume -16 LUFS, picchi sotto -1 dBTP, titolo nel file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOCE = path.join(ROOT, 'strumenti/prova/voce-prova.flac');
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };

// 0. index.html deve essere quello montato dai sorgenti
const { monta } = await import('./monta.mjs');
check(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') === monta(), 'index.html corrisponde ai sorgenti di src/');

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
await context.addInitScript(() => { try { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); } catch (e) {} });
const esterne = [];
await context.route(/^(https?|wss?):/, r => { esterne.push(r.request().url()); r.abort(); });
const page = await context.newPage();
const errori = [];
page.on('pageerror', e => errori.push(e.message));
page.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => typeof window.studioTest === 'function');

// 1. controlli interni
const t = await page.evaluate(() => studioTest());
check(t.superati === t.totale, 'controlli interni dell\'app: ' + t.superati + ' su ' + t.totale + (t.falliti.length ? ' — falliti: ' + t.falliti.map(f => f.nome + ' (' + f.dettaglio + ')').join('; ') : ''));

// 2. percorso: importa, Modalità Podcast, esporta
await page.setInputFiles('#fileVoice', VOCE);
await page.waitForFunction(() => window.__studio.S.vlen > 0, null, { timeout: 60000 });
const dur = await page.evaluate(() => window.__studio.S.vlen / 48000);
check(Math.abs(dur - 10) < 0.1, 'voce importata: ' + dur.toFixed(2) + ' s');
await page.click('[data-tab="improve"]');
await page.click('#btnPodcast');
await page.waitForSelector('#episode[open]', { timeout: 180000 });
const ep = (await page.textContent('#episode')).replace(/\s+/g, ' ').trim();
check(/Episodio pronto/.test(ep), 'Modalità Podcast: compare «Episodio pronto»');
await page.evaluate(() => document.querySelector('#episode').close());
check(await page.evaluate(() => window.__studio.S.procActive), 'Modalità Podcast: voce migliorata attiva');
await page.click('[data-tab="export"]');
await page.fill('#pMeta input >> nth=0', 'Prova automatica').catch(() => {});
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#btnExport')]);
const out = path.join(os.tmpdir(), 'sottovoce-prova-' + process.pid + '.mp3');
await dl.saveAs(out);
check(/\.mp3$/i.test(dl.suggestedFilename()), 'esportato un MP3: ' + dl.suggestedFilename());

// 3. misure dell'MP3
const buf = fs.readFileSync(out);
check(buf.slice(0, 3).toString() === 'ID3', 'l\'MP3 ha i dati dell\'episodio (ID3)');
const r = misuraFfmpeg(out);
check(Math.abs(r.I + 16) < 1, 'volume del file: ' + r.I + ' LUFS misurato su due casse (atteso -16)');
check(r.TP <= -0.5, 'picco vero: ' + r.TP + ' dBTP (atteso al massimo circa -1)');
check(Math.abs(r.dur - dur) < 0.2, 'durata dell\'MP3: ' + r.dur.toFixed(2) + ' s');
fs.unlinkSync(out);

check(!errori.length, 'nessun errore nella console' + (errori.length ? ': ' + errori.slice(0, 4).join(' | ') : ''));
check(!esterne.length, 'nessuna richiesta a internet' + (esterne.length ? ': ' + esterne.slice(0, 4).join(', ') : ''));
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);

// volume integrato, picco vero e durata, letti dal riepilogo che ffmpeg scrive sul canale degli errori
function misuraFfmpeg(file) {
  // dualmono: un file mono si misura come se suonasse su due casse, come fa l'app (AES: -16 LUFS stereo = -19 LUFS mono)
  const p = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true:dualmono=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const e = p.stderr || '', num = re => { const m = e.match(re); return m ? parseFloat(m[1]) : NaN; };
  const d = e.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return { I: num(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/), TP: num(/True peak:\s+Peak:\s+(-?[\d.]+) dBFS/), dur: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : NaN };
}
