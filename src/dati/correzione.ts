// Correggere a mano un prezzo di fine mese che è già nel file, e tornare al prezzo di prima (ticket 8).
// Si usa nel processo principale, sul file appena riletto dal disco e già passato alla versione 3,
// subito prima della scrittura sicura. Modulo puro: niente file, non cambia mai l'oggetto ricevuto.
//
// Esempio: il prezzo di MOND a fine settembre è 12,75 € da "Borsa Italiana". Lo correggi in 12,57:
// nel file diventa { prezzo: 12.57, fonte: "a mano", quando: "…", prima: { prezzo: 12.75, fonte: "Borsa Italiana", seduta: … } }.
// "Torna al prezzo di prima" rimette 12,75 € da "Borsa Italiana", con la sua seduta e la sua nota.
import { FONTE } from './aggiorna/fonti.ts'
import type { Apertura } from './ponte.ts'
import type { FileDati, PrezzoFineMese } from './tipi.ts'

/** Quale prezzo: il titolo e il fine mese (la chiave del mese, es. "2026-09-30"). */
export type RifPrezzo = { titolo: string; data: string }

export type Correzione =
  /** Scrive a mano il prezzo giusto (nella valuta del titolo). */
  | { tipo: 'correggi'; titolo: string; data: string; prezzo: number }
  /** Rimette il prezzo che c'era prima della correzione. */
  | { tipo: 'torna'; titolo: string; data: string }

export type EsitoCorrezione =
  | { esito: 'salvato'; apertura: Apertura; /** Il nome della copia fatta prima di scrivere. */ copia: string }
  /** Il file è stato cambiato da un altro PC (o con Blocco note): non si è scritto niente, i dati sono ricaricati. */
  | { esito: 'cambiato'; apertura: Apertura }
  | { esito: 'errore'; perche: string }

export type PonteCorrezione = {
  /** Scrive la correzione (o il ritorno al prezzo di prima) con la scrittura sicura, dopo una copia. */
  correggiPrezzo(c: Correzione): Promise<EsitoCorrezione>
}

export const CANALI_CORREZIONE = { correggiPrezzo: 'prezzo:correggi' } as const

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const meseInParole = (data: string) => `${MESI[Number(data.slice(5, 7)) - 1]} ${data.slice(0, 4)}`

export function trovaPrezzo(dati: FileDati, rif: RifPrezzo): PrezzoFineMese | undefined {
  return (dati.prezzi ?? []).find((p) => p.titolo === rif.titolo && p.data === rif.data)
}

/** Il nome corto del titolo, per le frasi e il nome della copia: il simbolo, o il nome. */
export function nomeDelTitolo(dati: FileDati, id: string): string {
  const t = (dati.titoli ?? []).find((x) => x.id === id)
  return t ? (t.simbolo ?? t.nome) : id
}

/** Una richiesta arrivata dalle pagine ha la forma giusta? (Il processo principale non si fida.) */
export function eCorrezione(x: unknown): x is Correzione {
  const c = x as Correzione
  if (typeof c !== 'object' || c === null || typeof c.titolo !== 'string' || typeof c.data !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.data)) return false
  if (c.tipo === 'torna') return true
  return c.tipo === 'correggi' && typeof c.prezzo === 'number'
}

/** Si può fare? Il prezzo deve esserci, il numero nuovo deve essere sensato, per tornare indietro serve quello di prima. */
export function controllaCorrezione(dati: FileDati, c: Correzione): { ok: true } | { ok: false; perche: string } {
  const p = trovaPrezzo(dati, c)
  const nome = nomeDelTitolo(dati, c.titolo)
  if (!p) return { ok: false, perche: `nel file non c’è il prezzo di ${nome} a fine ${meseInParole(c.data)}` }
  if (c.tipo === 'torna') {
    if (p.fonte !== FONTE.aMano || !p.prima) return { ok: false, perche: `il prezzo di ${nome} a fine ${meseInParole(c.data)} non ha un prezzo di prima` }
    return { ok: true }
  }
  if (!(Number.isFinite(c.prezzo) && c.prezzo > 0)) return { ok: false, perche: 'il prezzo nuovo deve essere un numero più di zero' }
  if (c.prezzo === p.prezzo) return { ok: false, perche: 'il prezzo nuovo è uguale a quello che c’è già' }
  return { ok: true }
}

/** Il prezzo com'è adesso, da tenere come "prima": senza il suo "prima". */
function comEra(p: PrezzoFineMese): NonNullable<PrezzoFineMese['prima']> {
  return {
    prezzo: p.prezzo,
    fonte: p.fonte,
    ...(p.seduta ? { seduta: p.seduta } : {}),
    ...(p.nota ? { nota: p.nota } : {}),
    ...(p.quando ? { quando: p.quando } : {}),
  }
}

/**
 * Scrive la correzione nel file (già in versione 3). "quando" è l'istante della scrittura (ISO).
 * Se il prezzo era già stato corretto, "prima" resta quello di partenza: "Torna al prezzo di prima"
 * riporta al prezzo che c'era prima di tutte le correzioni, non a uno sbagliato scritto in mezzo.
 * Il cambio di un titolo in valuta e il controllo di investing.com non cambiano. Gli altri dati non si toccano.
 */
export function applicaCorrezione(dati: FileDati, c: Correzione, quando: string): FileDati {
  const ok = controllaCorrezione(dati, c)
  if (!ok.ok) throw new Error(ok.perche)
  const prezzi = (dati.prezzi ?? []).map((p): PrezzoFineMese => {
    if (p.titolo !== c.titolo || p.data !== c.data) return p
    // L'ordine dei campi è quello che si legge meglio con Blocco note, come in scriviMese.
    const base = { titolo: p.titolo, data: p.data }
    const valuta = { valuta: p.valuta, ...(p.cambio !== undefined ? { cambio: p.cambio } : {}) }
    // Il controllo di investing.com (ticket 7) resta: è il prezzo di un'altra fonte per lo stesso fine mese,
    // e il pannello lo confronta con quello scritto a mano.
    const controllo = p.controllo ? { controllo: p.controllo } : {}
    if (c.tipo === 'correggi') {
      const prima = p.fonte === FONTE.aMano && p.prima ? p.prima : comEra(p)
      return { ...base, prezzo: c.prezzo, ...valuta, fonte: FONTE.aMano, quando, prima, ...controllo }
    }
    const prima = p.prima!
    return {
      ...base,
      prezzo: prima.prezzo,
      ...valuta,
      fonte: prima.fonte,
      ...(prima.seduta ? { seduta: prima.seduta } : {}),
      ...(prima.nota ? { nota: prima.nota } : {}),
      ...(prima.quando ? { quando: prima.quando } : {}),
      ...controllo,
    }
  })
  return { ...dati, prezzi }
}

/** Il perché della copia, nel suo nome: "prima di correggere a mano MOND di settembre 2026". */
export function percheDellaCopia(dati: FileDati, c: Correzione): string {
  const quale = `${nomeDelTitolo(dati, c.titolo)} di ${meseInParole(c.data)}`
  return c.tipo === 'correggi' ? `prima di correggere a mano ${quale}` : `prima di tornare al prezzo di prima di ${quale}`
}
