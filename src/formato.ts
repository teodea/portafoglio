// Date, mesi e numeri in parole, all'italiana. Modulo puro: lo usano le pagine e i conti.
import type { Cifra } from './conti/spiegazione.ts'

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

/** Il vero segno meno, non il trattino. */
export const MENO = '−'

/** "2026-09-30" → "30/09/2026" */
export function data(aaaammgg: string): string {
  return aaaammgg.slice(0, 10).split('-').reverse().join('/')
}

/** "2026-09-30" → "settembre 2026" */
export function mese(aaaammgg: string): string {
  return `${MESI[Number(aaaammgg.slice(5, 7)) - 1]} ${aaaammgg.slice(0, 4)}`
}

/** "2026-09-30" → "settembre" */
export function nomeMese(aaaammgg: string): string {
  return MESI[Number(aaaammgg.slice(5, 7)) - 1]
}

/** "2026-09-30" → "Settembre" */
export function NomeMese(aaaammgg: string): string {
  const m = nomeMese(aaaammgg)
  return m.charAt(0).toUpperCase() + m.slice(1)
}

/** "2026-09-30" → "set 26" */
export function meseBreve(aaaammgg: string): string {
  return `${nomeMese(aaaammgg).slice(0, 3)} ${aaaammgg.slice(2, 4)}`
}

/** Un istante ISO → "oggi alle 9:12", "ieri alle 18:02" o "03/11/2026 alle 18:02". */
export function quando(iso: string, adesso = new Date()): string {
  const d = new Date(iso)
  const ora = d.toLocaleTimeString('it-IT', { hour: 'numeric', minute: '2-digit' })
  const giorno = (x: Date) => x.toDateString()
  const ieri = new Date(adesso)
  ieri.setDate(ieri.getDate() - 1)
  if (giorno(d) === giorno(adesso)) return `oggi alle ${ora}`
  if (giorno(d) === giorno(ieri)) return `ieri alle ${ora}`
  return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} alle ${ora}`
}

/** "C:\Users\Io\OneDrive\Documents\Investimenti" → "OneDrive › Documents › Investimenti" */
export function percorsoBreve(percorso: string): string {
  const parti = percorso.split(/[/\\]+/).filter(Boolean)
  return parti.slice(-3).join(' › ')
}

// ---------- numeri ----------

/** Arrotonda come si scrive: evita "−0" e "+0,0%". */
function arrotonda(n: number, decimali: number): number {
  const f = 10 ** decimali
  const r = Math.round(n * f) / f
  return r === 0 ? 0 : r
}

/** 12345,6 → "12.345,6" (sempre il punto delle migliaia, anche sotto 10.000). Senza segno. */
export function numero(n: number, decimali = 0, massimo = decimali): string {
  return Math.abs(n).toLocaleString('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: massimo,
    useGrouping: 'always',
  })
}

/** Il segno di un numero come sarà scritto con quei decimali: 1, −1 o 0. */
export function segno(n: number, decimali = 0): 1 | -1 | 0 {
  const r = arrotonda(n, decimali)
  return r > 0 ? 1 : r < 0 ? -1 : 0
}

/** 12345 → "12.345 €"; un negativo ha il segno meno. */
export function euro(n: number, decimali = 0): string {
  return `${segno(n, decimali) < 0 ? MENO : ''}${numero(n, decimali)} €`
}

/** Un guadagno: sempre con il segno, "+12.345 €" o "−12.345 €"; lo zero senza segno. */
export function guadagnoEuro(n: number, decimali = 0): string {
  const s = segno(n, decimali)
  return `${s > 0 ? '+' : s < 0 ? MENO : ''}${numero(n, decimali)} €`
}

/** Una frazione come percentuale con il segno: 0,0342 → "+3,4%". */
export function percentuale(frazione: number): string {
  const s = segno(frazione * 100, 1)
  return `${s > 0 ? '+' : s < 0 ? MENO : ''}${numero(arrotonda(frazione * 100, 1), 1)}%`
}

/** Il segno di una percentuale come sarà scritta. */
export function segnoPercentuale(frazione: number): 1 | -1 | 0 {
  return segno(frazione * 100, 1)
}

/** Un prezzo nella sua valuta: "12,34 €", "52,845 GBP". */
export function prezzo(n: number, valuta: string): string {
  return `${numero(n, 2, 4)} ${valuta === 'EUR' ? '€' : valuta}`
}

/** Il cambio BCE: unità di valuta per 1 euro, "0,85461". */
export function cambio(n: number): string {
  return numero(n, 4, 5)
}

/** Le quote: "1.000", "12,5". */
export function quote(n: number): string {
  return numero(n, 0, 4)
}

/** Una cifra della spiegazione, scritta. */
export function cifra(c: Cifra): string {
  switch (c.tipo) {
    case 'euro':
      return euro(c.n, c.decimali ?? 2)
    case 'guadagno':
      return guadagnoEuro(c.n, c.decimali ?? 2)
    case 'percentuale':
      return percentuale(c.n)
    case 'quote':
      return quote(c.n)
    case 'prezzo':
      return prezzo(c.n, c.valuta)
    case 'cambio':
      return cambio(c.n)
    case 'testo':
      return c.testo
  }
}

/** Il segno di una cifra che si colora (guadagni e percentuali), 0 per le altre. */
export function segnoCifra(c: Cifra): 1 | -1 | 0 {
  if (c.tipo === 'guadagno') return segno(c.n, c.decimali ?? 2)
  if (c.tipo === 'percentuale') return segnoPercentuale(c.n)
  return 0
}
