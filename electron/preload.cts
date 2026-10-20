// Il preload: le poche funzioni che le pagine possono chiedere al processo principale,
// esposte in window.ponte. È CommonJS perché un preload in sandbox non può essere un modulo ES,
// e per lo stesso motivo può caricare solo "electron": i nomi dei canali sono ripetuti qui
// e il controllo dei tipi verifica che siano uguali a quelli di src/dati/ponte.ts.
import type { CANALI as CanaliCondivisi, Ponte } from '../src/dati/ponte.ts' with { 'resolution-mode': 'import' }
import type {
  CANALI_AGGIORNAMENTO as CanaliAggiornamento,
  PonteAggiornamento,
  StatoAggiornamento,
} from '../src/dati/aggiornamento.ts' with { 'resolution-mode': 'import' }

const CANALI = {
  apri: 'dati:apri',
  scegliCartella: 'dati:scegli-cartella',
  tornaAllaCopia: 'dati:torna-alla-copia',
  creaFileVuoto: 'dati:crea-file-vuoto',
  apriInEsplora: 'dati:apri-in-esplora',
  prezzoFineMese: 'aggiorna:prezzo',
  cambioFineMese: 'aggiorna:cambio',
  salvaMese: 'aggiorna:salva',
  valoriRiferimento: 'riferimenti:valori',
  nicIstat: 'riferimenti:nic',
  correggiPrezzo: 'prezzo:correggi',
  // ticket 13: la pagina Dati
  correggiDato: 'dato:correggi',
  tornaAQuestaCopia: 'copie:torna',
  scriviRiferimento: 'riferimento:scrivi',
  modificaMovimento: 'movimento:modifica',
  leggiPdf: 'pdf:leggi',
  guardaPdf: 'pdf:guarda',
  cercaCodici: 'pdf:cerca-codici',
  scriviCodici: 'codici:scrivi',
  // ticket 14: Scarica in Excel
  scaricaInExcel: 'excel:scarica',
  apriFileScaricato: 'excel:apri',
} as const satisfies typeof CanaliCondivisi

const { contextBridge, ipcRenderer, webUtils } = require('electron') as typeof import('electron')

const ponte: Ponte = {
  apri: () => ipcRenderer.invoke(CANALI.apri),
  scegliCartella: () => ipcRenderer.invoke(CANALI.scegliCartella),
  tornaAllaCopia: (file) => ipcRenderer.invoke(CANALI.tornaAllaCopia, file),
  creaFileVuoto: () => ipcRenderer.invoke(CANALI.creaFileVuoto),
  apriInEsplora: (quale) => ipcRenderer.invoke(CANALI.apriInEsplora, quale),
  prezzoFineMese: (richiesta, mese) => ipcRenderer.invoke(CANALI.prezzoFineMese, richiesta, mese),
  cambioFineMese: (valuta, mese) => ipcRenderer.invoke(CANALI.cambioFineMese, valuta, mese),
  salvaMese: (mese) => ipcRenderer.invoke(CANALI.salvaMese, mese),
  valoriRiferimento: (id, date) => ipcRenderer.invoke(CANALI.valoriRiferimento, id, date),
  nicIstat: (mesi) => ipcRenderer.invoke(CANALI.nicIstat, mesi),
  correggiPrezzo: (c) => ipcRenderer.invoke(CANALI.correggiPrezzo, c),
  // ticket 13: la pagina Dati
  correggiDato: (c) => ipcRenderer.invoke(CANALI.correggiDato, c),
  tornaAQuestaCopia: (file) => ipcRenderer.invoke(CANALI.tornaAQuestaCopia, file),
  scriviRiferimento: (s) => ipcRenderer.invoke(CANALI.scriviRiferimento, s),
  modificaMovimento: (m) => ipcRenderer.invoke(CANALI.modificaMovimento, m),
  // Il percorso di un file trascinato o scelto si sa solo qui, nel preload.
  leggiPdf: (file) => ipcRenderer.invoke(CANALI.leggiPdf, file.map((f) => webUtils.getPathForFile(f))),
  guardaPdf: (percorso) => ipcRenderer.invoke(CANALI.guardaPdf, percorso),
  cercaCodici: (r) => ipcRenderer.invoke(CANALI.cercaCodici, r),
  scriviCodici: (s) => ipcRenderer.invoke(CANALI.scriviCodici, s),
  // ticket 14: Scarica in Excel
  scaricaInExcel: (libro) => ipcRenderer.invoke(CANALI.scaricaInExcel, libro),
  apriFileScaricato: (percorso) => ipcRenderer.invoke(CANALI.apriFileScaricato, percorso),
}

contextBridge.exposeInMainWorld('ponte', ponte)

// L'aggiornamento dell'applicazione, in window.aggiornamento (vedi src/dati/aggiornamento.ts).
// Anche qui i nomi dei canali sono ripetuti, e il controllo dei tipi verifica che siano uguali.
const CANALI_AGGIORNAMENTO = {
  leggi: 'aggiornamento:leggi',
  rispondi: 'aggiornamento:rispondi',
  cambiato: 'aggiornamento:cambiato',
} as const satisfies typeof CanaliAggiornamento

const aggiornamento: PonteAggiornamento = {
  leggi: () => ipcRenderer.invoke(CANALI_AGGIORNAMENTO.leggi),
  rispondi: (installa) => ipcRenderer.invoke(CANALI_AGGIORNAMENTO.rispondi, installa),
  quandoCambia: (fai) => {
    const ascolta = (_evento: unknown, s: StatoAggiornamento) => fai(s)
    ipcRenderer.on(CANALI_AGGIORNAMENTO.cambiato, ascolta)
    return () => void ipcRenderer.off(CANALI_AGGIORNAMENTO.cambiato, ascolta)
  },
}

contextBridge.exposeInMainWorld('aggiornamento', aggiornamento)
