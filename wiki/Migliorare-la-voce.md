# Migliorare la voce

Scheda **2. Migliora**. Ci sono tre modi, dal più rapido al più preciso.

## 1. Modalità Podcast: un clic

Premi **Modalità Podcast**. Sottovoce analizza la registrazione (rumore, rimbombo, sibilanti, respiri, click, differenze di volume tra le frasi) e poi:

- applica lo stile **Podcast** e le correzioni suggerite dall'analisi;
- attiva livellatore, riparazione dei click e riduzione dei respiri **solo se servono**;
- imposta il volume per la pubblicazione: **-16 LUFS**, picchi a **-1 dBTP**, MP3.

Alla fine compare **Episodio pronto**, con una valutazione della qualità della registrazione e, se serve, un consiglio per la prossima volta. Da lì puoi esportare l'MP3 o aprire le regolazioni avanzate.

Tutto si annulla con **Torna alle regolazioni di prima**.

## 2. Analizza e proponi

Preferisci decidere tu? **Analizza e proponi** fa la stessa analisi ma **mostra i suggerimenti prima di applicarli**. Puoi accettarli tutti con **Applica tutti i suggerimenti** e, se non ti convincono, tornare alle regolazioni di prima.

## 3. Regolazioni avanzate

Scegli uno **stile della voce** come punto di partenza, ritocca le regolazioni e premi **Applica i miglioramenti**.

### Stili della voce

| Stile | Per cosa |
|---|---|
| **Narrazione** | Storie e racconti. Toglie il rimbombo e aggiunge presenza senza durezza. |
| **Voce calda** | Più corpo e meno aria: timbro morbido, compressione leggera. |
| **Parlato chiaro** | Lezioni e spiegazioni: parole ben scandite, compressione decisa. |
| **Podcast** | Parlato conversazionale: presenza moderata, compressione media. |
| **Radiofonica** | Voce piena, vicina e decisa. Rende meglio su una registrazione già pulita. |

### Le regolazioni, in breve

**Volume della voce**
- **Normalizza la voce (LUFS)** e **Obiettivo di volume**: -19 LUFS è il riferimento per la voce con musica sotto. Il volume finale del file si sceglie in [[Esportare|Esportare]].
- **Pareggia le registrazioni**: se un capitolo è registrato in più volte, ogni pezzo viene portato allo stesso volume.
- **La voce è già stata rifinita**: se la voce arriva già pulita da un altro programma, Sottovoce cambia solo il volume, così non viene trattata due volte.

**Pulizia del rumore**
- **Metodo**: *Intelligenza artificiale (RNNoise)* toglie fruscio e ventole lasciando la voce naturale ed è quello consigliato; *Classico con profilo del rumore* sottrae il rumore preso da un punto silenzioso; *Nessuna pulizia*.
- **Riduci l'eco della stanza**: oltre 0,7 la voce può perdere naturalezza.
- **Togli il ronzio elettrico**: 50 Hz in Europa, 60 Hz in Nord America. Lavora su frequenze strettissime e la voce non cambia.

**Timbro**
- **Taglio dei bassi**: 80-100 Hz per una voce maschile, 100-120 Hz per una femminile.
- **Rimbombo (220 Hz)**, **Scatolosità (380 Hz)**, **Corpo (140 Hz)**, **Presenza (3 kHz)**, **Attenua il metallico (6,5 kHz)**, **Aria (9 kHz)**.
- **Attenua le p e le b esplosive**: abbassa i bassi solo per i pochi millesimi di secondo del colpo.

**De-esser**: abbassa solo le "s", "z" e "sc" troppo forti. Da 4 a 8 dB di riduzione è tipico.

**Respiri e click**
- **Abbassa i respiri**: li rende più discreti senza cancellarli (6 dB discreti, 12 dB quasi spariti).
- **Ripara i click di bocca**: toglie gli schiocchi di lingua e saliva; t, k e s non vengono toccate.

**Dinamica**
- **Livellatore**: avvicina il volume delle frasi dette piano a quelle dette forte.
- **Compressore**: rende la voce più compatta. 2:1 è leggero, 3:1 deciso, oltre 4:1 molto marcato.
- **Gate**: abbassa il volume nelle pause, quando non parli.

**Misure della voce**: mostrano in numeri come sta la voce, prima e dopo.

> Ogni regolazione ha la sua spiegazione nell'app: passa il mouse sulla lettera **i**.

## Confrontare prima e dopo

In basso, i pulsanti **Originale** e **Migliorata** passano da una versione all'altra durante l'ascolto.

- **Stesso volume**: le due versioni si sentono allo stesso volume percepito, così non "vince" solo la più forte.
- **Ascolto alla cieca**: le versioni diventano X e Y; scegli quella che preferisci e poi premi **Rivela quale era quale**.

## Salvare le tue regolazioni

Se trovi le regolazioni giuste per la tua voce, salvale come **preset**: vedi [[Progetti e preset|Progetti-e-preset]].
