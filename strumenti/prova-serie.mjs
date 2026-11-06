// Prova dei modelli di serie.
//   node strumenti/prova-serie.mjs
// Prepara un episodio con sigla, chiusura, musica, copertina e dati della serie; lo salva come modello; crea un
// episodio nuovo dal modello e controlla che ci sia tutto; poi scarica, elimina e reimporta il modello.
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = n => path.join(ROOT, 'strumenti/prova', n);
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
await ctx.addInitScript(() => { try { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); } catch (e) {} });
await ctx.route(/^(https?|wss?):/, r => r.abort());
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push(e.message)); page.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => typeof window.studioTest === 'function');
const st = () => page.evaluate(() => { const s = window.__studio, l = s.layout(), x = v => +(v / 48000).toFixed(2); return {
  ops: s.S.ops.length, vlen: x(s.S.vlen), music: s.S.musicId ? s.S.sources.get(s.S.musicId).name : '', intro: x(l.intro), total: x(l.total),
  fx: s.S.fx.map(e => ({ anchor: e.anchor, at: x(e.at), gain: e.gainDb, name: s.S.sources.get(e.src).name, fadeOut: e.fadeOut })),
  meta: { title: s.META.title, artist: s.META.artist, album: s.META.album, track: s.META.track, cover: s.META.cover ? s.META.cover.length : 0 },
  duckDepth: s.P.duckDepth, musicDb: s.P.musicDb }; });
const lista = () => page.$$eval('#serieList .serie-item', li => li.map(x => x.querySelector('b').textContent + ' | ' + x.querySelector('span').textContent));

// 1. un episodio completo
await page.setInputFiles('#fileVoice', F('voce-prova.flac')); await page.waitForFunction(() => window.__studio.S.ops.length === 1);
await page.click('#stepper [data-go="tracks"]');
await page.setInputFiles('#fileMusic', F('musica-220.flac')); await page.waitForFunction(() => !!window.__studio.S.musicId);
await page.setInputFiles('#fileSig', F('sigla-440.flac')); await page.waitForFunction(() => window.__studio.S.ops.length === 2);
await page.setInputFiles('#fileEnd', F('chiusura-660.flac')); await page.waitForFunction(() => window.__studio.S.ops.length === 3);
await page.evaluate(() => { const s = window.__studio, e = s.S.fx.find(x => x.anchor === 'start');
  s.pushOp({ type: 'fxgain', id: e.id, gainDb: -3, label: 'prova' }); s.pushOp({ type: 'fxedit', id: s.S.fx.find(x => x.anchor === 'end').id, set: { fadeOut: 0.8 }, label: 'prova' });
  s.P.duckDepth = -15; Object.assign(s.META, { title: 'Episodio dodici', artist: 'Autore di prova', album: 'Serie di prova', track: '12' }); });
await page.setInputFiles('#fileCover', F('copertina.jpg')); await page.waitForFunction(() => !!window.__studio.META.cover);
const prima = await st();

// 2. salva come modello
await page.click('#stepper [data-go="project"]');
check((await lista()).length === 0 && /Ancora nessun modello/.test(await page.textContent('#serieList')), 'all\'inizio nessun modello, con una spiegazione');
await page.fill('#serieName', 'Serie di prova');
await page.click('#btnSerieSave');
await page.waitForFunction(() => document.querySelectorAll('#serieList .serie-item').length === 1);
let l = await lista();
check(/^Serie di prova \| sigla, musica, chiusura, copertina e regolazioni · Serie di prova · prossimo episodio: 13$/.test(l[0]), 'modello salvato: «' + l[0] + '»');

// 3. nuovo episodio dal modello
await page.click('#serieList .serie-item .btn.primary');
await page.waitForFunction(() => /Episodio 13/.test(document.querySelector('#projStatus').textContent), null, { timeout: 30000 });
let e = await st();
check(e.vlen === 0 && e.ops === 1, 'nuovo episodio: niente voce, una sola modifica in cronologia (' + e.ops + ')');
check(e.music === 'musica-220.flac' && e.musicDb === prima.musicDb && e.duckDepth === -15, 'musica e regolazioni come nel modello (musica ' + e.musicDb + ' dB, ducking ' + e.duckDepth + ' dB)');
const sig = e.fx.find(x => x.anchor === 'start'), end = e.fx.find(x => x.anchor === 'end');
check(sig && sig.name === 'sigla-440.flac' && sig.gain === -3, 'sigla con il suo volume ritoccato (' + JSON.stringify(sig) + ')');
check(end && end.name === 'chiusura-660.flac' && end.fadeOut === 0.8, 'chiusura con la sua dissolvenza (' + JSON.stringify(end) + ')');
check(e.meta.title === '' && e.meta.artist === 'Autore di prova' && e.meta.album === 'Serie di prova' && e.meta.track === '13' && e.meta.cover === prima.meta.cover,
  'dati: titolo vuoto, autore, serie, episodio 13 e copertina (' + JSON.stringify(e.meta) + ')');
check(await page.isVisible('#pane-rec'), 'si torna alla scheda Voce, pronta per registrare');
l = await lista(); check(/prossimo episodio: 14$/.test(l[0]), 'il modello ora propone l\'episodio 14');
// con la voce: tutto al suo posto
await page.setInputFiles('#fileVoice', F('voce-prova.flac')); await page.waitForFunction(() => window.__studio.S.vlen > 0);
e = await st();
check(e.intro === 9 && e.total === 27 && e.fx.find(x => x.anchor === 'end').at === 25, 'con la voce: voce da 9 s, chiusura a 25 s, totale 27 s (' + e.intro + ', ' + e.total + ')');
const mix = await page.evaluate(() => { const s = window.__studio, SR = 48000; const g = (a, b, f) => { const n = Math.round((b - a) * SR), [x] = s.renderMix(Math.round(a * SR), n, 'orig'); let re = 0, im = 0; for (let i = 0; i < n; i++) { const w = 2 * Math.PI * f * i / SR; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w); } return 20 * Math.log10(2 * Math.hypot(re, im) / n + 1e-9); }; return { sig: g(0.5, 2.5, 440), mus: g(4, 8, 220), end: g(25.3, 26, 660) }; });
check(mix.sig > -35 && mix.mus > -45 && mix.end > -35, 'nel mix suonano sigla, musica e chiusura (' + Object.values(mix).map(v => v.toFixed(0)).join(', ') + ' dB)');

// 4. scarica, elimina, reimporta
await page.click('#stepper [data-go="project"]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#serieList .serie-item .btn:nth-child(2)')]);
const file = path.join(os.tmpdir(), 'prova-' + process.pid + '.serie'); await dl.saveAs(file);
check(dl.suggestedFilename() === 'Serie di prova.serie', 'scarica: ' + dl.suggestedFilename());
await page.click('#serieList .serie-item .btn:nth-child(3)');
await page.waitForFunction(() => !document.querySelector('#serieList .serie-item'));
check(true, 'elimina: il modello sparisce dall\'elenco');
await page.setInputFiles('#fileSerie', file);
await page.waitForFunction(() => document.querySelectorAll('#serieList .serie-item').length === 1);
l = await lista(); check(/^Serie di prova \|.*prossimo episodio: 14$/.test(l[0]), 'reimportato dal file: «' + l[0] + '»');
await page.setInputFiles('#fileSerie', F('voce-prova.flac'));
await page.waitForFunction(() => /non è un modello valido/.test(document.querySelector('#serieStatus').textContent));
check(true, 'un file che non è un modello viene rifiutato con un messaggio');

const t = await page.evaluate(() => studioTest());
check(t.superati === t.totale, 'controlli interni dell\'app: ' + t.superati + ' su ' + t.totale);
check(!errori.length, 'nessun errore nella console' + (errori.length ? ': ' + errori.slice(0, 3).join(' | ') : ''));
await page.setViewportSize({ width: 1400, height: 1000 }); await page.click('#stepper [data-go="project"]');
await page.screenshot({ path: path.join(os.tmpdir(), 'sottovoce-serie.png') });
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
