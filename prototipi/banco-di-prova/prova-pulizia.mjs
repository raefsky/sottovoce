// Banco di prova di prototipi/pulizia.html
// node prova-pulizia.mjs <repo> <cartella audio> [--vero <cartella del pacchetto @lofcz/deepfilternet-web>]
// Senza --vero usa il DeepFilterNet finto: controlla la pagina, RNNoise, allineamento, volume e ascolto alla cieca.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'node:path';
import { apri } from './servi.mjs';

const args = process.argv.slice(2);
const [repo, banco] = args;
const vi = args.indexOf('--vero'), vero = vi > 0 ? args[vi + 1] : null;
const dfDir = vero || path.join(repo, 'prototipi/banco-di-prova/finti');
const cdn = [[/^https:\/\/cdn\.jsdelivr\.net\/npm\/@lofcz\/deepfilternet-web@[^/]+\/dist\/(.*)$/,
  m => vero ? path.join(vero, 'dist', m[1]) : path.join(dfDir, m[1] === 'index.js' ? 'deepfilternet-finto.js' : m[1])]];
const ok = [], ko = [];
const check = (cond, msg) => (cond ? ok : ko).push(msg);

const browser = await chromium.launch();
const { page, log, reqs } = await apri(browser, 'prototipi/pulizia.html', { repo, banco, cdn });

// 1. allineamento e velocità, sulla voce pulita
const r = await page.evaluate(async () => {
  const blob = await (await fetch('/__banco/pulita.wav')).blob();
  const x = await SV.decodeFile(new File([blob], 'pulita.wav'));
  const lag = (a, b) => { // ritardo di b rispetto ad a, su 3 s dal secondo 5, entro ±1500 campioni
    const s0 = 5 * SV.SR, L = 3 * SV.SR; let best = 0, bv = -Infinity;
    for (let d = -1500; d <= 1500; d++) { let v = 0; for (let i = s0; i < s0 + L; i++) v += a[i] * b[i + d]; if (v > bv) { bv = v; best = d; } }
    return best;
  };
  let t = performance.now(); const rn = await SV.runRnnoise(x, () => {}); const tr = performance.now() - t;
  t = performance.now(); const df = await SV.runDfn(x, 100, () => {}); const td = performance.now() - t;
  return { dur: x.length / SV.SR, n: x.length, nrn: rn.length, ndf: df.length, lagRn: lag(x, rn), lagDf: lag(x, df), tr, td, lx: SV.lufs(x), lrn: SV.lufs(rn), ldf: SV.lufs(df) };
});
const dly = await page.evaluate(() => SV.lastDfDelay); check(dly === 960, 'ritardo misurato dalla pagina: ' + dly + ' campioni (il finto ne usa 960)');
console.log('Misure:', JSON.stringify({ ...r, rnnoise_x: +(r.dur / r.tr * 1000).toFixed(1), dfn_x: +(r.dur / r.td * 1000).toFixed(1) }));
check(r.nrn === r.n && r.ndf === r.n, 'le uscite hanno la stessa lunghezza dell\'ingresso');
check(r.lagRn === 0, 'RNNoise allineato all\'originale (ritardo residuo ' + r.lagRn + ' campioni)');
check(r.lagDf === 0, 'DeepFilterNet allineato all\'originale (ritardo residuo ' + r.lagDf + ' campioni)');
check(Math.abs(r.lx - (-20)) < 1, 'misura LUFS plausibile sulla voce di prova (' + r.lx.toFixed(2) + ', atteso circa -20)');

// 2. il percorso di chi usa la pagina
await page.setInputFiles('#files', [path.join(banco, 'rumore_ventola.wav'), path.join(banco, 'stanza_eco.wav')]);
await page.waitForFunction(() => SV.items.length === 2 && SV.items.every(i => i.ready || i.error), null, { timeout: 300000 });
const errs = await page.evaluate(() => SV.items.filter(i => i.error).map(i => i.error));
check(!errs.length, 'i due file sono stati elaborati' + (errs.length ? ': ' + errs.join('; ') : ''));
const lev = await page.evaluate(() => SV.items.map(i => [SV.lufs(i.orig), SV.lufs(i.rn), SV.lufs(i.df)]));
check(lev.every(a => a.every(v => Math.abs(v + 19) < 0.2)), 'le tre versioni sono allo stesso volume, -19 LUFS (' + lev.map(a => a.map(v => v.toFixed(2)).join('/')).join(', ') + ')');
check(await page.isVisible('#listenCard'), 'la scheda di ascolto si apre da sola');
await page.click('#play'); await page.waitForTimeout(700);
const t1 = await page.textContent('#time');
await page.click('.ab button[data-v="B"]'); await page.waitForTimeout(500);
const t2 = await page.textContent('#time');
check(t1 !== '0:00 / 0:55' || t2 !== '0:00 / 0:55', 'la riproduzione avanza (' + t1 + ' → ' + t2 + ')');
check(await page.getAttribute('.ab button[data-v="B"]', 'aria-pressed') === 'true', 'il passaggio ad B è segnato sul pulsante');
await page.click('#play');
await page.click('[data-pick="A"]');
check(await page.isVisible('#reveal'), 'dopo la scelta compare quale era quale');
await page.locator('#list button').nth(1).click();
await page.click('[data-pick="="]');
const score = await page.textContent('#score');
check(/DeepFilterNet \d, RNNoise \d, pari 1\./.test(score), 'il riepilogo conta le scelte (' + score + ')');
await page.setViewportSize({ width: 1100, height: 1500 });
await page.screenshot({ path: path.join(banco, 'pulizia.png'), fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
const wide = await page.evaluate(() => document.documentElement.scrollWidth);
check(wide <= 390, 'al telefono la pagina non scorre di lato (larghezza ' + wide + ')');
await page.screenshot({ path: path.join(banco, 'pulizia-telefono.png'), fullPage: true });

const bad = log.filter(l => /pageerror|\[error\]/.test(l));
check(!bad.length, 'nessun errore nella console' + (bad.length ? ': ' + bad.slice(0, 5).join(' | ') : ''));
const ext = reqs.filter(q => q.startsWith('BLOCCATO') || q.startsWith('404'));
check(!ext.length, 'nessuna richiesta inattesa' + (ext.length ? ': ' + ext.join(', ') : ''));
console.log('\nRIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
