import { describe, expect, it } from 'vitest'
import { percheInParole } from './errore.ts'

describe('percheInParole', () => {
  it('toglie il prefisso di Electron e il nome dell’errore', () => {
    const e = new Error("Error invoking remote method 'cartella:apri': Error: il file è stato cambiato da un altro PC")
    expect(percheInParole(e)).toBe('il file è stato cambiato da un altro PC')
  })
  it('toglie anche un TypeError', () => {
    expect(percheInParole(new Error("Error invoking remote method 'x': TypeError: manca il mese"))).toBe('manca il mese')
  })
  it('lascia com’è un messaggio già in parole', () => {
    expect(percheInParole(new Error('non trovo quella copia'))).toBe('non trovo quella copia')
    expect(percheInParole('Errore: niente rete')).toBe('Errore: niente rete')
  })
  it('non resta mai vuoto', () => {
    expect(percheInParole(new Error(''))).toBe('non so perché')
  })
})
