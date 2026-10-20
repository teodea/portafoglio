// Correggere a mano, o scrivere quando mancano, l'inflazione NIC, i cambi BCE e i valori dei riferimenti
// di fine mese (ticket 13, mappa 27): dalla scheda "Inflazione, cambi e riferimenti" della pagina Dati,
// nel pannello "Da dove viene". Stesso schema dei prezzi (dati/correzione.ts, ticket 8):
// - "correggi": il dato giusto scritto a mano; resta "a mano" con quello di prima, se c'era;
// - "torna": rimette quello di prima, con la sua fonte;
// - "scaricato": il dato appena scaricato di nuovo ("Scarica di nuovo"), con la sua fonte (ISTAT, BCE, investing.com).
// Si usa nel processo principale, sul file appena riletto e già passato alla versione 3, prima della scrittura
// sicura. Modulo puro: niente file, non cambia mai l'oggetto ricevuto.
//
// Esempio: il NIC di settembre 2026 manca. Lo scrivi a mano, 104,6: nel file diventa
// { data: "2026-09-30", valore: 104.6, base: 2025, fonte: "a mano", quando: "…" }.
// Al prossimo aggiornamento ISTAT non lo sovrascrive: un dato a mano resta finché non lo cambi tu.
import { FONTE_CAMBIO } from './aggiorna/fonti.ts'
import { DESCRIZIONE, FONTE_NIC, FONTE_RIFERIMENTO } from './aggiorna/riferimenti.ts'
import type { Apertura } from './ponte.ts'
import { RIFERIMENTI, type CambioFineMese, type FileDati, type IdRiferimento, type NicDelMese, type ValoreRiferimento } from './tipi.ts'

/** Quale dato: sempre di fine mese ("data" è l'ultimo giorno del mese, la chiave del mese). */
export type RifDato =
  | { tipo: 'nic'; data: string }
  | { tipo: 'cambio'; valuta: string; data: string }
  | { tipo: 'riferimento'; riferimento: IdRiferimento; data: string }

export type CorrezioneDato =
  /** Il valore giusto, scritto a mano. Per un riferimento in dollari che manca serve anche il cambio BCE del giorno. */
  | { azione: 'correggi'; dato: RifDato; valore: number; cambio?: number }
  /** Rimette quello che c'era prima della correzione a mano. */
  | { azione: 'torna'; dato: RifDato }
  /** Il valore appena scaricato di nuovo dalla sua fonte, con la seduta (e il cambio, la base o la nota). */
  | { azione: 'scaricato'; dato: RifDato; valore: number; seduta?: string; cambio?: number; base?: 2015 | 2025; nota?: string }

export type EsitoCorrezioneDato =
  | { esito: 'salvato'; apertura: Apertura; /** Il nome della copia fatta prima di scrivere. */ copia: string }
  /** Il file è stato cambiato da un altro PC (o con Blocco note): non si è scritto niente, i dati sono ricaricati. */
  | { esito: 'cambiato'; apertura: Apertura }
  | { esito: 'errore'; perche: string }

export type PonteCorrezioneDato = {
  /** Scrive la correzione (o il ritorno, o il valore scaricato di nuovo) con la scrittura sicura, dopo una copia. */
  correggiDato(c: CorrezioneDato): Promise<EsitoCorrezioneDato>
}

export const CANALI_CORREZIONE_DATO = { correggiDato: 'dato:correggi' } as const

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const meseInParole = (data: string) => `${MESI[Number(data.slice(5, 7)) - 1]} ${data.slice(0, 4)}`
const DATA = /^\d{4}-\d{2}-\d{2}$/
/** "a mano": lo stesso nome per NIC, cambi e riferimenti. */
const A_MANO = FONTE_NIC.aMano
const positivo = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/** La base del NIC di un mese: ISTAT ha cambiato base a gennaio 2026 (prima 2015 = 100, poi 2025 = 100). */
export function baseNic(data: string): 2015 | 2025 {
  return data >= '2026-01' ? 2025 : 2015
}

/** Il nome del dato, per le frasi e il nome della copia: "il NIC", "il cambio GBP", "S&P 500". */
export function nomeDelDato(d: RifDato): string {
  if (d.tipo === 'nic') return 'il NIC'
  if (d.tipo === 'cambio') return `il cambio ${d.valuta}`
  return DESCRIZIONE[d.riferimento].nome
}

/** La fonte "ufficiale" del dato, quella di "Scarica di nuovo". */
export function fonteDelDato(d: RifDato): string {
  return d.tipo === 'nic' ? FONTE_NIC.istat : d.tipo === 'cambio' ? FONTE_CAMBIO.bce : FONTE_RIFERIMENTO.investing
}

/** Il dato com'è nel file adesso, o undefined se manca. */
export function trovaDato(dati: FileDati, d: RifDato): NicDelMese | CambioFineMese | ValoreRiferimento | undefined {
  if (d.tipo === 'nic') return (dati.nic ?? []).find((n) => n.data === d.data)
  if (d.tipo === 'cambio') return (dati.cambi ?? []).find((c) => c.valuta === d.valuta && c.data === d.data)
  return (dati.riferimenti ?? []).find((v) => v.riferimento === d.riferimento && v.data === d.data)
}

/** Il numero del dato: il valore del NIC o del riferimento, o il cambio. */
export function valoreDelDato(x: NicDelMese | CambioFineMese | ValoreRiferimento): number {
  return 'cambio' in x && !('valore' in x) ? x.cambio : (x as NicDelMese | ValoreRiferimento).valore
}

/** Il numero di prima, se il dato è a mano e ha sostituito un altro dato. */
export function primaDelDato(x: NicDelMese | CambioFineMese | ValoreRiferimento | undefined): { numero: number; fonte: string } | null {
  if (!x?.prima) return null
  const p = x.prima as { valore?: number; cambio?: number; fonte: string }
  const numero = p.valore ?? p.cambio
  return numero === undefined ? null : { numero, fonte: p.fonte }
}

/** Una richiesta arrivata dalle pagine ha la forma giusta? (Il processo principale non si fida.) */
export function eCorrezioneDato(x: unknown): x is CorrezioneDato {
  const c = x as CorrezioneDato
  if (typeof c !== 'object' || c === null || typeof c.dato !== 'object' || c.dato === null) return false
  const d = c.dato as RifDato
  if (typeof d.data !== 'string' || !DATA.test(d.data)) return false
  if (d.tipo === 'cambio') {
    if (typeof d.valuta !== 'string' || !/^[A-Z]{3}$/.test(d.valuta) || d.valuta === 'EUR') return false
  } else if (d.tipo === 'riferimento') {
    if (!(RIFERIMENTI as readonly string[]).includes(d.riferimento)) return false
  } else if (d.tipo !== 'nic') return false
  if (c.azione === 'torna') return true
  if (c.azione !== 'correggi' && c.azione !== 'scaricato') return false
  if (typeof c.valore !== 'number') return false
  if (c.cambio !== undefined && typeof c.cambio !== 'number') return false
  if (c.azione === 'scaricato') {
    if (c.seduta !== undefined && (typeof c.seduta !== 'string' || !DATA.test(c.seduta))) return false
    if (c.base !== undefined && c.base !== 2015 && c.base !== 2025) return false
    if (c.nota !== undefined && typeof c.nota !== 'string') return false
  }
  return true
}

/** Serve il cambio del dollaro? Solo per un riferimento in dollari. */
function inDollari(d: RifDato): boolean {
  return d.tipo === 'riferimento' && DESCRIZIONE[d.riferimento].valuta !== 'EUR'
}

/** Si può fare? Il numero nuovo deve essere sensato; per tornare indietro serve quello di prima. */
export function controllaCorrezioneDato(dati: FileDati, c: CorrezioneDato): { ok: true } | { ok: false; perche: string } {
  const x = trovaDato(dati, c.dato)
  const quale = `${nomeDelDato(c.dato)} di ${meseInParole(c.dato.data)}`
  if (c.azione === 'torna') {
    if (!x || x.fonte !== A_MANO || !primaDelDato(x)) return { ok: false, perche: `${quale} non ha un valore precedente` }
    return { ok: true }
  }
  if (!positivo(c.valore)) return { ok: false, perche: 'il numero nuovo deve essere maggiore di zero' }
  if (c.cambio !== undefined && !positivo(c.cambio)) return { ok: false, perche: 'il cambio deve essere un numero maggiore di zero' }
  if (inDollari(c.dato) && c.cambio === undefined && !(x && 'cambio' in x && positivo(x.cambio)) && cambioDelGiorno(dati, c.dato.data) === undefined)
    return { ok: false, perche: `per ${quale} serve il cambio BCE del dollaro di quel giorno` }
  if (c.dato.tipo === 'cambio' && x === undefined && !(dati.prezzi ?? []).some((p) => p.valuta === (c.dato as { valuta: string }).valuta))
    return { ok: false, perche: `nel file non c’è nessun titolo in ${c.dato.valuta}` }
  if (c.azione === 'correggi' && x && valoreDelDato(x) === c.valore) return { ok: false, perche: 'il numero nuovo è uguale a quello presente' }
  return { ok: true }
}

const conCampo = <K extends string, V>(k: K, v: V | undefined) => (v === undefined ? {} : ({ [k]: v } as Record<K, V>))

/**
 * Scrive la correzione nel file (già in versione 3). "quando" è l'istante della scrittura (ISO).
 * Come per i prezzi: se il dato era già a mano, "prima" resta quello di partenza. Un cambio cambia anche
 * nei prezzi dei titoli in quella valuta dello stesso fine mese, perché i conti in euro usano quelli.
 * Gli altri dati non si toccano.
 */
export function applicaCorrezioneDato(dati: FileDati, c: CorrezioneDato, quando: string): FileDati {
  const ok = controllaCorrezioneDato(dati, c)
  if (!ok.ok) throw new Error(ok.perche)
  const d = c.dato
  if (d.tipo === 'nic') return { ...dati, nic: ordinaNic(sostituisci(dati.nic ?? [], (n) => n.data === d.data, nuovoNic(trovaDato(dati, d) as NicDelMese | undefined, c, quando))) }
  if (d.tipo === 'cambio') {
    const nuovo = nuovoCambio(trovaDato(dati, d) as CambioFineMese | undefined, c, quando)
    const cambi = sostituisci(dati.cambi ?? [], (x) => x.valuta === d.valuta && x.data === d.data, nuovo)
    cambi.sort((a, b) => a.valuta.localeCompare(b.valuta) || a.data.localeCompare(b.data))
    const prezzi = (dati.prezzi ?? []).map((p) => (p.valuta === d.valuta && p.data === d.data ? { ...p, cambio: nuovo.cambio } : p))
    return { ...dati, cambi, prezzi }
  }
  const nuovo = nuovoRiferimento(trovaDato(dati, d) as ValoreRiferimento | undefined, c, quando, cambioDelGiorno(dati, d.data))
  const ordine = new Map(RIFERIMENTI.map((id, i) => [id as string, i]))
  const riferimenti = sostituisci(dati.riferimenti ?? [], (v) => v.riferimento === d.riferimento && v.data === d.data, nuovo)
  riferimenti.sort((a, b) => (ordine.get(a.riferimento) ?? 99) - (ordine.get(b.riferimento) ?? 99) || a.data.localeCompare(b.data))
  return { ...dati, riferimenti }
}

/** Il cambio del dollaro di un altro riferimento in dollari dello stesso giorno (è lo stesso cambio BCE). */
function cambioDelGiorno(dati: FileDati, data: string): number | undefined {
  return (dati.riferimenti ?? []).find((v) => v.data === data && v.valuta === 'USD' && positivo(v.cambio))?.cambio
}

function sostituisci<T>(elenco: T[], questo: (x: T) => boolean, nuovo: T): T[] {
  const i = elenco.findIndex(questo)
  return i < 0 ? [...elenco, nuovo] : elenco.map((x, j) => (j === i ? nuovo : x))
}

function ordinaNic(nic: NicDelMese[]): NicDelMese[] {
  return nic.sort((a, b) => a.data.localeCompare(b.data))
}

function nuovoNic(x: NicDelMese | undefined, c: CorrezioneDato, quando: string): NicDelMese {
  const data = c.dato.data
  if (c.azione === 'torna') {
    const p = x!.prima!
    return { data, valore: p.valore, base: p.base ?? x!.base, fonte: p.fonte, ...conCampo('nota', p.nota), ...conCampo('quando', p.quando) }
  }
  if (c.azione === 'scaricato')
    return { data, valore: c.valore, base: c.base ?? x?.base ?? baseNic(data), fonte: FONTE_NIC.istat, ...conCampo('nota', c.nota) }
  const base = x?.base ?? baseNic(data)
  const prima = x ? (x.fonte === FONTE_NIC.aMano ? x.prima : { valore: x.valore, fonte: x.fonte, base: x.base, ...conCampo('nota', x.nota), ...conCampo('quando', x.quando) }) : undefined
  return { data, valore: c.valore, base, fonte: FONTE_NIC.aMano, quando, ...conCampo('prima', prima) }
}

function nuovoCambio(x: CambioFineMese | undefined, c: CorrezioneDato, quando: string): CambioFineMese {
  const d = c.dato as Extract<RifDato, { tipo: 'cambio' }>
  const base = { valuta: d.valuta, data: d.data }
  if (c.azione === 'torna') {
    const p = x!.prima!
    return { ...base, cambio: p.cambio, fonte: p.fonte, ...conCampo('seduta', p.seduta), ...conCampo('quando', p.quando) }
  }
  if (c.azione === 'scaricato') return { ...base, cambio: c.valore, fonte: FONTE_CAMBIO.bce, ...conCampo('seduta', c.seduta) }
  const prima = x ? (x.fonte === FONTE_CAMBIO.aMano ? x.prima : { cambio: x.cambio, fonte: x.fonte, ...conCampo('seduta', x.seduta), ...conCampo('quando', x.quando) }) : undefined
  return { ...base, cambio: c.valore, fonte: FONTE_CAMBIO.aMano, quando, ...conCampo('prima', prima) }
}

function nuovoRiferimento(x: ValoreRiferimento | undefined, c: CorrezioneDato, quando: string, cambioDelGiorno: number | undefined): ValoreRiferimento {
  const d = c.dato as Extract<RifDato, { tipo: 'riferimento' }>
  const valuta = DESCRIZIONE[d.riferimento].valuta
  const base = { riferimento: d.riferimento, data: d.data }
  if (c.azione === 'torna') {
    const p = x!.prima!
    return {
      ...base,
      valore: p.valore,
      valuta,
      ...conCampo('cambio', p.cambio ?? x!.cambio),
      fonte: p.fonte,
      ...conCampo('seduta', p.seduta),
      ...conCampo('nota', p.nota),
      ...conCampo('quando', p.quando),
    }
  }
  const cambio = valuta === 'EUR' ? undefined : (c.cambio ?? x?.cambio ?? cambioDelGiorno)
  if (c.azione === 'scaricato')
    return { ...base, valore: c.valore, valuta, ...conCampo('cambio', cambio), fonte: FONTE_RIFERIMENTO.investing, ...conCampo('seduta', c.seduta), ...conCampo('nota', c.nota) }
  const prima = x
    ? x.fonte === FONTE_RIFERIMENTO.aMano
      ? x.prima
      : { valore: x.valore, fonte: x.fonte, ...conCampo('cambio', x.cambio), ...conCampo('seduta', x.seduta), ...conCampo('nota', x.nota), ...conCampo('quando', x.quando) }
    : undefined
  return { ...base, valore: c.valore, valuta, ...conCampo('cambio', cambio), fonte: FONTE_RIFERIMENTO.aMano, quando, ...conCampo('prima', prima) }
}

/** Il perché della copia, nel suo nome: "prima di correggere a mano il NIC di settembre 2026". */
export function percheDellaCopiaDato(dati: FileDati, c: CorrezioneDato): string {
  const quale = `${nomeDelDato(c.dato)} di ${meseInParole(c.dato.data)}`
  if (c.azione === 'torna') return `prima di tornare a quello di prima per ${quale}`
  if (c.azione === 'scaricato') return `prima di scaricare di nuovo ${quale}`
  return trovaDato(dati, c.dato) ? `prima di correggere a mano ${quale}` : `prima di scrivere a mano ${quale}`
}
