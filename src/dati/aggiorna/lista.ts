// La lista della schermata Aggiorna fine mese: una riga per titolo e una per cambio, che si riempiono
// mano a mano che arrivano i prezzi. Qui ci sono solo i dati e le regole ("Salva" spento finché manca
// un prezzo o un cambio); la schermata è in src/aggiorna/.
// Modulo puro: ogni funzione restituisce un oggetto nuovo.
import type { Borsa, FileDati } from '../tipi.ts'
import { FONTE, FONTE_CAMBIO, type EsitoCambio, type EsitoPrezzo, type RichiestaPrezzo } from './fonti.ts'
import { cambioDelMese, prezzoDelMese, prezzoPrecedente, quoteAFineMese, titoliDelMese, valutaDelTitolo } from './mesi.ts'
import type { MeseDaSalvare } from './versione3.ts'
import type { ParteRiferimenti } from './riferimenti.ts'
import { fineMese } from './calendario.ts'

export type PrezzoArrivato = Extract<EsitoPrezzo, { ok: true }>
export type CambioArrivato = Extract<EsitoCambio, { ok: true }>

/** Com'è una riga: in attesa, si sta scaricando, arrivata, oppure manca (con il perché). */
export type Stato<A> =
  { tipo: 'attesa' } | { tipo: 'scarica' } | { tipo: 'arrivato'; esito: A } | { tipo: 'manca'; perche: string; esito?: EsitoPrezzo }

export type RigaTitolo = {
  genere: 'titolo'
  id: string
  isin: string
  borsa: Borsa
  nomeBorsa: string
  simbolo: string | null
  nome: string
  valuta: string
  /** I codici delle riserve (investing.com e Yahoo), dal file dei dati. */
  codici: Pick<RichiestaPrezzo, 'codiceInvesting' | 'codiceYahoo' | 'borsaRiserve'>
  quote: number
  /** Il prezzo di fine mese prima, per "sul mese". */
  precedente?: { prezzo: number; cambio?: number; data: string }
  /** Il prezzo che c'è già nel file per questo mese ("Rifai"): il "prima" del prima e dopo. */
  prima?: { prezzo: number; fonte: string; nota?: string }
  stato: Stato<PrezzoArrivato>
  /** Il prezzo scritto a mano nella schermata (vince su quello arrivato). */
  aMano?: number
  /** "Rifai": l'utente tiene il prezzo che c'era (es. un titolo che nel file Excel aveva il prezzo di un'altra borsa). */
  tieni?: boolean
}

export type RigaCambio = {
  genere: 'cambio'
  valuta: string
  /** I simboli dei titoli che lo usano: "per TECN". */
  perTitoli: string[]
  precedente?: number
  prima?: { cambio: number; fonte: string }
  stato: Stato<CambioArrivato>
  aMano?: number
}

export type Aggiornamento = {
  mese: string
  /** true se il mese c'era già nel file: "Rifai settembre", con prima e dopo. */
  rifai: boolean
  titoli: RigaTitolo[]
  cambi: RigaCambio[]
  /** Riferimenti e inflazione (ticket 9): possono aspettare, non servono per salvare. */
  rif?: ParteRiferimenti
}

export function creaAggiornamento(dati: FileDati, mese: string): Aggiornamento {
  const titoli = titoliDelMese(dati, mese).map((t): RigaTitolo => {
    const precedente = prezzoPrecedente(dati, t.id, mese)
    const prima = prezzoDelMese(dati, t.id, mese)
    return {
      genere: 'titolo',
      id: t.id,
      isin: t.isin,
      borsa: t.borsa,
      nomeBorsa: t.nomeBorsa,
      simbolo: t.simbolo,
      nome: t.paroleSemplici ?? t.nome, // come nelle altre pagine: le parole semplici, se no il nome intero
      valuta: valutaDelTitolo(dati, t),
      codici: {
        ...(t.codiceInvesting !== undefined ? { codiceInvesting: t.codiceInvesting } : {}),
        ...(t.codiceYahoo !== undefined ? { codiceYahoo: t.codiceYahoo } : {}),
        ...(t.borsaRiserve !== undefined ? { borsaRiserve: t.borsaRiserve } : {}),
      },
      quote: quoteAFineMese(dati, t.id, mese),
      ...(precedente ? { precedente: { prezzo: precedente.prezzo, cambio: precedente.cambio, data: precedente.data } } : {}),
      ...(prima ? { prima: { prezzo: prima.prezzo, fonte: prima.fonte, nota: prima.nota } } : {}),
      stato: { tipo: 'attesa' },
    }
  })
  const valute = [...new Set(titoli.filter((t) => t.valuta !== 'EUR').map((t) => t.valuta))].sort()
  const mesePrima = fineMese(mese)
  const cambi = valute.map((valuta): RigaCambio => {
    const prima = (dati.cambi ?? []).find((c) => c.valuta === valuta && c.data === mesePrima)
    const primaDaiPrezzi = cambioDelMese(dati, valuta, mese)
    const precedenteData = titoli.find((t) => t.valuta === valuta && t.precedente?.cambio)?.precedente
    return {
      genere: 'cambio',
      valuta,
      perTitoli: titoli.filter((t) => t.valuta === valuta).map(etichetta),
      ...(precedenteData?.cambio ? { precedente: precedenteData.cambio } : {}),
      ...(prima
        ? { prima: { cambio: prima.cambio, fonte: prima.fonte } }
        : primaDaiPrezzi
          ? { prima: { cambio: primaDaiPrezzi, fonte: FONTE.fileExcel } }
          : {}),
      stato: { tipo: 'attesa' },
    }
  })
  return { mese, rifai: titoli.some((t) => t.prima), titoli, cambi }
}

/** Il nome corto di un titolo: il simbolo (es. "MOND"), o l'ISIN se non c'è. */
export function etichetta(t: Pick<RigaTitolo, 'simbolo' | 'isin'>): string {
  return t.simbolo ?? t.isin
}

/** Cosa esce dal PC per questa riga: solo i codici, mai le quote. */
export function richiestaDi(t: RigaTitolo): RichiestaPrezzo {
  return { isin: t.isin, borsa: t.borsa, simbolo: t.simbolo, valuta: t.valuta, ...t.codici }
}

// ---------- cambiare una riga ----------

export function conTitolo(a: Aggiornamento, id: string, cambia: (r: RigaTitolo) => RigaTitolo): Aggiornamento {
  return { ...a, titoli: a.titoli.map((r) => (r.id === id ? cambia(r) : r)) }
}

export function conCambio(a: Aggiornamento, valuta: string, cambia: (r: RigaCambio) => RigaCambio): Aggiornamento {
  return { ...a, cambi: a.cambi.map((r) => (r.valuta === valuta ? cambia(r) : r)) }
}

/** Il risultato di una richiesta di prezzo diventa lo stato della riga. */
export function statoDaEsito(esito: EsitoPrezzo): Stato<PrezzoArrivato> {
  return esito.ok ? { tipo: 'arrivato', esito } : { tipo: 'manca', perche: esito.perche, esito }
}

export function statoDaCambio(esito: EsitoCambio): Stato<CambioArrivato> {
  return esito.ok ? { tipo: 'arrivato', esito } : { tipo: 'manca', perche: esito.perche }
}

// ---------- leggere la lista ----------

/** Il prezzo che si salverebbe: quello a mano, o quello arrivato. */
export function prezzoDi(r: RigaTitolo): number | undefined {
  if (r.aMano !== undefined) return r.aMano
  if (r.tieni && r.prima) return r.prima.prezzo
  return r.stato.tipo === 'arrivato' ? r.stato.esito.prezzo : undefined
}

export function cambioDi(r: RigaCambio): number | undefined {
  if (r.aMano !== undefined) return r.aMano
  return r.stato.tipo === 'arrivato' ? r.stato.esito.cambio : undefined
}

/** Ci sono ancora righe in attesa o in arrivo. */
export function inCorso(a: Aggiornamento): boolean {
  const occupata = (s: Stato<unknown>) => s.tipo === 'attesa' || s.tipo === 'scarica'
  return a.titoli.some((r) => r.aMano === undefined && occupata(r.stato)) || a.cambi.some((r) => r.aMano === undefined && occupata(r.stato))
}

/** I prezzi e i cambi che mancano (né arrivati né scritti a mano). */
export function mancano(a: Aggiornamento): { titoli: RigaTitolo[]; cambi: RigaCambio[] } {
  return {
    titoli: a.titoli.filter((r) => prezzoDi(r) === undefined && r.stato.tipo === 'manca'),
    cambi: a.cambi.filter((r) => cambioDi(r) === undefined && r.stato.tipo === 'manca'),
  }
}

/** "Salva" si accende solo quando ci sono tutti i prezzi dei titoli e tutti i cambi. */
export function puoSalvare(a: Aggiornamento): boolean {
  return a.titoli.length > 0 && a.titoli.every((r) => prezzoDi(r) !== undefined) && a.cambi.every((r) => cambioDi(r) !== undefined)
}

/** Quanti prezzi dei titoli ci sono (arrivati o a mano). */
export function prezziPronti(a: Aggiornamento): number {
  return a.titoli.filter((r) => prezzoDi(r) !== undefined).length
}

/** Il valore dei titoli a fine mese, in euro; null finché manca qualcosa. */
export function valoreAFineMese(a: Aggiornamento): number | null {
  if (!puoSalvare(a)) return null
  const cambi = new Map(a.cambi.map((c) => [c.valuta, cambioDi(c)!]))
  return a.titoli.reduce((s, r) => s + (r.quote * prezzoDi(r)!) / (r.valuta === 'EUR' ? 1 : cambi.get(r.valuta)!), 0)
}

/** Il valore degli stessi titoli, con le stesse quote, al fine mese prima; null se manca un prezzo. */
export function valoreMesePrima(a: Aggiornamento): number | null {
  let s = 0
  for (const r of a.titoli) {
    if (!r.precedente) return null
    s += (r.quote * r.precedente.prezzo) / (r.valuta === 'EUR' ? 1 : (r.precedente.cambio ?? NaN))
  }
  return Number.isFinite(s) ? s : null
}

/** Quanto è cambiato il prezzo sul mese, in % (nella valuta del titolo). */
export function sulMese(r: RigaTitolo): number | null {
  const p = prezzoDi(r)
  if (p === undefined || !r.precedente) return null
  return (p / r.precedente.prezzo - 1) * 100
}

function decimali(n: number): number {
  const t = String(n)
  const i = t.indexOf('.')
  return i < 0 ? 0 : t.length - i - 1
}

/**
 * Il prima e dopo di "Rifai": uguale se il prezzo nuovo, arrotondato come quello di prima, è lo stesso
 * (il file Excel arrotondava: 12,748 della borsa e 12,75 del file sono lo stesso prezzo).
 */
export function confrontoConPrima(prima: number, dopo: number): { uguale: boolean; differenza: number } {
  // Mezza unità dell'ultima cifra di prima: 13,255 e 13,25 sono lo stesso prezzo arrotondato.
  const mezza = 0.5 * 10 ** -decimali(prima)
  return { uguale: Math.abs(dopo - prima) <= mezza + 1e-9, differenza: (dopo / prima - 1) * 100 }
}

/** Il contenuto da mandare al processo principale quando si preme "Salva". */
export function daSalvare(a: Aggiornamento): MeseDaSalvare {
  if (!puoSalvare(a)) throw new Error('manca ancora un prezzo o un cambio')
  return {
    mese: a.mese,
    // I prezzi tenuti com'erano non si mandano: nel file restano quelli di prima.
    prezzi: a.titoli
      .filter((r) => r.aMano !== undefined || !(r.tieni && r.prima))
      .map((r) => {
        if (r.aMano !== undefined) return { titolo: r.id, prezzo: r.aMano, fonte: FONTE.aMano }
        if (r.stato.tipo !== 'arrivato') throw new Error('riga senza prezzo')
        const e = r.stato.esito
        return {
          titolo: r.id,
          prezzo: e.prezzo,
          seduta: e.seduta,
          fonte: e.fonte,
          ...(e.nota ? { nota: e.nota } : {}),
          ...(e.controllo ? { controllo: e.controllo } : {}),
        }
      }),
    cambi: a.cambi.map((r) => {
      if (r.aMano !== undefined) return { valuta: r.valuta, cambio: r.aMano, fonte: FONTE_CAMBIO.aMano }
      if (r.stato.tipo !== 'arrivato') throw new Error('riga senza cambio')
      return { valuta: r.valuta, cambio: r.stato.esito.cambio, seduta: r.stato.esito.seduta, fonte: FONTE_CAMBIO.bce }
    }),
  }
}

/** Quanti prezzi vengono da ogni fonte, nell'ordine in cui compaiono: [["Borsa Italiana", 7], …]. */
export function contaFonti(fonti: string[]): [string, number][] {
  const conta = new Map<string, number>()
  for (const f of fonti) conta.set(f, (conta.get(f) ?? 0) + 1)
  return [...conta]
}

/** Come si chiama, nel riquadro "<Mese> è salvato", un prezzo tenuto com'era. */
export const TENUTO = 'tenuto com’era'

/** Le fonti dei prezzi della lista, per il riquadro "<Mese> è salvato". */
export function fontiDellaLista(a: Aggiornamento): string[] {
  return a.titoli.map((r) =>
    r.aMano !== undefined ? FONTE.aMano : r.tieni && r.prima ? TENUTO : r.stato.tipo === 'arrivato' ? r.stato.esito.fonte : '',
  )
}

/** "Rifai": quanti prezzi sono uguali a quelli di prima, quanti sono tenuti com'erano e quali sono diversi. */
export function primaEDopo(a: Aggiornamento): { uguali: number; tenuti: number; diversi: RigaTitolo[] } {
  let uguali = 0
  let tenuti = 0
  const diversi: RigaTitolo[] = []
  for (const r of a.titoli) {
    const p = prezzoDi(r)
    if (!r.prima || p === undefined) continue
    if (r.tieni && r.aMano === undefined) tenuti++
    else if (confrontoConPrima(r.prima.prezzo, p).uguale) uguali++
    else diversi.push(r)
  }
  return { uguali, tenuti, diversi }
}
