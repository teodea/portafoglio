// Le prove del nome del file e del controllo di quello che arriva dalle pagine (ticket 14).
import { describe, expect, it } from 'vitest'
import { eFileScaricato, eLibroExcel, nomeFileExcel, type LibroExcel } from './excel.ts'

const buono = (): LibroExcel => ({
  oggi: '2026-10-19',
  fogli: [
    { tipo: 'leggimi', nome: 'Leggimi', righe: [{ celle: ['Portafoglio titoli'], stile: 'titolo' }, { celle: ['Valore', 1234.5], formato: 'euro' }], larghezze: [26, 100] },
    {
      tipo: 'tabella',
      nome: 'Titoli',
      colonne: [{ titolo: 'Simbolo' }, { titolo: 'Valore', formato: 'euro' }, { titolo: 'set 26', data: '2026-09-30', formato: 'euroTondo' }],
      righe: [['MOND', 12.5, { data: '2026-09-30' }], ['TECN', null, null]],
      grassetto: [1],
    },
  ],
})

describe('il nome del file', () => {
  it('"Portafoglio titoli <giorno-mese-anno>.xlsx", con (2) per il secondo', () => {
    expect(nomeFileExcel('2026-10-19')).toBe('Portafoglio titoli 19-10-2026.xlsx')
    expect(nomeFileExcel('2026-10-19', 2)).toBe('Portafoglio titoli 19-10-2026 (2).xlsx')
    expect(eFileScaricato('Portafoglio titoli 19-10-2026.xlsx')).toBe(true)
    expect(eFileScaricato('Portafoglio titoli 19-10-2026 (2).xlsx')).toBe(true)
    expect(eFileScaricato('portafoglio.json')).toBe(false)
    expect(eFileScaricato('Portafoglio titoli 19-10-2026.xlsx.exe')).toBe(false)
  })
})

describe('il controllo del libro', () => {
  it('accetta un libro fatto bene', () => {
    expect(eLibroExcel(buono())).toBe(true)
  })

  it('rifiuta quello che non è un libro', () => {
    const rotti: unknown[] = [
      null,
      'ciao',
      { ...buono(), oggi: '19/10/2026' },
      { ...buono(), fogli: [] },
      { ...buono(), fogli: [{ ...buono().fogli[1], nome: 'Titoli/2' }] },
      { ...buono(), fogli: [buono().fogli[1], buono().fogli[1]] },
      { ...buono(), fogli: [{ ...buono().fogli[1], righe: [[Number.NaN]] }] },
      { ...buono(), fogli: [{ ...buono().fogli[1], righe: [[{ data: 'ieri' }]] }] },
      { ...buono(), fogli: [{ ...buono().fogli[1], colonne: [{ titolo: 'x', formato: 'formula' }] }] },
      { ...buono(), fogli: [{ ...buono().fogli[1], tipo: 'grafico' }] },
    ]
    for (const r of rotti) expect(eLibroExcel(r), JSON.stringify(r)).toBe(false)
  })
})
