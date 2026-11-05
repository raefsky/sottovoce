// Prova su telefono e tablet: niente scorrimento di lato, bersagli da toccare abbastanza grandi, intestazione e barra
// degli strumenti compatte, Studio leggibile.
//   node strumenti/prova-mobile.mjs
// Attenzione: niente fotografie a pagina intera prima delle misure, perché fanno perdere a Chromium l'emulazione del touch.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ok = [], ko = [];
const check = (c, m) => { (c ? ok : ko).push(m); };
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

for (const [nome, dev] of [['telefono', devices['iPhone 13']], ['tablet', devices['iPad (gen 7)']]]) {
  const ctx = await browser.newContext({ ...dev, permissions: ['microphone'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('sottovoce-studio.benvenuto.v1', '1'); } catch (e) {} });
  await ctx.route(/^(https?|wss?):/, r => r.abort());
  const page = await ctx.newPage();
  const errori = [];
  page.on('pageerror', e => errori.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => typeof window.studioTest === 'function');
  check(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), nome + ': schermo touch riconosciuto');
  await page.setInputFiles('#fileVoice', path.join(ROOT, 'strumenti/prova/voce-prova.flac'));
  await page.waitForFunction(() => window.__studio.S.vlen > 0);
  // ogni scheda: niente scorrimento di lato, menu, campi e link da almeno 40 pixel
  const larghi = [], piccoli = [];
  for (const tab of ['rec', 'improve', 'tracks', 'export', 'project']) {
    await page.evaluate(t => document.querySelector('#stepper [data-go="' + t + '"]').click(), tab);
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const W = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth, small = [];
      document.querySelectorAll('select, input[type=text], input[type=number], .linkbtn, .btn, .style-pv').forEach(el => {
        const r = el.getBoundingClientRect(); if (!r.width || !el.offsetParent || el.closest('dialog:not([open])')) return;
        if (r.height < 40) small.push((el.id || el.textContent.trim().slice(0, 16)) + ' ' + Math.round(r.height));
      });
      return { W, sw, small };
    });
    if (m.sw > m.W) larghi.push(tab + ' ' + m.sw + '>' + m.W);
    piccoli.push(...m.small.map(x => tab + ': ' + x));
  }
  check(!larghi.length, nome + ': nessuna scheda scorre di lato' + (larghi.length ? ' (' + larghi.join(', ') + ')' : ''));
  check(!piccoli.length, nome + ': menu, campi, link e pulsanti alti almeno 40 pixel' + (piccoli.length ? ' (' + [...new Set(piccoli)].slice(0, 6).join(' | ') + ')' : ''));
  // intestazione: tema, Studio e Guida sulla stessa riga; barra degli strumenti al massimo su due righe
  const h = await page.evaluate(() => {
    const top = s => Math.round(document.querySelector(s).getBoundingClientRect().top);
    const rows = new Set([...document.querySelectorAll('.tools > .tgrp')].filter(g => g.offsetParent).map(g => Math.round(g.getBoundingClientRect().top / 8)));
    return { tema: top('.look .tgroup'), studio: top('#btnStudio'), guida: top('#btnGuide'), righe: rows.size };
  });
  check(Math.abs(h.tema - h.studio) < 8 && Math.abs(h.studio - h.guida) < 8, nome + ': tema, Studio e Guida sulla stessa riga (' + [h.tema, h.studio, h.guida].join(', ') + ')');
  check(h.righe <= 2, nome + ': barra degli strumenti al massimo su due righe (' + h.righe + ')');
  // Studio
  await page.evaluate(() => document.querySelector('#btnStudio').click());
  await page.waitForTimeout(800);
  const s = await page.evaluate(() => {
    const vis = sel => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0; };
    const lab = [...document.querySelectorAll('.st-scale span')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
    let sovrapposte = 0; for (let i = 1; i < lab.length; i++) if (lab[i].left < lab[i - 1].right - 1) sovrapposte++;
    return { tasti: vis('#stKeys'), sovrapposte, dove: document.querySelector('#stWhere').textContent, sw: document.documentElement.scrollWidth, W: document.documentElement.clientWidth };
  });
  check(!s.tasti, nome + ': nello Studio non compare la riga sulla tastiera');
  check(s.sovrapposte === 0, nome + ': nello Studio le etichette della scala non si sovrappongono');
  check(/\d,\d s\./.test(s.dove), nome + ': la durata non si spezza tra numero e unità («' + s.dove + '»)');
  check(!errori.length, nome + ': nessun errore' + (errori.length ? ': ' + errori.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}
console.log('RIUSCITI ' + ok.length + ':\n  ' + ok.join('\n  '));
console.log('NON RIUSCITI ' + ko.length + (ko.length ? ':\n  ' + ko.join('\n  ') : ''));
await browser.close();
process.exit(ko.length ? 1 : 0);
