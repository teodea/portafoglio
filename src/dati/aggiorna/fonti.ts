// Da dove viene un prezzo: i nomi fissi delle fonti (quelli scritti nel file e sotto ogni prezzo,
// decisi nel ticket 27 della mappa) e l'ordine in cui si chiedono. L'ordine sta solo qui.
// Modulo puro: lo usano le pagine e il processo principale.
import type { Borsa, ControlloPrezzo } from '../tipi.ts'

export const FONTE = {
  borsaItaliana: 'Borsa Italiana',
  euronextMilano: 'Euronext Milano',
  xetra: 'Deutsche Börse (Xetra)',
  francoforte: 'Deutsche Börse (Francoforte)',
  lse: 'London Stock Exchange',
  euronextParigi: 'Euronext Parigi',
  investing: 'investing.com (riserva)',
  yahoo: 'Yahoo (seconda riserva)',
  xetraAltraBorsa: 'Xetra (riserva, altra borsa)',
  fileExcel: 'dal tuo file Excel',
  aMano: 'a mano',
  acquisto: 'prezzo d’acquisto',
  stima: 'stima',
} as const

export type NomeFonte = (typeof FONTE)[keyof typeof FONTE]

/** I nomi che può avere la fonte di un prezzo nel file, dalla versione 3. */
export const FONTI_PREZZO: readonly NomeFonte[] = Object.values(FONTE)

export const FONTE_CAMBIO = { bce: 'BCE', fileExcel: FONTE.fileExcel, aMano: FONTE.aMano } as const
export const FONTI_CAMBIO: readonly string[] = Object.values(FONTE_CAMBIO)

/** Le fonti che si possono scaricare (le altre sono il file Excel, la mano, l'acquisto e la stima). */
export type FonteDaScaricare =
  | typeof FONTE.borsaItaliana
  | typeof FONTE.euronextMilano
  | typeof FONTE.xetra
  | typeof FONTE.francoforte
  | typeof FONTE.lse
  | typeof FONTE.euronextParigi
  | typeof FONTE.investing
  | typeof FONTE.yahoo
  | typeof FONTE.xetraAltraBorsa

/** Le riserve, nell'ordine deciso nel ticket 27 della mappa: prima investing.com, poi Yahoo. */
export const RISERVE = [FONTE.investing, FONTE.yahoo] as const

/**
 * In che ordine si chiede il prezzo di fine mese, per borsa di quotazione.
 * Prima la borsa ufficiale (per Milano anche Euronext Milano), poi le riserve; sotto il prezzo si scrive perché.
 * Un titolo che le riserve hanno solo su un'altra borsa (es. un titolo di Francoforte, che investing.com e Yahoo
 * non hanno) prende da loro il prezzo di quella borsa, scritto "Xetra (riserva, altra borsa)".
 */
export const ORDINE_FONTI: Record<Borsa, readonly FonteDaScaricare[]> = {
  MIL: [FONTE.borsaItaliana, FONTE.euronextMilano, ...RISERVE],
  XET: [FONTE.xetra, ...RISERVE],
  FRA: [FONTE.francoforte, ...RISERVE],
  LON: [FONTE.lse, ...RISERVE],
  PAR: [FONTE.euronextParigi, ...RISERVE],
}

/** Il controllo accanto al prezzo della borsa: il prezzo di investing.com dello stesso fine mese. */
export const FONTE_DEL_CONTROLLO = FONTE.investing

/** Le borse su cui le riserve possono avere un titolo quotato altrove, con il nome della fonte da scrivere. */
export const ALTRA_BORSA = { XET: { fonte: FONTE.xetraAltraBorsa, nome: 'Xetra' } } as const
export type AltraBorsa = keyof typeof ALTRA_BORSA

/** Il nome breve della fonte ufficiale, per le frasi: "Borsa Italiana non ha risposto". */
export function nomeBreve(fonte: string): string {
  return fonte.replace(/ \(.*\)$/, '')
}

/** Le fonti ufficiali: la borsa di quotazione (o Euronext Milano per Milano). */
export function eUfficiale(fonte: string): boolean {
  return (
    fonte === FONTE.borsaItaliana ||
    fonte === FONTE.euronextMilano ||
    fonte === FONTE.xetra ||
    fonte === FONTE.francoforte ||
    fonte === FONTE.lse ||
    fonte === FONTE.euronextParigi
  )
}

/** Da v2 a v3: il testo libero della fonte di un prezzo caricato dal file Excel diventa un nome fisso. */
export function fonteDaVersione2(fonte: string): NomeFonte {
  if ((FONTI_PREZZO as readonly string[]).includes(fonte)) return fonte as NomeFonte
  if (/^prezzo d.acquisto/i.test(fonte)) return FONTE.acquisto
  if (/^stima/i.test(fonte)) return FONTE.stima
  return FONTE.fileExcel
}

/** Una richiesta di prezzo: escono dal PC solo i codici del titolo, mai le quote o i soldi. */
export type RichiestaPrezzo = {
  isin: string
  borsa: Borsa
  simbolo: string | null
  valuta: string
  /** Il codice della linea di quotazione su investing.com (dal file dei dati), per la riserva e il controllo. */
  codiceInvesting?: number
  /** Il codice Yahoo, es. "MOND.MI" (dal file dei dati), per la seconda riserva. */
  codiceYahoo?: string
  /** Se i due codici sono di un'altra borsa (es. Xetra invece di Francoforte). */
  borsaRiserve?: AltraBorsa
}

/** Un tentativo andato male, in parole: "Borsa Italiana: non ha risposto (errore 503)". */
export type Tentativo = { fonte: FonteDaScaricare; perche: string }

export type EsitoPrezzo =
  | {
      ok: true
      prezzo: number
      seduta: string
      fonte: FonteDaScaricare
      /** Se la fonte non è la prima dell'ordine, o la chiusura non è dell'ultimo giorno di borsa: perché. */
      nota?: string
      /** Il controllo di investing.com, o perché non si è potuto fare. */
      controllo?: ControlloPrezzo
      tentativi: Tentativo[]
    }
  | { ok: false; perche: string; tentativi: Tentativo[] }

export type EsitoCambio = { ok: true; cambio: number; seduta: string; fonte: typeof FONTE_CAMBIO.bce } | { ok: false; perche: string }
