// Yahoo, la seconda riserva: il servizio dei grafici di Yahoo Finance, con il codice Yahoo del titolo
// scritto nel file dei dati (es. "MOND.MI"). Non è un servizio ufficiale; escono solo i codici.
// Le chiusure di Yahoo sono rettificate per i frazionamenti venuti dopo: si riportano al prezzo
// scambiato quel giorno. I titoli di Londra sono in pence ("GBp"): si dividono per 100.
// Vedi mappa/research/27-yahoo.md.
import { fineMese, inizioMese } from '../../src/dati/aggiorna/calendario.ts'
import type { RichiestaPrezzo } from '../../src/dati/aggiorna/fonti.ts'
import { NonVa, scaricaTesto, type Chiusura, type Scarica } from './comune.ts'

const INDIRIZZO = 'https://query1.finance.yahoo.com/v8/finance/chart/'

/** Le valute in centesimi: la valuta vera e per quanto dividere. */
const CENTESIMI: Record<string, [string, number]> = { GBp: ['GBP', 100], GBX: ['GBP', 100] }

export type GraficoYahoo = {
  /** La valuta vera del titolo, es. "GBP" anche se Yahoo scrive i prezzi in pence. */
  valuta: string
  /** 100 se i prezzi sono in centesimi. */
  divisore: number
  /** I frazionamenti: il giorno e il rapporto (2 vuol dire una quota diventa due). */
  frazionamenti: { data: string; rapporto: number }[]
  /** Le chiusure così come le dà Yahoo, rettificate per i frazionamenti e nella valuta di Yahoo. */
  chiusure: Chiusura[]
}

/** "2026-10-30" nel fuso della borsa, dall'istante in secondi. */
function giorno(istante: number, fuso: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(istante * 1000))
  } catch {
    return new Date(istante * 1000).toISOString().slice(0, 10)
  }
}

/** Legge la risposta del servizio dei grafici. */
export function leggiYahoo(testo: string): GraficoYahoo {
  let valore: unknown
  try {
    valore = JSON.parse(testo)
  } catch {
    throw new NonVa('ha risposto con dati che non si leggono')
  }
  type Risposta = {
    chart?: {
      result?: {
        meta?: { currency?: string; exchangeTimezoneName?: string }
        timestamp?: number[]
        indicators?: { quote?: { close?: (number | null)[] }[] }
        events?: { splits?: Record<string, { date?: number; numerator?: number; denominator?: number }> }
      }[]
      error?: { description?: string } | null
    }
  }
  const r = (valore as Risposta | null)?.chart?.result?.[0]
  if (!r?.meta) throw new NonVa('non conosce il codice del titolo')
  const fuso = r.meta.exchangeTimezoneName || 'UTC'
  const [valuta, divisore] = CENTESIMI[r.meta.currency ?? ''] ?? [r.meta.currency ?? '', 1]
  const frazionamenti = Object.values(r.events?.splits ?? {})
    .filter((s) => typeof s.date === 'number' && s.numerator && s.denominator)
    .map((s) => ({ data: giorno(s.date!, fuso), rapporto: s.numerator! / s.denominator! }))
  const istanti = r.timestamp ?? []
  const chiusure = r.indicators?.quote?.[0]?.close ?? []
  const lette: Chiusura[] = []
  istanti.forEach((t, i) => {
    const c = chiusure[i]
    if (typeof c === 'number' && Number.isFinite(c)) lette.push({ data: giorno(t, fuso), prezzo: c })
  })
  return { valuta, divisore, frazionamenti, chiusure: lette }
}

/** Il moltiplicatore che riporta un prezzo rettificato al prezzo scambiato quel giorno. */
export function fattoreFrazionamenti(frazionamenti: GraficoYahoo['frazionamenti'], data: string): number {
  return frazionamenti.filter((s) => s.data > data).reduce((f, s) => f * s.rapporto, 1)
}

/** Arrotonda al decimillesimo: i prezzi di Yahoo arrivano come 24.356000900268555. */
export const arrotonda = (n: number) => Math.round(n * 10000) / 10000

/** Il grafico dal giorno "da" fino a oggi (servono i frazionamenti venuti dopo). */
export async function graficoYahoo(codice: string, da: string, scarica: Scarica = fetch, adesso = Date.now()): Promise<GraficoYahoo> {
  const parametri = new URLSearchParams({
    period1: String(Math.floor(Date.parse(da + 'T00:00:00Z') / 1000)),
    period2: String(Math.floor(adesso / 1000)),
    interval: '1d',
    events: 'split',
  })
  return leggiYahoo(await scaricaTesto(`${INDIRIZZO}${encodeURIComponent(codice)}?${parametri}`, {}, scarica))
}

/** Le chiusure del mese, nella valuta del titolo, riportate al prezzo scambiato quel giorno. */
export async function chiusureYahoo(t: RichiestaPrezzo, mese: string, scarica: Scarica = fetch, adesso = Date.now()): Promise<Chiusura[]> {
  if (!t.codiceYahoo) throw new NonVa('non si può chiedere: nel file manca il codice Yahoo del titolo')
  const g = await graficoYahoo(t.codiceYahoo, inizioMese(mese), scarica, adesso)
  if (g.valuta !== t.valuta) throw new NonVa(`ha il titolo in ${g.valuta || 'un’altra valuta'}, nel file è in ${t.valuta}`)
  const fine = fineMese(mese)
  return g.chiusure
    .filter((c) => c.data <= fine)
    .map((c) => ({ data: c.data, prezzo: arrotonda((c.prezzo * fattoreFrazionamenti(g.frazionamenti, c.data)) / g.divisore) }))
}
