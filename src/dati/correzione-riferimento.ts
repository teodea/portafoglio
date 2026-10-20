// Il valore di fine mese di un riferimento o il NIC di un mese, dal pannello "Da dove viene" della classifica
// "Fai meglio dei riferimenti?" (ticket 10): correggerlo a mano, tornare al valore di prima, scrivere i valori
// scaricati di nuovo. Come la correzione di un prezzo (correzione.ts, ticket 8) si usa nel processo principale,
// sul file appena riletto dal disco e già passato alla versione 3, subito prima della scrittura sicura.
// Modulo puro: niente file, non cambia mai l'oggetto ricevuto.
//
// Esempio: l'S&P 500 a fine settembre è 17.160,41 USD da investing.com, con il cambio BCE 1,1355. Lo correggi in 17.200:
// nel file diventa { valore: 17200, cambio: 1.1355, fonte: "a mano", quando: "…", prima: { valore: 17160.41, fonte: "investing.com", … } }.
// "Torna al valore di prima" rimette 17.160,41 USD da investing.com, con la sua seduta.
import { fineMese, meseDi, meseEAnno } from './aggiorna/calendario.ts'
import { controllaRiferimenti, DESCRIZIONE, FONTE_NIC, FONTE_RIFERIMENTO } from './aggiorna/riferimenti.ts'
import type { EsitoCorrezione } from './correzione.ts'
import { RIFERIMENTI, type FileDati, type IdRiferimento, type NicDelMese, type ValoreRiferimento } from './tipi.ts'

/** Un riferimento del confronto: i sei di borsa e l'inflazione NIC. */
export type IdConfronto = IdRiferimento | 'nic'
export const CONFRONTI: readonly IdConfronto[] = [...RIFERIMENTI, 'nic']

/** Quale valore: il riferimento e il giorno (per il pannello, il fine mese del confronto, es. "2026-09-30"). */
export type RifValore = { id: IdConfronto; data: string }

export type ScritturaRiferimento =
  /** Scrive a mano il valore giusto, nella valuta del riferimento. Per un riferimento in dollari che non c'è ancora serve anche il cambio BCE. */
  | { tipo: 'correggi'; id: IdConfronto; data: string; valore: number; cambio?: number }
  /** Rimette il valore che c'era prima della correzione. */
  | { tipo: 'torna'; id: IdConfronto; data: string }
  /** I valori appena scaricati di nuovo ("Scarica di nuovo"): sostituiscono quelli con lo stesso giorno, anche se a mano. */
  | { tipo: 'scaricati'; id: IdConfronto; riferimenti: ValoreRiferimento[]; nic: NicDelMese[] }

export type PonteRiferimentoAMano = {
  /** Scrive con la scrittura sicura, dopo una copia: una correzione, il ritorno al valore di prima o i valori scaricati di nuovo. */
  scriviRiferimento(s: ScritturaRiferimento): Promise<EsitoCorrezione>
}

export const CANALI_RIFERIMENTO_A_MANO = { scriviRiferimento: 'riferimento:scrivi' } as const

const DATA = /^\d{4}-\d{2}-\d{2}$/
const positivo = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/** "S&P 500", "il NIC". */
export function nomeDelConfronto(id: IdConfronto): string {
  return id === 'nic' ? 'il NIC' : DESCRIZIONE[id].nome
}

/** La valuta del valore che si scrive: "EUR" o "USD"; il NIC è un indice, senza valuta. */
export function valutaDel(id: IdConfronto): 'EUR' | 'USD' | null {
  return id === 'nic' ? null : DESCRIZIONE[id].valuta
}

/** La base del NIC di un mese: 2015 fino a dicembre 2025, 2025 da gennaio 2026 (come lo pubblica ISTAT). */
export function baseDelNic(data: string): 2015 | 2025 {
  return data >= '2026-01-01' ? 2025 : 2015
}

export function trovaValore(dati: FileDati, rif: RifValore): ValoreRiferimento | NicDelMese | undefined {
  if (rif.id === 'nic') return (dati.nic ?? []).find((n) => n.data === rif.data)
  return (dati.riferimenti ?? []).find((v) => v.riferimento === rif.id && v.data === rif.data)
}

/** Una richiesta arrivata dalle pagine ha la forma giusta? (Il processo principale non si fida.) */
export function eScritturaRiferimento(x: unknown): x is ScritturaRiferimento {
  const s = x as ScritturaRiferimento
  if (typeof s !== 'object' || s === null || !(CONFRONTI as readonly unknown[]).includes(s.id)) return false
  if (s.tipo === 'scaricati') return Array.isArray(s.riferimenti) && Array.isArray(s.nic) && s.riferimenti.length + s.nic.length <= 2000
  if (typeof s.data !== 'string' || !DATA.test(s.data)) return false
  if (s.tipo === 'torna') return true
  return s.tipo === 'correggi' && typeof s.valore === 'number' && (s.cambio === undefined || typeof s.cambio === 'number')
}

/** "il NIC di settembre 2026", "S&P 500 a fine settembre 2026" */
export function qualeValore(rif: RifValore): string {
  const quando = rif.data === fineMese(meseDi(rif.data)) ? `fine ${meseEAnno(meseDi(rif.data))}` : rif.data.split('-').reverse().join('/')
  return rif.id === 'nic' ? `il NIC di ${meseEAnno(meseDi(rif.data))}` : `${DESCRIZIONE[rif.id].nome} a ${quando}`
}

/** Si può fare? Il numero nuovo deve essere sensato; per tornare indietro serve quello di prima. */
export function controllaScrittura(dati: FileDati, s: ScritturaRiferimento): { ok: true } | { ok: false; perche: string } {
  if (s.tipo === 'scaricati') {
    if (!s.riferimenti.length && !s.nic.length) return { ok: false, perche: 'non è arrivato alcun valore da scrivere' }
    if (s.riferimenti.some((v) => v.riferimento !== s.id) || (s.id !== 'nic' && s.nic.length) || (s.id === 'nic' && s.riferimenti.length))
      return { ok: false, perche: 'i valori arrivati non sono di questo riferimento' }
    if (s.riferimenti.some((v) => v.fonte !== FONTE_RIFERIMENTO.investing) || s.nic.some((n) => n.fonte !== FONTE_NIC.istat))
      return { ok: false, perche: 'un valore scaricato deve avere la sua fonte' }
    return controllaRiferimenti({ riferimenti: s.riferimenti, nic: s.nic })
  }
  const c = trovaValore(dati, s)
  const quale = qualeValore(s)
  if (s.tipo === 'torna') {
    if (!c || c.fonte !== FONTE_RIFERIMENTO.aMano || !c.prima) return { ok: false, perche: `${quale} non ha un valore precedente` }
    return { ok: true }
  }
  if (!positivo(s.valore)) return { ok: false, perche: 'il valore nuovo deve essere un numero maggiore di zero' }
  if (s.cambio !== undefined && !positivo(s.cambio)) return { ok: false, perche: 'il cambio deve essere un numero maggiore di zero' }
  if (valutaDel(s.id) === 'USD' && !positivo(s.cambio ?? (c as ValoreRiferimento | undefined)?.cambio))
    return { ok: false, perche: `per ${quale} serve anche il cambio BCE del dollaro` }
  const cambioUguale = s.cambio === undefined || s.cambio === (c as ValoreRiferimento | undefined)?.cambio
  if (c && c.valore === s.valore && cambioUguale) return { ok: false, perche: 'il valore nuovo è uguale a quello presente' }
  return { ok: true }
}

const ORDINE = new Map(RIFERIMENTI.map((id, i) => [id as string, i]))
const ordinaRif = (xs: ValoreRiferimento[]) =>
  xs.sort((a, b) => (ORDINE.get(a.riferimento) ?? 99) - (ORDINE.get(b.riferimento) ?? 99) || a.data.localeCompare(b.data))
const ordinaNic = (xs: NicDelMese[]) => xs.sort((a, b) => a.data.localeCompare(b.data))

/** Il valore com'è adesso, da tenere come "prima": senza il suo "prima". */
function comEraRif(v: ValoreRiferimento): NonNullable<ValoreRiferimento['prima']> {
  return {
    valore: v.valore,
    fonte: v.fonte,
    ...(v.cambio !== undefined ? { cambio: v.cambio } : {}),
    ...(v.seduta ? { seduta: v.seduta } : {}),
    ...(v.nota ? { nota: v.nota } : {}),
    ...(v.quando ? { quando: v.quando } : {}),
  }
}

function comEraNic(n: NicDelMese): NonNullable<NicDelMese['prima']> {
  return { valore: n.valore, fonte: n.fonte, ...(n.nota ? { nota: n.nota } : {}), ...(n.quando ? { quando: n.quando } : {}) }
}

/**
 * Scrive nel file (già in versione 3). "quando" è l'istante della scrittura (ISO).
 * Come per i prezzi: se il valore era già stato corretto, "prima" resta quello di partenza.
 * Un valore che mancava, scritto a mano, non ha un "prima". Gli altri dati non si toccano.
 */
export function applicaScrittura(dati: FileDati, s: ScritturaRiferimento, quando: string): FileDati {
  const ok = controllaScrittura(dati, s)
  if (!ok.ok) throw new Error(ok.perche)

  if (s.tipo === 'scaricati') {
    const chiave = (v: { riferimento: string; data: string }) => v.riferimento + '|' + v.data
    const nuovi = new Set(s.riferimenti.map(chiave))
    const nuoviNic = new Set(s.nic.map((n) => n.data))
    return {
      ...dati,
      riferimenti: ordinaRif([...(dati.riferimenti ?? []).filter((v) => !nuovi.has(chiave(v))), ...s.riferimenti]),
      nic: ordinaNic([...(dati.nic ?? []).filter((n) => !nuoviNic.has(n.data)), ...s.nic]),
    }
  }

  if (s.id === 'nic') {
    const c = trovaValore(dati, s) as NicDelMese | undefined
    let nuovo: NicDelMese
    if (s.tipo === 'correggi') {
      const prima = c ? (c.fonte === FONTE_NIC.aMano && c.prima ? c.prima : comEraNic(c)) : undefined
      nuovo = { data: s.data, valore: s.valore, base: c?.base ?? baseDelNic(s.data), fonte: FONTE_NIC.aMano, quando, ...(prima ? { prima } : {}) }
    } else {
      const p = c!.prima!
      nuovo = { data: s.data, valore: p.valore, base: c!.base, fonte: p.fonte, ...(p.nota ? { nota: p.nota } : {}), ...(p.quando ? { quando: p.quando } : {}) }
    }
    return { ...dati, nic: ordinaNic([...(dati.nic ?? []).filter((n) => n.data !== s.data), nuovo]) }
  }

  const id = s.id
  const c = trovaValore(dati, s) as ValoreRiferimento | undefined
  const valuta = c?.valuta ?? DESCRIZIONE[id].valuta
  let nuovo: ValoreRiferimento
  if (s.tipo === 'correggi') {
    const prima = c ? (c.fonte === FONTE_RIFERIMENTO.aMano && c.prima ? c.prima : comEraRif(c)) : undefined
    const cambio = s.cambio ?? c?.cambio
    nuovo = {
      riferimento: id,
      data: s.data,
      valore: s.valore,
      valuta,
      ...(valuta !== 'EUR' && cambio !== undefined ? { cambio } : {}),
      fonte: FONTE_RIFERIMENTO.aMano,
      quando,
      ...(prima ? { prima } : {}),
    }
  } else {
    const p = c!.prima!
    const cambio = p.cambio ?? c!.cambio
    nuovo = {
      riferimento: id,
      data: s.data,
      valore: p.valore,
      valuta,
      ...(cambio !== undefined ? { cambio } : {}),
      fonte: p.fonte,
      ...(p.seduta ? { seduta: p.seduta } : {}),
      ...(p.nota ? { nota: p.nota } : {}),
      ...(p.quando ? { quando: p.quando } : {}),
    }
  }
  const resto = (dati.riferimenti ?? []).filter((v) => !(v.riferimento === id && v.data === s.data))
  return { ...dati, riferimenti: ordinaRif([...resto, nuovo]) }
}

/** Il perché della copia, nel suo nome: "prima di correggere a mano S&P 500 a fine settembre 2026". */
export function percheDellaCopiaRiferimento(s: ScritturaRiferimento): string {
  if (s.tipo === 'scaricati') return `prima di scrivere ${s.id === 'nic' ? 'il NIC' : DESCRIZIONE[s.id].nome} scaricato di nuovo`
  if (s.tipo === 'correggi') return `prima di correggere a mano ${qualeValore(s)}`
  return s.id === 'nic' ? `prima di tornare al NIC di prima di ${meseEAnno(meseDi(s.data))}` : `prima di tornare al valore di prima di ${qualeValore(s)}`
}
