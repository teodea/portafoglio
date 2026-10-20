// Le prove delle riserve (investing.com e Yahoo) e del controllo, senza internet:
// risposte d'esempio con codici e prezzi inventati, e fonti finte.
import { describe, expect, it } from 'vitest'
import { FONTE, type RichiestaPrezzo } from '../../src/dati/aggiorna/fonti.ts'
import { NonVa, type Scarica } from './comune.ts'
import { conFontiSpente, prezzoFineMese, type Lettore } from './index.ts'
import { chiusureInvesting, leggiInvesting } from './investing.ts'
import { chiusureYahoo, fattoreFrazionamenti, leggiYahoo } from './yahoo.ts'

const MILANO: RichiestaPrezzo = {
  isin: 'ZZ0000000001',
  borsa: 'MIL',
  simbolo: 'MOND',
  valuta: 'EUR',
  codiceInvesting: 900001,
  codiceYahoo: 'MOND.MI',
}
const LONDRA: RichiestaPrezzo = {
  isin: 'ZZ0000000002',
  borsa: 'LON',
  simbolo: 'TECN',
  valuta: 'GBP',
  codiceInvesting: 900002,
  codiceYahoo: 'TECN.L',
}
/** Un titolo comprato a Francoforte che le riserve hanno solo su Xetra. */
const FRANCOFORTE: RichiestaPrezzo = {
  isin: 'ZZ0000000004',
  borsa: 'FRA',
  simbolo: 'BITC',
  valuta: 'EUR',
  codiceInvesting: 900004,
  codiceYahoo: 'BITC.DE',
  borsaRiserve: 'XET',
}

/** Secondi dall'inizio del 1970 per un'ora del giorno, in UTC. */
const istante = (data: string, ora = '07:00') => Date.parse(`${data}T${ora}:00Z`) / 1000

function rispostaYahoo(valuta: string, fuso: string, righe: [string, number][], splits: Record<string, unknown> = {}) {
  return JSON.stringify({
    chart: {
      result: [
        {
          meta: { currency: valuta, exchangeTimezoneName: fuso },
          timestamp: righe.map(([d]) => istante(d)),
          indicators: { quote: [{ close: righe.map(([, p]) => p) }] },
          events: { splits },
        },
      ],
      error: null,
    },
  })
}

const rispondi =
  (testo: string, stato = 200): Scarica =>
  async () =>
    new Response(testo, { status: stato })

describe('Yahoo, la seconda riserva', () => {
  it('le chiusure nel giorno della borsa, i pence divisi per 100', () => {
    const g = leggiYahoo(
      rispostaYahoo('GBp', 'Europe/London', [
        ['2026-10-29', 5390],
        ['2026-10-30', 5413.5000001],
      ]),
    )
    expect(g.valuta).toBe('GBP')
    expect(g.divisore).toBe(100)
    expect(g.chiusure.map((c) => c.data)).toEqual(['2026-10-29', '2026-10-30'])
  })

  it('un codice che Yahoo non conosce', () => {
    expect(() => leggiYahoo('{"chart":{"result":null,"error":{"description":"No data found"}}}')).toThrow('non conosce il codice')
  })

  it('il prezzo scambiato quel giorno, prima di un frazionamento venuto dopo', async () => {
    // Il 10/11 una quota diventa due: Yahoo scrive 6,55 la chiusura del 30/10, che era 13,10.
    const testo = rispostaYahoo('EUR', 'Europe/Rome', [['2026-10-30', 6.55], ['2026-11-12', 6.6]], {
      a: { date: istante('2026-11-10'), numerator: 2, denominator: 1 },
    })
    expect(fattoreFrazionamenti([{ data: '2026-11-10', rapporto: 2 }], '2026-10-30')).toBe(2)
    expect(await chiusureYahoo(MILANO, '2026-10', rispondi(testo))).toEqual([{ data: '2026-10-30', prezzo: 13.1 }])
  })

  it('in sterline: 5413,5 pence fanno 54,135 sterline', async () => {
    const testo = rispostaYahoo('GBp', 'Europe/London', [['2026-10-30', 5413.5000001]])
    expect(await chiusureYahoo(LONDRA, '2026-10', rispondi(testo))).toEqual([{ data: '2026-10-30', prezzo: 54.135 }])
  })

  it('una valuta diversa da quella del file non si usa', async () => {
    const testo = rispostaYahoo('USD', 'America/New_York', [['2026-10-30', 15]])
    await expect(chiusureYahoo(MILANO, '2026-10', rispondi(testo))).rejects.toThrow('ha il titolo in USD, nel file è in EUR')
  })

  it('senza il codice nel file non si chiede', async () => {
    await expect(chiusureYahoo({ ...MILANO, codiceYahoo: undefined }, '2026-10', rispondi(''))).rejects.toThrow(
      'nel file manca il codice Yahoo',
    )
  })
})

describe('investing.com, la riserva e il controllo', () => {
  const storico = JSON.stringify({
    data: [
      { rowDateTimestamp: '2026-10-30T00:00:00Z', last_closeRaw: '5413.50000000000000' },
      { rowDateTimestamp: '2026-10-29T00:00:00Z', last_closeRaw: '5390.00000000000000' },
    ],
  })

  it('legge lo storico', () => {
    expect(leggiInvesting(storico)).toEqual([
      { data: '2026-10-30', prezzo: 5413.5 },
      { data: '2026-10-29', prezzo: 5390 },
    ])
    expect(leggiInvesting('{"data":null}')).toEqual([])
    expect(() => leggiInvesting('<html>Access denied</html>')).toThrow(NonVa)
  })

  it('in euro basta investing.com; i pence di Londra si dividono con l’unità di Yahoo', async () => {
    const yahoo = rispondi(rispostaYahoo('GBp', 'Europe/London', [['2026-10-30', 5413.5]]))
    expect(await chiusureInvesting(LONDRA, '2026-10', { investing: rispondi(storico), yahoo }, Date.now(), 0)).toEqual([
      { data: '2026-10-30', prezzo: 54.135 },
      { data: '2026-10-29', prezzo: 53.9 },
    ])
    const euro = JSON.stringify({ data: [{ rowDateTimestamp: '2026-10-30T00:00:00Z', last_closeRaw: '13.1' }] })
    const yahooSpento = rispondi('', 503)
    expect(await chiusureInvesting(MILANO, '2026-10', { investing: rispondi(euro), yahoo: yahooSpento }, Date.now(), 0)).toEqual([
      { data: '2026-10-30', prezzo: 13.1 },
    ])
  })

  it('in sterline senza Yahoo non si sa se sono pence: non si usa', async () => {
    await expect(
      chiusureInvesting(LONDRA, '2026-10', { investing: rispondi(storico), yahoo: rispondi('', 503) }, Date.now(), 0),
    ).rejects.toThrow('senza Yahoo non so se il prezzo è in sterline o in pence')
  })

  it('il sito che rifiuta la richiesta lo dice', async () => {
    const yahoo = rispondi(rispostaYahoo('EUR', 'Europe/Rome', [['2026-10-30', 13.1]]))
    await expect(chiusureInvesting(MILANO, '2026-10', { investing: rispondi('', 403), yahoo }, Date.now(), 0)).rejects.toThrow(
      'non ha risposto (errore 403)',
    )
  })
})

describe('le riserve nell’ordine e il controllo', () => {
  const chiusura =
    (prezzo: number, data = '2026-10-30'): Lettore =>
    async () => [{ data, prezzo }]
  const spenta: Lettore = async () => {
    throw new NonVa('non ha risposto (errore 503)')
  }
  const OGGI = '2026-11-03'

  it('la borsa risponde: il prezzo è suo, e accanto c’è il prezzo di investing.com', async () => {
    const esito = await prezzoFineMese(
      MILANO,
      '2026-10',
      { [FONTE.borsaItaliana]: chiusura(13.1), [FONTE.investing]: chiusura(13.18), [FONTE.yahoo]: chiusura(13.1) },
      OGGI,
    )
    expect(esito).toEqual({
      ok: true,
      prezzo: 13.1,
      seduta: '2026-10-30',
      fonte: 'Borsa Italiana',
      controllo: { prezzo: 13.18, seduta: '2026-10-30' },
      tentativi: [],
    })
  })

  it('le borse non rispondono: investing.com (riserva), con il perché sotto il prezzo', async () => {
    const esito = await prezzoFineMese(
      MILANO,
      '2026-10',
      { [FONTE.borsaItaliana]: spenta, [FONTE.euronextMilano]: spenta, [FONTE.investing]: chiusura(13.1), [FONTE.yahoo]: chiusura(13.1) },
      OGGI,
    )
    expect(esito).toMatchObject({
      ok: true,
      prezzo: 13.1,
      fonte: 'investing.com (riserva)',
      nota: 'Borsa Italiana non ha risposto (errore 503); Euronext Milano non ha risposto (errore 503)',
      controllo: { perche: 'il prezzo viene già da investing.com' },
    })
  })

  it('non risponde nemmeno investing.com: Yahoo (seconda riserva), e il controllo dice perché non c’è', async () => {
    const esito = await prezzoFineMese(LONDRA, '2026-10', { [FONTE.lse]: spenta, [FONTE.investing]: spenta, [FONTE.yahoo]: chiusura(54.135) }, OGGI)
    expect(esito).toMatchObject({
      ok: true,
      prezzo: 54.135,
      fonte: 'Yahoo (seconda riserva)',
      nota: 'London Stock Exchange non ha risposto (errore 503); investing.com non ha risposto (errore 503)',
      controllo: { perche: 'investing.com non ha risposto (errore 503)' },
    })
  })

  it('non risponde nessuno: manca, con il perché di ognuna', async () => {
    const esito = await prezzoFineMese(LONDRA, '2026-10', { [FONTE.lse]: spenta, [FONTE.investing]: spenta, [FONTE.yahoo]: spenta }, OGGI)
    expect(esito).toMatchObject({
      ok: false,
      perche: 'London Stock Exchange non ha risposto (errore 503); investing.com non ha risposto (errore 503); Yahoo non ha risposto (errore 503)',
    })
  })

  it('Francoforte risponde: Xetra fa da controllo, e lo dice', async () => {
    const esito = await prezzoFineMese(
      FRANCOFORTE,
      '2026-10',
      { [FONTE.francoforte]: chiusura(31.75), [FONTE.investing]: chiusura(31.418), [FONTE.yahoo]: chiusura(31.418) },
      OGGI,
    )
    expect(esito).toMatchObject({
      ok: true,
      prezzo: 31.75,
      fonte: 'Deutsche Börse (Francoforte)',
      controllo: { prezzo: 31.418, seduta: '2026-10-30', nota: 'prezzo di Xetra, altra borsa' },
    })
  })

  it('Francoforte non risponde: il prezzo di Xetra, scritto "Xetra (riserva, altra borsa)"', async () => {
    const esito = await prezzoFineMese(
      FRANCOFORTE,
      '2026-10',
      { [FONTE.francoforte]: spenta, [FONTE.investing]: chiusura(31.418), [FONTE.yahoo]: chiusura(31.418) },
      OGGI,
    )
    expect(esito).toMatchObject({
      ok: true,
      prezzo: 31.418,
      fonte: 'Xetra (riserva, altra borsa)',
      nota: 'Deutsche Börse non ha risposto (errore 503); prezzo di Xetra da investing.com',
      controllo: { perche: 'il prezzo viene già da investing.com' },
    })
    const daYahoo = await prezzoFineMese(
      FRANCOFORTE,
      '2026-10',
      { [FONTE.francoforte]: spenta, [FONTE.investing]: spenta, [FONTE.yahoo]: chiusura(31.418) },
      OGGI,
    )
    expect(daYahoo).toMatchObject({ fonte: 'Xetra (riserva, altra borsa)', nota: expect.stringContaining('prezzo di Xetra da Yahoo') })
  })

  it('il controllo che non riesce non ferma il prezzo: dice perché', async () => {
    const esito = await prezzoFineMese(
      MILANO,
      '2026-10',
      { [FONTE.borsaItaliana]: chiusura(13.1), [FONTE.investing]: spenta },
      OGGI,
    )
    expect(esito).toMatchObject({ ok: true, fonte: 'Borsa Italiana', controllo: { perche: 'investing.com non ha risposto (errore 503)' } })
    const senzaCodice = await prezzoFineMese(
      { ...MILANO, codiceInvesting: undefined },
      '2026-10',
      {
        [FONTE.borsaItaliana]: chiusura(13.1),
        [FONTE.investing]: async (t, mese) => chiusureInvesting(t, mese, { investing: rispondi(''), yahoo: rispondi('') }),
      },
      OGGI,
    )
    expect(senzaCodice).toMatchObject({
      controllo: { perche: 'investing.com non si può chiedere: nel file manca il codice investing.com del titolo' },
    })
  })

  it('una borsa spenta apposta per la prova: il prezzo arriva dalla riserva', async () => {
    const lettori = conFontiSpente(
      { [FONTE.borsaItaliana]: chiusura(13.1), [FONTE.euronextMilano]: chiusura(13.1), [FONTE.investing]: chiusura(13.1) },
      ['borsa italiana', 'Euronext Milano'],
    )
    expect(await prezzoFineMese(MILANO, '2026-10', lettori, OGGI)).toMatchObject({
      fonte: 'investing.com (riserva)',
      nota: 'Borsa Italiana non ha risposto (spenta apposta per la prova); Euronext Milano non ha risposto (spenta apposta per la prova)',
    })
    const tedesche = conFontiSpente({ [FONTE.xetra]: chiusura(1), [FONTE.francoforte]: chiusura(1) }, ['Deutsche Börse'])
    await expect(tedesche[FONTE.xetra]!(MILANO, '2026-10')).rejects.toThrow('spenta apposta')
    await expect(tedesche[FONTE.francoforte]!(MILANO, '2026-10')).rejects.toThrow('spenta apposta')
  })

  it('investing.com senza la chiusura dell’ultimo giorno: il controllo lo dice', async () => {
    const esito = await prezzoFineMese(
      MILANO,
      '2026-10',
      { [FONTE.borsaItaliana]: chiusura(13.1), [FONTE.investing]: chiusura(13.0, '2026-10-29') },
      OGGI,
    )
    expect(esito).toMatchObject({
      controllo: { prezzo: 13, seduta: '2026-10-29', nota: 'chiusura del 29/10/2026: del 30/10/2026 la fonte non ha il prezzo' },
    })
  })
})
