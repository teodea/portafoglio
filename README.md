# Portafoglio titoli

Il programma per Windows che dice **come sta andando il portafoglio titoli di famiglia**: quanto hai guadagnato, quanto rende all'anno, e come va rispetto agli indici di borsa, ai BTP e all'inflazione.

## ⬇️ Scaricalo

**[Scarica l'ultima versione](https://github.com/teodea/portafoglio/releases/latest)**: nella pagina che si apre, sotto **Assets**, clicca **Portafoglio-titoli-‹versione›.exe**. Poi aprilo per installarlo (i passaggi sono qui sotto, in «Installarlo»).

Questa pagina è la guida: come si installa, come si apre e come si usa.

## In breve

- **I dati stanno in un file solo**, `portafoglio.json`, in una cartella di OneDrive (per esempio **Documenti › Finanze**). Il programma non contiene dati: li legge da lì.
- Ogni volta che il programma scrive nel file, **prima ne fa una copia** nella sottocartella `copie`. Non si perde mai niente.
- Se più persone usano il programma su PC diversi, tutti scelgono la stessa cartella di OneDrive. Se il file è stato cambiato da un altro PC, il programma se ne accorge e non scrive sopra.
- Ogni numero si può cliccare: si apre il pannello **«Da dove viene»**, che spiega il conto in parole.

## Installarlo

Il file da scaricare è **Portafoglio-titoli-‹versione›.exe**, dalla [pagina delle versioni](https://github.com/teodea/portafoglio/releases/latest): è l'installatore.

1. Apri il file **Portafoglio-titoli-….exe** scaricato (di solito è nella cartella Download).
2. Windows può dire **«PC protetto da Windows»**: il programma non è firmato (lo usa solo la famiglia). Clicca **«Ulteriori informazioni»** e poi **«Esegui comunque»**. Succede solo la prima volta.
3. L'installazione è un clic: non chiede la password di amministratore e alla fine apre il programma.
4. Sul desktop e nel menu Start compare l'icona **Portafoglio titoli**.

**Le versioni nuove arrivano da sole.** Quando c'è una versione nuova, in cima alle pagine compare **«C'è una versione nuova: la installo?»**. Con **Sì** si scarica e si installa quando chiudi il programma; con **Non ora** te lo richiede la volta dopo. Disinstallando il programma, i dati in OneDrive non si toccano.

## Aprirlo

Doppio clic sull'icona **Portafoglio titoli** sul desktop, oppure cercalo nel menu Start. Si apre una finestra sola: se è già aperto, torna in primo piano.

**La prima volta** il programma chiede **«Dove sono i tuoi dati?»**:

1. Clicca il tasto per scegliere la cartella.
2. Vai nella cartella di OneDrive dove c'è `portafoglio.json` e conferma con **«Usa questa cartella»**.
3. Il programma controlla il file e apre la pagina **Portafoglio**. Dalla volta dopo si ricorda la cartella da solo.

Se un giorno la cartella non si trova più (OneDrive non collegato, cartella spostata), il programma lo dice e ti fa scegliere di nuovo. La cartella si cambia anche dalla pagina **Dati**, con **«Cambia»**.

Per chiudere il programma basta la **X** in alto a destra: quando è chiuso non resta acceso niente.

## Le pagine

Il menu a sinistra ha quattro pagine (con la finestra stretta il menu va in alto).

**Portafoglio**: la risposta a «come sto andando?». In grande il guadagno di tutto il portafoglio, compresi i titoli già venduti. Sotto: soldi investiti, guadagno dall'inizio, medio annuo, l'ultimo mese e l'anno in corso. Poi il grafico del valore mese per mese (clic su un mese per i suoi numeri), la classifica rispetto ai **riferimenti** (FTSE MIB, Euro Stoxx 50, S&P 500, Nasdaq-100, Dow Jones, BTP 10 anni, inflazione) e i titoli **in cima** e **in fondo alla classifica**.

**Titoli**: un titolo per riga, con valore, pagato, guadagno, medio annuo e prezzo di fine mese. I numeri in alto contano **solo i titoli che hai oggi**; per questo il guadagno è un po' diverso da quello del Portafoglio, che conta anche i venduti (lo dice sotto il numero). Le schede: Oggi, Mese per mese, Dividendi, Venduti. Clic su un titolo per la sua **Scheda**: grafico, mese per mese, operazioni e costo medio.

**Movimenti**: tutti gli acquisti, le vendite e i dividendi, dal più recente. In alto il tasto **Registra** per aggiungerne uno.

**Dati**: cosa c'è nel file: la cartella, se il file è a posto, l'ultima copia, i prezzi di fine mese (con la fonte e il controllo di investing.com), inflazione, cambi e riferimenti, e l'elenco delle **copie**. In alto **Scarica in Excel**.

**Il pannello «Da dove viene».** Clic su qualunque numero (o su una riga): da destra si apre un pannello che spiega il numero in parole, con il conto riga per riga e la fonte. Si chiude con la X, con **Esc** o cliccando fuori.

## Le cose da fare

### Registrare un acquisto, una vendita o un dividendo

Pagina **Movimenti › Registra**.

- **Dal PDF della banca (il modo più comodo):** trascina nel riquadro il PDF della banca (o sceglilo dalla cartella). Il programma legge i numeri e mostra il movimento in una frase. Se il titolo è nuovo, chiede «Cos'è, in parole semplici» e cerca da solo il suo codice su investing.com.
- **A mano:** scegli acquisto, vendita o dividendo e copia i numeri dal documento della banca. Il pagato si calcola da solo (quote × prezzo + commissioni). Una cedola di un'obbligazione si registra come dividendo, il rimborso a scadenza come vendita.
- Prima di scrivere il programma chiede **«È tutto giusto?»**: niente va nel file finché non confermi.

### Correggere un movimento sbagliato

In **Movimenti** clicca il movimento: nel pannello, sotto **«Se qualcosa è sbagliato»**, cambia il numero e premi **Correggi a mano**, poi conferma. Se cambi le quote o il prezzo, il pagato si rifà da solo; se non torna, il programma lo dice. Il movimento resta segnato «a mano» e si vede cosa c'era prima; **«Torna a com'era»** lo rimette. Un movimento registrato due volte si toglie con **«Togli questo movimento»**.

### Correggere un prezzo di fine mese

Clic sul prezzo (in Titoli o in Dati): nel pannello si scrive quello giusto. Lo stesso per inflazione, cambi e riferimenti, dalla pagina Dati.

### Aggiornare a fine mese

Dal primo giorno del mese, in cima alle pagine compare **«‹Mese› è finito: aggiorna i prezzi di fine mese»** (e il tasto **Aggiorna fine mese** in basso a sinistra).

1. Premi il tasto: la lista si riempie da sola con i prezzi di chiusura dalla borsa di ogni titolo, i cambi, i riferimenti e l'inflazione.
2. Se un prezzo non arriva: **Riprova**, oppure **Scrivo a mano**. Riferimenti e inflazione possono aspettare (l'ISTAT pubblica l'inflazione a metà del mese dopo).
3. Premi **Salva ‹mese›**. Prima di salvare il programma fa una copia del file.

Un mese già salvato si può rifare con **Rifai ‹mese›**: si vede cosa cambia rispetto a prima e, per ogni prezzo diverso, si può tenere quello di prima.

### Scaricare in Excel

Pagina **Dati › Scarica in Excel**: il file arriva nella cartella Download, con un foglio per titoli, movimenti, prezzi, mese per mese e riferimenti. Serve per guardare o mandare i numeri: le modifiche fatte in Excel **non** tornano nel programma.

### I codici investing.com (una volta sola)

Il controllo di investing.com mette accanto al prezzo della borsa quello di investing.com, e fa da riserva se la borsa non risponde. Per farlo servono i codici dei titoli. Pagina **Dati**, scheda **Prezzi dei titoli**, **«Cerca i codici investing.com»**: il programma li cerca, tu guardi che il prezzo di ieri sia vicino a quello del file, spunti e confermi.

## Se qualcosa va storto

**Ho sbagliato e voglio tornare indietro.** Pagina **Dati**, scheda **Copie**: c'è una copia del file prima di ogni scrittura, con la data e il perché (per esempio «prima dell'aggiornamento di ottobre»). **«Torna a questa copia»** rimette il file com'era; il file di adesso non si perde, diventa a sua volta una copia.

**Il programma dice che il file non si legge.** Succede se qualcuno l'ha aperto e cambiato con un altro programma. Il programma dice dov'è l'errore, non tocca niente e propone **«Torna all'ultima copia»**. Il file rotto non si cancella: va nella cartella `copie`.

**«Il file è stato cambiato da un altro PC».** Qualcuno ha scritto nel file da un altro computer mentre lo guardavi. Il programma non ha scritto niente e ha ricaricato i dati: controlla e rifai.

**Un prezzo non arriva a fine mese.** Riprova più tardi, oppure scrivilo a mano copiandolo dal sito della borsa: resta segnato «a mano».

**Windows dice «PC protetto da Windows».** È normale al primo avvio: **Ulteriori informazioni › Esegui comunque**.

---

Per chi cura il programma: come è fatto, come si prova e come si pubblica una versione nuova è in [SVILUPPO.md](SVILUPPO.md).
