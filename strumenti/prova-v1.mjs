// Prova di compatibilità: un progetto salvato con la versione 1 (tag v1.0.0) si apre nella versione attuale.
//   node strumenti/prova-v1.mjs <index.html della v1>
// Per avere la v1:  git show v1.0.0:index.html > /percorso/v1.html
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V1 = path.resolve(process.argv[2] || '');
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };
const browser = await chromium.launch();
const apri = async file => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); } catch (e) {} delete window.showSaveFilePicker; delete window.showOpenFilePicker; });
  await ctx.route(/^(https?|wss?):/, r => r.abort());
  const page = await ctx.newPage(); const errori = [];
  page.on('pageerror', e => errori.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('file://' + file); await page.waitForFunction(() => typeof window.studioTest === 'function');
  return { ctx, page, errori };
};
// 1. con la v1: voce, un taglio, Modalità Podcast, musica, titolo; poi "Salva il progetto"
const a = await apri(V1);
await a.page.setInputFiles('#fileVoice', path.join(ROOT, 'strumenti/prova/voce-prova.flac'));
await a.page.waitForFunction(() => window.__studio.S.vlen > 0);
await a.page.evaluate(() => window.__studio.pushOp({ type: 'delete', a: 48000, b: 72000, label: 'prova' }));
await a.page.click('[data-tab="improve"]'); await a.page.click('#btnPodcast');
await a.page.waitForSelector('#episode[open]', { timeout: 180000 });
await a.page.evaluate(() => document.querySelector('#episode').close());
await a.page.setInputFiles('#fileMusic', path.join(ROOT, 'strumenti/prova/musica-220.flac'));
await a.page.waitForFunction(() => !!window.__studio.S.musicId);
await a.page.evaluate(() => { window.__studio.META.title = 'Episodio della v1'; window.__studio.P.duckDepth = -14; });
const prima = await a.page.evaluate(() => ({ ops: window.__studio.S.ops.length, vlen: window.__studio.S.vlen, versione: document.body.textContent.match(/Sottovoce Officina Sonora (\d+\.\d+\.\d+)/)[1] }));
await a.page.click('[data-tab="project"]');
const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#btnSaveProj')]);
const file = path.join(os.tmpdir(), 'progetto-v1-' + process.pid + '.sottovoce'); await dl.saveAs(file);
check(prima.versione === '1.0.0', 'progetto salvato con la versione ' + prima.versione);
await a.ctx.close();
// 2. nella versione attuale
const b = await apri(path.join(ROOT, 'index.html'));
await b.page.setInputFiles('#fileProj', file);
await b.page.waitForFunction(() => /aperto/.test(document.querySelector('#projStatus').textContent), null, { timeout: 120000 });
const dopo = await b.page.evaluate(() => { const st = window.__studio, l = st.layout(); return { ops: st.S.ops.length, vlen: st.S.vlen, proc: st.S.procActive, musica: !!st.S.musicId, titolo: st.META.title, duck: st.P.duckDepth, intro: l.intro / 48000, sigla: l.sig, stato: document.querySelector('#projStatus').textContent, versione: document.body.textContent.match(/Sottovoce Officina Sonora (\d+\.\d+\.\d+)/)[1] }; });
check(dopo.ops === prima.ops && dopo.vlen === prima.vlen, 'nella ' + dopo.versione + ' si apre con le stesse modifiche e la stessa durata (' + dopo.ops + ' modifiche, ' + (dopo.vlen / 48000).toFixed(2) + ' s)');
check(dopo.proc && dopo.musica, 'voce migliorata e musica ci sono');
check(dopo.titolo === 'Episodio della v1' && dopo.duck === -14, 'titolo e regolazioni come nella v1');
check(dopo.sigla === 0 && dopo.intro === 6, 'senza sigla la linea del tempo è quella di prima (intro musicale ' + dopo.intro + ' s)');
check(!/più recente/.test(dopo.stato), 'nessun avviso di versione più recente');
check(!b.errori.length, 'nessun errore' + (b.errori.length ? ': ' + b.errori.join(' | ') : ''));
const [dl2] = await Promise.all([b.page.waitForEvent('download', { timeout: 180000 }), (async () => { await b.page.click('#stepper [data-go="export"]'); await b.page.click('#btnExport'); })()]);
check(/\.mp3$/.test(dl2.suggestedFilename()), 'il progetto della v1 si esporta: ' + dl2.suggestedFilename());
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
