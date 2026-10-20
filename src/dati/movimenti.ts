// Registrare, correggere a mano e togliere un movimento: un acquisto, una vendita o un dividendo (ticket 11).
// Si usa nel processo principale, sul file appena riletto dal disco e già passato alla versione 3,
// subito prima della scrittura sicura. Modulo puro: niente file, non cambia mai l'oggetto ricevuto.
//
// Esempio. Registri a mano l'acquisto di 10 MOND a 12 € con 5 € di commissioni: nel file entra
// { id, titolo, tipo: "acquisto", data, …, totale: 125, rifOrdine: null, fonte: "a mano" }, al suo posto
// nell'ordine delle date. Lo correggi in 11 quote: diventa quantita 11, con quando e prima: { quantita: 10 }.
// "Torna a com'era" rimette 10 e toglie quando e prima. "Togli questo movimento" lo toglie: il file torna
// identico a com'era prima della registrazione.
//
// Il ticket 12 (Registra dal PDF) usa la stessa richiesta "registra": con i nomi dei PDF, il numero
// d'ordine e, se prima di registrare hai cambiato un numero letto dal PDF, il valore del PDF in "dalPdf"
// (il movimento entra già segnato "a mano", con il valore del PDF come "prima"). Un acquisto di un titolo
// che non è ancora nel file porta con sé il titolo nuovo ("titoloNuovo"), che si aggiunge insieme al movimento.
import { valutaDelTitolo } from './aggiorna/mesi.ts'
import type { Apertura } from './ponte.ts'
import { conTitoloNuovo, controllaTitoloNuovo } from './titolo-nuovo.ts'
import type { CampoDividendo, CampoOperazione, Dividendo, FileDati, Operazione, Titolo } from './tipi.ts'

/** La fonte di un movimento scritto a mano. */
export const FONTE_A_MANO = 'a mano'

export type TipoMovimento = 'acquisto' | 'vendita' | 'dividendo'

export type CampiOperazione = Pick<Operazione, CampoOperazione>
export type CampiDividendo = Pick<Dividendo, CampoDividendo>

export type NuovaOperazione = {
  tipo: 'acquisto' | 'vendita'
  titolo: string
  data: string
  quantita: number
  /** Nella valuta del titolo. */
  prezzo: number
  /** Unità di valuta per 1 euro, quello della banca; 1 per i titoli in euro. */
  cambio: number
  commissioni: number
  /** Gli euro pagati o incassati: il numero che conta, quello della banca. */
  totale: number
  /** I PDF della banca da cui viene (ticket 12); senza, è scritto a mano. */
  pdf?: string[]
  rifOrdine?: string | null
  /** La data di esecuzione, se si sa (dal PDF); se no si scrive la data. */
  esecuzione?: string
  nota?: string
  /** Solo dal PDF: i numeri letti dal PDF che hai cambiato prima di registrare. */
  dalPdf?: Partial<CampiOperazione>
}

export type NuovoDividendo = {
  tipo: 'dividendo'
  titolo: string
  data: string
  lordo: number
  imposte: number
  pdf?: string[]
  nota?: string
  dalPdf?: Partial<CampiDividendo>
}

export type NuovoMovimento = NuovaOperazione | NuovoDividendo

export type ModificaMovimento =
  /** Scrive nel file un movimento nuovo; con "titoloNuovo" (ticket 12) aggiunge anche il titolo. */
  | { azione: 'registra'; movimento: NuovoMovimento; titoloNuovo?: Titolo }
  /** Corregge a mano i campi dati (solo quelli che cambiano). */
  | { azione: 'correggi'; id: string; campi: Partial<CampiOperazione> | Partial<CampiDividendo> }
  /** Rimette i valori di prima della correzione a mano. */
  | { azione: 'torna'; id: string }
  /** Toglie il movimento, per esempio registrato due volte per sbaglio. */
  | { azione: 'togli'; id: string }

export type EsitoMovimento =
  | {
      esito: 'salvato'
      apertura: Apertura
      /** Il nome della copia fatta prima di scrivere. */
      copia: string
      /** Il codice del movimento registrato o corretto (per "appena registrato"). */
      id: string
    }
  /** Il file è stato cambiato da un altro PC (o con Blocco note): non si è scritto niente, i dati sono ricaricati. */
  | { esito: 'cambiato'; apertura: Apertura }
  | { esito: 'errore'; perche: string }

export type PonteMovimenti = {
  /** Registra, corregge, rimette o toglie un movimento, con la scrittura sicura e una copia prima. */
  modificaMovimento(m: ModificaMovimento): Promise<EsitoMovimento>
}

export const CANALI_MOVIMENTI = { modificaMovimento: 'movimento:modifica' } as const

export const CAMPI_OPERAZIONE: readonly CampoOperazione[] = ['data', 'quantita', 'prezzo', 'cambio', 'commissioni', 'totale']
export const CAMPI_DIVIDENDO: readonly CampoDividendo[] = ['data', 'lordo', 'imposte']

const QUASI_ZERO = 1e-9
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/

export function dataValida(s: unknown): s is string {
  const m = typeof s === 'string' ? DATA.exec(s) : null
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

const dataScritta = (d: string) => d.split('-').reverse().join('/')
const due = (n: number) => Math.round(n * 100) / 100
const numeroScritto = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 4, useGrouping: 'always' })

// ---------- trovare un movimento ----------

export type Trovato = { tipo: 'operazione'; operazione: Operazione } | { tipo: 'dividendo'; dividendo: Dividendo }

export function trovaMovimento(dati: FileDati, id: string): Trovato | null {
  const o = (dati.operazioni ?? []).find((x) => x.id === id)
  if (o) return { tipo: 'operazione', operazione: o }
  const d = (dati.dividendi ?? []).find((x) => x.id === id)
  return d ? { tipo: 'dividendo', dividendo: d } : null
}

/** Il movimento in parole, per le frasi e il nome della copia: "l'acquisto di MOND del 12/10/2026". */
export function movimentoInParole(dati: FileDati, t: Trovato | NuovoMovimento): string {
  const m: { tipo: TipoMovimento; titolo: string; data: string; nota?: string } =
    'operazione' in t ? t.operazione : 'dividendo' in t ? { ...t.dividendo, tipo: 'dividendo' } : t
  const { tipo, titolo, data, nota } = m
  const cosa = tipo === 'acquisto' ? 'l’acquisto' : tipo === 'vendita' ? 'la vendita' : /cedola/i.test(nota ?? '') ? 'la cedola' : 'il dividendo'
  return `${cosa} di ${nomeDelTitolo(dati, titolo)} del ${dataScritta(data)}`
}

function nomeDelTitolo(dati: FileDati, id: string): string {
  const t = (dati.titoli ?? []).find((x) => x.id === id)
  return t ? (t.simbolo ?? t.nome) : id
}

// ---------- le quote ----------

/** Le operazioni di un titolo nell'ordine dei conti: per data e, lo stesso giorno, prima gli acquisti. */
export function inOrdine(ops: Operazione[]): Operazione[] {
  return ops.slice().sort((a, b) => (a.data === b.data ? (a.tipo === b.tipo ? 0 : a.tipo === 'acquisto' ? -1 : 1) : a.data < b.data ? -1 : 1))
}

/** Le quote del titolo alla fine di quel giorno (contano gli acquisti e le vendite fino a quel giorno compreso). */
export function quoteAlGiorno(dati: FileDati, titolo: string, giorno: string): number {
  let q = 0
  for (const o of dati.operazioni ?? []) if (o.titolo === titolo && o.data <= giorno) q += o.tipo === 'acquisto' ? o.quantita : -o.quantita
  return Math.abs(q) < QUASI_ZERO ? 0 : q
}

/** La prima vendita che vende più quote di quelle che ci sono, con le quote che c'erano. null se va tutto bene. */
function venditaScoperta(dati: FileDati, titolo: string): { vendita: Operazione; quote: number } | null {
  let q = 0
  for (const o of inOrdine((dati.operazioni ?? []).filter((x) => x.titolo === titolo))) {
    if (o.tipo === 'acquisto') q += o.quantita
    else {
      if (o.quantita > q + QUASI_ZERO) return { vendita: o, quote: Math.abs(q) < QUASI_ZERO ? 0 : q }
      q -= o.quantita
    }
  }
  return null
}

// ---------- i controlli ----------

/**
 * Un movimento dal PDF già registrato (ticket 12): un acquisto o una vendita con lo stesso numero d'ordine
 * della banca, un dividendo dello stesso titolo nello stesso giorno. Scritto a mano non si controlla.
 */
function giaDalPdf(dati: FileDati, n: NuovoMovimento): Trovato | null {
  if (!n.pdf || n.pdf.length === 0) return null
  const cifre = (s: string | null | undefined) => (s ?? '').replace(/^0+/, '')
  if (n.tipo === 'dividendo') {
    const d = (dati.dividendi ?? []).find((x) => x.titolo === n.titolo && x.data === n.data)
    return d ? { tipo: 'dividendo', dividendo: d } : null
  }
  if (!n.rifOrdine) return null
  const o = (dati.operazioni ?? []).find((x) => x.tipo === n.tipo && cifre(x.rifOrdine) === cifre(n.rifOrdine))
  return o ? { tipo: 'operazione', operazione: o } : null
}

export type Controllato = { ok: true } | { ok: false; perche: string }
const no = (perche: string): Controllato => ({ ok: false, perche })

/** Una richiesta arrivata dalle pagine ha la forma giusta? (Il processo principale non si fida.) */
export function eModifica(x: unknown): x is ModificaMovimento {
  const m = x as ModificaMovimento
  if (typeof m !== 'object' || m === null) return false
  if (m.azione === 'torna' || m.azione === 'togli') return typeof m.id === 'string'
  if (m.azione === 'correggi') return typeof m.id === 'string' && typeof m.campi === 'object' && m.campi !== null
  if (m.azione !== 'registra' || typeof m.movimento !== 'object' || m.movimento === null) return false
  if (m.titoloNuovo !== undefined && (typeof m.titoloNuovo !== 'object' || m.titoloNuovo === null)) return false
  const n = m.movimento
  if (typeof n.titolo !== 'string' || typeof n.data !== 'string') return false
  if (n.pdf !== undefined && !(Array.isArray(n.pdf) && n.pdf.every((p) => typeof p === 'string'))) return false
  if (n.nota !== undefined && typeof n.nota !== 'string') return false
  if (n.dalPdf !== undefined && (typeof n.dalPdf !== 'object' || n.dalPdf === null)) return false
  if (n.tipo === 'dividendo') return typeof n.lordo === 'number' && typeof n.imposte === 'number'
  return (
    (n.tipo === 'acquisto' || n.tipo === 'vendita') &&
    ['quantita', 'prezzo', 'cambio', 'commissioni', 'totale'].every((k) => typeof n[k as keyof NuovaOperazione] === 'number') &&
    (n.rifOrdine === undefined || n.rifOrdine === null || typeof n.rifOrdine === 'string') &&
    (n.esecuzione === undefined || typeof n.esecuzione === 'string')
  )
}

const positivo = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0
const nonNegativo = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0

/** Un campo di un'operazione ha un valore sensato? null se va bene, se no il perché. */
function campoOperazione(k: CampoOperazione, v: unknown, valuta: string): string | null {
  switch (k) {
    case 'data':
      return dataValida(v) ? null : 'la data non è valida: scriverla come 12/10/2026'
    case 'quantita':
      return positivo(v) ? null : 'le quote devono essere maggiori di zero'
    case 'prezzo':
      return positivo(v) ? null : 'il prezzo per quota deve essere maggiore di zero'
    case 'cambio':
      if (!positivo(v)) return 'il cambio deve essere maggiore di zero'
      return valuta === 'EUR' && v !== 1 ? 'il titolo è in euro: il cambio è 1' : null
    case 'commissioni':
      return nonNegativo(v) ? null : 'le commissioni non possono essere negative'
    case 'totale':
      return positivo(v) ? null : 'il totale deve essere maggiore di zero'
  }
}

function campoDividendo(k: CampoDividendo, v: unknown): string | null {
  switch (k) {
    case 'data':
      return dataValida(v) ? null : 'la data non è valida: scriverla come 31/08/2026'
    case 'lordo':
      return positivo(v) ? null : 'il lordo deve essere maggiore di zero'
    case 'imposte':
      return nonNegativo(v) ? null : 'le imposte non possono essere negative'
  }
}

/** Dopo il cambiamento: le vendite non vendono mai più quote di quelle che ci sono. */
function quoteGiuste(dopo: FileDati, titolo: string): Controllato {
  const s = venditaScoperta(dopo, titolo)
  if (!s) return { ok: true }
  const nome = nomeDelTitolo(dopo, titolo)
  return no(
    `il ${dataScritta(s.vendita.data)} ${s.quote > 0 ? `c’erano solo ${numeroScritto(s.quote)} quote` : 'non c’erano quote'} di ${nome}: non se ne possono vendere ${numeroScritto(s.vendita.quantita)}`,
  )
}

/** Si può fare? Ogni numero dev'essere sensato, e non si vendono più quote di quelle che si hanno. */
export function controllaModifica(dati: FileDati, m: ModificaMovimento): Controllato {
  if (m.azione === 'registra' && m.titoloNuovo) {
    const ok = controllaTitoloNuovo(dati, m.titoloNuovo)
    if (!ok.ok) return ok
    if (m.movimento.tipo !== 'acquisto' || m.movimento.titolo !== m.titoloNuovo.id) return no('un titolo nuovo si aggiunge solo con il suo acquisto')
    return controllaModifica(conTitoloNuovo(dati, m.titoloNuovo), { azione: 'registra', movimento: m.movimento })
  }
  if (m.azione === 'registra') {
    const n = m.movimento
    const t = (dati.titoli ?? []).find((x) => x.id === n.titolo)
    if (!t) return no('scegliere il titolo')
    const doppio = giaDalPdf(dati, n)
    if (doppio) return no(`${movimentoInParole(dati, doppio)} è già registrato: non si registra due volte`)
    if (n.tipo === 'dividendo') {
      for (const k of CAMPI_DIVIDENDO) {
        const p = campoDividendo(k, n[k])
        if (p) return no(p)
      }
      if (n.imposte > n.lordo) return no('le imposte non possono essere più del lordo')
      if (quoteAlGiorno(dati, n.titolo, n.data) <= 0) return no(`il ${dataScritta(n.data)} non c’erano quote di ${nomeDelTitolo(dati, n.titolo)}`)
      return { ok: true }
    }
    const valuta = valutaDelTitolo(dati, t)
    for (const k of CAMPI_OPERAZIONE) {
      const p = campoOperazione(k, n[k], valuta)
      if (p) return no(p)
    }
    return quoteGiuste(applica(dati, m, '').dati, n.titolo)
  }

  const trovato = trovaMovimento(dati, m.id)
  if (!trovato) return no('nel file non c’è più questo movimento')
  const titolo = trovato.tipo === 'operazione' ? trovato.operazione.titolo : trovato.dividendo.titolo

  if (m.azione === 'togli') return trovato.tipo === 'operazione' ? quoteGiuste(applica(dati, m, '').dati, titolo) : { ok: true }
  if (m.azione === 'torna') {
    const prima = trovato.tipo === 'operazione' ? trovato.operazione.prima : trovato.dividendo.prima
    if (!prima) return no(`${movimentoInParole(dati, trovato)} non è stato corretto manualmente`)
    return trovato.tipo === 'operazione' ? quoteGiuste(applica(dati, m, '').dati, titolo) : { ok: true }
  }

  // Correggi.
  const campi = Object.entries(m.campi)
  if (trovato.tipo === 'operazione') {
    const o = trovato.operazione
    if (!campi.every(([k]) => (CAMPI_OPERAZIONE as readonly string[]).includes(k))) return no('si possono correggere solo data, quote, prezzo, cambio, commissioni e totale')
    for (const [k, v] of campi) {
      const p = campoOperazione(k as CampoOperazione, v, o.valuta)
      if (p) return no(p)
    }
    if (!campi.some(([k, v]) => o[k as CampoOperazione] !== v)) return no('nessun valore modificato')
    return quoteGiuste(applica(dati, m, '').dati, titolo)
  }
  const d = trovato.dividendo
  if (!campi.every(([k]) => (CAMPI_DIVIDENDO as readonly string[]).includes(k))) return no('di un dividendo si possono correggere solo data, lordo e imposte')
  for (const [k, v] of campi) {
    const p = campoDividendo(k as CampoDividendo, v)
    if (p) return no(p)
  }
  if (!campi.some(([k, v]) => d[k as CampoDividendo] !== v)) return no('nessun valore modificato')
  const lordo = (m.campi as Partial<CampiDividendo>).lordo ?? d.lordo
  const imposte = (m.campi as Partial<CampiDividendo>).imposte ?? d.imposte
  if (imposte > lordo) return no('le imposte non possono essere più del lordo')
  return { ok: true }
}

// ---------- scrivere ----------

/** Un codice nuovo che non c'è ancora: se "base" è già usato, "base-2", "base-3"… */
function codiceLibero(dati: FileDati, base: string): string {
  const usati = new Set([...(dati.operazioni ?? []).map((o) => o.id), ...(dati.dividendi ?? []).map((d) => d.id)])
  if (!usati.has(base)) return base
  for (let n = 2; ; n++) if (!usati.has(`${base}-${n}`)) return `${base}-${n}`
}

/** Mette il movimento al suo posto nell'ordine delle date, senza spostare gli altri. */
function inserisci<T extends { data: string }>(elenco: T[], nuovo: T): T[] {
  const i = elenco.findIndex((x) => x.data > nuovo.data)
  return i < 0 ? [...elenco, nuovo] : [...elenco.slice(0, i), nuovo, ...elenco.slice(i)]
}

/** Solo i campi del PDF che sono davvero diversi da quelli registrati. */
function soloDiversi<T extends object>(dalPdf: Partial<T> | undefined, valori: T): Partial<T> {
  const r: Partial<T> = {}
  for (const [k, v] of Object.entries(dalPdf ?? {}) as [keyof T, T[keyof T]][]) if (v !== undefined && v !== valori[k]) r[k] = v
  return r
}

function applica(dati: FileDati, m: ModificaMovimento, quando: string): { dati: FileDati; id: string } {
  if (m.azione === 'registra' && m.titoloNuovo) return applica(conTitoloNuovo(dati, m.titoloNuovo), { azione: 'registra', movimento: m.movimento }, quando)
  if (m.azione === 'registra') {
    const n = m.movimento
    const fonte = n.pdf && n.pdf.length > 0 ? n.pdf.join(' + ') : FONTE_A_MANO
    const titolo = (dati.titoli ?? []).find((t) => t.id === n.titolo)
    if (n.tipo === 'dividendo') {
      const id = codiceLibero(dati, `div-${titolo?.isin ?? n.titolo}-${n.data}`)
      const d: Dividendo = { id, titolo: n.titolo, data: n.data, lordo: n.lordo, imposte: n.imposte, netto: due(n.lordo - n.imposte), fonte }
      if (n.nota) d.nota = n.nota
      const prima = soloDiversi(n.dalPdf, d)
      if (Object.keys(prima).length > 0) Object.assign(d, { quando, prima })
      return { dati: { ...dati, dividendi: inserisci(dati.dividendi ?? [], d) }, id }
    }
    const id = codiceLibero(dati, n.rifOrdine ? `op-${n.rifOrdine}` : `op-${n.titolo}-${n.data}-${n.tipo}`)
    // L'ordine dei campi è quello delle operazioni già nel file, che si legge meglio con Blocco note.
    const o: Operazione = {
      id,
      titolo: n.titolo,
      tipo: n.tipo,
      data: n.data,
      esecuzione: n.esecuzione ?? n.data,
      quantita: n.quantita,
      prezzo: n.prezzo,
      valuta: titolo ? valutaDelTitolo(dati, titolo) : 'EUR',
      cambio: n.cambio,
      commissioni: n.commissioni,
      totale: n.totale,
      rifOrdine: n.rifOrdine ?? null,
      fonte,
    }
    if (n.nota) o.nota = n.nota
    const prima = soloDiversi(n.dalPdf, o)
    if (Object.keys(prima).length > 0) Object.assign(o, { quando, prima })
    return { dati: { ...dati, operazioni: inserisci(dati.operazioni ?? [], o) }, id }
  }

  const id = m.id
  if (m.azione === 'togli') {
    const dopo = { ...dati, operazioni: (dati.operazioni ?? []).filter((o) => o.id !== id), dividendi: (dati.dividendi ?? []).filter((d) => d.id !== id) }
    return { dati: senzaTitoloVuoto(dopo, trovaMovimento(dati, id)), id }
  }

  const operazioni = (dati.operazioni ?? []).map((o) => (o.id === id ? cambiaOperazione(o, m, quando) : o))
  const dividendi = (dati.dividendi ?? []).map((d) => (d.id === id ? cambiaDividendo(d, m, quando) : d))
  return {
    dati: {
      ...dati,
      ...(dati.operazioni ? { operazioni } : {}),
      ...(dati.dividendi ? { dividendi } : {}),
    },
    id,
  }
}

/**
 * Tolto l'unico acquisto di un titolo entrato con lui (ticket 12), il titolo non ha più movimenti né prezzi:
 * si toglie anche il titolo, così il file torna com'era prima della registrazione.
 */
function senzaTitoloVuoto(dati: FileDati, tolto: Trovato | null): FileDati {
  if (!tolto || tolto.tipo !== 'operazione') return dati
  const id = tolto.operazione.titolo
  const usato =
    (dati.operazioni ?? []).some((o) => o.titolo === id) ||
    (dati.dividendi ?? []).some((d) => d.titolo === id) ||
    (dati.prezzi ?? []).some((p) => p.titolo === id)
  return usato ? dati : { ...dati, titoli: (dati.titoli ?? []).filter((t) => t.id !== id) }
}

/** Toglie "quando" e "prima": il movimento torna senza segni di correzione, con i campi nel loro ordine. */
function senzaCorrezione<T extends { quando?: string; prima?: unknown }>(x: T): T {
  const { quando: _q, prima: _p, ...resto } = x
  return resto as T
}

/**
 * La correzione: "prima" tiene il valore di partenza di ogni campo cambiato. Se un campo torna al valore
 * di partenza esce da "prima"; se in "prima" non resta niente, il movimento non è più "a mano".
 */
function corretto<T extends { quando?: string; prima?: object }>(x: T, nuovi: Record<string, unknown>, quando: string): T {
  const prima: Record<string, unknown> = { ...(x.prima ?? {}) }
  const valori: Record<string, unknown> = { ...x }
  for (const [k, v] of Object.entries(nuovi)) {
    if (v === undefined || v === valori[k]) continue
    if (!(k in prima)) prima[k] = valori[k]
    else if (prima[k] === v) delete prima[k]
    valori[k] = v
  }
  const base = senzaCorrezione(valori as T)
  return Object.keys(prima).length > 0 ? { ...base, quando, prima } : base
}

function cambiaOperazione(o: Operazione, m: ModificaMovimento, quando: string): Operazione {
  if (m.azione === 'torna') return o.prima ? { ...senzaCorrezione(o), ...o.prima } : o
  if (m.azione !== 'correggi') return o
  return corretto<Operazione>(o, m.campi, quando)
}

function cambiaDividendo(d: Dividendo, m: ModificaMovimento, quando: string): Dividendo {
  if (m.azione === 'torna') return d.prima ? { ...senzaCorrezione(d), ...d.prima } : d
  if (m.azione !== 'correggi') return d
  const c = m.campi as Partial<CampiDividendo>
  const lordo = c.lordo ?? d.lordo
  const imposte = c.imposte ?? d.imposte
  // Il netto si rifà solo se cambiano lordo o imposte: così un netto del file con un centesimo di arrotondamento resta com'era.
  const netto = lordo !== d.lordo || imposte !== d.imposte ? due(lordo - imposte) : d.netto
  return corretto<Dividendo>(d, { ...c, netto }, quando)
}

/**
 * Scrive il cambiamento nel file (già in versione 3). "quando" è l'istante della scrittura (ISO).
 * Restituisce anche il codice del movimento. Gli altri dati non si toccano.
 */
export function applicaModifica(dati: FileDati, m: ModificaMovimento, quando: string): { dati: FileDati; id: string } {
  const ok = controllaModifica(dati, m)
  if (!ok.ok) throw new Error(ok.perche)
  return applica(dati, m, quando)
}

/** Il perché della copia, nel suo nome: "prima di registrare l'acquisto di MOND del 12-10-2026". */
export function percheDellaCopia(dati: FileDati, m: ModificaMovimento): string {
  // Nel nome di un file di Windows la "/" non si può usare: la data si scrive con i trattini.
  const quale = (t: Trovato | NuovoMovimento, d = dati) => movimentoInParole(d, t).replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$1-$2-$3')
  if (m.azione === 'registra') return `prima di registrare ${quale(m.movimento, m.titoloNuovo ? conTitoloNuovo(dati, m.titoloNuovo) : dati)}`
  const t = trovaMovimento(dati, m.id)
  const cosa = t ? quale(t) : 'un movimento'
  if (m.azione === 'correggi') return `prima di correggere a mano ${cosa}`
  if (m.azione === 'torna') return `prima di rimettere com’era ${cosa}`
  return `prima di togliere ${cosa}`
}
