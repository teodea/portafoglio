// I sei riferimenti di borsa: le chiusure giornaliere da investing.com (una richiesta per riferimento copre
// tutta la storia che serve) e, per quelli in dollari, il cambio BCE dello stesso giorno.
// Di ogni data chiesta si prende la chiusura: per una fine mese l'ultima seduta del mese, per la data di un
// movimento la seduta di quel giorno o, se la borsa era chiusa, quella prima.
// Escono dal PC solo il codice del riferimento e le date, mai le quote o i soldi. Solo Node: le prove
// usano risposte finte; in Electron investing.com si chiede con la rete di Chromium (vedi electron/riferimenti.ts).
import { fineMese, inizioMese, meseDi, oggiLocale } from '../../src/dati/aggiorna/calendario.ts'
import { DESCRIZIONE, type EsitoRiferimento, type ValoreArrivato } from '../../src/dati/aggiorna/riferimenti.ts'
import type { IdRiferimento } from '../../src/dati/tipi.ts'
import { leggiBce } from './bce.ts'
import { dataInParole, NonVa, scaricaTesto, type Chiusura, type Scarica } from './comune.ts'

const INVESTING = 'https://api.investing.com/api/financialdata/historical/'
const INTESTAZIONI_INVESTING = {
  Accept: 'application/json',
  'domain-id': 'it',
  Origin: 'https://it.investing.com',
  Referer: 'https://it.investing.com/',
}
const BCE = 'https://data-api.ecb.europa.eu/service/data/EXR/'
/** Il servizio di investing.com dà al massimo circa 5000 righe per richiesta: si chiede a pezzi. */
const GIORNI_PER_RICHIESTA = 3000
/** Per la data di un movimento si guarda al massimo una settimana indietro. */
const GIORNI_INDIETRO = 7
/** Un secondo abbondante tra due richieste a investing.com, come faceva il motore dell'archivio. */
const PAUSA = 1100

let coda: Promise<unknown> = Promise.resolve()
let ultima = 0

function inFila<T>(lavoro: () => Promise<T>, pausa: number): Promise<T> {
  const turno = coda.then(async () => {
    const attesa = ultima + pausa - Date.now()
    if (attesa > 0) await new Promise((fatto) => setTimeout(fatto, attesa))
    ultima = Date.now()
    return lavoro()
  })
  coda = turno.catch(() => undefined)
  return turno
}

const giorno = (d: Date) => d.toISOString().slice(0, 10)
function piuGiorni(data: string, n: number): string {
  const d = new Date(data + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return giorno(d)
}

/** "17.160,41" → 17160.41 (numero all'italiana, come lo mostra il sito); NaN se non è un numero. */
function numeroItaliano(testo: string): number {
  const t = testo.trim().replace(/\./g, '').replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}

/**
 * Legge la risposta di investing.com: [{ rowDateTimestamp: "2026-09-30T00:00:00Z", last_close: "17.160,41",
 * last_closeRaw: "17160.41015625" }, …]. Vale il numero come lo mostra il sito ("last_close"): quello "Raw"
 * ha cifre in più che non esistono (17160.41015625). Gli indici si arrotondano a due decimali.
 */
export function leggiStoricoInvesting(testo: string): Chiusura[] {
  let valore: unknown
  try {
    valore = JSON.parse(testo)
  } catch {
    throw new NonVa('ha risposto con dati che non si leggono')
  }
  const righe = (valore as { data?: unknown } | null)?.data
  if (righe === null || righe === undefined) return []
  if (!Array.isArray(righe)) throw new NonVa('ha risposto con dati che non si leggono')
  const chiusure: Chiusura[] = []
  for (const r of righe as { rowDateTimestamp?: unknown; last_close?: unknown; last_closeRaw?: unknown }[]) {
    const data = typeof r.rowDateTimestamp === 'string' ? r.rowDateTimestamp.slice(0, 10) : ''
    let prezzo = typeof r.last_close === 'string' ? numeroItaliano(r.last_close) : NaN
    if (!Number.isFinite(prezzo)) prezzo = Math.round(Number(r.last_closeRaw) * 10000) / 10000
    // Gli indici (migliaia di punti) si scrivono con due decimali: "134.154,9375" del sito è 134.154,94.
    if (prezzo >= 1000) prezzo = Math.round(prezzo * 100) / 100
    if (/^\d{4}-\d{2}-\d{2}$/.test(data) && Number.isFinite(prezzo) && prezzo > 0) chiusure.push({ data, prezzo })
  }
  return chiusure.sort((a, b) => a.data.localeCompare(b.data))
}

/** È la chiave di un mese (il suo ultimo giorno di calendario)? */
function eFineMese(data: string): boolean {
  return fineMese(meseDi(data)) === data
}

/**
 * La chiusura che vale per una data: per una fine mese l'ultima del mese, per un altro giorno quella del
 * giorno o al massimo di una settimana prima. Le chiusure devono essere in ordine di data.
 */
export function chiusuraPer<T extends { data: string }>(chiusure: readonly T[], data: string): T | null {
  const da = eFineMese(data) ? inizioMese(meseDi(data)) : piuGiorni(data, -GIORNI_INDIETRO)
  let scelta: T | null = null
  for (const c of chiusure) if (c.data >= da && c.data <= data) scelta = c
  return scelta
}

async function storicoInvesting(codice: number, da: string, a: string, scarica: Scarica, pausa: number): Promise<Chiusura[]> {
  const tutte: Chiusura[] = []
  for (let inizio = da; inizio <= a; ) {
    const fine = [piuGiorni(inizio, GIORNI_PER_RICHIESTA), a].sort()[0]
    const parametri = new URLSearchParams({ 'start-date': inizio, 'end-date': fine, 'time-frame': 'Daily', 'add-missing-rows': 'false' })
    const testo = await inFila(() => scaricaTesto(`${INVESTING}${codice}?${parametri}`, { headers: INTESTAZIONI_INVESTING }, scarica), pausa)
    tutte.push(...leggiStoricoInvesting(testo))
    inizio = piuGiorni(fine, 1)
  }
  return tutte.sort((x, y) => x.data.localeCompare(y.data))
}

async function cambiBce(valuta: string, da: string, a: string, scarica: Scarica): Promise<{ data: string; cambio: number }[]> {
  const url = `${BCE}D.${valuta}.EUR.SP00.A?startPeriod=${da}&endPeriod=${a}&format=csvdata`
  return leggiBce(await scaricaTesto(url, {}, scarica)).sort((x, y) => x.data.localeCompare(y.data))
}

export type ReteRiferimenti = { investing: Scarica; bce: Scarica }

/**
 * I valori di un riferimento alle date chieste (fine mese e date dei movimenti). Le date di mesi non
 * ancora finiti non si chiedono. Esempio: S&P 500, ["2026-09-30"] → 17.160,41 dollari del 30/09/2026,
 * con il cambio BCE del 30/09/2026.
 */
export async function valoriRiferimento(
  id: IdRiferimento,
  date: readonly string[],
  rete: ReteRiferimenti,
  oggi = oggiLocale(),
  pausa = PAUSA,
): Promise<EsitoRiferimento> {
  const r = DESCRIZIONE[id]
  const chieste = [...new Set(date)].filter((d) => d < oggi).sort()
  if (!chieste.length) return date.length ? { ok: false, perche: 'il mese non è ancora finito' } : { ok: true, valori: [], mancano: [] }
  const da = piuGiorni(chieste[0], -GIORNI_INDIETRO - 3)
  const a = chieste.at(-1)!
  let chiusure: Chiusura[]
  try {
    chiusure = await storicoInvesting(r.codiceInvesting, da, a, rete.investing, pausa)
  } catch (e) {
    return { ok: false, perche: `investing.com ${e instanceof NonVa ? e.message : 'non ha risposto'}` }
  }
  let cambi: { data: string; cambio: number }[] = []
  if (r.valuta !== 'EUR') {
    try {
      cambi = await cambiBce(r.valuta, da, a, rete.bce)
    } catch (e) {
      return { ok: false, perche: `il cambio del dollaro non è arrivato: la BCE ${e instanceof NonVa ? e.message : 'non ha risposto'}` }
    }
  }
  const valori: ValoreArrivato[] = []
  const mancano: string[] = []
  for (const data of chieste) {
    const c = chiusuraPer(chiusure, data)
    if (!c) {
      mancano.push(data)
      continue
    }
    const note: string[] = []
    if (!eFineMese(data) && c.data !== data) note.push(`il ${dataInParole(data)} la borsa era chiusa: vale la chiusura del ${dataInParole(c.data)}`)
    const v: ValoreArrivato = { data, valore: c.prezzo, seduta: c.data }
    if (r.valuta !== 'EUR') {
      // Il cambio BCE dello stesso giorno; se quel giorno la BCE non l'ha pubblicato, quello prima.
      const cambio = chiusuraPer(cambi, c.data)
      if (!cambio) {
        mancano.push(data)
        continue
      }
      v.cambio = cambio.cambio
      if (cambio.data !== c.data) note.push(`cambio BCE del ${dataInParole(cambio.data)}`)
    }
    if (note.length) v.nota = note.join('; ')
    valori.push(v)
  }
  if (!valori.length && mancano.length)
    return { ok: false, perche: `investing.com non ha i valori del ${mancano.map(dataInParole).slice(0, 3).join(', ')}${mancano.length > 3 ? '…' : ''}` }
  return { ok: true, valori, mancano }
}
