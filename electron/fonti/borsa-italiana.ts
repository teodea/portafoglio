// Borsa Italiana: le chiusure giornaliere dell'ultimo anno, dal servizio dei grafici del suo sito.
// Si chiede con il simbolo del titolo (es. "MOND.ETF"); la risposta è una lista
// [istante, chiusura, apertura, massimo, minimo, chiusura, volume] con l'istante a mezzanotte UTC del giorno.
// Al browser il sito non risponde (vale solo per le sue pagine), al processo principale sì.
import type { RichiestaPrezzo } from '../../src/dati/aggiorna/fonti.ts'
import { NonVa, scaricaTesto, type Chiusura, type Scarica } from './comune.ts'

const INDIRIZZO = 'https://charts.borsaitaliana.it/charts/services/ChartWService.asmx/GetPricesWithVolume'

function richiesta(chiave: string) {
  return JSON.stringify({
    request: {
      SampleTime: '1d',
      TimeFrame: '1y',
      RequestedDataSetType: 'ohlc',
      ChartPriceType: 'price',
      Key: chiave,
      OffSetToGMT: 0,
      FromDate: null,
      ToDate: null,
      UseDelay: true,
      KeyType: 'Topic',
      KeyType2: 'Topic',
      Language: 'it-IT',
    },
  })
}

/** Legge la risposta del servizio. */
export function leggiBorsaItaliana(testo: string): Chiusura[] {
  let valore: unknown
  try {
    valore = JSON.parse(testo)
  } catch {
    throw new NonVa('ha risposto con dati che non si leggono')
  }
  const righe = (valore as { d?: unknown } | null)?.d
  if (!Array.isArray(righe)) throw new NonVa('ha risposto con dati che non si leggono')
  const chiusure: Chiusura[] = []
  for (const r of righe) {
    if (!Array.isArray(r) || typeof r[0] !== 'number' || typeof r[1] !== 'number') continue
    chiusure.push({ data: new Date(r[0]).toISOString().slice(0, 10), prezzo: r[1] })
  }
  return chiusure
}

export async function chiusureBorsaItaliana(t: RichiestaPrezzo, scarica: Scarica = fetch): Promise<Chiusura[]> {
  if (!t.simbolo) throw new NonVa('nel file manca il simbolo del titolo, che serve per chiedere il prezzo')
  // Gli ETF stanno sotto ".ETF", le azioni sotto ".MTA".
  for (const chiave of [`${t.simbolo}.ETF`, `${t.simbolo}.MTA`]) {
    const testo = await scaricaTesto(
      INDIRIZZO,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8', Referer: 'https://www.borsaitaliana.it/' },
        body: richiesta(chiave),
      },
      scarica,
    )
    const chiusure = leggiBorsaItaliana(testo)
    if (chiusure.length) return chiusure
  }
  throw new NonVa(`non conosce il simbolo ${t.simbolo}`)
}
