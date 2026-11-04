# Resoconto della notte: primi passi della v2

*Branch `v2`, 4–5 novembre 2026. L'app online e il branch `main` non sono stati toccati.*

## In breve

- **Fatto:** il branch `v2` è su GitHub, con due prototipi pronti da provare: uno per la **pulizia** (DeepFilterNet3 contro il RNNoise di oggi) e uno per la **trascrizione** (Whisper nel browser).
- **Verificato:** le pagine funzionano. Sono riusciti tutti i 46 controlli automatici, su schermo grande e da telefono, e anche la prova con i file aperti con un doppio clic.
- **Non misurato:** quanto suona meglio DeepFilterNet e quanto è precisa la trascrizione. Per sicurezza questo ambiente non lascia eseguire codice scaricato da terzi, e i modelli veri lo sono. Queste misure le fai tu, nel tuo browser, con i link qui sotto.
- **Da fare tu:** la Release `v1.0.0` su GitHub (cinque minuti, istruzioni in fondo), perché il tag da qui non è passato.

## Come provare, domattina

### 1. La pulizia

Apri **[pulizia.html](https://raw.githack.com/raefsky/sottovoce/v2/prototipi/pulizia.html)**.

1. Trascina 3 o 4 registrazioni tue, da 1 a 5 minuti ciascuna. Le più utili: una con rumore di fondo (ventola, traffico), una con rumori che cambiano (tastiera, voci lontane), una in una stanza che rimbomba, una pulita.
2. La prima volta il browser scarica DeepFilterNet (circa 34 MB).
3. Per ogni file ascolta **A** e **B** con le cuffie: sono le due pulizie, in ordine casuale e allo stesso volume. Passando dall'una all'altra l'ascolto continua dallo stesso punto. **Originale** è il file così com'è.
4. Scegli quella che preferisci: solo dopo la pagina ti dice quale era quale.
5. Alla fine premi **Copia i risultati** e incollali nella chat con me.

Se DeepFilterNet ti sembra troppo aggressivo, prova di nuovo con "Al massimo 30 dB" nel menu in alto: toglie meno rumore e lascia la voce più naturale.

### 2. La trascrizione

Apri **[trascrizione.html](https://raw.githack.com/raefsky/sottovoce/v2/prototipi/trascrizione.html)**. Meglio con **Chrome o Edge** aggiornati, che possono usare la scheda grafica.

1. Comincia con **Whisper base** e un pezzo di 2 o 3 minuti.
2. Se hai il copione di quello che hai detto, incollalo nel riquadro "Testo di riferimento": la pagina calcolerà quante parole ha sbagliato.
3. Premi **Trascrivi**. La pagina mostra il peso del modello scaricato, il tempo impiegato e quante volte è più veloce del tempo reale.
4. Clicca le parole per controllare che i tempi tornino. Prova a scaricare i sottotitoli SRT.
5. Poi prova **Whisper small** sullo stesso pezzo e, se il computer regge, un episodio intero.
6. Ogni volta premi **Copia i risultati** e incollali nella chat.

Il link passa da raw.githack.com, un servizio che mostra come pagine web i file di un repository pubblico. Da qui non sono riuscito ad aprirlo per controllarlo, perché la rete di questo ambiente non lo raggiunge.

**Se il link non si apre**, c'è la strada del doppio clic, che ho provato:
1. Su GitHub apri il repository e scegli il branch **v2** nel menu dei branch.
2. Premi **Code → Download ZIP** ed estrai il file.
3. Nella cartella `prototipi` apri `pulizia.html` o `trascrizione.html` con un doppio clic, in Chrome o Edge.

## Cosa ho verificato

Ho provato le pagine in Chromium senza interfaccia, con audio di prova creato da una voce sintetica italiana (55 secondi), e tre versioni difficili: ventola con ronzio, voci lontane con tastiera, stanza con eco.

Al posto di DeepFilterNet e di Whisper ho usato dei **sostituti finti** scritti da me: hanno la stessa interfaccia, ma nessun modello. Dimostrano che la pagina fa quello che deve, non quanto sono bravi i modelli veri.

**Pulizia (15 controlli riusciti):**
- RNNoise è lo stesso dell'app, copiato senza modifiche. Qui lavora a **circa 42–48 volte il tempo reale**: un'ora di audio in un minuto e mezzo circa.
- L'uscita di ogni pulizia è allineata all'originale al campione. Il ritardo di DeepFilterNet la pagina lo misura da sola su ogni file, invece di fidarsi di un numero scritto a mano.
- Originale, A e B sono portati tutti a **-19 LUFS**, così nel confronto non vince la versione più forte. La misura del volume coincide con quella di ffmpeg.
- L'ascolto alla cieca, il passaggio tra A e B, la rivelazione, il riepilogo e il download funzionano. Al telefono la pagina non scorre di lato.

**Trascrizione (31 controlli riusciti):**
- L'audio viene diviso in pezzi da circa 28 secondi, tagliati nella pausa più silenziosa: nessuna parola persa o doppia ai tagli.
- Il calcolo delle parole sbagliate è corretto, e i riempitivi vengono trovati ed evidenziati.
- I sottotitoli SRT sono validi e senza riempitivi. Cliccando una parola l'ascolto parte da lì, e durante l'ascolto la parola corrente si illumina.
- Se un modello non dà i tempi parola per parola, la pagina ripiega sui tempi per frase. Se una versione del modello non esiste, prova la successiva.

**Apertura con doppio clic:** tutte e due le pagine funzionano anche aperte direttamente dal disco, senza errori.

## Cose da sapere prima di decidere

1. **Whisper tende a non scrivere gli "ehm".** È addestrato su testi "puliti", quindi spesso li salta. Il conteggio dei riempitivi potrebbe essere basso. Se succede, per la v2 servirà un altro modo per trovarli, per esempio cercando i suoni brevi tra le parole.
2. **I pesi dei modelli sono stime.** Tiny circa 40 MB, base circa 80, small circa 250. Large v3 turbo è molto più pesante: provalo solo con la scheda grafica. Il peso vero compare nella pagina mentre scarica.
3. **Le misure di velocità che conteranno sono le tue.** Questo computer nel cloud non ha scheda grafica: sul tuo Mac o PC i numeri saranno diversi, probabilmente migliori con WebGPU.
4. **DeepFilterNet viene da una versione non ufficiale** (`@lofcz/deepfilternet-web`, licenza MIT o Apache-2.0). Ne ho letto il codice JavaScript: non fa chiamate esterne e il modello è dentro il file wasm. Se entrasse nella v2, prima andrebbe ricompilato dal codice ufficiale di DeepFilterNet o verificato meglio.
5. **Pesa:** 34 MB contro i circa 110 KB di RNNoise. Per l'app servirebbe uno scaricamento a parte, solo per chi sceglie la "qualità alta".

## Cosa non è riuscito, e perché

- **Il tag `v1.0.0`:** il proxy di questa sessione non lascia passare i tag. Si crea dalla Release, qui sotto.
- **Misure dei modelli veri:** l'ambiente blocca l'esecuzione di codice scaricato da terzi, e comunque non raggiunge Hugging Face. È una protezione giusta e non l'ho aggirata. I pacchetti li ho solo scaricati e letti.

## La Release v1.0.0 (da fare tu)

1. Su GitHub, apri il repository e vai su **Releases → Draft a new release**.
2. In **Choose a tag** scrivi `v1.0.0` e scegli "Create new tag on publish". Come **Target** lascia `main`.
3. **Release title:** `Sottovoce Officina Sonora 1.0.0`
4. **Descrizione**, da copiare:

   > La prima versione pubblica di Sottovoce Officina Sonora: rifinitura della voce e mix con la musica per podcast, direttamente nel browser.
   >
   > - Pulizia del rumore con RNNoise, stili pronti per la voce, de-esser, attenuazione di p e b, anti-ronzio, respiri e click
   > - Registrazione e montaggio nell'app, accorciamento delle pause lunghe
   > - Volume costante in LUFS e Modalità Podcast in un clic
   > - Musica con ducking automatico ed effetti
   > - Esportazione in MP3 o WAV con titolo, autore e copertina
   >
   > Tutto avviene nel browser: l'audio non lascia il computer.
   > Licenza PolyForm Noncommercial 1.0.0.

5. Premi **Publish release**.

## Dove sta tutto

- `prototipi/pulizia.html` e `prototipi/trascrizione.html`: i due prototipi.
- `prototipi/lib/rnnoise-sottovoce.js`: il RNNoise dell'app, copiato senza modifiche.
- `prototipi/banco-di-prova/`: le prove automatiche, i sostituti finti e il generatore degli audio di prova.
- `prototipi/README.md`: istruzioni tecniche e provenienza dei componenti.

## Il passo successivo

Quando mi incolli i risultati delle due prove, decidiamo insieme:
- se DeepFilterNet entra nella v2, come opzione di qualità alta;
- quale modello Whisper è il compromesso giusto tra precisione, peso e velocità sul tuo computer.

Poi si parte con la prima fase vera: riordino del codice, nuova interfaccia, modelli di serie e salvataggio su file.
