// Pezzi comuni alle fonti: scaricare con un tempo massimo, dire in parole perché non è andata,
// scegliere la chiusura di fine mese tra quelle arrivate. Solo Node: le prove lo usano senza Electron.
import { fineMese, inizioMese, ultimaSeduta } from '../../src/dati/aggiorna/calendario.ts'
import type { Borsa } from '../../src/dati/tipi.ts'

/** Una chiusura giornaliera: il giorno di borsa e il prezzo nella valuta del titolo. */
export type Chiusura = { data: string; prezzo: number }

/** Un errore da far vedere così com'è, in parole: "non ha risposto (errore 503)". */
export class NonVa extends Error {}

/** I siti rispondono meglio a un browser normale che a un programma senza nome. */
export const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

export type Scarica = (url: string, init?: RequestInit) => Promise<Response>

/** fetch con un tempo massimo e gli errori in parole. */
export async function scaricaTesto(url: string, init: RequestInit = {}, scarica: Scarica = fetch, secondi = 25): Promise<string> {
  let risposta: Response
  try {
    risposta = await scarica(url, {
      ...init,
      headers: { 'User-Agent': AGENTE, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(secondi * 1000),
    })
  } catch (e) {
    const nome = e instanceof Error ? e.name : ''
    if (nome === 'TimeoutError' || nome === 'AbortError') throw new NonVa('non ha risposto in tempo')
    throw new NonVa('non ha risposto: controllare la connessione a internet')
  }
  if (!risposta.ok) throw new NonVa(`non ha risposto (errore ${risposta.status})`)
  return await risposta.text()
}

/** "2026-10-30" → "30/10/2026" */
export function dataInParole(data: string): string {
  return data.split('-').reverse().join('/')
}

/**
 * La chiusura di fine mese: l'ultima chiusura dentro il mese. Se non è dell'ultimo giorno di borsa
 * (per esempio quel giorno il titolo non ha avuto scambi) la nota lo dice. Null se nel mese non ce n'è.
 */
export function chiusuraDiFineMese(
  chiusure: Chiusura[],
  mese: string,
  borsa: Borsa,
): { prezzo: number; seduta: string; nota?: string } | null {
  const da = inizioMese(mese)
  const a = fineMese(mese)
  let migliore: Chiusura | null = null
  for (const c of chiusure)
    if (c.data >= da && c.data <= a && Number.isFinite(c.prezzo) && c.prezzo > 0 && (!migliore || c.data > migliore.data)) migliore = c
  if (!migliore) return null
  const attesa = ultimaSeduta(borsa, mese)
  return {
    prezzo: migliore.prezzo,
    seduta: migliore.data,
    ...(migliore.data < attesa
      ? { nota: `chiusura del ${dataInParole(migliore.data)}: del ${dataInParole(attesa)} la fonte non ha il prezzo` }
      : {}),
  }
}

/** Un numero scritto all'inglese, "1,234.56" → 1234.56; NaN se non è un numero. */
export function numeroInglese(testo: string): number {
  const t = testo.trim().replace(/,/g, '')
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}
