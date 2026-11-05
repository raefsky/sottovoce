/* ========================= Spiegazioni delle opzioni (la lettera i) ========================= */
const HELP = {
  match: 'Nel confronto tra Originale e Migliorata li ascolti allo stesso volume percepito, così non vince solo la più forte. Con “Normalizza la voce” attiva sono già allo stesso volume.',
  micId: 'Il microfono da usare. I nomi compaiono dopo il primo permesso del browser. Se non sei sicuro, lascia quello predefinito del sistema.',
  recWhere: 'Dove finisce la nuova registrazione o il file importato. In fondo: dopo tutto il resto. Al cursore: inserita nel punto del cursore, il resto si sposta in avanti. Al posto della selezione: sostituisce il tratto selezionato, utile per rifare una frase. Al posto di tutta la voce: la nuova registrazione o il nuovo file prendono il posto della voce intera, mentre musica, effetti e titolo restano.',
  xfadeMs: 'A ogni taglio o incollatura il programma unisce i due pezzi con una dissolvenza incrociata brevissima, così non si sentono clic. 10 ms va bene quasi sempre. Valori più alti ammorbidiscono, ma possono mangiare l’inizio di una consonante.',
  nrMethod: 'Come togliere il rumore di fondo. Intelligenza artificiale (RNNoise): toglie fruscio, ventole e rumori costanti lasciando la voce naturale; è quella preferita nell’ascolto alla cieca. Classico: prende il punto più silenzioso come esempio di rumore e lo sottrae. Nessuna pulizia: salta questo passaggio.',
  nrMix: 'Quanta voce pulita usare. 100 % è tutta pulita, la versione preferita nell’ascolto alla cieca. Un valore più basso lascia un po’ di originale.',
  nrDb: 'Di quanto, al massimo, il metodo classico abbassa il rumore. Tra 10 e 15 dB è prudente: di più, la voce può suonare metallica o “sott’acqua”.',
  nrAlpha: 'Quanto spinge il metodo classico. Più è alta, più rumore toglie, ma la voce diventa metallica. Parti da 1,2 e alza poco alla volta.',
  eco: 'Attenua il rimbombo e la coda dopo ogni frase, tipici di stanze vuote o con pareti dure. Oltre 0,7 la voce può perdere naturalezza. A 0 è spento.',
  hp: 'Taglia i suoni molto gravi che non fanno parte della voce: colpi sul tavolo, vibrazioni, traffico lontano. Di solito 80-100 Hz per una voce maschile, 100-120 Hz per una femminile.',
  lowMid: 'Abbassa la zona dove si accumula il rimbombo della stanza (intorno a 220 Hz). Più abbassi, meno rimbomba, ma la voce si fa più sottile.',
  mud: 'Abbassa la zona che fa sembrare la voce chiusa in una scatola (intorno a 380 Hz). Bastano piccoli ritocchi, da -1 a -3 dB.',
  lowShelf: 'Aggiunge o toglie corpo alla voce (sotto 140 Hz). In più la rende calda e piena, ma fa crescere anche il rimbombo.',
  presence: 'Alza o abbassa la zona che rende le parole comprensibili (intorno a 3 kHz). Un po’ in più aiuta la chiarezza, troppo rende la voce dura.',
  harsh: 'Abbassa la zona dove nasce il suono metallico o tagliente (intorno a 6,5 kHz). Spesso bastano da -3 a -4 dB.',
  air: 'Regola i suoni più acuti, oltre 9 kHz: brillantezza e “aria”. In meno smorza una voce sibilante o sottile.',
  deessOn: 'Il de-esser abbassa solo le “s”, le “z” e le “sc” troppo forti, nell’istante in cui compaiono. Il resto della voce non cambia.',
  deessAmt: 'Di quanto può abbassare, al massimo, le “s”. Da 4 a 8 dB è tipico. Oltre, la voce può prendere una leggera lisca.',
  deessThr: 'Quanto è sensibile. Un valore basso interviene su più “s”, uno alto solo sulle più forti.',
  compOn: 'Il compressore avvicina il volume dei suoni forti e di quelli deboli, dentro le frasi. La voce diventa più compatta e facile da ascoltare, anche in auto o con le cuffiette.',
  compRatio: 'Quanto il compressore riduce le differenze. 2:1 è leggero, 3:1 deciso, oltre 4:1 molto marcato. Più compressione fa risalire anche il rumore e l’eco della stanza.',
  compThr: 'Il livello oltre il quale il compressore comincia a lavorare. Più è bassa, più parole vengono uniformate.',
  compAtk: 'Quanto in fretta il compressore reagisce a un suono forte. Rapido (5-10 ms) tiene a bada anche i picchi; più lento lascia più energia alle consonanti.',
  compRel: 'Quanto in fretta il volume torna normale dopo l’intervento del compressore. Da 100 a 200 ms suona naturale per la voce.',
  gateOn: 'Il gate abbassa il volume nelle pause, quando non parli: spariscono il fruscio residuo e i piccoli rumori. Il modo in cui riconosce la voce si sceglie nella scheda Musica, sotto Ducking.',
  gateOver: 'Quanto sopra il rumore di fondo deve stare un suono per essere considerato voce. Si calcola da sola: più è alta, più spesso il gate abbassa.',
  gateRed: 'Di quanto il gate abbassa i silenzi. Da 10 a 15 dB suona naturale. Valori alti rischiano di mangiare la fine delle parole deboli.',
  target: 'Il volume della voce in LUFS, cioè come lo sente l’orecchio. -19 è il riferimento per la voce con musica sotto. Il volume finale del file, musica compresa, si sceglie poi nella scheda Esporta.',
  voiceRefined: 'Attivala se la voce arriva già lavorata, per esempio tagliata e pulita in Audacity o passata in Rifinitura. Il programma salta pulizia del rumore, eco, timbro, de-esser, compressore e gate, così la voce non viene trattata due volte. Resta solo la normalizzazione del volume in LUFS, come in Sottovoce.',
  voiceNorm: 'Misura il volume percepito della voce montata (in LUFS, come in Sottovoce) e la porta all’obiettivo. Vale per l’originale e per la migliorata. Non modifica le registrazioni: cambia solo il volume con cui si ascoltano e si esportano.',
  normEach: 'Utile quando un capitolo è registrato in più volte, magari in giorni diversi: ogni registrazione viene misurata e portata allo stesso volume delle altre, così i pezzi uniti non hanno salti di volume.',
  musicAuto: 'Misura la musica appena la carichi e ne imposta il volume per arrivare all’obiettivo qui sotto.',
  musicDb: 'Volume della musica quando la voce non parla, per esempio nell’intro.',
  musicTarget: 'Il volume a cui il calcolo automatico porta la musica da sola, in LUFS. Più basso vuol dire musica più discreta.',
  carve: 'Toglie un po’ di musica intorno a 3 kHz, dove si trova la voce, così le parole restano chiare anche con la musica sotto.',
  loop: 'Se la musica è più corta del mix, ricomincia da capo invece di fermarsi.',
  musicOffset: 'Salta i primi secondi del brano, per esempio se l’inizio è troppo lento.',
  fadeIn: 'Durata della dissolvenza in entrata della musica all’inizio del mix.',
  fadeOut: 'Durata della dissolvenza in uscita della musica alla fine del mix.',
  intro: 'Secondi di sola musica prima che entri la voce.',
  tail: 'Secondi di musica che continuano dopo la fine della voce.',
  duckOn: 'Abbassa automaticamente la musica quando la voce parla e la fa risalire nelle pause.',
  duckDepth: 'Di quanto scende la musica quando parli. -12 dB è discreto, -16 dB la fa quasi sparire.',
  duckAtk: 'Quanto è rapida la discesa della musica quando inizia la voce. Valori bassi vogliono dire discesa veloce.',
  duckRel: 'Quanto è rapida la risalita quando la voce smette. Valori alti vogliono dire risalita lenta e morbida.',
  duckHold: 'Per quanto la musica resta abbassata nelle pause brevi tra le parole. Evita che salga e scenda a ogni respiro.',
  duckLook: 'La musica comincia a scendere un attimo prima che inizi la voce, così non copre le prime sillabe.',
  humOn: 'Toglie il ronzio della corrente elettrica, che entra da cavi, alimentatori o luci. Agisce solo su poche frequenze strettissime, quelle del ronzio, così la voce non cambia. Con “Rileva il ronzio” il programma lo cerca da solo nelle pause.',
  humFreq: '50 Hz in Europa, Italia compresa. 60 Hz in America del Nord e in parte del Giappone.',
  humHarm: 'Il ronzio non ha una sola nota: con 50 Hz ci sono anche 100, 150 e 200 Hz. Più armoniche togli, più ronzio sparisce. La quarta tocca appena il fondo di una voce maschile.',
  plosOn: 'Le p e le b spingono aria sul microfono e producono un colpo sordo. Questo filtro lo riconosce e abbassa i bassi solo per quei pochi millesimi di secondo, lasciando il resto della voce intatto. È diverso dal taglio dei bassi, che lavora sempre.',
  plosFreq: 'Sotto questa frequenza si cerca e si abbassa il colpo. 150 Hz va bene per quasi tutte le voci. Alzala solo se i colpi restano.',
  plosSens: 'Quanto facilmente un suono basso viene preso per un colpo. Più alto prende anche i colpi leggeri, ma può toccare le vocali gravi di una voce maschile.',
  plosMax: 'Di quanto si abbassano al massimo i bassi durante un colpo.',
  fxSnap: 'Quando trascini un effetto vicino all’inizio o alla fine di una pausa, si ferma lì da solo: per esempio un gong che parte appena smetti di parlare. Funziona entro 8 pixel.',
  silMin: 'Le pause più brevi di così restano come sono. Alza il valore per accorciare solo le pause davvero lunghe.',
  silMax: 'Quanto resta di ogni pausa accorciata. 0,6 s è un respiro naturale tra due frasi.',
  levOn: 'Il livellatore ascolta la voce su un paio di secondi e avvicina il volume delle frasi dette piano a quelle dette forte, senza toccare le singole parole. Nelle pause non alza mai il volume, così il rumore resta basso. Lavora prima del compressore.',
  levAmt: 'Con 100 % ogni frase arriva al volume medio della voce, entro la correzione massima. Con 50 % la differenza si dimezza: la voce resta viva.',
  levMax: 'Di quanto al massimo si alza o si abbassa una frase. Tenerla bassa evita di trasformare un sussurro voluto in voce piena.',
  breathOn: 'Riconosce i respiri tra le frasi e li abbassa senza cancellarli, così il parlato resta naturale. La prima volta servono alcuni secondi per riconoscere la voce.',
  breathDb: 'Di quanto si abbassano i respiri. 6 dB li rende più discreti, 12 dB quasi spariscono.',
  breathSens: 'Quanto facilmente un suono tra le frasi viene preso per un respiro. Più alto ne trova di più, ma può toccare l’inizio o la fine delle parole sussurrate.',
  clickOn: 'Cerca gli schiocchi brevissimi di lingua e saliva, al massimo 3 millesimi di secondo, e toglie solo i loro acuti. Le consonanti come t, k e s durano di più e non vengono toccate.',
  clickSens: 'Quanto facilmente un picco breve viene preso per un click. Più alto ne ripara di più, ma può ammorbidire qualche consonante secca.',
  humBw: 'Quanto è larga ogni banda tolta. Stretta tocca meno la voce, ma se la corrente oscilla un po’ lascia passare parte del ronzio: in quel caso allarga a 3 o 4 Hz.',
  humDb: 'Quanto vengono abbassate le frequenze del ronzio. 30 dB lo rendono di solito inudibile.',
  vadMode: 'Come il programma capisce quando stai parlando. Dal livello: conta come voce tutto ciò che supera una soglia. Intelligente (RNNoise): riconosce la voce vera, quindi respiri, tosse e rumori non abbassano la musica e le frasi dette piano vengono riconosciute. Vale per il ducking e per il gate.',
  vadSens: 'Quanto facilmente un suono viene considerato voce. Più alto: riconosce anche le parole più deboli, ma può scambiare per voce qualche rumore. Più basso: solo la voce sicura.',
  duckThrAuto: 'Calcola da sola la soglia oltre la quale il mixer considera che stai parlando. Spegnilo solo se il ducking non rileva le frasi dette piano.',
  duckThr: 'Livello sopra il quale il mixer considera che stai parlando, quando la soglia automatica è spenta.',
  fxDb: 'Volume di tutti gli effetti insieme. Ogni effetto ha poi il suo cursore nell’elenco.',
  expFormat: 'MP3: file leggero, pronto da pubblicare, con titolo, autore e copertina. WAV: senza perdita di qualità, per continuare a lavorare in altri programmi.',
  expKbps: 'Qualità dell’MP3. Per il parlato 128 kbps basta, 192 è un buon compromesso con la musica, 320 è la più alta.',
  expBits: '24 bit conserva più dettaglio: sceglilo se il file andrà ancora lavorato. 16 bit pesa meno; il programma aggiunge un fruscio impercettibile (dither) che evita piccole distorsioni nei suoni deboli.',
  expSr: 'Quanti campioni al secondo ha il file. 48 kHz è il formato di lavoro del programma e del video. 44,1 kHz è quello dei CD: sceglilo solo se una piattaforma lo chiede.',
  expCh: 'Automatico: mono se c’è solo la voce, stereo se ci sono musica o effetti. Un MP3 mono di sola voce pesa la metà e suona uguale.',
  expWhich: 'Quale voce mettere nel file: quella migliorata, se hai applicato i miglioramenti, oppure l’originale.',
  expNorm: 'Porta tutto il file al volume finale scelto. Lascialo attivo: così ogni capitolo ha lo stesso volume.',
  expTarget: 'Il volume del file finale in LUFS. -16 è il riferimento per pubblicare un podcast, -19 lascia più margine se il file andrà ancora mixato.',
  expCeil: 'Il punto più alto che il suono può raggiungere, misurato con precisione (true peak). -1 dBTP evita distorsioni quando le piattaforme convertono il file.',
  expSelOnly: 'Esporta solo il tratto selezionato, per esempio un capitolo alla volta da una registrazione lunga.',
  title: 'Il titolo dell’episodio o del capitolo. Diventa anche il nome del file.',
  artist: 'L’autore o la voce narrante.',
  album: 'Il nome del podcast, della serie o del libro.',
  year: 'L’anno di pubblicazione.',
  track: 'Il numero dell’episodio o del capitolo, per esempio 3 oppure 3/12.',
  comment: 'Una breve descrizione, che alcune app mostrano sotto il titolo.'
};
/* ========================= Una riga sotto ogni controllo ========================= */
// Dice a cosa serve, con il beneficio pratico e senza gergo; la lettera i accanto approfondisce.
const HINT = {
  micId: 'Quale microfono usare per registrare.',
  recWhere: 'Dove mettere la nuova voce nel montaggio.',
  xfadeMs: 'Unisce i pezzi tagliati senza clic.',
  silMin: 'Accorcia solo le pause più lunghe di così.',
  silMax: 'Quanto resta di ogni pausa: 0,6 s è un respiro.',
  nrMethod: 'Come togliere il rumore di fondo.',
  nrMix: 'Quanta pulizia usare. 100 % è il consigliato.',
  nrDb: 'Quanto rumore togliere: troppo suona metallico.',
  nrAlpha: 'Più alta toglie di più, ma indurisce la voce.',
  eco: 'Attenua il rimbombo della stanza.',
  humOn: 'Toglie il brusio della corrente elettrica.',
  humFreq: 'In Italia e in Europa è 50 Hz.',
  humHarm: 'Più armoniche togli, più ronzio sparisce.',
  humDb: 'Quanto abbassarlo: 30 dB basta quasi sempre.',
  humBw: 'Allargalo solo se un po’ di ronzio resta.',
  hp: 'Toglie colpi sul tavolo, vibrazioni e rombo.',
  plosOn: 'Ammorbidisce i colpi d’aria di p e b.',
  plosFreq: '150 Hz va bene quasi sempre.',
  plosSens: 'Più alta, trova anche i colpi leggeri.',
  plosMax: 'Quanto attenuare ogni colpo.',
  breathOn: 'Rende i respiri più discreti, senza toglierli.',
  breathDb: '6 dB li rende discreti, 12 quasi spariscono.',
  breathSens: 'Più alta, trova più respiri.',
  clickOn: 'Toglie gli schiocchi di lingua e saliva.',
  clickSens: 'Più alta, ripara più click.',
  lowMid: 'Meno rimbombo, voce più asciutta.',
  mud: 'Toglie l’effetto “voce chiusa in una scatola”.',
  lowShelf: 'Più corpo e calore, oppure meno.',
  presence: 'Rende le parole più chiare.',
  harsh: 'Ammorbidisce una voce dura o metallica.',
  air: 'Più brillantezza, oppure meno sibili.',
  deessOn: 'Interviene solo sulle “s”: il resto non cambia.',
  deessAmt: 'Quanto abbassare le “s”: da 4 a 8 dB è tipico.',
  deessThr: 'Più bassa, interviene su più “s”.',
  levOn: 'Avvicina le frasi dette piano a quelle forti.',
  levAmt: 'Quanto pareggiare: 50 % lascia la voce viva.',
  levMax: 'Correzione massima per ogni frase.',
  compOn: 'Riduce la differenza tra parti forti e deboli.',
  compRatio: 'Quanto uniformare: 2:1 è leggero, 4:1 deciso.',
  compThr: 'Più bassa, più parole vengono uniformate.',
  compAtk: 'Quanto in fretta interviene sui suoni forti.',
  compRel: 'Quanto in fretta la voce torna naturale.',
  gateOn: 'Silenzia il rumore quando non parli.',
  gateOver: 'Più alta, silenzia di più.',
  gateRed: 'Quanto abbassare le pause: 10-15 dB è naturale.',
  voiceRefined: 'Già pulita altrove? Qui si regola solo il volume.',
  voiceNorm: 'Tiene la voce sempre allo stesso volume.',
  target: 'Volume della voce: -19 se c’è la musica.',
  normEach: 'Stesso volume per pezzi registrati in giorni diversi.',
  musicAuto: 'Trova da solo il volume giusto della musica.',
  musicDb: 'Volume della musica quando non parli.',
  musicTarget: 'Più basso, musica più discreta.',
  intro: 'Musica da sola prima della voce.',
  tail: 'Musica dopo la fine della voce.',
  fadeIn: 'La musica entra piano, senza strappi.',
  fadeOut: 'La musica sfuma alla fine.',
  carve: 'Fa spazio alla voce: parole chiare sulla musica.',
  loop: 'Ricomincia da capo invece di fermarsi.',
  musicOffset: 'Salta l’inizio del brano.',
  duckOn: 'Abbassa la musica quando parli.',
  duckDepth: 'Quanto scende la musica mentre parli.',
  duckAtk: 'Quanto in fretta scende quando parli.',
  duckRel: 'Quanto in fretta risale nelle pause.',
  duckHold: 'Evita che salga e scenda a ogni respiro.',
  duckLook: 'Scende un attimo prima, per non coprire le sillabe.',
  vadMode: 'Come capisce quando stai parlando.',
  vadSens: 'Più alta, riconosce anche la voce più debole.',
  duckThrAuto: 'Lascialo attivo: la soglia si regola da sola.',
  duckThr: 'Sopra questo livello il suono conta come voce.',
  fxDb: 'Volume di tutti gli effetti insieme.',
  fxSnap: 'Gli effetti si fermano da soli sui bordi delle pause.',
  expFormat: 'MP3 per pubblicare, WAV per continuare a lavorare.',
  expKbps: 'Per il parlato basta 128, con la musica 192.',
  expBits: '24 bit se il file va ancora lavorato.',
  expCh: 'Automatico va bene quasi sempre.',
  expSr: '48 kHz di solito, 44,1 se una piattaforma lo chiede.',
  expWhich: 'Quale voce mettere nel file.',
  expNorm: 'Ogni file esce allo stesso volume.',
  expTarget: 'Volume del file: -16 è il riferimento dei podcast.',
  expCeil: 'Evita distorsioni quando le piattaforme convertono.',
  expSelOnly: 'Esporta solo il tratto selezionato.',
  title: 'Diventa anche il nome del file.',
  artist: 'Chi parla o chi firma il lavoro.',
  album: 'Il nome del podcast, della serie o del libro.',
  year: 'L’anno di pubblicazione.',
  track: 'Per esempio 3, oppure 3/12.',
  comment: 'Breve descrizione, mostrata da alcune app.'
};
let hintN = 0;
// la riga va sotto il nome (nelle caselle dentro l'etichetta) e il lettore di schermo la legge come descrizione del controllo
function addHint(row, text) {
  if (!text) return;
  const h = document.createElement(row.classList.contains('check') ? 'span' : 'p'); h.className = 'hint'; h.id = 'hint' + (++hintN); h.textContent = text;
  const ctl = row.querySelector('input,select,textarea');
  if (ctl) { const d = ctl.getAttribute('aria-describedby'); ctl.setAttribute('aria-describedby', (d ? d + ' ' : '') + h.id); }
  if (row.classList.contains('check')) { h.setAttribute('aria-hidden', 'true'); row.querySelector('.chk > span').appendChild(h); }
  else { const top = row.querySelector('.row-top'); top.after(h); }
}
const FMT = {};
function makeInfo(text, label) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'info-i'; b.textContent = 'i'; b.dataset.tip = text;
  b.setAttribute('aria-label', 'Informazioni: ' + label.replace(/<[^>]*>/g, '')); return b;
}
function attachInfo(row, key, label) { addHint(row, HINT[key]); const t = HELP[key]; if (!t) return; const host = row.querySelector('.lab'); if (host) host.appendChild(makeInfo(t, label)); }
const bodyOf = panel => $('.body', $('#' + panel));
function addSlider(panel, key, label, min, max, step, unit, dec, note, signed) {
  const row = document.createElement('div'); row.className = 'row'; row.dataset.row = key;
  row.innerHTML = '<div class="row-top"><span class="lab"><label for="p_' + key + '">' + label + '</label></span><output id="out_' + key + '" class="val" for="p_' + key + '" tabindex="0" role="button" aria-label="Scrivi il valore di ' + label.replace(/<[^>]*>/g, '') + '"></output></div>' +
    '<input id="p_' + key + '" data-p="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '">' + (note ? '<p class="note">' + note + '</p>' : '');
  attachInfo(row, key, label); bodyOf(panel).appendChild(row); FMT[key] = { unit, dec, signed: !!signed };
}
function addCheck(panel, key, label, note) {
  const row = document.createElement('div'); row.className = 'check'; row.dataset.row = key;
  row.innerHTML = '<label class="chk"><input type="checkbox" data-p="' + key + '"><span>' + label + (note ? '<span class="note" style="display:block">' + note + '</span>' : '') + '</span></label><span class="lab"></span>';
  attachInfo(row, key, label); bodyOf(panel).appendChild(row);
}
function addSelect(panel, key, label, options) {
  const row = document.createElement('div'); row.className = 'row'; row.dataset.row = key;
  row.innerHTML = '<div class="row-top"><span class="lab"><label for="p_' + key + '">' + label + '</label></span></div><select id="p_' + key + '" data-p="' + key + '">' + options.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select>';
  attachInfo(row, key, label); bodyOf(panel).appendChild(row);
}
function addMeta(panel, key, label, multi) {
  const row = document.createElement('div'); row.className = 'row'; row.dataset.row = 'm_' + key;
  row.innerHTML = '<div class="row-top"><span class="lab"><label for="m_' + key + '">' + label + '</label></span></div>' + (multi ? '<textarea id="m_' + key + '" data-m="' + key + '" maxlength="600"></textarea>' : '<input type="text" id="m_' + key + '" data-m="' + key + '" maxlength="200">');
  attachInfo(row, key, label); bodyOf(panel).appendChild(row);
}
function buildPanels() {
  addSelect('pRec', 'micId', 'Microfono', [['', 'Quello predefinito del sistema']]);
  addSelect('pRec', 'recWhere', 'Dove va la registrazione', [['end', 'In fondo'], ['cursor', 'Al cursore'], ['replace', 'Al posto della selezione'], ['all', 'Al posto di tutta la voce']]);
  addSlider('pRec', 'xfadeMs', 'Dissolvenza sui tagli', 2, 50, 1, ' ms', 0);
  addSlider('pSil', 'silMin', 'Pausa minima da accorciare', 0.5, 5, 0.1, ' s', 1);
  addSlider('pSil', 'silMax', 'Durata da lasciare', 0.2, 3, 0.1, ' s', 1);
  addSelect('pNR', 'nrMethod', 'Metodo', [['ia', 'Intelligenza artificiale (RNNoise)'], ['classica', 'Classico con profilo del rumore'], ['nessuna', 'Nessuna pulizia']]);
  addSlider('pNR', 'nrMix', 'Quanto pulire', 0, 100, 5, ' %', 0);
  addSlider('pNR', 'nrDb', 'Quanto rumore togliere', 6, 30, 1, ' dB', 0);
  addSlider('pNR', 'nrAlpha', 'Aggressività', 1, 3.5, 0.1, '', 1);
  addSlider('pNR', 'eco', 'Riduci l’eco della stanza', 0, 1, 0.1, '', 1);
  addCheck('pNR', 'humOn', 'Togli il ronzio elettrico');
  addSelect('pNR', 'humFreq', 'Frequenza della rete', [[50, '50 Hz (Europa)'], [60, '60 Hz (America)']]);
  addSlider('pNR', 'humHarm', 'Armoniche da togliere', 1, 4, 1, '', 0);
  addSlider('pNR', 'humDb', 'Quanto abbassare il ronzio', 10, 40, 1, ' dB', 0);
  addSlider('pNR', 'humBw', 'Larghezza del filtro', 1, 5, 0.5, ' Hz', 1);
  const hb = document.createElement('div'); hb.className = 'btnrow'; hb.innerHTML = '<button class="btn" id="btnHum" disabled>Rileva il ronzio</button>';
  const hs = document.createElement('p'); hs.className = 'status'; hs.id = 'humStatus'; hs.setAttribute('role', 'status');
  bodyOf('pNR').append(hb, hs);
  addSlider('pTone', 'hp', 'Taglio dei bassi', 20, 200, 1, ' Hz', 0);
  addCheck('pTone', 'plosOn', 'Attenua le p e le b esplosive');
  addSlider('pTone', 'plosFreq', 'Frequenza dei colpi', 80, 250, 5, ' Hz', 0);
  addSlider('pTone', 'plosSens', 'Sensibilità ai colpi', 0, 100, 5, ' %', 0);
  addSlider('pTone', 'plosMax', 'Riduzione massima dei colpi', 3, 24, 1, ' dB', 0);
  addCheck('pMouth', 'breathOn', 'Abbassa i respiri');
  addSlider('pMouth', 'breathDb', 'Quanto abbassare i respiri', 0, 12, 1, ' dB', 0);
  addSlider('pMouth', 'breathSens', 'Sensibilità ai respiri', 0, 100, 5, ' %', 0);
  addCheck('pMouth', 'clickOn', 'Ripara i click di bocca');
  addSlider('pMouth', 'clickSens', 'Sensibilità ai click', 0, 100, 5, ' %', 0);
  addSlider('pTone', 'lowMid', 'Rimbombo (220 Hz)', -9, 3, 0.5, ' dB', 1, '', true);
  addSlider('pTone', 'mud', 'Scatolosità (380 Hz)', -6, 3, 0.5, ' dB', 1, '', true);
  addSlider('pTone', 'lowShelf', 'Corpo (140 Hz)', -6, 6, 0.5, ' dB', 1, '', true);
  addSlider('pTone', 'presence', 'Presenza (3 kHz)', -6, 8, 0.5, ' dB', 1, '', true);
  addSlider('pTone', 'harsh', 'Attenua il metallico (6,5 kHz)', -8, 2, 0.5, ' dB', 1, '', true);
  addSlider('pTone', 'air', 'Aria (9 kHz)', -6, 6, 0.5, ' dB', 1, '', true);
  addCheck('pDeess', 'deessOn', 'De-esser');
  addSlider('pDeess', 'deessAmt', 'Riduzione massima', 2, 12, 0.5, ' dB', 1);
  addSlider('pDeess', 'deessThr', 'Sensibilità', 12, 30, 1, ' dB', 0);
  addCheck('pDyn', 'levOn', 'Livellatore');
  addSlider('pDyn', 'levAmt', 'Quanto pareggiare', 0, 100, 5, ' %', 0);
  addSlider('pDyn', 'levMax', 'Correzione massima', 2, 12, 0.5, ' dB', 1);
  addCheck('pDyn', 'compOn', 'Compressore');
  addSlider('pDyn', 'compRatio', 'Rapporto di compressione', 1, 10, 0.5, ':1', 1);
  addSlider('pDyn', 'compThr', 'Soglia del compressore', -50, -5, 1, ' dB', 0);
  addSlider('pDyn', 'compAtk', 'Attacco', 1, 100, 1, ' ms', 0);
  addSlider('pDyn', 'compRel', 'Rilascio', 50, 800, 10, ' ms', 0);
  addCheck('pDyn', 'gateOn', 'Gate');
  addSlider('pDyn', 'gateOver', 'Soglia del gate sopra il rumore', 3, 25, 1, ' dB', 0);
  addSlider('pDyn', 'gateRed', 'Riduzione del gate', 3, 40, 1, ' dB', 0);
  addCheck('pLevel', 'voiceRefined', 'La voce è già stata rifinita');
  addCheck('pImport', 'voiceRefined', 'La voce è già stata rifinita');
  addCheck('pLevel', 'voiceNorm', 'Normalizza la voce (LUFS)');
  addSlider('pLevel', 'target', 'Obiettivo di volume', -24, -14, 0.5, ' LUFS', 1);
  addCheck('pLevel', 'normEach', 'Pareggia le registrazioni');
  addCheck('pMusic', 'musicAuto', 'Volume automatico della musica');
  addSlider('pMusic', 'musicDb', 'Volume della musica', -30, 12, 0.5, ' dB', 1, '', true);
  addSlider('pMusic', 'musicTarget', 'Obiettivo del volume automatico', -32, -14, 0.5, ' LUFS', 1);
  addSlider('pMusic', 'intro', 'Intro musicale', 0, 60, 0.5, ' s', 1);
  addSlider('pMusic', 'tail', 'Coda musicale', 0, 60, 0.5, ' s', 1);
  addSlider('pMusic', 'fadeIn', 'Dissolvenza in entrata', 0, 15, 0.5, ' s', 1);
  addSlider('pMusic', 'fadeOut', 'Dissolvenza in uscita', 0, 20, 0.5, ' s', 1);
  addSlider('pMusic', 'carve', 'Spazio per la voce', 0, 8, 0.5, ' dB', 1);
  addCheck('pMusic', 'loop', 'Ripeti la musica se è più corta del mix');
  addSlider('pMusic', 'musicOffset', 'Parti dal secondo', 0, 600, 0.5, ' s', 1);
  addCheck('pDuck', 'duckOn', 'Ducking');
  addSlider('pDuck', 'duckDepth', 'Abbassamento della musica', -36, -3, 0.5, ' dB', 1, '', true);
  addSlider('pDuck', 'duckAtk', 'Rapidità di discesa', 10, 600, 5, ' ms', 0);
  addSlider('pDuck', 'duckRel', 'Rapidità di risalita', 100, 3000, 50, ' ms', 0);
  addSlider('pDuck', 'duckHold', 'Tenuta tra le parole', 0, 1500, 10, ' ms', 0);
  addSlider('pDuck', 'duckLook', 'Anticipo', 0, 500, 10, ' ms', 0);
  addSelect('pDuck', 'vadMode', 'Come riconosce la voce', [['level', 'Dal livello'], ['ai', 'Intelligente (RNNoise)']]);
  addSlider('pDuck', 'vadSens', 'Sensibilità del riconoscimento', 10, 90, 5, ' %', 0);
  addCheck('pDuck', 'duckThrAuto', 'Soglia della voce automatica');
  addSlider('pDuck', 'duckThr', 'Soglia della voce', -70, -15, 1, ' dB', 0);
  const fxBody = document.createElement('div'); fxBody.className = 'body'; $('#pFx').insertBefore(fxBody, $('#fxList'));
  addSlider('pFx', 'fxDb', 'Volume degli effetti', -24, 12, 0.5, ' dB', 1, '', true);
  addCheck('pFx', 'fxSnap', 'Aggancia alle pause della voce');
  addSelect('pExport', 'expFormat', 'Formato', [['mp3', 'MP3, per pubblicare'], ['wav', 'WAV, senza perdita']]);
  addSelect('pExport', 'expKbps', 'Qualità dell’MP3', [[128, '128 kbps'], [192, '192 kbps'], [256, '256 kbps'], [320, '320 kbps']]);
  addSelect('pExport', 'expBits', 'Profondità del WAV', [[24, '24 bit (consigliato per proseguire)'], [16, '16 bit (con dither)']]);
  addSelect('pExport', 'expCh', 'Canali', [['auto', 'Automatico'], ['mono', 'Mono'], ['stereo', 'Stereo']]);
  addSelect('pExport', 'expSr', 'Frequenza di campionamento', [[48000, '48 kHz'], [44100, '44,1 kHz']]);
  addSelect('pExport', 'expWhich', 'Voce da usare', [['proc', 'Migliorata, se applicata'], ['orig', 'Originale']]);
  addCheck('pExport', 'expNorm', 'Porta il file al volume finale');
  addSlider('pExport', 'expTarget', 'Volume finale', -24, -12, 0.5, ' LUFS', 1);
  addSlider('pExport', 'expCeil', 'Tetto dei picchi (true peak)', -3, -0.5, 0.1, ' dBTP', 1, '', true);
  addCheck('pExport', 'expSelOnly', 'Solo la selezione');
  addMeta('pMeta', 'title', 'Titolo'); addMeta('pMeta', 'artist', 'Autore'); addMeta('pMeta', 'album', 'Podcast, serie o libro');
  addMeta('pMeta', 'year', 'Anno'); addMeta('pMeta', 'track', 'Numero dell’episodio'); addMeta('pMeta', 'comment', 'Descrizione', true);
}
const ADV_KEYS = ['xfadeMs', 'nrDb', 'nrAlpha', 'humFreq', 'humHarm', 'humDb', 'humBw', 'plosFreq', 'plosSens', 'plosMax', 'breathDb', 'breathSens', 'clickSens', 'levAmt', 'levMax', 'silMin', 'silMax', 'mud', 'lowShelf', 'air', 'deessThr', 'compThr', 'compAtk', 'compRel', 'gateOver', 'gateRed', 'musicTarget', 'carve', 'musicOffset', 'duckAtk', 'duckRel', 'duckHold', 'duckLook', 'vadSens', 'duckThrAuto', 'duckThr', 'expSr', 'expWhich', 'expCeil', 'expCh'];
function markAdvanced() { ADV_KEYS.forEach(k => { const r = $('[data-row="' + k + '"]'); if (r) r.classList.add('adv'); }); }
function updateVis() {
  const vis = (k, on) => { const r = $('[data-row="' + k + '"]'); if (r) r.classList.toggle('hid', !on); };
  vis('nrMix', P.nrMethod === 'ia'); vis('nrDb', P.nrMethod === 'classica'); vis('nrAlpha', P.nrMethod === 'classica');
  vis('expKbps', P.expFormat === 'mp3'); vis('expBits', P.expFormat === 'wav'); vis('expTarget', P.expNorm);
  ['humFreq', 'humHarm', 'humDb', 'humBw'].forEach(k => vis(k, P.humOn));
  ['plosFreq', 'plosSens', 'plosMax'].forEach(k => vis(k, P.plosOn));
  ['breathDb', 'breathSens'].forEach(k => vis(k, P.breathOn)); vis('clickSens', P.clickOn);
  ['levAmt', 'levMax'].forEach(k => vis(k, P.levOn));
  const ai = P.vadMode === 'ai'; vis('vadSens', ai); vis('duckThrAuto', !ai); vis('duckThr', !ai && !P.duckThrAuto); vis('musicDb', true);
}
function fmtVal(key) { const f = FMT[key]; if (!f) return ''; const v = +P[key]; return (f.signed && v > 0 ? '+' : '') + fmtNum(v, f.dec) + f.unit; }
function syncKey(key) {
  $$('[data-p="' + key + '"]').forEach(el => {
    if (el.type === 'checkbox') el.checked = !!P[key];
    else if (el.tagName === 'SELECT' && !Array.from(el.options).some(o => o.value === String(P[key]))) { /* opzione non disponibile: resta la prima */ }
    else el.value = P[key];
    if (el.type === 'range') sliderFill(el);
  });
  const o = $('#out_' + key); if (o && !o.querySelector('input')) o.textContent = fmtVal(key);
}
// parte riempita del cursore, fino al pallino
function sliderFill(el) { const mn = +el.min, mx = +el.max, v = +el.value; el.style.setProperty('--fill', ((v - mn) / (mx - mn || 1) * 100).toFixed(2) + '%'); }
// un clic sul valore lo rende modificabile a mano; Invio conferma, Esc annulla
function editValue(o) {
  const key = o.id.slice(4), el = $('#p_' + key), f = FMT[key]; if (!el || o.querySelector('input')) return;
  const inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.className = 'val-edit';
  inp.value = fmtNum(P[key], f.dec); inp.setAttribute('aria-label', o.getAttribute('aria-label'));
  o.textContent = ''; o.appendChild(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok => {
    if (done) return; done = true;
    if (ok) {
      const v = parseFloat(inp.value.replace(',', '.').replace(/[^\d.+-]/g, ''));
      if (isFinite(v)) { const st = +el.step || 1, mn = +el.min, mx = +el.max; P[key] = clamp(Math.round((v - mn) / st) * st + mn, mn, mx); P[key] = +P[key].toFixed(6); }
    }
    o.textContent = ''; syncKey(key); if (ok) onParam(key); o.focus();
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
}
function syncAll() {
  Object.keys(P).forEach(syncKey);
  $$('[data-m]').forEach(el => { el.value = META[el.dataset.m] || ''; });
  $('#vzoom').value = String(P.vzoom); $$('[data-spec]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.spec === P.specView))); scheduleSpec(); updateVis(); updateStyleCards(); updateRefinedUI();
}
// con la voce già rifinita si nascondono stili e pannelli della catena
function updateRefinedUI() {
  const on = !!P.voiceRefined;
  ['#voiceStyles', '#pane-improve .applybar', '#pNR', '#pTone', '#pDeess', '#pMouth', '#pDyn'].forEach(sel => { const el = $(sel); if (el) el.hidden = on; });
  $('#assist').classList.toggle('refined', on);   // voce già rifinita: niente analisi da proporre
  const b = $('#btnBlind'); if (b && on) b.disabled = true;
}
const MUSIC_KEYS = new Set(['musicDb', 'carve', 'loop', 'musicOffset', 'fadeIn', 'fadeOut', 'intro', 'tail', 'duckOn', 'duckThrAuto', 'duckThr', 'duckDepth', 'duckAtk', 'duckRel', 'duckHold', 'duckLook', 'fxDb', 'vadMode', 'vadSens']);
function onParam(key) {
  if (IMPROVE_KEYS.includes(key) || /^(vad|hum|plos|breath|click|lev)/.test(key)) updateApplyStatus();
  if (key === 'vadMode' && P.vadMode === 'ai') ensureVad();
  if (key === 'voiceRefined') {
    if (P.voiceRefined) { S.procActive = false; S.mode = 'orig'; BL.on = false; }
    restartIfPlaying(); drawAll(); updateTransport(); updateApplyStatus(); updateLevelStatus(); updateRefinedUI(); scheduleDiag();
    toast(P.voiceRefined ? 'Voce già rifinita: niente catena di miglioramento, solo la normalizzazione del volume.' : 'Catena di miglioramento di nuovo disponibile: premi “Applica i miglioramenti”.');
  }
  if (key === 'target' || key === 'voiceNorm' || key === 'normEach') { restartIfPlaying(); drawAll(); scheduleDiag(); updateLevelStatus(); }
  if (key === 'silMin' || key === 'silMax') { const b = $('#btnSilApply'); if (b) b.disabled = true; }
  if (key === 'match') { restartIfPlaying(); drawBase(); }
  if (key === 'expSelOnly' || key === 'expWhich') updateExportWarn();
  if (key === 'xfadeMs') { S.version++; drawBase(); restartIfPlaying(); }
  if (MUSIC_KEYS.has(key)) { if (key === 'intro' || key === 'tail') { S.fit = true; drawAll(); } else drawBase(); restartIfPlaying(); }
  if (key === 'carve') updateCarve().then(restartIfPlaying);
  if ((key === 'musicTarget' || key === 'musicAuto') && P.musicAuto && S.musicId) { autoMusic(); drawBase(); restartIfPlaying(); }
  if (key === 'musicDb' && P.musicAuto) { P.musicAuto = false; syncKey('musicAuto'); }
  if (key === 'micId' && S.monitoring) { closeMic(); S.monitoring = false; toggleMonitor(); }
  updateVis(); updateStyleCards(); scheduleSave();
}
function bindControls() {
  $$('[data-p]').forEach(el => {
    const key = el.dataset.p;
    el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
      if (el.type === 'checkbox') P[key] = el.checked;
      else if (el.type === 'range') P[key] = parseFloat(el.value);
      else P[key] = (typeof P[key] === 'number') ? +el.value : el.value;
      syncKey(key); onParam(key);
    });
    if (el.type === 'range') {
      // doppio clic (o doppio tocco) sul cursore: torna al valore predefinito
      el.addEventListener('dblclick', () => { if (DEFAULTS && key in DEFAULTS) { P[key] = DEFAULTS[key]; syncKey(key); onParam(key); toast('Valore predefinito: ' + fmtVal(key) + '.'); } });
    }
  });
  $$('output.val').forEach(o => {
    o.addEventListener('click', () => editValue(o));
    o.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editValue(o); } });
  });
  $$('[data-m]').forEach(el => el.addEventListener('input', () => { META[el.dataset.m] = el.value; scheduleSave(); }));
  $('#vzoom').addEventListener('change', e => { P.vzoom = +e.target.value; drawAll(); scheduleSave(); });
}

/* ========================= Stili pronti ========================= */
const VOICE_STYLES = [
  { id: 'narrazione', name: 'Narrazione', desc: 'Voce piena e chiara per storie e racconti. Toglie il rimbombo e aggiunge presenza senza durezza.',
    v: { nrMix: 100, eco: 0.4, hp: 100, lowMid: -4.5, mud: -1.5, lowShelf: 0, presence: 1, harsh: -2, air: 0, deessAmt: 6, compThr: -22, compRatio: 2.5, compAtk: 10, compRel: 150, plosOn: true } },
  { id: 'calda', name: 'Voce calda', desc: 'Più corpo e meno aria: timbro morbido e avvolgente, con compressione leggera.',
    v: { nrMix: 100, eco: 0.3, hp: 80, lowMid: -2, mud: -1, lowShelf: 2, presence: 0, harsh: -2.5, air: -1.5, deessAmt: 7, compThr: -24, compRatio: 2, compAtk: 15, compRel: 200, plosOn: true } },
  { id: 'chiara', name: 'Parlato chiaro', desc: 'Per lezioni e spiegazioni: parole ben scandite, più presenza e compressione decisa.',
    v: { nrMix: 100, eco: 0.6, hp: 110, lowMid: -5, mud: -2.5, lowShelf: -1, presence: 2.5, harsh: -3, air: 0.5, deessAmt: 6, compThr: -20, compRatio: 3, compAtk: 8, compRel: 120 } },
  { id: 'podcast', name: 'Podcast', desc: 'Naturale e chiara, per il parlato conversazionale: presenza moderata e compressione media.',
    v: { nrMix: 100, eco: 0.5, hp: 90, lowMid: -3.5, mud: -2, lowShelf: 0.5, presence: 2, harsh: -2, air: 0.5, deessAmt: 6, compThr: -22, compRatio: 3, compAtk: 10, compRel: 150 } },
  { id: 'radio', name: 'Radiofonica', desc: 'Voce piena, vicina e decisa: più corpo e presenza, compressione marcata. Rende meglio su una registrazione già pulita.',
    v: { nrMix: 100, eco: 0.6, hp: 100, lowMid: -3, mud: -2, lowShelf: 2, presence: 3, harsh: -2.5, air: 1.5, deessAmt: 7, compThr: -26, compRatio: 4, compAtk: 5, compRel: 100 } }
];
const MUSIC_STYLES = [
  { id: 'minimo', name: 'Sottofondo minimo', desc: 'Quasi impercettibile: dà atmosfera senza distrarre.', v: { musicTarget: -28, carve: 5 } },
  { id: 'discreto', name: 'Sottofondo discreto', desc: 'Il tappeto classico: si sente, ma resta ben sotto la voce.', v: { musicTarget: -24, carve: 4 } },
  { id: 'presente', name: 'Presente, cinematografico', desc: 'Musica più viva, per i momenti di pathos.', v: { musicTarget: -21, carve: 3 } }
];
const DUCK_REACT = [
  { id: 'lenta', name: 'Lenta', desc: 'Transizioni fluide e cinematografiche. Consigliata per narrazione e racconti.', v: { duckAtk: 200, duckRel: 1400, duckHold: 500, duckLook: 200, duckDepth: -12 } },
  { id: 'media', name: 'Media', desc: 'Risposta equilibrata, adatta alla maggior parte dei podcast.', v: { duckAtk: 150, duckRel: 1000, duckHold: 450, duckLook: 150, duckDepth: -12 } },
  { id: 'veloce', name: 'Veloce', desc: 'La musica scende e risale in fretta. Per ritmo serrato o interviste.', v: { duckAtk: 60, duckRel: 500, duckHold: 250, duckLook: 80, duckDepth: -12 } },
  { id: 'custom', name: 'Personalizzata', desc: 'I tuoi valori: regolali con i cursori qui sotto.', v: null }
];
const STYLE_SETS = [['#voiceStyles', 'voice', VOICE_STYLES, 'Stile della voce', 'Scegli uno stile e premi Applica. Poi rifinisci con i cursori.', '--voice', 'Se la voce suona metallica, abbassa “Attenua il metallico”. Se rimbomba, alza “Riduci l’eco della stanza”.'],
  ['#musicStyles', 'music', MUSIC_STYLES, 'Livello della musica', 'Se copre le parole, scegli un’opzione più bassa.', '--music', 'Il volume si ricalcola da solo sul brano, in LUFS.'],
  ['#duckReact', 'react', DUCK_REACT, 'Reazione della musica', 'Quanto in fretta la musica scende e risale.', '--duck']];
function buildStyles() {
  STYLE_SETS.forEach(([sel, kind, list, title, hint, col, tip]) => {
    const box = $(sel); box.innerHTML = '<h2 class="styles-h"></h2><p class="styles-d"></p><div class="style-grid" role="group"></div>';
    $('.styles-h', box).textContent = title; $('.styles-d', box).textContent = hint; $('.style-grid', box).setAttribute('aria-label', title);
    if (tip) $('.styles-h', box).appendChild(makeInfo(tip, title));
    list.forEach(st => {
      const b = document.createElement('button'); b.className = 'style'; b.dataset.style = st.id; b.setAttribute('aria-pressed', 'false'); b.style.setProperty('--c', 'var(' + col + ')');
      const t = document.createElement('b'); t.textContent = st.name; const d = document.createElement('span'); d.textContent = st.desc;
      b.append(t, d); b.addEventListener('click', () => applyStyle(kind, st)); $('.style-grid', box).appendChild(b);
    });
  });
}
// Schema del ducking: due frasi su 6 secondi con una pausa breve. È un'illustrazione del comportamento, non l'anteprima esatta.
// Modello: la musica è abbassata se c'è una frase tra inizio meno anticipo e fine più tenuta; discesa e risalita sono rampe lineari.
const DUCK_PHRASES = [[0.7, 2.6], [3.1, 5.3]];
function drawDuckViz() {
  const svg = $('#duckViz'); if (!svg) return;
  const W = 380, H = 124, top = 10, bot = 74, X = t => 28 + t / 6 * (W - 36), depth = Math.abs(P.duckDepth), maxDb = 24;
  const Y = db => top + (bot - top) * clamp(-db / maxDb, 0, 1);
  let bars = '';
  for (const [a, b] of DUCK_PHRASES) for (let t = a; t < b - 0.04; t += 0.075) {
    const h = 6 + 22 * Math.abs(Math.sin(t * 7.3) * Math.cos(t * 2.1));
    bars += '<rect x="' + X(t).toFixed(1) + '" y="' + (104 - h).toFixed(1) + '" width="3" height="' + h.toFixed(1) + '" rx="1.5" style="fill:var(--accent);opacity:.9"/>';
  }
  const look = P.duckLook / 1000, hold = P.duckHold / 1000, atk = Math.max(0.01, P.duckAtk / 1000), rel = Math.max(0.01, P.duckRel / 1000);
  let cur = 0, pts = [];
  for (let t = 0; t <= 6.0001; t += 0.01) {
    const down = DUCK_PHRASES.some(([a, b]) => t >= a - look && t <= b + hold);
    const tgt = P.duckOn && down ? -depth : 0;
    if (tgt < cur) cur = Math.max(tgt, cur - depth * 0.01 / atk); else if (tgt > cur) cur = Math.min(tgt, cur + depth * 0.01 / rel);
    pts.push(X(t).toFixed(1) + ',' + Y(cur).toFixed(1));
  }
  svg.innerHTML = '<line x1="28" x2="' + (W - 8) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" style="stroke:var(--line);stroke-width:1"/>' +
    '<line x1="28" x2="' + (W - 8) + '" y1="' + Y(-depth) + '" y2="' + Y(-depth) + '" style="stroke:var(--line);stroke-width:1;stroke-dasharray:2 4"/>' +
    '<text x="22" y="' + (Y(0) + 4) + '" text-anchor="end" style="font:11px var(--f-mono);fill:var(--muted)">0</text>' +
    '<text x="22" y="' + (Y(-depth) + 4) + '" text-anchor="end" style="font:11px var(--f-mono);fill:var(--muted)">-' + fmtNum(depth, 0) + '</text>' +
    bars + '<polyline points="' + pts.join(' ') + '" style="fill:none;stroke:var(--duck);stroke-width:1.6;stroke-linejoin:round"/>' +
    [0, 2, 4, 6].map(t => '<text x="' + X(t) + '" y="' + (H - 2) + '" text-anchor="middle" style="font:11px var(--f-mono);fill:var(--muted)">' + t + ' s</text>').join('');
}
function updateStyleCards() {
  STYLE_SETS.forEach(([sel, , list]) => {
    let any = false;
    $$(sel + ' .style').forEach(b => { const st = list.find(x => x.id === b.dataset.style); if (!st.v) return; const on = Object.keys(st.v).every(k => P[k] === st.v[k]); any = any || on; b.setAttribute('aria-pressed', String(on)); });
    // "Personalizzata" si accende da sola quando i valori non corrispondono a nessun preset
    const cu = $(sel + ' .style[data-style="custom"]'); if (cu) cu.setAttribute('aria-pressed', String(!any));
  });
  drawDuckViz();
}
function applyStyle(kind, st) {
  if (!st.v) { setLevel('adv'); const r = $('[data-row="duckAtk"] input'); if (r) { r.scrollIntoView({ block: 'center' }); r.focus(); } return; }
  Object.keys(st.v).forEach(k => { P[k] = st.v[k]; }); syncAll();
  if (kind === 'voice') { updateApplyStatus(); toast('Stile “' + st.name + '” scelto.' + (S.vlen ? ' Premi “Applica i miglioramenti”.' : '')); }
  else { if (kind === 'music' && S.musicId && P.musicAuto) autoMusic(); updateCarve(); drawBase(); restartIfPlaying(); toast('“' + st.name + '” applicato.'); }
  scheduleSave();
}

/* ========================= Preset ========================= */
let DEFAULTS = null;
const PKEY = 'sottovoce-studio.preset.v1', PSKIP = new Set(['micId', 'vzoom', 'match', 'specView']);
function readPresets() { try { return JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch { return {}; } }
function writePresets(o) { try { localStorage.setItem(PKEY, JSON.stringify(o)); return true; } catch { return false; } }
function snapshotParams() { const o = {}; Object.keys(P).forEach(k => { if (!PSKIP.has(k)) o[k] = P[k]; }); return o; }
// valori predefiniti delle impostazioni che un preset o un progetto vecchio non contiene
function missingDefaults(o) { const out = {}; if (!DEFAULTS) return out; Object.keys(DEFAULTS).forEach(k => { if (!PSKIP.has(k) && !(o && k in o)) out[k] = DEFAULTS[k]; }); return out; }
function sanitize(o) { const out = {}; if (!o || typeof o !== 'object') return out; Object.keys(o).forEach(k => { if (k in P && !PSKIP.has(k) && typeof o[k] === typeof P[k]) out[k] = o[k]; }); return out; }
function applyPreset(o) {
  Object.assign(P, missingDefaults(o), sanitize(o)); syncAll(); updateApplyStatus(); updateCarve(); if (S.musicId && P.musicAuto) autoMusic(); drawAll(); restartIfPlaying(); scheduleSave();
}
function fillPresetSel(sel) {
  const el = $('#presetSel'), cur = sel != null ? sel : el.value; el.innerHTML = '';
  const o0 = document.createElement('option'); o0.value = '__default__'; o0.textContent = 'Predefinito'; el.appendChild(o0);
  Object.keys(readPresets()).sort((a, b) => a.localeCompare(b, 'it')).forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; el.appendChild(o); });
  el.value = Array.from(el.options).some(o => o.value === cur) ? cur : '__default__';
}
function buildPresetUI() {
  const body = bodyOf('pPreset');
  body.innerHTML = '<div class="row"><div class="row-top"><label for="presetSel">Preset</label></div><select id="presetSel"></select></div>' +
    '<div class="row"><div class="row-top"><label for="presetName">Salva le impostazioni attuali con il nome</label></div><input id="presetName" type="text" maxlength="40" placeholder="Per esempio: Capitoli del libro"></div>' +
    '<div class="btnrow"><button class="btn" id="presetSave">Salva</button><button class="btn" id="presetLoad">Usa il preset scelto</button><button class="btn" id="presetDel">Elimina il preset scelto</button></div>' +
    '<div class="btnrow"><button class="btn" id="presetExport">Salva i preset su file</button><button class="btn" id="presetImport">Carica i preset da file</button></div>' +
    '<input class="vh" type="file" id="presetFile" accept=".json,application/json" tabindex="-1" aria-hidden="true"><p class="status" id="presetStatus" role="status"></p>';
  const [rSel, rName] = body.querySelectorAll('.row'); addHint(rSel, 'Un insieme di regolazioni salvate, da riusare.'); addHint(rName, 'Per ritrovare le stesse regolazioni la prossima volta.');
  fillPresetSel('__default__');
  $('#presetLoad').addEventListener('click', () => {
    const n = $('#presetSel').value;
    if (n === '__default__') { applyPreset(DEFAULTS); toast('Impostazioni predefinite ripristinate.'); return; }
    const o = readPresets()[n]; if (o) { applyPreset(o); toast('Preset “' + n + '” applicato.' + (S.procActive ? ' Premi “Applica i miglioramenti” per sentirlo sulla voce.' : '')); }
  });
  $('#presetSave').addEventListener('click', () => {
    const inp = $('#presetName'), name = inp.value.trim();
    if (!name) { toast('Scrivi un nome per il preset.'); inp.focus(); return; }
    const all = readPresets(); all[name] = snapshotParams();
    if (!writePresets(all)) { toast('Il browser non permette di salvare i preset: usa “Salva i preset su file”.'); return; }
    fillPresetSel(name); inp.value = ''; toast('Preset “' + name + '” salvato.');
  });
  $('#presetDel').addEventListener('click', () => {
    const name = $('#presetSel').value;
    if (name === '__default__') { toast('Il preset predefinito non si può eliminare.'); return; }
    if (!confirm('Eliminare il preset “' + name + '”?')) return;
    const all = readPresets(); delete all[name]; writePresets(all); fillPresetSel('__default__'); toast('Preset eliminato.');
  });
  $('#presetExport').addEventListener('click', () => {
    const all = readPresets(); if (!Object.keys(all).length) all['Impostazioni attuali'] = snapshotParams();
    downloadBlob(APP_SLUG + '-preset.json', new Blob([JSON.stringify({ app: 'sottovoce-studio', version: 1, presets: all }, null, 2)], { type: 'application/json' }));
    $('#presetStatus').textContent = 'Preset salvati nel file ' + APP_SLUG + '-preset.json.';
  });
  $('#presetImport').addEventListener('click', () => $('#presetFile').click());
  $('#presetFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text()), src = d && d.presets; if (!src || typeof src !== 'object') throw 0;
      const all = readPresets(); let n = 0;
      Object.keys(src).forEach(name => { const c = sanitize(src[name]); if (Object.keys(c).length && String(name).trim()) { all[String(name).trim().slice(0, 40)] = c; n++; } });
      if (!n || !writePresets(all)) throw 0;
      fillPresetSel(); $('#presetStatus').textContent = n === 1 ? 'Caricato 1 preset dal file.' : 'Caricati ' + n + ' preset dal file.';
    } catch { $('#presetStatus').textContent = 'Questo file non contiene preset di ' + APP_NAME + '.'; }
  });
  try { localStorage.setItem('sottovoce-studio.t', '1'); localStorage.removeItem('sottovoce-studio.t'); } catch { $('#presetStatus').textContent = 'Il browser non permette di salvare i preset qui: resta disponibile il salvataggio su file.'; }
}

/* ========================= Stato dei pulsanti e informazioni ========================= */
function updateLevelStatus() {
  const el = $('#levelStatus'); if (!el) return;
  if (!S.vlen) { el.textContent = 'Registra o importa la voce per vedere il volume.'; return; }
  const which = S.procActive && S.mode === 'proc' ? 'proc' : 'orig';
  // volume reale, senza il pareggio tra registrazioni
  const each = P.normEach; P.normEach = false; const raw = lufs(renderVoice(0, S.vlen, which === 'proc'), true); P.normEach = each;
  if (raw <= -90) { el.textContent = 'La voce è troppo bassa o silenziosa per misurarla: il volume non viene cambiato.'; return; }
  const g = P.voiceNorm ? P.target - raw : 0;
  let t = 'La voce ' + (which === 'proc' ? 'migliorata' : 'originale') + ' misura ' + fmtNum(raw, 1) + ' LUFS';
  t += P.voiceNorm ? ': per arrivare a ' + fmtNum(P.target, 1) + ' LUFS il volume ' + (g >= 0 ? 'si alza' : 'si abbassa') + ' in media di ' + fmtNum(Math.abs(g), 1) + ' dB.' : '. Normalizzazione spenta: resta com’è.';
  const used = [...new Set(S.segs.filter(x => x.src).map(x => x.src))].map(id => S.sources.get(id)).filter(Boolean);
  if (used.length > 1) t += ' Registrazioni: ' + used.map(s => s.name + ' ' + fmtNum(lufs(s.chs[0], true), 1) + ' LUFS').join(', ') + (P.normEach ? ', pareggiate tra loro.' : ', non pareggiate.');
  el.textContent = t;
}
function updateButtons() {
  const has = S.vlen > 0, r = selVoice(), lay = layout();
  $('#tUndo').disabled = !S.ops.length; $('#tRedo').disabled = !S.redo.length;
  ['#tCut', '#tCopy', '#tDel', '#tSil', '#tFadeIn', '#tFadeOut'].forEach(s => { $(s).disabled = !r; });
  $('#tPaste').disabled = !(S.clip && S.clip.length); $('#tAll').disabled = !has; $('#tNone').disabled = !S.sel;
  ['#zOut', '#zIn', '#zFit'].forEach(s => { $(s).disabled = !lay.total; }); $('#zSel').disabled = !S.sel;
  $('#btnExport').disabled = !lay.total; $('#btnStems').disabled = !lay.total; $('#btnSaveProj').disabled = !(S.ops.length || S.musicId);
  $('#btnMusicRemove').disabled = !S.musicId; $('#btnClearHist').disabled = S.ops.length + S.redo.length < 2 || S.recording || (!S.redo.length && S.ops.every(o => o.collapsed)); $('#btnReplaceVoice').disabled = !S.vlen;
  if ($('#tUndo').disabled) $('#tUndo').title = ''; else $('#tUndo').title = 'Annulla: ' + S.ops[S.ops.length - 1].label;
  if (!$('#tRedo').disabled) $('#tRedo').title = 'Ripeti: ' + S.redo[S.redo.length - 1].label; else $('#tRedo').title = '';
  updateEditBar(); updateExportWarn();
}
function updateTransport() {
  const lay = layout(), has = lay.total > 0;
  $('#btnPlay').disabled = !has || S.recording; ['#btnHome', '#btnBack', '#btnFwd', '#btnEnd'].forEach(s => { $(s).disabled = !has || S.recording; });
  $('#playLabel').textContent = S.playing ? 'Pausa' : 'Riproduci'; $('#btnPlay').classList.toggle('is-playing', S.playing);
  $('#recLabel').textContent = S.recording ? 'Ferma' : 'Registra';
  $('#transport').classList.toggle('recording', S.recording);
  $('#btnMonitor').textContent = S.monitoring ? 'Smetti di provare il livello' : 'Prova il livello';
  $('#btnMonitor').disabled = S.recording;
  const blind = BL.on;
  $('#abOrig').disabled = !has || S.recording; $('#abProc').disabled = !S.procActive || S.recording;
  $('#abOrig').textContent = blind ? 'X' : 'Originale'; $('#abProc').textContent = blind ? 'Y' : 'Migliorata';
  const showX = blind ? S.mode === BL.map[0] : S.mode === 'orig';
  $('#abOrig').setAttribute('aria-pressed', String(showX)); $('#abProc').setAttribute('aria-pressed', String(!showX));
  $('#btnBlind').disabled = !S.procActive || S.recording || P.voiceRefined; $('#btnBlind').textContent = blind ? 'Rivela quale era quale' : 'Ascolto alla cieca';
  $('#matchBox').disabled = blind;
  if (!S.playing && !S.recording) $('#timeNow').textContent = fmtSec(S.cur);
  $('#timeTotal').textContent = fmtSec(lay.total);
}
function updateSelInfo() {
  const lay = layout(), el = $('#selInfo');
  if (!lay.total) { el.textContent = ''; return; }
  let t = '<b>' + fmtSec(S.cur) + '</b>';
  if (S.sel) t += '<span>Selezione ' + fmtSec(S.sel[0]) + ' a ' + fmtSec(S.sel[1]) + ' (' + fmtDur((S.sel[1] - S.sel[0]) / SR) + ')</span>';
  t += '<span class="tot">voce ' + fmtSec(S.vlen) + (lay.total !== S.vlen ? ', mix ' + fmtSec(lay.total) : '') + '</span>';
  el.innerHTML = t;
  if (!S.playing && !S.recording) $('#timeNow').textContent = fmtSec(S.cur);
}
function updateLegend() {
  $('#legend').textContent = S.vlen ? 'Trascina la riga dei tempi per spostare il cursore' : '';
}
function renderHistory() {
  const ol = $('#histList'); ol.innerHTML = '';
  if (!S.ops.length && !S.redo.length) { const li = document.createElement('li'); li.textContent = 'Ancora nessuna modifica.'; ol.appendChild(li); return; }
  const all = S.ops.concat(S.redo.slice().reverse());
  all.forEach((op, i) => {
    const li = document.createElement('li'), done = i < S.ops.length;
    if (i === S.ops.length - 1) li.className = 'cur';
    const t = document.createElement('span'); t.className = 't'; t.textContent = (i + 1) + '. ' + op.label + (done ? '' : ' (annullata)');
    if (!done) t.style.color = 'var(--muted)';
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = i === S.ops.length - 1 ? 'Attuale' : 'Torna qui'; b.disabled = i === S.ops.length - 1;
    b.setAttribute('aria-label', 'Torna allo stato dopo la modifica ' + (i + 1));
    b.addEventListener('click', () => { stopIfPlaying(); while (S.ops.length > i + 1) S.redo.push(S.ops.pop()); while (S.ops.length < i + 1 && S.redo.length) S.ops.push(S.redo.pop()); replay(); afterEdit(null); toast('Tornato allo stato dopo la modifica ' + (i + 1) + '.'); });
    li.append(t, b); ol.appendChild(li);
  });
  // si scorre solo l'elenco, non la pagina
  const cur = ol.querySelector('.cur'); if (cur) { const top = cur.offsetTop; if (top < ol.scrollTop || top + cur.offsetHeight > ol.scrollTop + ol.clientHeight) ol.scrollTop = top - ol.clientHeight / 2; }
}
function afterEdit() {
  const lay = layout();
  S.cur = clamp(S.cur, 0, lay.total);
  if (S.sel) { S.sel = [clamp(S.sel[0], 0, lay.total), clamp(S.sel[1], 0, lay.total)]; if (S.sel[1] - S.sel[0] < 1) S.sel = null; }
  drawAll(); updateButtons(); updateTransport(); updateLegend(); renderHistory(); renderFxList(); updateApplyStatus(); scheduleDiag(); scheduleSave(); updateLevelStatus();
  flowUpdate();
}

/* ========================= Confronto alla cieca ========================= */
const BL = { on: false, map: ['orig', 'proc'] };
function toggleBlind() {
  if (!BL.on) {
    const r = new Uint32Array(1); crypto.getRandomValues(r);
    BL.map = (r[0] & 1) ? ['orig', 'proc'] : ['proc', 'orig']; BL.on = true; BL.prevMatch = P.match;
    P.match = true; syncKey('match');
    S.mode = BL.map[0]; restartIfPlaying(); drawAll(); updateTransport();
    toast('Confronto alla cieca: ascolta X e Y allo stesso volume. Per scoprire quale era quale apri il menu Altro, i tre puntini, e premi “Rivela”.', 7000);
  } else {
    BL.on = false; P.match = BL.prevMatch; syncKey('match');
    const x = BL.map[0] === 'proc' ? 'la migliorata' : 'l’originale', y = BL.map[1] === 'proc' ? 'la migliorata' : 'l’originale';
    updateTransport(); drawAll(); toast('X era ' + x + ', Y era ' + y + '.', 8000);
  }
}
function setMode(m) {
  if (BL.on) m = m === 'x' ? BL.map[0] : BL.map[1];
  if (m === 'proc' && !S.procActive) { toast('Prima applica i miglioramenti nella scheda Migliora.'); return; }
  S.mode = m; restartIfPlaying(); drawAll(); updateTransport(); updateLevelStatus();
}

/* ========================= Suggerimenti, schede, aspetto, informazioni ========================= */
const BTN_TIPS = {
  tUndo: 'Annulla l’ultima modifica. Si può annullare tutto, fino all’inizio.', tRedo: 'Rifà la modifica appena annullata.',
  tCut: 'Toglie il tratto selezionato e lo tiene negli appunti, per incollarlo altrove.', tCopy: 'Copia il tratto selezionato negli appunti.',
  tPaste: 'Inserisce gli appunti al cursore, oppure al posto della selezione.', tDel: 'Toglie il tratto selezionato. Il resto si avvicina, con una dissolvenza brevissima sul taglio.',
  tSil: 'Sostituisce il tratto selezionato con silenzio della stessa durata.', tFadeIn: 'Il volume parte da zero all’inizio della selezione e sale fino alla fine della selezione.',
  tFadeOut: 'Il volume scende fino a zero alla fine della selezione.', tAll: 'Seleziona tutta la voce.',
  zIn: 'Ingrandisce la forma d’onda. Anche con ' + MOD + ' e la rotellina, o con il pizzico sul trackpad.', zOut: 'Riduce l’ingrandimento.', zSel: 'Ingrandisce fino a mostrare solo la selezione.', zFit: 'Mostra tutto.',
  btnHome: 'Porta il cursore all’inizio.', btnBack: 'Sposta il cursore indietro di 5 secondi. Se stai ascoltando, l’ascolto riparte da lì.', btnFwd: 'Sposta il cursore avanti di 5 secondi.', btnEnd: 'Porta il cursore alla fine.',
  tNone: 'Toglie la selezione, così il prossimo ascolto parte dal cursore e non si limita al tratto selezionato.', btnPlay: 'Avvia o ferma l’ascolto dal cursore. Con una selezione ascolti solo quella.',
  btnRec: 'Registra dal microfono. La registrazione va dove indicato nella scheda Registra e importa: in fondo, al cursore o al posto della selezione.',
  abOrig: 'Ascolta la voce originale, senza miglioramenti.', abProc: 'Ascolta la voce migliorata. Disponibile dopo “Applica i miglioramenti”.',
  btnBlind: 'Confronto alla cieca: Originale e Migliorata diventano X e Y in ordine casuale, allo stesso volume.',
  btnMonitor: 'Ascolta il microfono senza registrare e guarda l’indicatore in basso per regolare il guadagno.',
  btnPropose: 'Misura la voce originale e imposta i cursori: pulizia, eco, de-esser e ronzio. Mostra cosa cambia e perché. Non tocca l’audio finché non premi Applica.',
  ebFix: 'Analizza il tratto selezionato: riconosce parole, respiri, rumori, click e pause lunghe e propone la correzione. Non cambia nulla finché non premi Applica correzione.',
  ebPlay: 'Ascolta solo il tratto selezionato.', ebCut: 'Toglie il tratto e lo tiene negli appunti, per incollarlo altrove.', ebDel: 'Toglie il tratto. Il resto si avvicina, con una dissolvenza brevissima sul taglio.',
  ebSil: 'Sostituisce il tratto con silenzio della stessa durata: il resto non si sposta. Passando sul pulsante vedi l’anteprima.',
  ebBreath: 'Abbassa il respiro nella selezione, senza toglierlo, così l’ascolto resta naturale. Se nella selezione ci sono soprattutto parole, non le tocca.',
  ebClick: 'Ripara i piccoli click di bocca o digitali nella selezione. Il resto del suono non cambia.', ebUndo: 'Annulla l’ultima modifica.', ebRedo: 'Rifà la modifica annullata.',
  btnPodcast: 'Analizza la registrazione, sceglie le regolazioni per un podcast, migliora la voce e prepara il volume per la pubblicazione. Si può sempre tornare alle regolazioni di prima.',
  btnApply: 'Applica alla voce, nell’ordine: click e ronzio, se attivi, pulizia del rumore, eco, plosivi, timbro, livellatore, compressore, de-esser, respiri e gate. Con 5 minuti di audio servono circa 15 secondi.',
  btnExport: 'Crea il file finale e lo salva nella cartella dei download.', btnStems: 'Crea un WAV per ogni traccia (voce, musica, effetti), della stessa durata e allineati. Sommati danno il mix, con lo stesso volume finale. Utile per finire il lavoro in Audacity.', btnSaveProj: 'Salva un file .sottovoce con gli originali e tutte le modifiche.',
  btnOpenProj: 'Riapre un file .sottovoce salvato prima.', btnNewProj: 'Ricomincia da zero. Il lavoro attuale si toglie da questo browser.',
  btnGuide: 'Spiega passo passo come usare il programma, con le scorciatoie da tastiera.', btnInfo: 'Informazioni sul programma e testo delle licenze dei componenti.',
  btnReplaceVoice: 'Sceglie un file che prende il posto di tutta la voce, per esempio una nuova versione rifinita in Audacity. Musica, effetti, titolo, copertina e impostazioni restano. Si può annullare.',
  btnClearHist: 'Riunisce tutte le modifiche nel montaggio attuale, che resta identico. Le parti tagliate via dalle registrazioni si eliminano, così il progetto pesa meno. Dopo non si può più tornare indietro.',
  btnMusicRemove: 'Toglie la musica dal mix. Il file originale non viene toccato.', btnCover: 'Sceglie l’immagine di copertina che finisce nell’MP3.', btnCoverDel: 'Toglie la copertina.'
};
// scritte delle scorciatoie: sul Mac i simboli ⌘ ⇧ ⌫, su Windows e Linux Ctrl, Maiusc e Canc
function applyPlatform() {
  document.documentElement.dataset.os = OS;
  if (OS !== 'mac') $$('[data-pc]').forEach(el => { el.textContent = el.dataset.pc; });
}
function initHelp() {
  applyPlatform();
  Object.keys(BTN_TIPS).forEach(id => { const el = document.getElementById(id); if (el) el.dataset.tip = BTN_TIPS[id]; });
  // titoli dei pannelli con una spiegazione in più: la "i" accanto al titolo
  $$('h2[data-info]').forEach(h => h.appendChild(makeInfo(h.dataset.info, h.textContent)));
  // pulsanti con sola icona: il suggerimento comincia con nome e scorciatoia, per esempio "Taglia ⌘X"
  $$('[data-k]').forEach(el => {
    const k = OS === 'mac' ? el.dataset.k : (el.dataset.kpc || el.dataset.k), name = el.getAttribute('aria-label') || el.textContent.trim();
    el.dataset.tip = name + ' ' + k + (BTN_TIPS[el.id] ? '. ' + BTN_TIPS[el.id] : '');
  });
  $$('.seg').forEach(b => { b.dataset.tip = b.dataset.mode === 'simple' ? 'Mostra solo i controlli principali.' : 'Mostra tutti i controlli, anche quelli per i dettagli.'; });
  const tg = $('.transport .toggle'); tg.dataset.tip = HELP.match; tg.parentNode.insertBefore(makeInfo(HELP.match, 'Stesso volume'), tg.nextSibling);
  const vz = $('#vzoom').closest('label'); vz.dataset.tip = 'Ingrandisce la forma d’onda in altezza, utile per le registrazioni basse. Automatica la adatta da sola. Non cambia il volume.';
  const pop = $('#tipPop'); let timer = null, cur = null, pinned = null;
  function place(el) {
    const r = el.getBoundingClientRect(); pop.style.left = '0px'; pop.style.top = '0px';
    const w = pop.offsetWidth, h = pop.offsetHeight; let x = r.left + r.width / 2 - w / 2; x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    let y = r.bottom + 8; if (y + h > window.innerHeight - 90) y = Math.max(8, r.top - h - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function hideTip() { clearTimeout(timer); if (cur) { cur.removeAttribute('aria-describedby'); cur = null; } pop.hidden = true; pinned = null; }
  function showTip(el) { const t = el.dataset.tip; if (!t) return; if (cur && cur !== el) cur.removeAttribute('aria-describedby'); cur = el; pop.textContent = t; pop.hidden = false; el.setAttribute('aria-describedby', 'tipPop'); place(el); }
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (!el || el === cur || pinned) return; clearTimeout(timer); timer = setTimeout(() => showTip(el), el.classList.contains('info-i') ? 120 : 550); });
  document.addEventListener('mouseout', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (!el) return; if (e.relatedTarget && el.contains(e.relatedTarget)) return; if (pinned === el) return; clearTimeout(timer); if (cur === el) hideTip(); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.info-i'); if (el) showTip(el); });
  document.addEventListener('focusout', e => { if (cur && cur === e.target && pinned !== cur) hideTip(); });
  document.addEventListener('click', e => {
    const i = e.target.closest && e.target.closest('.info-i');
    if (i && !i.classList.contains('demo')) { e.preventDefault(); if (pinned === i) hideTip(); else { hideTip(); pinned = i; showTip(i); } return; }
    if (pinned || cur) hideTip();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('scroll', () => { if (cur) hideTip(); }, { passive: true, capture: true });
}
function showTab(name) {
  $$('.tab').forEach(b => { const on = b.dataset.tab === name; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  $$('.pane').forEach(p => { p.hidden = p.id !== 'pane-' + name; });
  if (name === 'improve') scheduleDiag();
  if (name === 'rec') fillMics();
}
function setLevel(m) {
  $('#app').classList.toggle('simple', m === 'simple');
  $$('.seg').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  try { localStorage.setItem('sottovoce-studio.livello.v1', m); } catch { }
}
function initTabs() {
  const tabs = $$('.tab');
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => showTab(b.dataset.tab));
    b.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); e.stopPropagation(); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); showTab(n.dataset.tab); });
  });
  let m = 'simple'; try { m = localStorage.getItem('sottovoce-studio.livello.v1') || 'simple'; } catch { }
  showTab('rec'); setLevel(m === 'adv' ? 'adv' : 'simple');
  $$('.seg').forEach(b => b.addEventListener('click', () => setLevel(b.dataset.mode)));
}
const THEME_KEY = 'sottovoce-studio.tema.v1';
// temi: Auto (segue il sistema), Chiaro (carta) e Scuro. Un solo colore d'accento, l'ambra.
function applyLook(theme) {
  const r = document.documentElement;
  if (theme === 'light' || theme === 'dark') r.dataset.theme = theme; else delete r.dataset.theme;
  delete r.dataset.accent;
  $$('[data-theme-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeBtn === theme)));
  drawAll(); startMeter();
}
function initLook() {
  let theme = 'auto';
  try { theme = localStorage.getItem(THEME_KEY) || 'auto'; localStorage.removeItem('sottovoce-studio.accento.v1'); } catch { }
  $$('[data-theme-btn]').forEach(b => b.addEventListener('click', () => { theme = b.dataset.themeBtn; applyLook(theme); try { localStorage.setItem(THEME_KEY, theme); } catch { } }));
  applyLook(theme);
}
// i due menu "Altro": nella barra degli strumenti e, sul telefono, nel trasporto
/* ========================= Prima apertura ========================= */
// Finestra di benvenuto: compare alla prima apertura (dopo l'eventuale "Riprendere il lavoro?") e si rivede dal menu ⋯.
// La scelta "non mostrarla più" si ricorda nel browser; se il browser non lo permette, compare al massimo una volta per sessione.
const WELCOME_KEY = 'sottovoce-studio.benvenuto.v1';
let welcomeShown = false;
function openWelcome() {
  const d = $('#welcome'); if (!d || d.open) return;
  $('#welcomeNoMore').checked = true; welcomeShown = true; d.showModal(); $('#welcomeOk').focus();
}
function maybeWelcome() {
  let seen = false;
  try { seen = localStorage.getItem(WELCOME_KEY) === '1'; } catch { seen = welcomeShown; }
  if (!seen && !welcomeShown && !document.querySelector('dialog[open]')) openWelcome();
}
function initWelcome() {
  const d = $('#welcome'); if (!d) return;
  d.addEventListener('close', () => { try { if ($('#welcomeNoMore').checked) localStorage.setItem(WELCOME_KEY, '1'); else localStorage.removeItem(WELCOME_KEY); } catch { } });
  $('#btnWelcome').addEventListener('click', openWelcome);
}
function initMenus() {
  const pairs = [['#btnMore', '#morePanel'], ['#tpMore', '#tpExtra']];
  const close = (b, p) => { $(b).setAttribute('aria-expanded', 'false'); $(p).classList.remove('open'); if (b === '#btnMore') $(p).hidden = true; };
  pairs.forEach(([b, p]) => $(b).addEventListener('click', e => {
    e.stopPropagation(); const open = $(b).getAttribute('aria-expanded') !== 'true';
    pairs.forEach(([b2, p2]) => close(b2, p2));
    if (open) { $(b).setAttribute('aria-expanded', 'true'); $(p).classList.add('open'); $(p).hidden = false; const f = $(p).querySelector('button:not(:disabled),select,input'); if (f) f.focus(); }
  }));
  document.addEventListener('click', e => { pairs.forEach(([b, p]) => { if ($(b).getAttribute('aria-expanded') === 'true' && !$(p).contains(e.target) && !$(b).contains(e.target)) close(b, p); }); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') pairs.forEach(([b, p]) => { if ($(b).getAttribute('aria-expanded') === 'true') { close(b, p); $(b).focus(); } }); });
  // dopo una scelta nel menu della barra, il menu si chiude
  $$('#morePanel button').forEach(x => x.addEventListener('click', () => close('#btnMore', '#morePanel')));
}
function openInfo() {
  [['lic-polyform', '#licPolyform'], ['lic-mit-tabler', '#licMit'], ['lic-ofl', '#licOfl'], ['lic-bsd', '#licBsd'], ['lic-apache', '#licApache'], ['lic-lgpl', '#licLgpl'], ['lic-gpl', '#licGpl']].forEach(([id, sel]) => {
    const src = document.getElementById(id), box = $(sel); if (src) $('pre', box).textContent = src.textContent.trim(); else box.hidden = true;
  });
  $('#info').showModal();
}

