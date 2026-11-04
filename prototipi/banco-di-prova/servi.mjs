// Banco di prova dei prototipi: apre una pagina in Chromium senza interfaccia e risponde da sé a tutte le richieste.
// - http://test.local/...          i file del repository
// - http://test.local/__banco/...  gli audio di prova
// - le CDN e Hugging Face          i file indicati in `cdn` (pacchetti scaricati, oppure sostituti finti)
// Nessuna richiesta esce davvero verso internet.
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.wav': 'audio/wav', '.onnx': 'application/octet-stream', '.txt': 'text/plain' };

// cdn: elenco di [espressione regolare sull'indirizzo, funzione che dato il risultato del match restituisce il file locale]
export async function apri(browser, pagina, { repo, banco, cdn = [] }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const log = [], reqs = [];
  page.on('console', m => log.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => log.push('[pageerror] ' + e.message));
  const serve = (route, file) => {
    if (!file || !fs.existsSync(file)) { reqs.push('404 ' + file); return route.fulfill({ status: 404, body: 'non trovato' }); }
    reqs.push('200 ' + file);
    return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
  };
  await context.route('**/*', route => {
    const href = route.request().url(), u = new URL(href);
    if (u.host === 'test.local') {
      if (u.pathname.startsWith('/__banco/')) return serve(route, path.join(banco, decodeURIComponent(u.pathname.slice(9))));
      return serve(route, path.join(repo, decodeURIComponent(u.pathname)));
    }
    for (const [re, fn] of cdn) { const m = href.match(re); if (m) return serve(route, fn(m)); }
    reqs.push('BLOCCATO ' + href);
    return route.fulfill({ status: 404, body: 'bloccato nel banco di prova' });
  });
  await page.goto('http://test.local/' + pagina);
  return { context, page, log, reqs };
}
