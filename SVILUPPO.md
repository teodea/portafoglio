# Portafoglio titoli — per chi cura il programma

Applicazione per Windows (Electron) per sapere come sta andando un portafoglio titoli, accanto all'andamento degli indici di borsa e dell'inflazione ISTAT.

**Per chi lo usa:** come si scarica, si apre e si usa è nella [pagina principale](README.md).

Il repository contiene **solo il programma**: nessun dato. I dati stanno nel file `portafoglio.json`, dentro la cartella del computer che l'utente sceglie dall'applicazione. Le prove usano un portafoglio inventato (`src/dati/portafoglio-inventato.ts`).

## Com'è fatta

- `electron/`: il processo principale (finestra, file) e il preload, che espone alle pagine poche funzioni in `window.ponte`.
- `src/dati/`: moduli puri condivisi (tipi del file, controllo del file all'apertura, nomi delle copie, il contratto del ponte).
- `src/conti/`: i conti, in un modulo puro provato con Vitest (costo medio, guadagno, medio annuo con XIRR, il mese senza i soldi nuovi, vendite parziali, titoli in valuta). Ogni numero esce con la sua spiegazione per il pannello "Da dove viene" (`src/pannello/`).
- `src/`: le pagine in React. Aperte in un browser qualsiasi usano un ponte finto con dati inventati (`?prova=rotto`, `?prova=nessuna`, `?prova=senza-file`, `?prova=dato`, `?prova=rotto-senza-copie`).

## Sviluppo

```bash
npm ci                 # installa anche Electron
npm run dev            # Vite + finestra di Electron
npm run pagine         # solo le pagine, nel browser
npm test               # prove (Vitest)
npm run typecheck      # tipi di pagine, processo principale e preload
npm run build          # costruisce pagine (dist/) ed Electron (dist-electron/)
npm start              # apre la versione costruita
```

Per provare con una cartella dei dati senza toccare le impostazioni vere:

```bash
npm run dev -- --cartella="C:\percorso\dei\dati" --profilo="C:\percorso\di\un\profilo\di\prova"
```

## Installatore e versioni nuove

- `npm run installatore` costruisce sul PC l'installatore per Windows in `installatore/` (`Portafoglio-titoli-<versione>.exe`, più `latest.yml`), senza pubblicare niente. Configurazione in `electron-builder.yml`.
- L'installatore pubblico lo costruisce la GitHub Action `Installatore` (`.github/workflows/installatore.yml`) e lo mette nella Release `v<versione>` di questo repository. Parte a ogni modifica di `main`, ma lavora solo se la versione di `package.json` non ha ancora la sua Release: **per pubblicare una versione nuova si cambia `version` in `package.json`**.
- All'apertura l'applicazione installata guarda le Release e, se c'è una versione nuova, chiede "C'è una versione nuova: la installo?". Con il sì la scarica e, appena scaricata (tre secondi per leggere la striscia), si chiude e lancia l'installatore non silenzioso: si vede la sua finestra "Installazione in corso" con la barra, e alla fine l'applicazione si riapre da sola, così nessuno la riapre a metà trovando la versione vecchia; con "Non ora" lo richiede la volta dopo. Ad applicazione chiusa non resta acceso niente. Il codice è in `electron/aggiornamento.ts` e `src/dati/aggiornamento.ts`; il registro in `AppData\Roaming\Portafoglio titoli\aggiornamento.log`.
- L'installatore non è firmato: al primo avvio Windows dice "app non riconosciuta"; si sceglie "Ulteriori informazioni" e poi "Esegui comunque".

Per provare la domanda senza pubblicare niente, con una finta fonte di versioni sul PC (una cartella con `latest.yml` e l'installatore di una versione più alta, servita su `http://localhost`):

```bash
"installatore/win-unpacked/Portafoglio titoli.exe" --fonte-versioni=http://127.0.0.1:8765/ --profilo="C:\percorso\di\un\profilo\di\prova"
```

Con la finta fonte l'applicazione scarica la versione nuova ma **non** si chiude e non la installa: scrive solo nel registro che cosa installerebbe. Nelle pagine aperte nel browser la striscia si vede con `?versione=nuova`.

## Prima di pubblicare

```bash
npm run controlla-dati -- --dati "C:\percorso\di\portafoglio.json"
```

Controlla che nei file di `app/` non ci siano i codici, i nomi, i simboli, i numeri d'ordine, le quote, i prezzi o gli importi del file dei dati (lo legge soltanto). Senza `--dati` cerca solo codici ISIN veri: è il controllo che fa anche la Action.
