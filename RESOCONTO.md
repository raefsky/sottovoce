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
2. **I pesi dei modelli dipendono dal computer.** Con la scheda grafica sono più grandi: Whisper base ha scaricato 199 MB sul Mac (Edge, WebGPU). Large v3 turbo è molto più pesante. Il peso vero compare nella pagina mentre scarica.
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

## Risultati delle prove (5 novembre)

**Pulizia, ascolto alla cieca sul Mac (Edge):**
- Senza limite: RNNoise 2, DeepFilterNet 0, pari 1.
- Con DeepFilterNet al massimo a 30 dB: DeepFilterNet vince sui file rumorosi (crowd, Fan), RNNoise sulla voce pulita (solo).
- Velocità: RNNoise circa 120 volte il tempo reale, DeepFilterNet 30–39. Ritardo misurato di DeepFilterNet: 30 ms su tutti i file.
- Proposta: RNNoise resta la pulizia normale. DeepFilterNet diventa "Pulizia forte", limitato a 30 dB, scelto dalla Modalità Podcast solo con molto rumore e scaricato solo quando serve. Prima va ricompilato dal codice ufficiale.

**Trascrizione, Whisper base sul Mac (Edge, WebGPU):**
- 2:14 di un capitolo letto in 14 s (9,5 volte il tempo reale), 199 MB scaricati, 31 s di primo caricamento.
- Circa 10 errori su 100 parole nell'estratto ("divento" per "di vento", "le vigati" per "levigati", "crista" per "cresta"…): troppi per sottotitoli e montaggio dal testo.

**Trascrizione, Whisper small sul Mac (Edge, WebGPU):**
- Stesso file: 28 s (4,7 volte il tempo reale), 562 MB scaricati, 88 s di primo caricamento.
- Circa 2 errori su 100 parole nell'estratto ("Alghe hanno date" per "alghe annodate", "ingi nocchi" per "inginocchi"), più qualche maiuscola e punteggiatura. Quasi tutti gli errori di base sono spariti.
- Proposta: Whisper small è il modello della v2, scaricato solo da chi attiva il testo dell'episodio. Da provare ancora: un pezzo parlato a braccio, per vedere se scrive gli "ehm".

**Parlato a braccio, Whisper small (ehm.wav, 1:46, registrazione da riunione online):**
- 18 s (5,7 volte il tempo reale). Riempitivi trovati: 0. Whisper non scrive gli "ehm", come temuto.
- Scrive invece ripetizioni e autocorrezioni ("del del", "da non confondere a, da non confondere dicevo", "il PDP no il PDP, volevo dire…"): queste si possono trovare nel testo.
- Errori su sigle e termini di scuola: "pay" per "PEI", "gl o" per "GLO".
- Conseguenza: "Togli gli ehm" non può basarsi sul testo. Idea da provare: un "ehm" è un tratto in cui RNNoise sente voce ma Whisper non mette nessuna parola.

## Ricerca degli "ehm" e delle ripetizioni (aggiunta il 5 novembre)

`trascrizione.html` ora cerca gli "ehm" dal suono, non dal testo. RNNoise (lo stesso dell'app) dice ogni 10 ms se c'è voce, Whisper dice dove sono le parole. Un tratto di voce lungo da 0,18 a 2,2 secondi senza parole è un probabile "ehm", "mmm" o respiro. I punti trovati compaiono nel testo come **ehm?** e in un elenco da controllare a orecchio ("Era un ehm" / "Non lo era").

Cerca anche le ripetizioni ("del del") e le frasi ripartite ("da non confondere a, da non confondere"), escludendo i raddoppi normali come "piano piano" o "molto molto".

Banco di prova, con frasi e "ehm" sintetici e i tempi esatti delle parole: trovati 4 riempitivi su 4, nessun falso allarme, pausa muta e respiro non segnalati, ripetizioni trovate 2 su 2.

Il limite da verificare: con Whisper vero i tempi delle parole sono imprecisi di qualche decimo di secondo. Una parola che "si allarga" sopra un "ehm" lo nasconde, una che finisce troppo presto crea un falso allarme. La prova su `ehm.wav` dirà quanto pesa.
