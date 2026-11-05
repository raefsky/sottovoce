# Sviluppare Sottovoce

L'app pubblicata è un file solo, `index.html`, che funziona anche senza internet. Non si modifica a mano: si monta dai sorgenti in `src/`.

## I sorgenti

| Cartella | Cosa contiene |
|---|---|
| `src/index.html` | La pagina, con i segnaposto `@@include …@@` e `@@app@@` |
| `src/css/` | `caratteri.css` (i caratteri incorporati) e `app.css` (l'aspetto) |
| `src/js/` | Il codice dell'app, un file per argomento. L'ordine di montaggio è in `ordine.txt` |
| `src/terze-parti/` | RNNoise e lamejs, copiati senza modifiche |
| `src/licenze/` | I testi delle licenze mostrati in "Informazioni e licenze" |

Il codice in `src/js/` gira tutto nello stesso ambito: `_inizio.js` apre la funzione che lo contiene e `_fine.js` la chiude. Un file vede le funzioni e le variabili dei file montati prima e dopo, come quando era un file solo.

## Montare

```bash
node strumenti/monta.mjs
```

Per controllare che `index.html` sia aggiornato senza riscriverlo:

```bash
node strumenti/monta.mjs --verifica
```

Serve solo Node, nessuna libreria esterna.

## Provare

Prima e dopo ogni modifica:

```bash
node strumenti/prova-app.mjs
```

La prova apre l'app in Chromium senza rete ed esegue i controlli interni (`studioTest`). Poi segue il percorso di chi la usa: importa `strumenti/prova/voce-prova.flac`, applica la Modalità Podcast, esporta l'MP3 e lo misura con ffmpeg. Servono Playwright con Chromium e ffmpeg.

Per il salvataggio del progetto in un file:

```bash
node strumenti/prova-file.mjs
```

Questa prova serve la pagina da un piccolo server su `127.0.0.1`, perché le funzioni dei file richiedono un indirizzo sicuro. Le finestre "Salva" e "Apri" del sistema sono sostituite da un file vero nello spazio privato del browser (OPFS). Il ricollegamento dopo una ricarica non si prova in automatico: nel Chromium delle prove rileggere dal database un collegamento a un file OPFS fa crollare il browser, anche in una pagina vuota. Per questo l'app lo rilegge solo quando si clicca l'indicatore, e quel passaggio va provato a mano su Chrome o Edge.

Per sigla e chiusura (effetti ancorati all'inizio e alla fine) e per il tratto della musica:

```bash
node strumenti/prova-sigla.mjs
```

Usa file di prova riconoscibili dal tono (sigla a 440 Hz, chiusura a 660 Hz, musica a 220 Hz) e controlla nel mix cosa suona e dove.

Per i modelli di serie (salvataggio, nuovo episodio, numero dell'episodio, scaricamento e reimportazione):

```bash
node strumenti/prova-serie.mjs
```

Per la registrazione, con il microfono finto di Chromium (la forma d'onda deve vedersi mentre si registra):

```bash
node strumenti/prova-registra.mjs
```

Il volume di un file mono si misura come se suonasse su due casse, come fa l'app: -16 LUFS su due casse corrisponde a -19 LUFS misurati su un canale solo, la raccomandazione AES per i podcast in mono.

## Pubblicare

GitHub Pages pubblica `index.html` dal branch `main`. Dopo aver montato e provato, `index.html` va salvato nel repository insieme ai sorgenti.
