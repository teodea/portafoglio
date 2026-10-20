// investing.com: la riserva quando la borsa non risponde, e il controllo accanto al prezzo della borsa.
// Lo storico arriva dal servizio dei prezzi del sito, con il codice della linea di quotazione scritto
// nel file dei dati (lo stesso che usava il motore dell'archivio). Il servizio risponde solo a un browser
// vero: nel processo principale si chiede con la rete di Chromium (vedi rete.ts).
// Come Yahoo, i prezzi sono rettificati per i frazionamenti e quelli di Londra sono in pence:
// frazionamenti e unità si prendono da Yahoo, se nel file c'è il codice Yahoo.
import { fineMese, inizioMese } from '../../src/dati/aggiorna/calendario.ts'
import type { RichiestaPrezzo } from '../../src/dati/aggiorna/fonti.ts'
import { NonVa, scaricaTesto, type Chiusura, type Scarica } from './comune.ts'
import { arrotonda, fattoreFrazionamenti, graficoYahoo, type GraficoYahoo } from './yahoo.ts'

export const INDIRIZZO = 'https://api.investing.com/api/financialdata/historical/'
export const INTESTAZIONI = {
  Accept: 'application/json',
  'domain-id': 'it',
  Origin: 'https://it.investing.com',
  Referer: 'https://it.investing.com/',
}
/** Un secondo abbondante tra due richieste al sito, come faceva il motore dell'archivio. */
export const PAUSA = 1100

let coda: Promise<unknown> = Promise.resolve()
let ultima = 0

/** Le richieste a investing.com si mettono in fila, una ogni PAUSA millisecondi. */
export function inFila<T>(lavoro: () => Promise<T>, pausa = PAUSA): Promise<T> {
  const turno = coda.then(async () => {
    const attesa = ultima + pausa - Date.now()
    if (attesa > 0) await new Promise((fatto) => setTimeout(fatto, attesa))
    ultima = Date.now()
    return lavoro()
  })
  coda = turno.catch(() => undefined)
  return turno
}

/** Legge la risposta del servizio: [{ rowDateTimestamp: "2026-10-30T00:00:00Z", last_closeRaw: "13.1" }, …]. */
export function leggiInvesting(testo: string): Chiusura[] {
  let valore: unknown
  try {
    valore = JSON.parse(testo)
  } catch {
    throw new NonVa('ha risposto con dati non leggibili')
  }
  const righe = (valore as { data?: unknown } | null)?.data
  if (righe === null) return []
  if (!Array.isArray(righe)) throw new NonVa('ha risposto con dati non leggibili')
  const chiusure: Chiusura[] = []
  for (const r of righe as { rowDateTimestamp?: unknown; last_closeRaw?: unknown }[]) {
    const data = typeof r.rowDateTimestamp === 'string' ? r.rowDateTimestamp.slice(0, 10) : ''
    const prezzo = Number(r.last_closeRaw)
    if (/^\d{4}-\d{2}-\d{2}$/.test(data) && Number.isFinite(prezzo) && prezzo > 0) chiusure.push({ data, prezzo })
  }
  return chiusure
}

export type Rete = { investing: Scarica; yahoo: Scarica }

export async function chiusureInvesting(
  t: RichiestaPrezzo,
  mese: string,
  rete: Rete,
  adesso = Date.now(),
  pausa = PAUSA,
): Promise<Chiusura[]> {
  if (!t.codiceInvesting) throw new NonVa('non si può chiedere: nel file manca il codice investing.com del titolo')
  // Unità e frazionamenti da Yahoo. Senza, un titolo in sterline non si può usare (pence o sterline?).
  let yahoo: GraficoYahoo | null = null
  if (t.codiceYahoo) {
    try {
      yahoo = await graficoYahoo(t.codiceYahoo, inizioMese(mese), rete.yahoo, adesso)
    } catch {
      yahoo = null
    }
  }
  if (t.valuta !== 'EUR' && !yahoo)
    throw new NonVa('non si può usare: senza Yahoo non si sa se il prezzo è in sterline o in pence')
  const parametri = new URLSearchParams({
    'start-date': inizioMese(mese),
    'end-date': fineMese(mese),
    'time-frame': 'Daily',
    'add-missing-rows': 'false',
  })
  const testo = await inFila(() => scaricaTesto(`${INDIRIZZO}${t.codiceInvesting}?${parametri}`, { headers: INTESTAZIONI }, rete.investing), pausa)
  const divisore = yahoo?.divisore ?? 1
  return leggiInvesting(testo).map((c) => ({
    data: c.data,
    prezzo: arrotonda((c.prezzo * (yahoo ? fattoreFrazionamenti(yahoo.frazionamenti, c.data) : 1)) / divisore),
  }))
}
