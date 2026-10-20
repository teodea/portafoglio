// Il controllo di investing.com (ticket 27 della mappa): accanto al prezzo della borsa, il prezzo che dà
// investing.com per lo stesso fine mese. "uguale", "diverso di +0,6%", oppure perché non si è potuto fare.
// Si vede nella lista di Aggiorna, nel pannello del prezzo e (ticket 13) nella pagina Dati.
// Modulo puro.
import type { ControlloPrezzo } from '../tipi.ts'
import type { RigaTitolo } from './lista.ts'

export type { ControlloPrezzo }

export type Confronto =
  | { tipo: 'uguale'; controllo: number; nota?: string }
  /** differenza: quanto il prezzo di investing.com è sopra (+) o sotto (−) quello scelto, in %. */
  | { tipo: 'diverso'; controllo: number; differenza: number; nota?: string }
  | { tipo: 'non-fatto'; perche: string }

function decimali(n: number): number {
  const t = String(n)
  const i = t.indexOf('.')
  return i < 0 ? 0 : t.length - i - 1
}

/**
 * Due prezzi sono uguali se lo sono arrotondati come il meno preciso dei due, ma almeno al centesimo:
 * 31,42 e 31,418 sono lo stesso prezzo (il file Excel arrotondava), 437 e 437,4 no.
 */
export function stessoPrezzo(a: number, b: number): boolean {
  const cifre = Math.max(2, Math.min(decimali(a), decimali(b)))
  return Math.abs(a - b) <= 0.5 * 10 ** -cifre + 1e-9
}

/** Il prezzo scelto confrontato con il controllo. Null se il controllo non c'è (es. i mesi del file Excel). */
export function confronta(prezzo: number, controllo: ControlloPrezzo | undefined): Confronto | null {
  if (!controllo) return null
  if ('perche' in controllo) return { tipo: 'non-fatto', perche: controllo.perche }
  const nota = controllo.nota ? { nota: controllo.nota } : {}
  if (stessoPrezzo(prezzo, controllo.prezzo)) return { tipo: 'uguale', controllo: controllo.prezzo, ...nota }
  return { tipo: 'diverso', controllo: controllo.prezzo, differenza: (controllo.prezzo / prezzo - 1) * 100, ...nota }
}

/** I perché fissi del controllo che non si fa. */
export const NON_FATTO = { giaInvesting: 'il prezzo viene già da investing.com' } as const

/**
 * Il controllo non si è fatto perché nel file manca il codice investing.com del titolo: lo stesso perché per
 * molti titoli, che si dice una volta sola e non riga per riga (collaudo del 19/10, punto 7).
 */
export function senzaCodice(c: Confronto | null): boolean {
  return c?.tipo === 'non-fatto' && /manca il codice investing\.com/.test(c.perche)
}

/** Quanti controlli sono uguali, quali sono diversi e quanti non si sono fatti: per il riquadro "<Mese> è salvato". */
export function contaControlli(confronti: { titolo: string; confronto: Confronto | null }[]): {
  uguali: number
  diversi: { titolo: string; differenza: number }[]
  nonFatti: number
  /** Quanti dei non fatti, perché nel file manca il codice investing.com del titolo. */
  senzaCodice: number
} {
  let uguali = 0
  let nonFatti = 0
  let senza = 0
  const diversi: { titolo: string; differenza: number }[] = []
  for (const { titolo, confronto: c } of confronti) {
    if (!c) continue
    if (c.tipo === 'uguale') uguali++
    else if (c.tipo === 'diverso') diversi.push({ titolo, differenza: c.differenza })
    else {
      nonFatti++
      if (senzaCodice(c)) senza++
    }
  }
  return { uguali, diversi, nonFatti, senzaCodice: senza }
}

/**
 * Il controllo di una riga della lista di Aggiorna, sul prezzo che si salverebbe. Un prezzo scritto a mano
 * non ha controllo ("—"); un prezzo tenuto com'era (Rifai) si confronta con il controllo appena arrivato.
 */
export function confrontoDellaRiga(r: RigaTitolo): Confronto | null {
  if (r.aMano !== undefined || r.stato.tipo !== 'arrivato') return null
  const p = r.tieni && r.prima ? r.prima.prezzo : r.stato.esito.prezzo
  return confronta(p, r.stato.esito.controllo)
}

/** Il controllo mandato dalla schermata ha la forma giusta (prima di scriverlo nel file). */
export function controlloValido(c: unknown): c is ControlloPrezzo {
  if (typeof c !== 'object' || c === null) return false
  const x = c as Record<string, unknown>
  if (typeof x.perche === 'string') return true
  return (
    typeof x.prezzo === 'number' &&
    Number.isFinite(x.prezzo) &&
    x.prezzo > 0 &&
    typeof x.seduta === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(x.seduta) &&
    (x.nota === undefined || typeof x.nota === 'string')
  )
}

const numero = (n: number, min: number, max: number, segno = false) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: min, maximumFractionDigits: max, signDisplay: segno ? 'exceptZero' : 'auto' }).format(n)

/** Il controllo in una frase, per il pannello "Da dove viene" del prezzo. Null se il controllo non c'è. */
export function controlloInParole(prezzo: number, valuta: string, controllo: ControlloPrezzo | undefined): string | null {
  const c = confronta(prezzo, controllo)
  if (!c) return null
  if (c.tipo === 'non-fatto') return `Controllo di investing.com non fatto: ${c.perche}.`
  const altro = c.nota ? ` (${c.nota})` : ''
  if (c.tipo === 'uguale') return `Controllo di investing.com: stesso prezzo${altro}.`
  const d = numero(c.differenza, Math.abs(c.differenza) < 0.1 ? 2 : 1, Math.abs(c.differenza) < 0.1 ? 2 : 1, true)
  return `Controllo di investing.com: dice ${numero(c.controllo, 2, 4)} ${valuta === 'EUR' ? '€' : valuta}${altro}, diverso di ${d}%. Di solito vale la borsa.`
}
