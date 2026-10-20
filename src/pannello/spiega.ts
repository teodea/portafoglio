// Il legame tra i numeri e il pannello "Da dove viene": chi ha un numero chiede di spiegarlo qui.
import { createContext, useContext } from 'react'
import type { Spiegazione } from '../conti/spiegazione.ts'

export const Contesto = createContext<(s: Spiegazione) => void>(() => {})

/** La funzione che apre il pannello con una spiegazione. */
export function useSpiega(): (s: Spiegazione) => void {
  return useContext(Contesto)
}

/** La classe del colore del segno: verde, rosso o niente. */
export function classeSegno(s: number): string {
  return s > 0 ? 'su' : s < 0 ? 'giu' : ''
}
