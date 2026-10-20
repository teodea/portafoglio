// Le prove dei numeri della pagina Dati (ticket 13), sul portafoglio inventato.
import { describe, expect, it } from 'vitest'
import { FONTE } from '../dati/aggiorna/fonti.ts'
import { aVersioneAttuale, scriviMese } from '../dati/aggiorna/versione3.ts'
import { applicaCorrezione } from '../dati/correzione.ts'
import { applicaCorrezioneDato } from '../dati/correzione-dati.ts'
import { portafoglioInventato } from '../dati/portafoglio-inventato.ts'
import type { FileDati } from '../dati/tipi.ts'
import { conRiferimentiInventati } from '../pagine/dati/ponte-finto-dati.ts'
import { cifra } from '../formato.ts'
import {
  contaFonti,
  datoInCifre,
  fraseFonti,
  mesiConPrezzi,
  righeDati,
  righePrezzi,
  senzaRiferimenti,
  spiegaDato,
  spiegaPrezzo,
  ultimoNic,
  valuteDeiTitoli,
} from './pagina-dati.ts'

const MOND = 'ZZ0000000001-MIL'
const TECN = 'ZZ0000000002-LON'
const SETTEMBRE = '2026-09-30'
const OTTOBRE = '2026-10-31'

/** Il portafoglio inventato dopo un aggiornamento di ottobre: MOND da Euronext Milano con il controllo diverso, TECN da investing.com. */
function conOttobre(): FileDati {
  return scriviMese(
    aVersioneAttuale(portafoglioInventato()),
    {
      mese: '2026-10',
      prezzi: [
        { titolo: MOND, prezzo: 13.1, seduta: '2026-10-30', fonte: FONTE.euronextMilano, nota: 'Borsa Italiana non ha risposto', controllo: { prezzo: 13.18, seduta: '2026-10-30' } },
        { titolo: TECN, prezzo: 53.2, seduta: '2026-10-30', fonte: FONTE.investing, nota: 'London Stock Exchange non ha risposto', controllo: { perche: 'il prezzo viene già da investing.com' } },
      ],
      cambi: [{ valuta: 'GBP', cambio: 0.8712, seduta: '2026-10-30', fonte: 'BCE' }],
    },
    '2026-11-03T18:00:00.000Z',
  )
}

describe('la scheda Prezzi dei titoli', () => {
  it('i fine mese con prezzi, dal più recente', () => {
    expect(mesiConPrezzi(conOttobre())).toEqual([OTTOBRE, SETTEMBRE, '2026-08-31'])
  })

  it('per ogni prezzo la borsa, la fonte con il suo nome, il perché e il controllo', () => {
    const righe = righePrezzi(conOttobre(), OTTOBRE)
    expect(righe.map((r) => r.nome)).toEqual(['MOND', 'TECN'])
    const [mond, tecn] = righe
    expect(mond).toMatchObject({ borsa: 'Borsa Italiana', perche: 'Borsa Italiana non ha risposto', codiceInvesting: 900001, aMano: false })
    expect(mond.fonte).toMatchObject({ nome: 'Euronext Milano', borsa: true })
    expect(mond.controllo).toMatchObject({ tipo: 'diverso', controllo: 13.18 })
    expect(tecn.fonte).toMatchObject({ nome: 'investing.com (riserva)', borsa: false })
    expect(tecn.controllo).toEqual({ tipo: 'non-fatto', perche: 'il prezzo viene già da investing.com' })
    expect(fraseFonti(contaFonti(righe))).toBe('1 da Euronext Milano · 1 da investing.com (riserva)')
  })

  it('i mesi del file Excel dicono "file Excel iniziale", senza controllo; un prezzo corretto conta "a mano"', () => {
    const dati = applicaCorrezione(aVersioneAttuale(portafoglioInventato()), { tipo: 'correggi', titolo: MOND, data: SETTEMBRE, prezzo: 12.57 }, '2026-10-19T18:00:00.000Z')
    const righe = righePrezzi(dati, SETTEMBRE)
    expect(righe[0]).toMatchObject({ nome: 'MOND', aMano: true, perche: null, controllo: null })
    expect(righe[1].fonte.nome).toBe('file Excel iniziale')
    expect(fraseFonti(contaFonti(righe))).toBe('1 inserito manualmente · 1 dal file Excel iniziale')
  })

  it('il pannello del prezzo: fonte, seduta, perché, controllo, prezzo in euro, e la correzione', () => {
    const s = spiegaPrezzo(conOttobre(), { titolo: TECN, data: OTTOBRE })!
    expect(s.titolo).toBe('Prezzo di TECN a fine ottobre 2026')
    expect(cifra(s.grande)).toBe('53,20 GBP')
    expect(s.conto.map((r) => [r.etichetta, cifra(r.cifra)])).toEqual([
      ['Prezzo in sterlina', '53,20 GBP'],
      ['÷ cambio BCE', '0,8712'],
      ['Prezzo in euro', '61,0652 €'],
    ])
    expect(s.note).toContain('Fonte: investing.com (riserva), chiusura del 30/10/2026.')
    expect(s.note).toContain('London Stock Exchange non ha risposto.')
    expect(s.note).toContain('Controllo con investing.com non eseguito: il prezzo viene già da investing.com.')
    expect(s.correggi).toEqual({ titolo: TECN, data: OTTOBRE })
    // Dopo una correzione il pannello si rifà sui dati nuovi.
    const corretto = applicaCorrezione(conOttobre(), { tipo: 'correggi', titolo: TECN, data: OTTOBRE, prezzo: 53.5 }, '2026-11-04T10:00:00.000Z')
    expect(cifra(s.rifai!(corretto)!.grande)).toBe('53,50 GBP')
  })
})

describe('la scheda Inflazione, cambi e riferimenti', () => {
  it('un mese per riga, dal più recente, da gennaio 2024 (la base del NIC del primo acquisto) a settembre 2026', () => {
    const dati = conRiferimentiInventati(portafoglioInventato())
    const righe = righeDati(dati)
    expect(righe[0].data).toBe(SETTEMBRE)
    expect(righe.at(-1)!.data).toBe('2024-01-31')
    expect(righe).toHaveLength(33)
    expect(valuteDeiTitoli(dati)).toEqual(['GBP'])
    expect(ultimoNic(dati)).toBe('2026-08')
  })

  it('"manca" solo dove serve: il NIC di settembre, il Nasdaq-100 di agosto; i riferimenti prima del primo acquisto non servono', () => {
    const righe = righeDati(conRiferimentiInventati(portafoglioInventato()))
    const settembre = righe[0]
    expect(settembre.nic).toMatchObject({ tipo: 'manca', dato: { tipo: 'nic', data: SETTEMBRE } })
    expect(settembre.nic.tipo === 'manca' && settembre.nic.perche).toMatch(/^ISTAT di solito pubblica il NIC di settembre verso metà ottobre\./)
    expect(settembre.cambi[0]).toMatchObject({ tipo: 'dato', numero: 0.8546, fonte: 'dal tuo file Excel' })
    const agosto = righe[1]
    const nasdaq = agosto.riferimenti[2]
    expect(nasdaq).toMatchObject({ tipo: 'manca', dato: { tipo: 'riferimento', riferimento: 'nasdaq100' } })
    expect(agosto.riferimenti.filter((c) => c.tipo === 'dato')).toHaveLength(4)
    const gennaio2024 = righe.at(-1)!
    expect(gennaio2024.nic.tipo).toBe('dato')
    expect(gennaio2024.riferimenti.every((c) => c.tipo === 'non-serve')).toBe(true)
    // La sterlina serve solo da quando c'è il titolo in sterline (giugno 2024): prima non serve, poi manca (il file inventato ha solo agosto e settembre 2026).
    expect(gennaio2024.cambi[0].tipo).toBe('non-serve')
    expect(righe.find((r) => r.data === '2024-07-31')!.cambi[0].tipo).toBe('manca')
  })

  it('senza riferimenti nel file: tutti "manca", con il perché', () => {
    const dati = aVersioneAttuale(portafoglioInventato())
    expect(senzaRiferimenti(dati)).toBe(true)
    const r = righeDati(dati)[0]
    expect(r.riferimenti.every((c) => c.tipo === 'manca' && /prossimo Aggiorna fine mese/.test(c.perche))).toBe(true)
  })

  it('un dato corretto a mano è segnato, con quello di prima', () => {
    const dati = applicaCorrezioneDato(conRiferimentiInventati(portafoglioInventato()), { azione: 'correggi', dato: { tipo: 'nic', data: '2026-08-31' }, valore: 103.9 }, '2026-10-19T18:00:00.000Z')
    const agosto = righeDati(dati)[1]
    expect(agosto.nic).toMatchObject({ tipo: 'dato', numero: 103.9, aMano: true })
    expect(agosto.nic.tipo === 'dato' && agosto.nic.prima).toBeGreaterThan(0)
  })

  it('il pannello del NIC: il conto dell’inflazione del mese, anche tra due basi', () => {
    const dati = conRiferimentiInventati(portafoglioInventato())
    const s = spiegaDato(dati, { tipo: 'nic', data: '2026-01-31' })
    expect(s.titolo).toBe('Inflazione NIC a fine gennaio 2026')
    expect(s.conto.map((r) => r.etichetta)).toEqual(['NIC di gennaio', 'NIC di dicembre', 'Inflazione del mese'])
    expect(cifra(s.conto[0].cifra)).toMatch(/\(base 2025 = 100\)$/)
    expect(cifra(s.conto[1].cifra)).toMatch(/\(base 2015 = 100\)$/)
    expect(s.note[0]).toMatch(/ISTAT ha cambiato base a gennaio 2026/)
    expect(s.correggiDato).toEqual({ tipo: 'nic', data: '2026-01-31' })
  })

  it('il pannello di un indice in dollari: i punti e l’equivalente in euro; quando manca, il perché', () => {
    const dati = conRiferimentiInventati(portafoglioInventato())
    const s = spiegaDato(dati, { tipo: 'riferimento', riferimento: 'sp500', data: '2026-07-31' })
    expect(s.conto.map((r) => r.etichetta)).toEqual(['Punti, in dollari', '÷ cambio BCE del dollaro', 'Equivalente in euro'])
    expect(s.note[0]).toBe('Fonte: investing.com, chiusura del 31/07/2026.')
    const manca = spiegaDato(dati, { tipo: 'riferimento', riferimento: 'nasdaq100', data: '2026-08-31' })
    expect(cifra(manca.grande)).toBe('manca')
    expect(manca.frase).toMatch(/^investing.com non ha fornito il valore di fine agosto/)
    expect(manca.correggiDato).toEqual({ tipo: 'riferimento', riferimento: 'nasdaq100', data: '2026-08-31' })
  })

  it('i numeri scritti: NIC con un decimale, cambio con quattro, riferimenti con due', () => {
    expect(datoInCifre({ tipo: 'nic', data: SETTEMBRE }, 104.6)).toBe('104,6')
    expect(datoInCifre({ tipo: 'cambio', valuta: 'GBP', data: SETTEMBRE }, 0.8546)).toBe('0,8546')
    expect(datoInCifre({ tipo: 'riferimento', riferimento: 'sp500', data: SETTEMBRE }, 14123.4)).toBe('14.123,40')
  })
})
