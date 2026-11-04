// Banco di prova di prototipi/trascrizione.html, con la libreria di trascrizione finta.
// node prova-trascrizione.mjs <repo> <cartella audio con pulita.wav e testo.txt>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { apri } from './servi.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [repo, banco] = process.argv.slice(2);
const testo = fs.readFileSync(path.join(banco, 'testo.txt'), 'utf8').trim();
const finto = path.join(repo, 'prototipi/banco-di-prova/finti/transformers-finto.js');
const cdn = [[/^https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@[^/]+(\/.*)?$/, () => finto]];
const ok = [], ko = [];
const check = (c, m) => (c ? ok : ko).push(m);
const browser = await chromium.launch();

async function prova(modello, nome) {
  const { context, page, log, reqs } = await apri(browser, 'prototipi/trascrizione.html', { repo, banco, cdn });
  await page.evaluate(t => { window.__TESTO_FINTO = t; }, testo);
  await page.selectOption('#model', modello);
  await page.setInputFiles('#file', path.join(banco, 'pulita.wav'));
  await page.fill('#ref', testo);
  await page.click('#go');
  await page.waitForSelector('#out:not([hidden])', { timeout: 120000 });
  const r = await page.evaluate(() => ({ run: SV.run, n: SV.words.length, srt: SV.srt(), first: SV.words[0], status: document.querySelector('#status').textContent }));
  const nRef = testo.split(/\s+/).length;
  check(r.n === nRef + 2, nome + ': tutte le parole trascritte, nessuna persa o doppia ai tagli (' + r.n + ' su ' + (nRef + 2) + ')');
  check(r.run.wer && r.run.wer.errors === 2, nome + ': parole sbagliate calcolate bene (' + (r.run.wer && r.run.wer.errors) + ', attese 2: i due "ehm" aggiunti)');
  check(r.run.fillers === 2, nome + ': riempitivi trovati ' + r.run.fillers + ' su 2');
  check(r.srt.includes('-->') && !/ehm/i.test(r.srt), nome + ': sottotitoli SRT validi e senza riempitivi');
  check(r.run.bytes === 4e7, nome + ': peso del modello letto dallo scaricamento (' + r.run.bytes + ' byte)');
  const bad = log.filter(l => /pageerror|\[error\]/.test(l));
  check(!bad.length, nome + ': nessun errore nella console' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
  check(!reqs.some(q => /^(BLOCCATO|404)/.test(q)), nome + ': nessuna richiesta inattesa' + reqs.filter(q => /^(BLOCCATO|404)/.test(q)).join(', '));
  return { page, context, r };
}

// 1. modello base: tempi per parola
const a = await prova('Xenova/whisper-base', 'base');
check(a.r.run.wordLevel === true, 'base: tempi per parola');
const cut = await a.page.evaluate(async () => {
  const blob = await (await fetch('/__banco/pulita.wav')).blob();
  const ac = new AudioContext(); const ab = await ac.decodeAudioData(await blob.arrayBuffer());
  const off = new OfflineAudioContext(1, Math.ceil(ab.duration * 16000), 16000); const s = off.createBufferSource(); s.buffer = ab; s.connect(off.destination); s.start();
  const x = (await off.startRendering()).getChannelData(0);
  const b = SV.chunkBounds(x); const rms = (i, w) => { let v = 0; for (let k = i - w; k < i + w; k++) v += x[k] * x[k]; return Math.sqrt(v / (2 * w)); };
  let all = 0; for (let k = 0; k < x.length; k++) all += x[k] * x[k];
  return { n: b.length, cuts: b.slice(0, -1).map(c => +(c[1] / 16000).toFixed(2)), cutRms: b.slice(0, -1).map(c => rms(c[1], 800)), rmsAll: Math.sqrt(all / x.length), contiguous: b.every((c, i) => i === 0 || c[0] === b[i - 1][1]), end: b[b.length - 1][1] === x.length };
});
check(cut.n >= 2 && cut.contiguous && cut.end, 'audio diviso in pezzi contigui che coprono tutto (' + cut.n + ' pezzi, tagli a ' + cut.cuts.join(', ') + ' s)');
check(cut.cutRms.every(v => v < cut.rmsAll * 0.2), 'i tagli cadono nelle pause (livello al taglio ' + cut.cutRms.map(v => (20 * Math.log10(v / cut.rmsAll)).toFixed(0) + ' dB').join(', ') + ' rispetto alla media)');
const w20 = await a.page.evaluate(() => SV.words[20]);
await a.page.locator('#text button').nth(20).click();
await a.page.waitForTimeout(400);
const ct = await a.page.evaluate(() => document.querySelector('#player').currentTime);
check(Math.abs(ct - w20.a) < 0.6, 'cliccando una parola l\'ascolto parte da lì (' + ct.toFixed(2) + ' s, parola a ' + w20.a.toFixed(2) + ' s)');
const lit = await a.page.evaluate(() => document.querySelectorAll('#text button.on').length);
check(lit === 1, 'durante l\'ascolto una parola è evidenziata');
await a.page.evaluate(() => document.querySelector('#player').pause());
check(await a.page.locator('#text button.filler').count() === 2, 'i due riempitivi sono evidenziati nel testo');
await a.page.setViewportSize({ width: 1100, height: 1400 });
await a.page.screenshot({ path: path.join(banco, 'trascrizione.png'), fullPage: true });
await a.page.setViewportSize({ width: 390, height: 844 });
const wide = await a.page.evaluate(() => document.documentElement.scrollWidth);
check(wide <= 390, 'al telefono la pagina non scorre di lato (larghezza ' + wide + ')');
await a.page.screenshot({ path: path.join(banco, 'trascrizione-telefono.png'), fullPage: true });
await a.context.close();

// 2. modello large: niente tempi per parola, la pagina ripiega sui tempi per frase
const b = await prova('onnx-community/whisper-large-v3-turbo', 'large');
check(b.r.run.wordLevel === false, 'large: ripiego sui tempi per frase quando mancano quelli per parola');
check(await b.page.locator('#text button.low').count() > 0, 'large: le parole con tempi stimati sono segnate');
await b.context.close();

// 3. modello small: manca la versione q8, la pagina prova la successiva
const c = await prova('Xenova/whisper-small', 'small');
check(/processore/.test(c.r.run.device), 'small: caricato con la combinazione successiva (' + c.r.run.device + ')');
await c.context.close();

console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
