// Quali mesi aggiornare e quali titoli servono per un mese.
// Modulo puro.
import type { FileDati, PrezzoFineMese, Titolo } from '../tipi.ts'
import { fineMese, meseDi, meseDopo, meseFinito } from './calendario.ts'

/** L'ultimo mese che ha prezzi nel file, "AAAA-MM", o null. */
export function ultimoMeseSalvato(dati: FileDati): string | null {
  let ultimo: string | null = null
  for (const p of dati.prezzi ?? []) if (!ultimo || p.data > ultimo) ultimo = p.data
  return ultimo ? meseDi(ultimo) : null
}

/** Il primo mese con un'operazione, "AAAA-MM", o null. */
function primoMeseConOperazioni(dati: FileDati): string | null {
  let primo: string | null = null
  for (const o of dati.operazioni ?? []) if (!primo || o.data < primo) primo = o.data
  return primo ? meseDi(primo) : null
}

/**
 * I mesi finiti e non ancora aggiornati, dal più vecchio. Esempio: ultimo mese nel file settembre,
 * oggi 3 dicembre → ottobre e novembre. Si aggiornano uno alla volta, dal più vecchio.
 */
export function mesiDaAggiornare(dati: FileDati, oggi: string): string[] {
  const ultimo = ultimoMeseSalvato(dati)
  let mese = ultimo ? meseDopo(ultimo) : primoMeseConOperazioni(dati)
  const mesi: string[] = []
  while (mese && meseFinito(mese, oggi) && mesi.length < 36) {
    if (titoliDelMese(dati, mese).length) mesi.push(mese)
    mese = meseDopo(mese)
  }
  return mesi
}

const DATA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Le quote del titolo a fine mese. Un'operazione conta dal giorno dell'esecuzione
 * (se è scritta come data) o da quello di regolamento: basta che una delle due sia nel mese.
 */
export function quoteAFineMese(dati: FileDati, titolo: string, mese: string): number {
  const fine = fineMese(mese)
  let quote = 0
  for (const o of dati.operazioni ?? []) {
    if (o.titolo !== titolo) continue
    const quando = DATA.test(o.esecuzione) && o.esecuzione < o.data ? o.esecuzione : o.data
    if (quando > fine) continue
    quote += o.tipo === 'acquisto' ? o.quantita : -o.quantita
  }
  return Math.abs(quote) < 1e-9 ? 0 : quote
}

/** I titoli che a fine mese ci sono ancora: per ognuno serve il prezzo. */
export function titoliDelMese(dati: FileDati, mese: string): Titolo[] {
  return (dati.titoli ?? []).filter((t) => quoteAFineMese(dati, t.id, mese) > 0)
}

/** Il prezzo del titolo a fine mese, se c'è. */
export function prezzoDelMese(dati: FileDati, titolo: string, mese: string): PrezzoFineMese | undefined {
  const data = fineMese(mese)
  return (dati.prezzi ?? []).find((p) => p.titolo === titolo && p.data === data)
}

/** L'ultimo prezzo del titolo prima di quel mese (per "sul mese"). */
export function prezzoPrecedente(dati: FileDati, titolo: string, mese: string): PrezzoFineMese | undefined {
  const inizio = mese + '-01'
  let migliore: PrezzoFineMese | undefined
  for (const p of dati.prezzi ?? []) if (p.titolo === titolo && p.data < inizio && (!migliore || p.data > migliore.data)) migliore = p
  return migliore
}

/** La valuta di quotazione del titolo: quella scritta (versione 3), o quella dei suoi prezzi e operazioni. */
export function valutaDelTitolo(dati: FileDati, titolo: Titolo): string {
  if (titolo.valuta) return titolo.valuta
  let ultimo: PrezzoFineMese | undefined
  for (const p of dati.prezzi ?? []) if (p.titolo === titolo.id && (!ultimo || p.data > ultimo.data)) ultimo = p
  if (ultimo) return ultimo.valuta
  const op = (dati.operazioni ?? []).find((o) => o.titolo === titolo.id)
  return op?.valuta ?? 'EUR'
}

/** Il cambio di fine mese di una valuta: dall'elenco dei cambi (versione 3) o dai prezzi (versione 2). */
export function cambioDelMese(dati: FileDati, valuta: string, mese: string): number | undefined {
  const data = fineMese(mese)
  const c = (dati.cambi ?? []).find((x) => x.valuta === valuta && x.data === data)
  if (c) return c.cambio
  return (dati.prezzi ?? []).find((p) => p.valuta === valuta && p.data === data && p.cambio)?.cambio
}

const NOMI_VALUTE: Record<string, string> = {
  GBP: 'Sterlina',
  USD: 'Dollaro',
  CHF: 'Franco svizzero',
  JPY: 'Yen',
}

/** "GBP" → "Sterlina" */
export function nomeValuta(valuta: string): string {
  return NOMI_VALUTE[valuta] ?? valuta
}
