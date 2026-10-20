// Tornare a una copia dalla scheda Copie della pagina Dati (ticket 13, mappa 27), con il file a posto:
// prima si copia il file di adesso in "copie" (così si può tornare indietro), poi si rimette la copia scelta.
// Diverso da "Torna all'ultima copia" della schermata del file rotto, che mette da parte il file rotto.
// Modulo puro: tipi, canale e il perché della copia.
import { quandoInParole, type Copia } from './copie.ts'
import type { Apertura } from './ponte.ts'

export type EsitoRitorno =
  | {
      esito: 'fatto'
      apertura: Apertura
      /** La copia del file com'era prima di tornare indietro: "Torna a questa copia" su di lei rimette tutto. */
      copia: string
    }
  /** Il file è stato cambiato da un altro PC (o con Blocco note): non si è scritto niente, i dati sono ricaricati. */
  | { esito: 'cambiato'; apertura: Apertura }
  | { esito: 'errore'; perche: string }

export type PonteCopie = {
  /** Copia il file di adesso in "copie", poi rimette al suo posto la copia scelta (un nome dentro "copie"). */
  tornaAQuestaCopia(file: string): Promise<EsitoRitorno>
}

export const CANALI_COPIE = { tornaAQuestaCopia: 'copie:torna' } as const

/**
 * Il perché della copia fatta prima di tornare indietro, nel suo nome:
 * "prima di tornare alla copia del 16.10.2026 alle 18.02". Nei nomi dei file di Windows niente "/" né ":".
 */
export function percheDelRitorno(c: Pick<Copia, 'quando'>): string {
  return `prima di tornare alla copia del ${quandoInParole(c.quando).replace(/\//g, '.').replace(':', '.')}`
}
