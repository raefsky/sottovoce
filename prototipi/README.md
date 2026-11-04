# Prototipi per Sottovoce v2

Due pagine di prova, separate dall'app. Servono a decidere se due novità entrano nella v2. L'app (`index.html`) non cambia.

| Pagina | Cosa prova | Aprila |
|---|---|---|
| `pulizia.html` | Confronto alla cieca tra la pulizia di oggi (RNNoise) e DeepFilterNet3 | [apri](https://raw.githack.com/raefsky/sottovoce/v2/prototipi/pulizia.html) |
| `trascrizione.html` | Trascrizione nel browser con Whisper: velocità, parole sbagliate, riempitivi, sottotitoli | [apri](https://raw.githack.com/raefsky/sottovoce/v2/prototipi/trascrizione.html) |

I link passano da raw.githack.com, un servizio che mostra come pagine web i file di un repository GitHub pubblico. L'audio resta comunque sul tuo computer: da internet arrivano solo i programmi e i modelli.

Si possono anche scaricare e aprire con un doppio clic. Per `pulizia.html` serve anche la cartella `lib/` accanto.

## Da dove arrivano i componenti

| Componente | Da dove | Licenza |
|---|---|---|
| RNNoise | Copia identica di quello dentro `index.html` (`lib/rnnoise-sottovoce.js`) | BSD-3-Clause, compilato da @jitsi/rnnoise-wasm (Apache-2.0) |
| DeepFilterNet3 | `@lofcz/deepfilternet-web@0.1.0` da cdn.jsdelivr.net (circa 34 MB, modello incluso) | MIT o Apache-2.0 |
| Programma di trascrizione | `@huggingface/transformers@4.3.1` da cdn.jsdelivr.net | Apache-2.0 |
| Modelli Whisper | huggingface.co: `Xenova/whisper-tiny`, `-base`, `-small`, `onnx-community/whisper-large-v3-turbo` | MIT |

## Banco di prova

La cartella `banco-di-prova/` contiene le prove automatiche, che aprono le pagine in Chromium senza interfaccia. Al posto di DeepFilterNet e della libreria di trascrizione usano dei sostituti finti (`banco-di-prova/finti/`). Così controllano le pagine, l'allineamento, il volume, la divisione in pezzi e i ripieghi, ma non la qualità dei modelli veri.

```bash
node banco-di-prova/prova-pulizia.mjs <cartella del repository> <cartella con gli audio di prova>
```

```bash
node banco-di-prova/prova-trascrizione.mjs <cartella del repository> <cartella con pulita.wav e testo.txt>
```

```bash
node banco-di-prova/prova-file-locale.mjs <cartella del repository> <cartella con gli audio di prova>
```

Gli audio di prova si creano con una voce sintetica italiana (espeak-ng con la voce mbrola `it4`) a partire da `banco-di-prova/testo.txt`, poi `genera_audio.py` aggiunge rumore di ventola con ronzio, voci lontane con tastiera, ed eco di una stanza:

```bash
espeak-ng -v mb-it4 -s 150 -f banco-di-prova/testo.txt -w voce.wav
```

```bash
ffmpeg -i voce.wav -ar 48000 -ac 1 -af "highpass=f=70,loudnorm=I=-20:TP=-2" pulita.wav
```

```bash
python3 banco-di-prova/genera_audio.py <cartella con pulita.wav e babble_src.wav>
```

`babble_src.wav` è una seconda voce sintetica (per esempio `mb-it3`) da usare come voci lontane.

`prova-pulizia.mjs` accetta anche `--vero <cartella del pacchetto @lofcz/deepfilternet-web>` per usare il modello vero.
