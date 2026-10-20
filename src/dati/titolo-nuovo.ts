// Il titolo nuovo (ticket 12): un acquisto dal PDF di un titolo che non è ancora nel file.
// Si scrivono ISIN, simbolo e borsa (dal PDF, o scelta se "fuori mercato"), le parole semplici (obbligatorie)
// e, se si trovano, i codici di investing.com (riserva e controllo) e Yahoo (seconda riserva).
// Qui anche il ponte della lettura dei PDF e della ricerca dei codici. Modulo puro.
import type { PdfAperto } from './pdf-fineco.ts'
import { BORSE, type Borsa, type FileDati, type Titolo } from './tipi.ts'

/** Il nome della borsa come si scrive nel file e nelle pagine (lo stesso dei titoli già nel file). */
export const NOMI_BORSE: Record<Borsa, string> = {
  MIL: 'Borsa Italiana',
  XET: 'Xetra',
  FRA: 'Francoforte',
  LON: 'Londra',
  PAR: 'Euronext Parigi',
}

/** Il codice della borsa su investing.com (exchangeID), come nel motore dell'archivio. */
export const BORSA_INVESTING: Record<Borsa, number> = { MIL: 6, XET: 4, FRA: 104, LON: 3, PAR: 9 }

/** Il suffisso dei codici Yahoo per borsa: "VWCE" su Xetra è "VWCE.DE". */
export const SUFFISSO_YAHOO: Record<Borsa, string> = { MIL: '.MI', XET: '.DE', FRA: '.F', LON: '.L', PAR: '.PA' }

/** La valuta di solito di una borsa (Londra: sterline). Il PDF d'acquisto la dice comunque. */
export const VALUTA_DELLA_BORSA: Record<Borsa, string> = { MIL: 'EUR', XET: 'EUR', FRA: 'EUR', LON: 'GBP', PAR: 'EUR' }

export const eBorsa = (x: unknown): x is Borsa => typeof x === 'string' && (BORSE as readonly string[]).includes(x)

/** Quello che si scrive nel riquadro "Titolo nuovo". */
export type DatiTitoloNuovo = {
  isin: string
  borsa: Borsa | null
  simbolo: string
  /** "Cos'è, in parole semplici": obbligatorio. */
  parole: string
  /** La descrizione della banca, es. "VANG FTSE AW USD-A". */
  descrizioneBanca: string
  /** Il nome lungo, da investing.com se l'ha trovato. */
  nome?: string
  valuta: string
  codiceInvesting?: number
  codiceYahoo?: string
}

/** Il dossier dei titoli nuovi: quello dei titoli che ci sono già (oggi il personale Fineco). */
export function dossierDelFile(dati: FileDati): string {
  const conta = new Map<string, number>()
  for (const t of dati.titoli ?? []) conta.set(t.dossier, (conta.get(t.dossier) ?? 0) + 1)
  let migliore = 'Fineco personale'
  let n = 0
  for (const [d, k] of conta) if (k > n) [migliore, n] = [d, k]
  return migliore
}

/** Il titolo da scrivere nel file (null se manca la borsa). L'ordine dei campi è quello dei titoli già nel file. */
export function titoloNuovo(dati: FileDati, d: DatiTitoloNuovo): Titolo | null {
  if (!d.borsa) return null
  const isin = d.isin.trim().toUpperCase()
  const t: Titolo = {
    id: `${isin}-${d.borsa}`,
    isin,
    borsa: d.borsa,
    nomeBorsa: NOMI_BORSE[d.borsa],
    nome: (d.nome ?? '').trim() || d.descrizioneBanca.trim() || d.simbolo.trim() || isin,
    soprannome: null,
    simbolo: d.simbolo.trim().toUpperCase() || null,
    descrizioneBanca: d.descrizioneBanca.trim() || d.simbolo.trim() || isin,
    dossier: dossierDelFile(dati),
    paroleSemplici: d.parole.trim(),
    valuta: d.valuta,
  }
  if (d.codiceInvesting) t.codiceInvesting = d.codiceInvesting
  if (d.codiceYahoo?.trim()) t.codiceYahoo = d.codiceYahoo.trim().toUpperCase()
  return t
}

/** Cosa manca nel riquadro, in parole: "cos’è in parole semplici", "la borsa di quotazione". */
export function mancaNelTitoloNuovo(d: DatiTitoloNuovo): string[] {
  const m: string[] = []
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(d.isin.trim().toUpperCase())) m.push('l’ISIN del titolo nuovo')
  if (!d.borsa) m.push('la borsa di quotazione del titolo nuovo')
  if (!d.simbolo.trim()) m.push('il simbolo del titolo nuovo')
  if (!d.parole.trim()) m.push('cos’è il titolo nuovo, in parole semplici')
  return m
}

export type Controllato = { ok: true } | { ok: false; perche: string }

/** Un titolo nuovo arrivato dalle pagine si può aggiungere? (Il processo principale non si fida.) */
export function controllaTitoloNuovo(dati: FileDati, t: unknown): Controllato {
  const no = (perche: string): Controllato => ({ ok: false, perche })
  const x = t as Titolo
  if (typeof x !== 'object' || x === null) return no('il titolo nuovo non va')
  if (typeof x.isin !== 'string' || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(x.isin)) return no('l’ISIN del titolo nuovo non va')
  if (!eBorsa(x.borsa)) return no('scegli la borsa di quotazione del titolo nuovo')
  if (x.id !== `${x.isin}-${x.borsa}`) return no('il codice del titolo nuovo non va')
  if ((dati.titoli ?? []).some((y) => y.id === x.id)) return no(`il titolo ${x.simbolo ?? x.isin} su ${NOMI_BORSE[x.borsa]} c’è già nel file`)
  if (typeof x.paroleSemplici !== 'string' || !x.paroleSemplici.trim()) return no('scrivi cos’è il titolo nuovo, in parole semplici')
  for (const k of ['nomeBorsa', 'nome', 'descrizioneBanca', 'dossier', 'valuta'] as const)
    if (typeof x[k] !== 'string' || !x[k]) return no('il titolo nuovo non va')
  if (x.simbolo !== null && typeof x.simbolo !== 'string') return no('il simbolo del titolo nuovo non va')
  if (x.codiceInvesting !== undefined && !(Number.isInteger(x.codiceInvesting) && x.codiceInvesting > 0)) return no('il codice investing.com non va')
  if (x.codiceYahoo !== undefined && typeof x.codiceYahoo !== 'string') return no('il codice Yahoo non va')
  return { ok: true }
}

/** Il file con il titolo nuovo al suo posto (in ordine di codice, come gli altri). */
export function conTitoloNuovo(dati: FileDati, t: Titolo): FileDati {
  const titoli = (dati.titoli ?? []).filter((x) => x.id !== t.id)
  const i = titoli.findIndex((x) => x.id > t.id)
  return { ...dati, titoli: i < 0 ? [...titoli, t] : [...titoli.slice(0, i), t, ...titoli.slice(i)] }
}

// ---------- la ricerca dei codici e la lettura dei PDF: il ponte ----------

/** Una linea di quotazione trovata su investing.com. */
export type LineaInvesting = {
  codice: number
  nome: string
  simbolo: string
  /** Il nome della borsa su investing.com, es. "Milano". */
  borsa: string
  /** L'ultima chiusura, se si è potuta chiedere. */
  prezzo: number | null
  seduta: string | null
}

export type RichiestaCodici = {
  isin: string
  borsa: Borsa
  simbolo: string
  valuta: string
  /** Facoltativo: l'indirizzo della pagina di investing.com incollato a mano. */
  indirizzo?: string
}

export type CodiciTrovati = {
  /** Le linee sulla borsa del titolo, la più probabile per prima ("Non è lui" passa alla dopo). */
  investing: LineaInvesting[]
  /** Se investing.com non ha trovato niente, perché. */
  perche?: string
  /** Il codice Yahoo, se esiste. */
  yahoo: string | null
}

export type PontePdf = {
  /** Legge i campi del modulo dei PDF scelti o trascinati (nel processo principale). */
  leggiPdf(file: File[]): Promise<PdfAperto[]>
  /** Apre il PDF con il programma di Windows per i PDF. */
  guardaPdf(percorso: string): Promise<void>
  /** Cerca i codici investing.com e Yahoo di un titolo nuovo dall'ISIN: poche richieste, distanziate. */
  cercaCodici(r: RichiestaCodici): Promise<CodiciTrovati>
}

export const CANALI_PDF = { leggiPdf: 'pdf:leggi', guardaPdf: 'pdf:guarda', cercaCodici: 'pdf:cerca-codici' } as const
