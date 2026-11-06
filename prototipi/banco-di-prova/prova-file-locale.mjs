// Controlla che i prototipi funzionino anche aperti con un doppio clic (indirizzo file://), con i motori finti.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [repo, banco] = process.argv.slice(2);
const finti = path.join(repo, 'prototipi/banco-di-prova/finti');
const browser = await chromium.launch();
const esiti = [];
for (const [pagina, re, finto] of [
  ['pulizia.html', /deepfilternet-web@[^/]+\/dist\/index\.js$/, 'deepfilternet-finto.js'],
  ['trascrizione.html', /@huggingface\/transformers@[^/]+$/, 'transformers-finto.js']]) {
  const ctx = await browser.newContext(), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await ctx.route(/^https:/, r => re.test(r.request().url())
    ? r.fulfill({ status: 200, body: fs.readFileSync(path.join(finti, finto)), headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' } })
    : r.fulfill({ status: 404 }));
  await page.goto('file://' + path.join(repo, 'prototipi', pagina));
  if (pagina === 'pulizia.html') {
    await page.setInputFiles('#files', path.join(banco, 'rumore_ventola.wav'));
    await page.waitForFunction(() => SV.items[0] && (SV.items[0].ready || SV.items[0].error), null, { timeout: 120000 });
    const e = await page.evaluate(() => SV.items[0].error || 'pronto');
    esiti.push(pagina + ': ' + e);
  } else {
    await page.evaluate(t => { window.__TESTO_FINTO = t; }, fs.readFileSync(path.join(banco, 'testo.txt'), 'utf8'));
    await page.setInputFiles('#file', path.join(banco, 'pulita.wav'));
    await page.click('#go');
    await page.waitForSelector('#out:not([hidden]), #status.err', { timeout: 120000 });
    esiti.push(pagina + ': ' + (await page.textContent('#status')) + ' parole ' + await page.evaluate(() => SV.words.length));
  }
  esiti.push('  errori: ' + (errs.length ? errs.join(' | ') : 'nessuno'));
  await ctx.close();
}
console.log(esiti.join('\n'));
await browser.close();
