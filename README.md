# Portafoglio titoli

Il programma per Windows che mostra **l'andamento del portafoglio titoli di famiglia**: controvalore, plusvalenza, rendimento annualizzato e confronto con gli indici di borsa, i BTP e l'inflazione.

## ⬇️ Scaricare il programma

**[Scarica l'ultima versione](https://github.com/teodea/portafoglio/releases/latest)**: nella pagina che si apre, sotto **Assets**, selezionare **Portafoglio-titoli-‹versione›.exe** e aprirlo per installarlo (i passaggi sono più sotto, in «Installazione»).

Questa pagina è la guida: installazione, primo avvio e uso.

## In breve

- **I dati stanno in un unico file**, `portafoglio.json`, in una cartella di OneDrive (per esempio **Documenti › Finanze**). Il programma non contiene dati: li legge da lì.
- Prima di ogni modifica al file, il programma **ne salva una copia** nella sottocartella `copie`. Nessun dato va perso.
- Se il programma è usato su più computer, su tutti si sceglie la stessa cartella di OneDrive. Se il file è stato modificato da un altro computer, il programma se ne accorge e non lo sovrascrive.
- Ogni numero è selezionabile: si apre un pannello con la **provenienza**, cioè il calcolo riga per riga e le fonti.

## Installazione

Il file da scaricare è **Portafoglio-titoli-‹versione›.exe**, dalla [pagina delle versioni](https://github.com/teodea/portafoglio/releases/latest): è l'installatore.

1. Aprire il file **Portafoglio-titoli-….exe** scaricato (di norma si trova nella cartella Download).
2. Windows può mostrare **«PC protetto da Windows»**: il programma non è firmato digitalmente (è a uso della famiglia). Selezionare **«Ulteriori informazioni»** e poi **«Esegui comunque»**. Succede solo la prima volta.
3. L'installazione si completa con un clic, non richiede la password di amministratore e al termine apre il programma.
4. Sul desktop e nel menu Start compare l'icona **Portafoglio titoli**.

**Gli aggiornamenti sono automatici.** Quando è disponibile una nuova versione, in cima alle pagine compare **«È disponibile una nuova versione: installarla?»**. Con **Installa** la versione si scarica e si installa alla chiusura del programma, che al termine si riapre automaticamente (circa un minuto); con **Non ora** la richiesta si ripete all'avvio successivo. La disinstallazione non tocca i dati in OneDrive.

## Primo avvio

Doppio clic sull'icona **Portafoglio titoli** sul desktop, oppure dal menu Start. Il programma ha una sola finestra: se è già aperto, torna in primo piano.

**Al primo avvio** il programma chiede la **cartella dei dati**:

1. Selezionare **«Scegli la cartella dei dati»**.
2. Aprire la cartella di OneDrive che contiene `portafoglio.json` e confermare.
3. Il programma controlla il file e apre la pagina **Portafoglio**. La cartella viene ricordata per gli avvii successivi.

Se la cartella non è più raggiungibile (OneDrive non collegato, cartella spostata), il programma lo segnala e chiede di sceglierla di nuovo. La cartella si cambia anche dalla pagina **Dati**, con **«Cambia»**.

Il programma si chiude con la **X** in alto a destra: da chiuso non resta attivo nulla.

## Le pagine

Il menu ha quattro pagine (a sinistra; con la finestra stretta, in alto).

**Portafoglio**: il quadro complessivo. In grande la plusvalenza di tutto il portafoglio, titoli venduti compresi, con il rendimento sul capitale investito e il rendimento annualizzato. Sotto: controvalore, capitale investito, rendimento del mese, rendimento da inizio anno e dividendi netti. Poi l'andamento del controvalore mese per mese, il **confronto con i riferimenti** (FTSE MIB, Euro Stoxx 50, S&P 500, Nasdaq-100, Dow Jones, BTP 10 anni, inflazione) e i titoli migliori e peggiori.

**Titoli**: un titolo per riga, con controvalore, costo, plus/minusvalenza, rendimento, rendimento annualizzato e prezzo di fine mese. I riquadri in alto contano **solo i titoli in portafoglio**; per questo la plusvalenza può differire da quella della pagina Portafoglio, che comprende anche i titoli venduti. Le schede: ‹data dei prezzi›, Mese per mese, Dividendi, Venduti. Selezionando un titolo si apre la sua **scheda**: grafico, mese per mese, operazioni, dividendi e provenienza dei numeri.

**Movimenti**: tutti gli acquisti, le vendite e i dividendi, dal più recente. In alto il tasto **Registra** per inserirne uno.

**Dati**: il contenuto del file: la cartella, lo stato del file, l'ultima copia, i prezzi di fine mese (con la fonte e il controllo di investing.com), inflazione, cambi e riferimenti, e l'elenco delle **copie**. In alto **Scarica in Excel**.

**Il pannello della provenienza.** Selezionando un numero (o una riga) si apre da destra un pannello che lo spiega, con il calcolo riga per riga e la fonte. Si chiude con la X, con **Esc** o selezionando un punto fuori dal pannello.

## Operazioni

### Registrare un acquisto, una vendita o un dividendo

Pagina **Movimenti › Registra**.

- **Dal PDF della banca (il modo più rapido):** trascinare il PDF nel riquadro, oppure selezionarlo dalla cartella. Il programma legge i dati e mostra il movimento in sintesi. Per un titolo nuovo chiede la **descrizione in parole semplici** e cerca da solo il codice su investing.com.
- **Inserimento manuale:** scegliere acquisto, vendita o dividendo e riportare i dati dal documento della banca. Il costo d'acquisto si calcola automaticamente (quote × prezzo + commissioni). Una cedola di un'obbligazione si registra come dividendo, il rimborso a scadenza come vendita.
- Prima della registrazione il programma chiede **«I dati sono corretti?»**: il file non viene modificato fino alla conferma con **«Sì, registra»**.

### Correggere un movimento

In **Movimenti** selezionare il movimento: nel pannello, sotto **«Correzione dei dati»**, modificare il valore, selezionare **Correggi** e confermare. Se cambiano le quote o il prezzo, l'importo si ricalcola; se i valori non sono coerenti, il programma lo segnala. Il movimento resta segnato come «manuale», con i valori precedenti in vista; **«Ripristina i valori precedenti»** li rimette. Un movimento registrato per errore si rimuove con **«Elimina il movimento»**.

### Correggere un prezzo di fine mese

Selezionare il prezzo (in Titoli o in Dati) e, nel pannello, inserire quello corretto. Lo stesso vale per inflazione, cambi e riferimenti, dalla pagina Dati.

### Aggiornamento di fine mese

Dal primo giorno del mese, in cima alle pagine compare **«‹Mese› è concluso: aggiornare i prezzi di fine mese»**, con il tasto **Aggiorna fine mese** (anche nel menu).

1. Selezionare il tasto: l'elenco si compila automaticamente con i prezzi di chiusura dalla borsa di ogni titolo, i cambi, i riferimenti e l'inflazione.
2. Se un prezzo non arriva: **Riprova**, oppure **Inserisci manualmente**. Riferimenti e inflazione non sono necessari per salvare (l'ISTAT pubblica l'inflazione a metà del mese successivo).
3. Selezionare **Salva ‹mese›**. Prima del salvataggio il programma salva una copia del file.

Un mese già salvato si può ripetere con **Ripeti ‹mese›**: si vedono le differenze rispetto al salvataggio precedente e, per ogni prezzo diverso, si può mantenere il precedente.

### Esportare in Excel

Pagina **Dati › Scarica in Excel**: il file viene salvato nella cartella Download, con un foglio per titoli, movimenti, prezzi, controvalore mese per mese e riferimenti. Serve per consultare o inviare i numeri: le modifiche fatte in Excel **non** tornano nel programma.

### I codici investing.com (una sola volta)

Il controllo con investing.com affianca al prezzo della borsa quello di investing.com e fa da riserva se la borsa non risponde. Per farlo servono i codici dei titoli. Pagina **Dati**, scheda **Prezzi dei titoli**, **«Cerca i codici investing.com»**: il programma li cerca; si verifica che il prezzo del giorno precedente sia vicino a quello del file, si selezionano e si conferma.

## In caso di problemi

**Tornare a una situazione precedente.** Pagina **Dati**, scheda **Copie**: c'è una copia del file prima di ogni modifica, con la data e il motivo (per esempio «prima dell'aggiornamento di ottobre»). **«Torna a questa copia»** ripristina il file; quello attuale non va perso, diventa a sua volta una copia.

**«Il file dei dati non è leggibile».** Succede se il file è stato aperto e modificato con un altro programma. Il programma indica dov'è l'errore, non modifica nulla e propone **«Ripristina l'ultima copia»**. Il file danneggiato non viene cancellato: va nella cartella `copie`.

**«Il file è stato modificato da un altro computer».** Il file è stato scritto da un altro computer durante l'uso. Il programma non ha scritto nulla e ha ricaricato i dati: verificare e ripetere l'operazione.

**Un prezzo di fine mese non arriva.** Riprovare più tardi, oppure inserirlo manualmente copiandolo dal sito della borsa: resta segnato come «manuale».

**Windows mostra «PC protetto da Windows».** È normale al primo avvio: **Ulteriori informazioni › Esegui comunque**.

---

Per chi cura il programma: struttura, prove e pubblicazione di una nuova versione sono descritte in [SVILUPPO.md](SVILUPPO.md).
