// I codici investing.com (e Yahoo) dei titoli che sono già nel file, cercati dall'applicazione (collaudo del 19/10,
// punto 7): dalla pagina Dati, scheda Prezzi dei titoli, "Cerca i codici investing.com". Prima c'era solo uno
// strumento da riga di comando (costruzione/strumenti/codici-riserve.mjs), che la famiglia non può usare.
// Servono al controllo di investing.com accanto al prezzo della borsa, e alle riserve se la borsa non risponde.
// La ricerca è la stessa del titolo nuovo (ticket 12, ponte.cercaCodici); qui la scrittura: si aggiungono i codici
// sotto il simbolo del titolo, con la scrittura sicura e la copia prima. Un codice che c'è già non si cambia.
// Come lo strumento: un titolo di Francoforte che investing.com ha solo su Xetra prende i codici di Xetra e
// "borsaRiserve": "XET", così il suo prezzo di riserva è scritto "Xetra (riserva, altra borsa)".
// Modulo puro: niente file, non cambia mai l'oggetto ricevuto.
import { quoteAlGiorno } from './movimenti.ts'
import type { EsitoCorrezioneDato } from './correzione-dati.ts'
import type { FileDati, Titolo } from './tipi.ts'

/** I codici da scrivere per un titolo: almeno uno dei due; "XET" se sono quelli di Xetra per un titolo di Francoforte. */
export type CodiciDelTitolo = { titolo: string; codiceInvesting?: number; codiceYahoo?: string; borsaRiserve?: 'XET' }

export type ScritturaCodici = { codici: CodiciDelTitolo[] }

/** Come per le correzioni della pagina Dati: salvato con la copia, cambiato da un altro PC, o un errore. */
export type EsitoCodici = EsitoCorrezioneDato

export type PonteCodici = {
  /** Scrive i codici trovati nel file, con la scrittura sicura, dopo una copia. */
  scriviCodici(s: ScritturaCodici): Promise<EsitoCodici>
}

export const CANALI_CODICI = { scriviCodici: 'codici:scrivi' } as const

/** Il perché della copia, lo stesso dello strumento da riga di comando. */
export const PERCHE_CODICI = 'prima dei codici delle riserve'

const YAHOO = /^[A-Z0-9][A-Z0-9.^=-]{0,19}$/

/** I titoli che hai oggi senza il codice investing.com: quelli da cercare. I venduti non servono più. */
export function titoliSenzaCodice(dati: FileDati): Titolo[] {
  return (dati.titoli ?? []).filter((t) => t.codiceInvesting === undefined && quoteAlGiorno(dati, t.id, '9999-12-31') > 0)
}

/** Una richiesta arrivata dalle pagine ha la forma giusta? (Il processo principale non si fida.) */
export function eScritturaCodici(x: unknown): x is ScritturaCodici {
  const s = x as ScritturaCodici
  if (typeof s !== 'object' || s === null || !Array.isArray(s.codici)) return false
  return s.codici.every(
    (c) =>
      typeof c === 'object' &&
      c !== null &&
      typeof c.titolo === 'string' &&
      (c.codiceInvesting === undefined || typeof c.codiceInvesting === 'number') &&
      (c.codiceYahoo === undefined || typeof c.codiceYahoo === 'string') &&
      (c.borsaRiserve === undefined || c.borsaRiserve === 'XET'),
  )
}

/** Si può fare? Titoli che esistono, una volta sola, codici sensati e che non ci sono già. */
export function controllaCodici(dati: FileDati, s: ScritturaCodici): { ok: true } | { ok: false; perche: string } {
  const no = (perche: string) => ({ ok: false as const, perche })
  if (s.codici.length === 0) return no('non c’è nessun codice da scrivere')
  const visti = new Set<string>()
  for (const c of s.codici) {
    const t = (dati.titoli ?? []).find((x) => x.id === c.titolo)
    if (!t) return no(`il titolo ${c.titolo} non è nel file`)
    const nome = t.simbolo ?? t.isin
    if (visti.has(c.titolo)) return no(`${nome} è scritto due volte`)
    visti.add(c.titolo)
    if (c.codiceInvesting === undefined && c.codiceYahoo === undefined) return no(`per ${nome} non c’è nessun codice`)
    if (c.codiceInvesting !== undefined) {
      if (!Number.isInteger(c.codiceInvesting) || c.codiceInvesting <= 0) return no(`il codice investing.com di ${nome} non va`)
      if (t.codiceInvesting !== undefined) return no(`${nome} ha già il codice investing.com`)
    }
    if (c.codiceYahoo !== undefined) {
      if (!YAHOO.test(c.codiceYahoo)) return no(`il codice Yahoo di ${nome} non va`)
      if (t.codiceYahoo !== undefined) return no(`${nome} ha già il codice Yahoo`)
    }
    if (c.borsaRiserve !== undefined) {
      if (t.borsa !== 'FRA') return no(`l’altra borsa per le riserve vale solo per i titoli di Francoforte, non per ${nome}`)
      if (t.borsaRiserve !== undefined) return no(`${nome} ha già l’altra borsa per le riserve`)
    }
  }
  return { ok: true }
}

/**
 * Il file con i codici: sotto il "simbolo" di ogni titolo, come li scriveva lo strumento da riga di comando,
 * così il resto del file resta identico. Gli altri dati non si toccano.
 */
export function applicaCodici(dati: FileDati, s: ScritturaCodici): FileDati {
  const ok = controllaCodici(dati, s)
  if (!ok.ok) throw new Error(ok.perche)
  const perTitolo = new Map(s.codici.map((c) => [c.titolo, c]))
  const titoli = (dati.titoli ?? []).map((t) => {
    const c = perTitolo.get(t.id)
    if (!c) return t
    const nuovi = {
      ...(c.codiceInvesting !== undefined ? { codiceInvesting: c.codiceInvesting } : {}),
      ...(c.codiceYahoo !== undefined ? { codiceYahoo: c.codiceYahoo } : {}),
      ...(c.borsaRiserve !== undefined ? { borsaRiserve: c.borsaRiserve } : {}),
    }
    const voci = Object.entries(t)
    const dopo = voci.findIndex(([k]) => k === 'simbolo') + 1 || voci.length
    return Object.fromEntries([...voci.slice(0, dopo), ...Object.entries(nuovi), ...voci.slice(dopo)]) as Titolo
  })
  return { ...dati, titoli }
}
