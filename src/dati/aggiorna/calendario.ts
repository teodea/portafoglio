// I mesi e i giorni di borsa. "Fine mese" = la chiusura dell'ultimo giorno di borsa del mese.
// Un mese si scrive "AAAA-MM" (es. "2026-10"); nel file la chiave del mese è il suo ultimo giorno
// di calendario ("2026-10-31"), come nei prezzi caricati dal file Excel.
// Modulo puro: lo usano le pagine e il processo principale.
import type { Borsa } from '../tipi.ts'

export const NOMI_MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const

const due = (n: number) => String(n).padStart(2, '0')
const giorno = (d: Date) => `${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}`
const utc = (anno: number, mese: number, g: number) => new Date(Date.UTC(anno, mese - 1, g))

/** "2026-10-31" → "2026-10" */
export function meseDi(data: string): string {
  return data.slice(0, 7)
}

/** "2026-10" → "2026-10-31" */
export function fineMese(mese: string): string {
  const [a, m] = mese.split('-').map(Number)
  return giorno(utc(a, m + 1, 0))
}

/** "2026-10" → "2026-10-01" */
export function inizioMese(mese: string): string {
  return mese + '-01'
}

/** "2026-12" → "2027-01"; con passi negativi va indietro. */
export function meseDopo(mese: string, passi = 1): string {
  const [a, m] = mese.split('-').map(Number)
  const d = utc(a, m + passi, 1)
  return giorno(d).slice(0, 7)
}

/** "2026-10" → "ottobre" */
export function nomeMese(mese: string): string {
  return NOMI_MESI[Number(mese.slice(5, 7)) - 1]
}

/** "2026-10" → "Ottobre" */
export function NomeMese(mese: string): string {
  const n = nomeMese(mese)
  return n[0].toUpperCase() + n.slice(1)
}

/** "2026-10" → "ottobre 2026" */
export function meseEAnno(mese: string): string {
  return `${nomeMese(mese)} ${mese.slice(0, 4)}`
}

/** Il giorno di oggi "AAAA-MM-GG", con l'ora del PC (non UTC). */
export function oggiLocale(adesso = new Date()): string {
  return `${adesso.getFullYear()}-${due(adesso.getMonth() + 1)}-${due(adesso.getDate())}`
}

/** Un mese è finito quando è finito il suo ultimo giorno di calendario. */
export function meseFinito(mese: string, oggi: string): boolean {
  return oggi > fineMese(mese)
}

// ---------- i giorni di chiusura delle borse ----------

function pasqua(anno: number): Date {
  const a = anno % 19
  const b = Math.floor(anno / 100)
  const c = anno % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mese = Math.floor((h + l - 7 * m + 114) / 31)
  const g1 = ((h + l - 7 * m + 114) % 31) + 1
  return utc(anno, mese, g1)
}

const piuGiorni = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

/** Il primo (o l'ultimo, con n = -1) lunedì del mese. */
function lunedi(anno: number, mese: number, n: 1 | -1): Date {
  let d = n === 1 ? utc(anno, mese, 1) : utc(anno, mese + 1, 0)
  while (d.getUTCDay() !== 1) d = piuGiorni(d, n)
  return d
}

/** Una festività inglese che cade nel fine settimana si sposta al lunedì (o martedì) dopo. */
function spostaInglese(d: Date, occupati: Set<string>): Date {
  let x = d
  while (x.getUTCDay() === 0 || x.getUTCDay() === 6 || occupati.has(giorno(x))) x = piuGiorni(x, 1)
  return x
}

/** I giorni feriali in cui la borsa è chiusa, nell'anno. */
export function giorniChiusi(borsa: Borsa, anno: number): Set<string> {
  const p = pasqua(anno)
  const venerdiSanto = piuGiorni(p, -2)
  const pasquetta = piuGiorni(p, 1)
  const fissi = (...md: [number, number][]) => md.map(([m, g]) => utc(anno, m, g))
  let giorni: Date[]
  switch (borsa) {
    case 'MIL':
      giorni = [...fissi([1, 1], [5, 1], [8, 15], [12, 24], [12, 25], [12, 26], [12, 31]), venerdiSanto, pasquetta]
      break
    case 'XET':
    case 'FRA':
      giorni = [...fissi([1, 1], [5, 1], [12, 24], [12, 25], [12, 26], [12, 31]), venerdiSanto, pasquetta]
      break
    case 'PAR':
      giorni = [...fissi([1, 1], [5, 1], [12, 25], [12, 26]), venerdiSanto, pasquetta]
      break
    case 'LON': {
      const occupati = new Set<string>()
      const aggiungi = (d: Date) => occupati.add(giorno(d))
      aggiungi(spostaInglese(utc(anno, 1, 1), occupati))
      aggiungi(venerdiSanto)
      aggiungi(pasquetta)
      aggiungi(lunedi(anno, 5, 1))
      aggiungi(lunedi(anno, 5, -1))
      aggiungi(lunedi(anno, 8, -1))
      aggiungi(spostaInglese(utc(anno, 12, 25), occupati))
      aggiungi(spostaInglese(utc(anno, 12, 26), occupati))
      return occupati
    }
  }
  return new Set(giorni.map(giorno))
}

/** L'ultimo giorno di borsa del mese, "AAAA-MM-GG". */
export function ultimaSeduta(borsa: Borsa, mese: string): string {
  const chiusi = giorniChiusi(borsa, Number(mese.slice(0, 4)))
  const [a, m] = mese.split('-').map(Number)
  let d = utc(a, m + 1, 0)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || chiusi.has(giorno(d))) d = piuGiorni(d, -1)
  return giorno(d)
}
