// Le cifre a sinistra del grafico del valore: cinque linee con un passo tondo. Modulo puro.
import { numero } from '../../formato.ts'

/** Cinque linee della griglia con un passo tondo (1, 1,25, 1,5, 2, 2,5 … per una potenza di dieci), il più stretto che contiene tutto. */
export function griglia(min: number, max: number): number[] {
  if (!(max > min)) {
    const m = max || 1
    return griglia(m * 0.9, m * 1.1)
  }
  const grezzo = (max - min) / 4
  const dieci = 10 ** Math.floor(Math.log10(grezzo))
  for (const f of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 20]) {
    const passo = f * dieci
    const basso = Math.floor(min / passo) * passo
    if (basso + 4 * passo >= max) return Array.from({ length: 5 }, (_, i) => basso + i * passo)
  }
  return Array.from({ length: 5 }, (_, i) => min + i * grezzo)
}

/** Le cifre a sinistra, intere e con il punto delle migliaia: "375.000", "1.250.000" (niente "k" né "M"). */
export function corto(v: number): string {
  return numero(v)
}
