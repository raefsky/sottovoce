// Banco di prova della ricerca degli "ehm" e delle ripetizioni in prototipi/trascrizione.html.
// node prova-ehm.mjs <repo> <cartella con ehm_prova.wav, parole_ehm.json, verita_ehm.json>
// Whisper è finto (dà i tempi veri delle parole, senza gli ehm); RNNoise è quello vero dell'app.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { apri } from './servi.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [repo, dir] = process.argv.slice(2);
const parole = JSON.parse(fs.readFileSync(path.join(dir, 'parole_ehm.json'), 'utf8'));
const verita = JSON.parse(fs.readFileSync(path.join(dir, 'verita_ehm.json'), 'utf8'));
const finto = path.join(repo, 'prototipi/banco-di-prova/finti/transformers-finto.js');
const cdn = [[/^https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@[^/]+(\/.*)?$/, () => finto]];
const ok = [], ko = [];
const check = (c, m) => (c ? ok : ko).push(m);
const browser = await chromium.launch();
const { page, log } = await apri(browser, 'prototipi/trascrizione.html', { repo, banco: dir, cdn });
await page.evaluate(p => { window.__PAROLE_FINTE = p; }, parole);
await page.setInputFiles('#file', path.join(dir, 'ehm_prova.wav'));
await page.click('#go');
await page.waitForSelector('#ehmCard:not([hidden])', { timeout: 120000 });
const r = await page.evaluate(() => ({ cands: SV.cands.map(c => ({ a: c.a, b: c.b, conf: c.conf })), reps: SV.reps.map(g => g.text), run: SV.run }));
const ov = (x, y) => Math.min(x.b, y.b) - Math.max(x.a, y.a) > 0.05;
const t = x => x.a.toFixed(2) + '–' + x.b.toFixed(2);
console.log('Trovati:', r.cands.map(c => t(c) + ' (voce ' + c.conf.toFixed(2) + ')').join(', '));
for (const v of verita) {
  const hit = r.cands.filter(c => ov(c, v));
  if (v.tipo === 'ehm') check(hit.length >= 1, 'ehm a ' + t(v) + ' trovato' + (hit.length ? ' (' + hit.map(t).join(', ') + ')' : ''));
  if (v.tipo === 'pausa') check(hit.length === 0, 'la pausa muta a ' + t(v) + ' non è segnalata');
  if (v.tipo === 'respiro') console.log('Respiro a ' + t(v) + ': ' + (hit.length ? 'segnalato come possibile ehm (da scartare a orecchio)' : 'non segnalato'));
}
const falsi = r.cands.filter(c => !verita.some(v => v.tipo !== 'pausa' && ov(c, v)));
check(falsi.length === 0, 'nessun falso allarme sulle parole (' + falsi.map(t).join(', ') + ')');
check(r.reps.some(x => /da non confondere a/.test(x)), 'trovata la ripartenza «da non confondere a, da non confondere»');
check(r.reps.some(x => /^del del/.test(x)), 'trovata la ripetizione «del del»');
check(r.reps.length === 2, 'nessuna altra ripetizione segnalata (' + r.reps.length + ': ' + r.reps.join(' | ') + ')');
// i riempitivi scritti da Whisper non devono diventare ripetizioni (come «um, um, um» nella prova su ehm.wav)
const rf = await page.evaluate(() => SV.findReps(['um,', 'um,', 'um.', 'Siamo', 'pronti,', 'um,', 'um,', 'Ciao', 'a', 'tutti'].map((w, i) => ({ text: ' ' + w, a: i, b: i + 0.5 }))).map(g => g.text));
check(rf.length === 0, 'i riempitivi ripetuti non sono contati come ripetizioni (' + rf.join(' | ') + ')');
const rr = await page.evaluate(() => SV.findReps('il pdp, no il pdp, volevo dire il pei dal punto di vista umano punto di vista umano'.split(' ').map((w, i) => ({ text: ' ' + w, a: i, b: i + 0.5 }))).map(g => g.text));
check(rr.length === 2, 'le ripartenze della prova su ehm.wav restano trovate (' + rr.join(' | ') + ')');
// segnare a mano e copiare i risultati
await page.locator('#cands .cand').first().locator('button', { hasText: 'Era un ehm' }).click();
await page.fill('#heard', '4');
const n = await page.locator('#text button.ehm').count();
check(n === r.cands.length, 'i possibili ehm compaiono nel testo (' + n + ')');
await page.locator('#text button.ehm').first().click(); await page.waitForTimeout(300);
const ct = await page.evaluate(() => document.querySelector('#player').currentTime);
check(Math.abs(ct - (r.cands[0].a - 0.6)) < 0.5, 'cliccando un ehm? si ascolta quel punto (' + ct.toFixed(2) + ' s)');
await page.evaluate(() => document.querySelector('#player').pause());
// sull'indirizzo di prova (http) il browser non offre gli appunti: si intercetta il testo copiato
await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__copiato = t; } }, configurable: true }); });
await page.click('#copy'); await page.waitForTimeout(200);
const clip = await page.evaluate(() => window.__copiato || '');
check(/Controllati: 1 veri/.test(clip) && /Ehm sentiti in tutto: 4/.test(clip) && /Ripetizioni: 2/.test(clip), 'il riepilogo copiato contiene ehm controllati, ehm sentiti e ripetizioni');
console.log('\n' + clip.split('\n').slice(0, 12).join('\n') + '\n');
await page.setViewportSize({ width: 1100, height: 1600 });
await page.screenshot({ path: path.join(dir, 'ehm.png'), fullPage: true });
const bad = log.filter(l => /pageerror|\[error\]/.test(l));
check(!bad.length, 'nessun errore nella console' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
