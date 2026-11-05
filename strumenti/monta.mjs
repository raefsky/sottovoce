// Monta index.html a partire dai file di src/. Nessuna libreria esterna: serve solo Node.
//   node strumenti/monta.mjs             scrive index.html
//   node strumenti/monta.mjs --verifica  controlla che index.html sia aggiornato rispetto a src/ (non scrive nulla)
// In src/index.html:  @@include percorso@@  diventa il contenuto di src/percorso, così com'è;
//                     @@app@@  diventa js/_inizio.js, poi i file elencati in js/ordine.txt, poi js/_fine.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const leggi = p => fs.readFileSync(path.join(SRC, p), 'utf8');

export function monta() {
  const ordine = leggi('js/ordine.txt').split('\n').map(r => r.trim()).filter(Boolean);
  const app = leggi('js/_inizio.js') + ordine.map(f => '/* ---- ' + f + ' ---- */\n' + leggi('js/' + f)).join('') + leggi('js/_fine.js');
  // si sostituisce un segnaposto alla volta, senza rileggere il testo inserito
  const parti = leggi('index.html').split(/(@@include [^@\s]+@@|@@app@@)/);
  return parti.map(p => p === '@@app@@' ? app : p.startsWith('@@include ') ? leggi(p.slice(10, -2)) : p).join('');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = monta(), dest = path.join(ROOT, 'index.html');
  if (process.argv.includes('--verifica')) {
    const ora = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
    if (ora === out) { console.log('index.html è aggiornato (' + out.length + ' caratteri).'); process.exit(0); }
    let i = 0; while (i < out.length && out[i] === ora[i]) i++;
    console.error('index.html NON corrisponde a src/: prima differenza al carattere ' + i + '. Esegui: node strumenti/monta.mjs');
    process.exit(1);
  }
  fs.writeFileSync(dest, out);
  console.log('Scritto index.html (' + out.length + ' caratteri).');
}
