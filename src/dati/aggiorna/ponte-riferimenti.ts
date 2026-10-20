// Le funzioni del ponte per i riferimenti e l'inflazione (ticket 9), accanto a quelle di Aggiorna.
// Servono ad Aggiorna fine mese, e poi alla pagina Dati e al confronto per "Scarica di nuovo".
// Modulo puro, solo tipi e costanti.
import type { IdRiferimento } from '../tipi.ts'
import type { EsitoNic, EsitoRiferimento } from './riferimenti.ts'

export type PonteRiferimenti = {
  /** I valori del riferimento alle date chieste ("AAAA-MM-GG"), da investing.com e, se è in dollari, con il cambio BCE. */
  valoriRiferimento(id: IdRiferimento, date: string[]): Promise<EsitoRiferimento>
  /** Il NIC dei mesi chiesti ("AAAA-MM") da ISTAT, con una sola richiesta. */
  nicIstat(mesi: string[]): Promise<EsitoNic>
}

export const CANALI_RIFERIMENTI = {
  valoriRiferimento: 'riferimenti:valori',
  nicIstat: 'riferimenti:nic',
} as const
