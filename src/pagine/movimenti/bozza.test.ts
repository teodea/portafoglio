// Le prove dei numeri nelle caselle di Registra e della correzione di un movimento.
import { describe, expect, it } from 'vitest'
import { leggiNumero, numeroNellaCasella, totaleDalConto } from './bozza.ts'

describe('i numeri nelle caselle', () => {
  it('gli euro con due decimali, "120,50" e non "120,5"; quote e cambi come sono', () => {
    expect(numeroNellaCasella(120.5, 2)).toBe('120,50')
    expect(numeroNellaCasella(361.5, 2)).toBe('361,50')
    expect(numeroNellaCasella(24284.2, 2)).toBe('24284,20')
    expect(numeroNellaCasella(0.0566, 2)).toBe('0,0566')
    expect(numeroNellaCasella(3)).toBe('3')
    expect(numeroNellaCasella(0.85463)).toBe('0,85463')
    expect(leggiNumero(numeroNellaCasella(1234.5, 2))).toBe(1234.5)
  })

  it('il pagato che viene dal conto: quote × prezzo ÷ cambio, più le commissioni (meno, per una vendita)', () => {
    expect(totaleDalConto('acquisto', 4, 120.5, 1, 0)).toBe(482)
    expect(totaleDalConto('acquisto', 1001, 24.25, 1, 9.95)).toBe(24284.2)
    expect(totaleDalConto('vendita', 10, 100, 0.85, 5)).toBe(1171.47)
  })
})
