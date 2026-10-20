// Le prove delle fonti senza internet: risposte d'esempio (codici e prezzi inventati) e fonti finte.
import { describe, expect, it } from 'vitest'
import { FONTE, type RichiestaPrezzo } from '../../src/dati/aggiorna/fonti.ts'
import { cambioBce, leggiBce } from './bce.ts'
import { leggiBorsaItaliana } from './borsa-italiana.ts'
import { chiusuraDiFineMese, NonVa } from './comune.ts'
import { leggiTabellaDeutscheBoerse } from './deutsche-boerse.ts'
import { leggiEuronext } from './euronext.ts'
import { prezzoFineMese, type Lettore } from './index.ts'
import { divisoreLse, leggiSchedaLse, leggiStoricoLse } from './lse.ts'

const MILANO: RichiestaPrezzo = { isin: 'ZZ0000000001', borsa: 'MIL', simbolo: 'MOND', valuta: 'EUR' }

describe('leggere le risposte delle fonti', () => {
  it('Borsa Italiana: istante a mezzanotte UTC e chiusura', () => {
    const testo = JSON.stringify({
      d: [
        [Date.UTC(2026, 9, 29), 12.9, 12.8, 13, 12.7, 12.9, 100],
        [Date.UTC(2026, 9, 30), 13.1, 12.9, 13.2, 12.9, 13.1, 120],
      ],
    })
    expect(leggiBorsaItaliana(testo)).toEqual([
      { data: '2026-10-29', prezzo: 12.9 },
      { data: '2026-10-30', prezzo: 13.1 },
    ])
    expect(() => leggiBorsaItaliana('<html>')).toThrow(NonVa)
  })

  it('Euronext: colonna Close, e il controllo dell’ISIN in testa al file', () => {
    const csv =
      '﻿"Historical Data"\n"From 2026-10-01 to 2026-10-31"\nZZ0000000001\nDate;Open;High;Low;Last;Close;"Number of Shares";"Number of Trades";Turnover\n30/10/2026;13;13.2;12.9;13.05;13.1;10;2;131\n29/10/2026;12.8;13;12.7;12.9;12.9;0;0;0;\n'
    expect(leggiEuronext(csv, 'ZZ0000000001')).toEqual([
      { data: '2026-10-30', prezzo: 13.1 },
      { data: '2026-10-29', prezzo: 12.9 },
    ])
    expect(leggiEuronext(csv, 'ZZ0000000009')).toBeNull()
  })

  it('BCE: l’elenco dei cambi giornalieri', () => {
    const csv =
      'KEY,FREQ,CURRENCY,TIME_PERIOD,OBS_VALUE\nEXR.D.GBP.EUR.SP00.A,D,GBP,2026-10-29,0.8702\nEXR.D.GBP.EUR.SP00.A,D,GBP,2026-10-30,0.8691\n'
    expect(leggiBce(csv)).toEqual([
      { data: '2026-10-29', cambio: 0.8702 },
      { data: '2026-10-30', cambio: 0.8691 },
    ])
  })

  it('BCE: il cambio di un mese non ancora finito non si chiede', async () => {
    let chiesto = false
    const finto = async () => ((chiesto = true), new Response(''))
    expect(await cambioBce('GBP', '2026-10', finto, '2026-10-19')).toEqual({ ok: false, perche: 'Ottobre non è ancora finito' })
    expect(chiesto).toBe(false)
  })

  it('Deutsche Börse: la tabella della pagina, date "GG/MM/AA" e numeri all’inglese', () => {
    expect(
      leggiTabellaDeutscheBoerse(
        ['Date', 'Open', 'Close', 'High', 'Low'],
        [
          ['30/10/26', '1,201.00', '1,204.50', '1,210.00', '1,200.00'],
          ['29/10/26', '12.00', '12.35', '12.40', '11.90'],
        ],
      ),
    ).toEqual([
      { data: '2026-10-30', prezzo: 1204.5 },
      { data: '2026-10-29', prezzo: 12.35 },
    ])
  })

  it('Londra: i prezzi in pence diventano sterline', () => {
    expect(leggiSchedaLse('{"isin":"ZZ0000000002","currency":"GBX","tidm":"TECN"}')).toEqual({ isin: 'ZZ0000000002', valuta: 'GBX' })
    expect(divisoreLse('GBX', 'GBP')).toBe(100)
    expect(() => divisoreLse('USD', 'GBP')).toThrow('a Londra il titolo è in USD, nel file in GBP')
    const storico =
      '{"data":[{"_DATE_END":"2026-10-29","CLOSE_PRC":"5390.0"},{"_DATE_END":"2026-10-30","CLOSE_PRC":"5413.5"}],"status":"OK"}'
    expect(leggiStoricoLse(storico, 100)).toEqual([
      { data: '2026-10-29', prezzo: 53.9 },
      { data: '2026-10-30', prezzo: 54.135 },
    ])
  })
})

describe('la chiusura di fine mese', () => {
  it('l’ultima chiusura dentro il mese; se non è dell’ultimo giorno di borsa lo dice', () => {
    const chiusure = [
      { data: '2026-10-28', prezzo: 12.5 },
      { data: '2026-10-29', prezzo: 12.9 },
      { data: '2026-11-02', prezzo: 13.5 },
    ]
    expect(chiusuraDiFineMese(chiusure, '2026-10', 'MIL')).toEqual({
      prezzo: 12.9,
      seduta: '2026-10-29',
      nota: 'chiusura del 29/10/2026: del 30/10/2026 la fonte non ha il prezzo',
    })
    expect(chiusuraDiFineMese([...chiusure, { data: '2026-10-30', prezzo: 13.1 }], '2026-10', 'MIL')).toEqual({
      prezzo: 13.1,
      seduta: '2026-10-30',
    })
    expect(chiusuraDiFineMese([{ data: '2026-11-02', prezzo: 13.5 }], '2026-10', 'MIL')).toBeNull()
  })
})

describe('l’ordine delle fonti', () => {
  const buona: Lettore = async () => [{ data: '2026-10-30', prezzo: 13.1 }]
  const spenta: Lettore = async () => {
    throw new NonVa('non ha risposto (errore 503)')
  }

  it('prima la borsa ufficiale', async () => {
    const esito = await prezzoFineMese(MILANO, '2026-10', { [FONTE.borsaItaliana]: buona, [FONTE.euronextMilano]: spenta }, '2026-11-03')
    expect(esito).toEqual({ ok: true, prezzo: 13.1, seduta: '2026-10-30', fonte: 'Borsa Italiana', tentativi: [] })
  })

  it('se Borsa Italiana non risponde, Euronext Milano, e sotto il prezzo c’è scritto perché', async () => {
    const esito = await prezzoFineMese(MILANO, '2026-10', { [FONTE.borsaItaliana]: spenta, [FONTE.euronextMilano]: buona }, '2026-11-03')
    expect(esito).toMatchObject({ ok: true, fonte: 'Euronext Milano', nota: 'Borsa Italiana non ha risposto (errore 503)' })
  })

  it('se non risponde nessuna, manca, con il perché di ognuna', async () => {
    const esito = await prezzoFineMese(
      MILANO,
      '2026-10',
      { [FONTE.borsaItaliana]: spenta, [FONTE.euronextMilano]: async () => [] },
      '2026-11-03',
    )
    expect(esito).toEqual({
      ok: false,
      perche: 'Borsa Italiana non ha risposto (errore 503); Euronext Milano non ha la chiusura di ottobre',
      tentativi: [
        { fonte: 'Borsa Italiana', perche: 'non ha risposto (errore 503)' },
        { fonte: 'Euronext Milano', perche: 'non ha la chiusura di ottobre' },
      ],
    })
  })

  it('un mese non ancora finito non si chiede nemmeno', async () => {
    let chiesto = false
    const esito = await prezzoFineMese(MILANO, '2026-10', { [FONTE.borsaItaliana]: async () => ((chiesto = true), []) }, '2026-10-19')
    expect(esito).toEqual({ ok: false, perche: 'Ottobre non è ancora finito', tentativi: [] })
    expect(chiesto).toBe(false)
  })
})
