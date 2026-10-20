// Le funzioni del ponte per Aggiorna fine mese (si aggiungono a quelle di dati/ponte.ts).
// Modulo puro, solo tipi e costanti.
import type { Apertura } from '../ponte.ts'
import type { EsitoCambio, EsitoPrezzo, RichiestaPrezzo } from './fonti.ts'
import type { MeseDaSalvare } from './versione3.ts'

export type EsitoSalva =
  | { esito: 'salvato'; apertura: Apertura; /** Il nome della copia fatta prima di scrivere. */ copia: string }
  /** Il file è stato cambiato da un altro PC (o con Blocco note): non si è scritto niente, i dati sono ricaricati. */
  | { esito: 'cambiato'; apertura: Apertura }
  | { esito: 'errore'; perche: string }

export type PonteAggiorna = {
  /** Il prezzo di fine mese del titolo, dalla sua borsa ("AAAA-MM"). Escono dal PC solo i codici. */
  prezzoFineMese(richiesta: RichiestaPrezzo, mese: string): Promise<EsitoPrezzo>
  /** Il cambio BCE di fine mese (unità di valuta per 1 euro). */
  cambioFineMese(valuta: string, mese: string): Promise<EsitoCambio>
  /** Scrive il mese nel file con la scrittura sicura, dopo una copia. Il file passa alla versione 3. */
  salvaMese(mese: MeseDaSalvare): Promise<EsitoSalva>
}

export const CANALI_AGGIORNA = {
  prezzoFineMese: 'aggiorna:prezzo',
  cambioFineMese: 'aggiorna:cambio',
  salvaMese: 'aggiorna:salva',
} as const
