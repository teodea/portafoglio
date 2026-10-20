import { describe, expect, it } from 'vitest'
import { portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import { cercaNelTesto, formeDelNumero, isinValido, isinVeri, trattiDelFile } from './controlla-dati.ts'

// Codici ISIN con la cifra di controllo giusta, scritti spezzati: così questo file non fa scattare il controllo stesso.
const PUBBLICO = 'US037833100' + '5' // un esempio pubblico molto noto, per provare il calcolo
const ITALIANO = 'IT000000000' + '7'

describe('il controllo dei codici ISIN', () => {
  it('riconosce la cifra di controllo', () => {
    expect(isinValido(PUBBLICO)).toBe(true)
    expect(isinValido(ITALIANO)).toBe(true)
    expect(isinValido('IT000000000' + '8')).toBe(false)
    expect(isinValido('non un codice')).toBe(false)
  })

  it('segnala i codici veri, non quelli inventati delle prove né le stringhe a caso', () => {
    expect(isinVeri(`const a = "${ITALIANO}"; const b = "ZZ0000000001"`)).toEqual([ITALIANO])
    expect(isinVeri('ABCDEFGHIJKL 123456789012')).toEqual([])
    expect(isinVeri(JSON.stringify(portafoglioInventato()))).toEqual([])
  })
})

describe('i dati del file da non pubblicare', () => {
  const dati = portafoglioInventato()
  const tratti = trattiDelFile(dati)

  it('prende codici, nomi e simboli dei titoli', () => {
    const valori = tratti.map((t) => t.valore)
    expect(valori).toContain('ZZ0000000001')
    expect(valori).toContain('Fondo Inventato Azioni Mondo')
    expect(valori).toContain('MOND')
  })

  it('prende solo i numeri abbastanza particolari, in tutte le forme', () => {
    expect(formeDelNumero(1234.5)).toEqual(expect.arrayContaining(['1234.5', '1234.50', '1234,50', '1.234,50']))
    const conNumeri = trattiDelFile({ operazioni: [{ quantita: 10, prezzo: 432.17, totale: 12000, commissioni: 2.95 }] })
    const numeri = conNumeri.filter((t) => t.come === 'numero').map((t) => t.valore)
    expect(numeri).toEqual(expect.arrayContaining(['432.17', '432,17', '12000']))
    expect(numeri).not.toContain('10')
    expect(numeri).not.toContain('2.95')
  })

  it('trova i dati in un file, con la riga', () => {
    const testo = [
      "// niente qui",
      "const nome = 'fondo inventato azioni mondo'",
      'simbolo: MOND,',
      'MONDO non è il simbolo',
      'prezzo 432,17 euro',
      'versione 1432.171 non conta',
    ].join('\n')
    const t = trattiDelFile({ ...dati, prezzi: [{ titolo: 'x', data: '2026-09-30', prezzo: 432.17, valuta: 'EUR', fonte: 'prova' }] })
    const trovati = cercaNelTesto('prova.ts', testo, t)
    expect(trovati.map((x) => [x.riga, x.valore])).toEqual([
      [2, 'Fondo Inventato Azioni Mondo'],
      [3, 'MOND'],
      [5, '432,17'],
    ])
  })

  it('nel file senza numeri (package-lock) cerca solo codici e nomi', () => {
    const t = trattiDelFile({ prezzi: [{ prezzo: 12345.67 }] })
    expect(cercaNelTesto('package-lock.json', 'sha512-12345.67', t, false)).toEqual([])
  })
})
