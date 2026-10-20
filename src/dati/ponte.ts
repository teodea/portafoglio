// Il confine tra le pagine e il processo principale: le poche funzioni che il preload espone
// in window.ponte. Le pagine non toccano mai i file: chiedono qui.
// Modulo puro, solo tipi e costanti: lo usano il preload, il processo principale e le pagine.
import { CANALI_AGGIORNA, type PonteAggiorna } from './aggiorna/ponte-aggiorna.ts'
import { CANALI_RIFERIMENTI, type PonteRiferimenti } from './aggiorna/ponte-riferimenti.ts'
import type { Problema } from './controllo.ts'
import { CANALI_CORREZIONE, type PonteCorrezione } from './correzione.ts'
import { CANALI_CORREZIONE_DATO, type PonteCorrezioneDato } from './correzione-dati.ts'
import { CANALI_CODICI, type PonteCodici } from './codici-riserve.ts'
import { CANALI_COPIE, type PonteCopie } from './torna-copia.ts'
import { CANALI_RIFERIMENTO_A_MANO, type PonteRiferimentoAMano } from './correzione-riferimento.ts'
import type { Copia } from './copie.ts'
import { CANALI_MOVIMENTI, type PonteMovimenti } from './movimenti.ts'
import { CANALI_PDF, type PontePdf } from './titolo-nuovo.ts'
import { CANALI_EXCEL, type PonteExcel } from './excel.ts'
import type { FileDati } from './tipi.ts'

export type Cartella = {
  /** Il percorso completo, es. C:\Users\…\OneDrive\Documents\Investimenti */
  percorso: string
  /** Solo il nome dell'ultima cartella, es. "Investimenti". */
  nome: string
}

/** Cosa trova l'applicazione quando apre (o riapre) la cartella dei dati. */
export type Apertura =
  | { stato: 'nessuna-cartella' }
  | { stato: 'cartella-mancante'; cartella: Cartella }
  | { stato: 'file-mancante'; cartella: Cartella }
  | {
      stato: 'pronto'
      cartella: Cartella
      dati: FileDati
      /** Quando è stato controllato il file, ISO. */
      controllato: string
      /** Le copie in "copie", dalla più recente. */
      copie: Copia[]
    }
  | {
      stato: 'rotto'
      cartella: Cartella
      problema: Problema
      controllato: string
      copie: Copia[]
      /** Se un tentativo di tornare a una copia non è andato, il perché in parole. */
      avviso?: string
    }

export type QualeCartella = 'dati' | 'copie'

export type Ponte = PonteAggiorna &
  PonteRiferimenti &
  PonteCorrezione &
  PonteCorrezioneDato &
  PonteCopie &
  PonteRiferimentoAMano &
  PonteMovimenti &
  PontePdf &
  PonteCodici &
  PonteExcel & {
  /** Apre la cartella ricordata, controlla il file e lo legge. */
  apri(): Promise<Apertura>
  /** La finestra di Windows per scegliere la cartella; null se si chiude senza scegliere. */
  scegliCartella(): Promise<Apertura | null>
  /** Solo con il file rotto: mette da parte il file rotto in "copie" e rimette questa copia. */
  tornaAllaCopia(file: string): Promise<Apertura>
  /** Solo se nella cartella non c'è portafoglio.json: ne crea uno vuoto. */
  creaFileVuoto(): Promise<Apertura>
  /** Apre la cartella dei dati (o la sottocartella delle copie) in Esplora file. */
  apriInEsplora(quale: QualeCartella): Promise<void>
}

/** I nomi dei canali tra preload e processo principale. */
export const CANALI = {
  apri: 'dati:apri',
  scegliCartella: 'dati:scegli-cartella',
  tornaAllaCopia: 'dati:torna-alla-copia',
  creaFileVuoto: 'dati:crea-file-vuoto',
  apriInEsplora: 'dati:apri-in-esplora',
  ...CANALI_AGGIORNA,
  ...CANALI_RIFERIMENTI,
  ...CANALI_CORREZIONE,
  ...CANALI_CORREZIONE_DATO,
  ...CANALI_COPIE,
  ...CANALI_RIFERIMENTO_A_MANO,
  ...CANALI_MOVIMENTI,
  ...CANALI_PDF,
  ...CANALI_CODICI,
  ...CANALI_EXCEL,
} as const
