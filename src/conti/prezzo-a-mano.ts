// I prezzi scritti a mano, per le pagine e il pannello (ticket 8). Modulo puro.
import { FONTE } from '../dati/aggiorna/fonti.ts'
import type { RifPrezzo } from '../dati/correzione.ts'
import type { FileDati, PrezzoFineMese } from '../dati/tipi.ts'
import { schedaDelTitolo } from './scheda.ts'
import type { Spiegazione } from './spiegazione.ts'
import { contiDeiTitoli } from './titoli.ts'

/** Il prezzo è scritto a mano (nell'aggiornamento o corretto dopo): porta il chip "a mano". */
export function eAMano(p: PrezzoFineMese | null | undefined): boolean {
  return p?.fonte === FONTE.aMano
}

/**
 * Il "Da dove viene" di un prezzo di fine mese, rifatto sui dati di adesso: è quello della scheda
 * Mese per mese della Scheda del titolo. Serve al pannello dopo una correzione, per mostrare subito
 * il prezzo nuovo con il chip e quello di prima. null se quel mese il titolo non c'era.
 */
export function spiegazioneDelPrezzo(dati: FileDati, rif: RifPrezzo): Spiegazione | null {
  const conto = contiDeiTitoli(dati).titoli.find((t) => t.id === rif.titolo)
  if (!conto) return null
  const riga = schedaDelTitolo(dati, conto).mesi.find((r) => r.mese.mese === rif.data && r.prezzoDel === null)
  return riga ? riga.prezzo.perche : null
}
