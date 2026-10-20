// L'inflazione NIC (indice generale) dal servizio SDMX ufficiale di ISTAT, esploradati.istat.it.
// Si usa il flusso "tutte le basi": una sola richiesta dà fino a dicembre 2025 la base 2015 (DATA_TYPE 39)
// e da gennaio 2026 la base 2025 (DATA_TYPE 85). Le due basi si agganciano nei conti (nicAgganciato).
// ISTAT accetta al massimo 5 richieste al minuto per indirizzo e chi supera il limite resta bloccato
// per 1-2 giorni: qui se ne fanno al massimo 4 al minuto, a distanza di almeno 13 secondi, in fila.
import { fineMese, inizioMese, meseDi, meseFinito, oggiLocale } from '../../src/dati/aggiorna/calendario.ts'
import type { EsitoNic, NicArrivato } from '../../src/dati/aggiorna/riferimenti.ts'
import { AGENTE, type Scarica } from './comune.ts'

const INDIRIZZO = 'https://esploradati.istat.it/SDMXWS/rest/data/167_745_DF_DCSP_NIC1B2025_6/M.IT..4.00'
const BASI: Record<string, 2015 | 2025> = { '39': 2015, '85': 2025 }

/** Il limite di ISTAT, con margine: 4 richieste in 60 secondi, e almeno 13 secondi tra una e l'altra. */
export const LIMITE = { richieste: 4, finestra: 60_000, distanza: 13_000 }

/** Quando sono partite le ultime richieste (millisecondi), per tutto il processo. */
const partite: number[] = []
let coda: Promise<unknown> = Promise.resolve()

/** Quanto aspettare prima della prossima richiesta, dato quando sono partite le ultime. */
export function attesaIstat(partiteFinora: readonly number[], adesso: number, limite = LIMITE): number {
  const recenti = partiteFinora.filter((t) => adesso - t < limite.finestra).sort((a, b) => a - b)
  let attesa = 0
  if (recenti.length) attesa = Math.max(attesa, recenti.at(-1)! + limite.distanza - adesso)
  if (recenti.length >= limite.richieste) attesa = Math.max(attesa, recenti[recenti.length - limite.richieste] + limite.finestra - adesso)
  return Math.max(0, attesa)
}

function inFila<T>(lavoro: () => Promise<T>, limite = LIMITE): Promise<T> {
  const turno = coda.then(async () => {
    const attesa = attesaIstat(partite, Date.now(), limite)
    if (attesa > 0) await new Promise((fatto) => setTimeout(fatto, attesa))
    partite.push(Date.now())
    while (partite.length > 20) partite.shift()
    return lavoro()
  })
  coda = turno.catch(() => undefined)
  return turno
}

/**
 * Legge il CSV di ISTAT (colonne DATA_TYPE, MEASURE, ECOICOP_2, TIME_PERIOD, OBS_VALUE, OBS_STATUS): solo
 * l'indice (MEASURE 4) generale (ECOICOP_2 00). Se un mese c'è in due basi, vale la più nuova.
 */
export function leggiIstat(testo: string): NicArrivato[] {
  const righe = testo.replace(/^﻿/, '').trim().split(/\r?\n/)
  if (righe.length < 2) return []
  const col = righe[0].split(',')
  const i = (nome: string) => col.indexOf(nome)
  const [iTipo, iMisura, iVoce, iMese, iValore, iStato] = ['DATA_TYPE', 'MEASURE', 'ECOICOP_2', 'TIME_PERIOD', 'OBS_VALUE', 'OBS_STATUS'].map(i)
  if (iTipo < 0 || iMese < 0 || iValore < 0) throw new Error('ISTAT ha risposto con dati non leggibili')
  const perMese = new Map<string, NicArrivato>()
  for (const r of righe.slice(1)) {
    const c = r.split(',')
    const base = BASI[c[iTipo]]
    if (!base || (iMisura >= 0 && c[iMisura] !== '4') || (iVoce >= 0 && c[iVoce] !== '00')) continue
    const mese = c[iMese]
    const valore = Number(c[iValore])
    if (!/^\d{4}-\d{2}$/.test(mese) || !c[iValore] || !Number.isFinite(valore) || valore <= 0) continue
    const v: NicArrivato = { data: fineMese(mese), valore, base }
    const stato = iStato >= 0 ? c[iStato] : ''
    if (stato === 'P') v.nota = 'dato provvisorio di ISTAT'
    const c0 = perMese.get(mese)
    if (!c0 || c0.base < base) perMese.set(mese, v)
  }
  return [...perMese.values()].sort((a, b) => a.data.localeCompare(b.data))
}

/**
 * Il NIC dei mesi chiesti, con una sola richiesta (dal più vecchio al più nuovo). I mesi che ISTAT non ha
 * ancora pubblicato semplicemente non ci sono: si riprendono al prossimo aggiornamento.
 */
export async function nicIstat(mesi: readonly string[], scarica: Scarica = fetch, oggi = oggiLocale(), limite = LIMITE): Promise<EsitoNic> {
  const chiesti = [...new Set(mesi)].filter((m) => /^\d{4}-\d{2}$/.test(m) && meseFinito(m, oggi)).sort()
  if (!chiesti.length) return { ok: true, valori: [] }
  const url = `${INDIRIZZO}?startPeriod=${chiesti[0]}&endPeriod=${chiesti.at(-1)}`
  let testo: string
  try {
    testo = await inFila(async () => {
      const risposta = await scarica(url, {
        // Accept-Language serve: con quello di Node ("*") ISTAT risponde errore 500 ("languageTag").
        headers: { 'User-Agent': AGENTE, Accept: 'application/vnd.sdmx.data+csv;version=1.0.0', 'Accept-Language': 'it' },
        signal: AbortSignal.timeout(60_000),
      })
      // Nessun dato nel periodo (per esempio il mese non è ancora uscito): ISTAT risponde 404.
      if (risposta.status === 404) return ''
      if (risposta.status === 429 || risposta.status === 403)
        throw new Error('ISTAT chiede di attendere: troppe richieste. Riprovare al prossimo aggiornamento')
      if (!risposta.ok) throw new Error(`ISTAT non ha risposto (errore ${risposta.status})`)
      return await risposta.text()
    }, limite)
  } catch (e) {
    const nome = e instanceof Error ? e.name : ''
    if (nome === 'TimeoutError' || nome === 'AbortError') return { ok: false, perche: 'ISTAT non ha risposto in tempo' }
    if (e instanceof TypeError) return { ok: false, perche: 'ISTAT non ha risposto: controllare la connessione a internet' }
    return { ok: false, perche: e instanceof Error ? e.message : 'ISTAT non ha risposto' }
  }
  let valori: NicArrivato[]
  try {
    valori = leggiIstat(testo)
  } catch (e) {
    return { ok: false, perche: e instanceof Error ? e.message : 'ISTAT ha risposto con dati non leggibili' }
  }
  const voluti = new Set(chiesti)
  return { ok: true, valori: valori.filter((v) => voluti.has(meseDi(v.data)) && v.data >= inizioMese(chiesti[0])) }
}
