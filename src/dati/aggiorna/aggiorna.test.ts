// Le prove di Aggiorna fine mese sui moduli puri, con il portafoglio inventato.
import { describe, expect, it } from 'vitest'
import { controllaFile } from '../controllo.ts'
import { comeTesto, portafoglioInventato } from '../portafoglio-inventato.ts'
import { fineMese, meseDopo, meseFinito, ultimaSeduta } from './calendario.ts'
import { FONTE, fonteDaVersione2 } from './fonti.ts'
import {
  confrontoConPrima,
  conCambio,
  conTitolo,
  creaAggiornamento,
  daSalvare,
  mancano,
  primaEDopo,
  puoSalvare,
  statoDaCambio,
  statoDaEsito,
  valoreAFineMese,
  valoreMesePrima,
  type Aggiornamento,
} from './lista.ts'
import { mesiDaAggiornare, quoteAFineMese, titoliDelMese, ultimoMeseSalvato } from './mesi.ts'
import { aVersione3, controllaMese, scriviMese, type MeseDaSalvare } from './versione3.ts'

const MONDO = 'ZZ0000000001-MIL'
const TECN = 'ZZ0000000002-LON'
const OBBL = 'ZZ0000000003-MIL'

describe('il calendario delle borse', () => {
  it('fine mese, mese dopo, mese finito', () => {
    expect(fineMese('2024-02')).toBe('2024-02-29')
    expect(fineMese('2026-12')).toBe('2026-12-31')
    expect(meseDopo('2026-12')).toBe('2027-01')
    expect(meseDopo('2026-01', -1)).toBe('2025-12')
    expect(meseFinito('2026-10', '2026-10-31')).toBe(false)
    expect(meseFinito('2026-10', '2026-11-01')).toBe(true)
  })

  it('l’ultimo giorno di borsa del mese', () => {
    expect(ultimaSeduta('MIL', '2026-10')).toBe('2026-10-30') // il 31 è sabato
    expect(ultimaSeduta('MIL', '2026-05')).toBe('2026-05-29') // il 31 è domenica
    expect(ultimaSeduta('MIL', '2025-12')).toBe('2025-12-30') // il 31 Borsa Italiana è chiusa
    expect(ultimaSeduta('PAR', '2025-12')).toBe('2025-12-31') // Euronext Parigi è aperta
    expect(ultimaSeduta('XET', '2024-03')).toBe('2024-03-28') // il 29 è Venerdì santo
    expect(ultimaSeduta('LON', '2026-08')).toBe('2026-08-28') // il 31 è festa a Londra (summer bank holiday)
    expect(ultimaSeduta('MIL', '2026-08')).toBe('2026-08-31')
  })
})

describe('quali mesi e quali titoli', () => {
  const dati = portafoglioInventato()

  it('l’ultimo mese salvato e i mesi da fare, dal più vecchio', () => {
    expect(ultimoMeseSalvato(dati)).toBe('2026-09')
    expect(mesiDaAggiornare(dati, '2026-10-19')).toEqual([])
    expect(mesiDaAggiornare(dati, '2026-11-03')).toEqual(['2026-10'])
    expect(mesiDaAggiornare(dati, '2026-12-02')).toEqual(['2026-10', '2026-11'])
  })

  it('servono i titoli che ci sono ancora a fine mese', () => {
    expect(quoteAFineMese(dati, OBBL, '2025-08')).toBe(1000)
    expect(quoteAFineMese(dati, OBBL, '2025-09')).toBe(0) // venduta a settembre 2025
    expect(titoliDelMese(dati, '2026-10').map((t) => t.id)).toEqual([MONDO, TECN])
  })
})

describe('il passaggio alla versione 3', () => {
  const v2 = portafoglioInventato()
  const v3 = aVersione3(v2)

  it('versione, valuta dei titoli, cambi e fonti con un nome fisso; i numeri non cambiano', () => {
    expect(v3.versione).toBe(3)
    expect(v3.titoli?.map((t) => t.valuta)).toEqual(['EUR', 'GBP', 'EUR'])
    expect(v3.cambi).toEqual([
      { valuta: 'GBP', data: '2026-08-31', cambio: 0.8652, fonte: 'dal tuo file Excel' },
      { valuta: 'GBP', data: '2026-09-30', cambio: 0.8546, fonte: 'dal tuo file Excel' },
    ])
    expect(v3.prezzi?.[0]).toMatchObject({ prezzo: 12.4, fonte: 'dal tuo file Excel', nota: 'inventato' })
    expect(v3.prezzi?.map((p) => p.prezzo)).toEqual(v2.prezzi?.map((p) => p.prezzo))
    expect(controllaFile(comeTesto(v3)).ok).toBe(true)
  })

  it('non cambia il file di partenza, e una seconda volta non fa niente', () => {
    expect(v2.versione).toBe(2)
    expect(v2.prezzi?.[0].fonte).toBe('inventato')
    expect(aVersione3(v3)).toBe(v3)
  })

  it('le fonti del file Excel diventano nomi fissi', () => {
    expect(fonteDaVersione2('file (foglio qualcosa)')).toBe(FONTE.fileExcel)
    expect(fonteDaVersione2("prezzo d'acquisto (giorno dell'acquisto)")).toBe(FONTE.acquisto)
    expect(fonteDaVersione2('stima: rimborso alla pari')).toBe(FONTE.stima)
  })

  it('dalla versione 3 il controllo all’apertura vuole una fonte con un nome fisso', () => {
    const testo = comeTesto(v3).replace('"fonte": "dal tuo file Excel"', '"fonte": "dal mio quaderno"')
    const esito = controllaFile(testo)
    expect(esito.ok).toBe(false)
    if (!esito.ok) expect(esito.problema.spiegazione).toContain('"fonte" dovrebbe essere uno di questi')
  })
})

const OTTOBRE: MeseDaSalvare = {
  mese: '2026-10',
  prezzi: [
    { titolo: MONDO, prezzo: 13.1, seduta: '2026-10-30', fonte: FONTE.borsaItaliana },
    { titolo: TECN, prezzo: 54.2, seduta: '2026-10-30', fonte: FONTE.lse },
  ],
  cambi: [{ valuta: 'GBP', cambio: 0.8691, seduta: '2026-10-30', fonte: 'BCE' }],
}

describe('scrivere un mese', () => {
  const v3 = aVersione3(portafoglioInventato())

  it('aggiunge i prezzi e il cambio di ottobre, con la seduta e il cambio sul prezzo in sterline', () => {
    const dopo = scriviMese(v3, OTTOBRE, '2026-11-03T17:02:00.000Z')
    const ottobre = dopo.prezzi?.filter((p) => p.data === '2026-10-31')
    expect(ottobre).toEqual([
      { titolo: MONDO, data: '2026-10-31', prezzo: 13.1, valuta: 'EUR', fonte: 'Borsa Italiana', seduta: '2026-10-30' },
      {
        titolo: TECN,
        data: '2026-10-31',
        prezzo: 54.2,
        valuta: 'GBP',
        cambio: 0.8691,
        fonte: 'London Stock Exchange',
        seduta: '2026-10-30',
      },
    ])
    expect(dopo.cambi?.at(-1)).toEqual({ valuta: 'GBP', data: '2026-10-31', cambio: 0.8691, fonte: 'BCE', seduta: '2026-10-30' })
    expect(dopo.prezzi).toHaveLength(6)
    expect(controllaFile(comeTesto(dopo)).ok).toBe(true)
    expect(v3.prezzi).toHaveLength(4) // il file di partenza non cambia
  })

  it('"Rifai": i prezzi del mese si sostituiscono; quello a mano tiene il prezzo di prima', () => {
    const una = scriviMese(v3, OTTOBRE, '2026-11-03T17:02:00.000Z')
    const rifatto = scriviMese(
      una,
      { ...OTTOBRE, prezzi: [OTTOBRE.prezzi[0], { titolo: TECN, prezzo: 54.5, fonte: FONTE.aMano }] },
      '2026-11-04T08:00:00.000Z',
    )
    const tecn = rifatto.prezzi?.find((p) => p.titolo === TECN && p.data === '2026-10-31')
    expect(tecn).toMatchObject({
      prezzo: 54.5,
      fonte: 'a mano',
      quando: '2026-11-04T08:00:00.000Z',
      prima: { prezzo: 54.2, fonte: 'London Stock Exchange' },
    })
    expect(rifatto.prezzi?.filter((p) => p.data === '2026-10-31')).toHaveLength(2)
    expect(controllaFile(comeTesto(rifatto)).ok).toBe(true)
  })

  it('un mese senza il cambio di un titolo in sterline non si scrive', () => {
    expect(controllaMese(v3, { ...OTTOBRE, cambi: [] })).toEqual({ ok: false, perche: 'manca il cambio GBP' })
    expect(controllaMese(v3, { ...OTTOBRE, prezzi: [{ ...OTTOBRE.prezzi[0], prezzo: 0 }] }).ok).toBe(false)
    expect(controllaMese(v3, OTTOBRE)).toEqual({ ok: true })
  })
})

describe('la lista della schermata', () => {
  const dati = portafoglioInventato()

  function arrivaTutto(a: Aggiornamento): Aggiornamento {
    let b = conTitolo(a, MONDO, (r) => ({
      ...r,
      stato: statoDaEsito({ ok: true, prezzo: 13.1, seduta: '2026-10-30', fonte: FONTE.borsaItaliana, tentativi: [] }),
    }))
    b = conTitolo(b, TECN, (r) => ({
      ...r,
      stato: statoDaEsito({
        ok: false,
        perche: 'London Stock Exchange non ha risposto',
        tentativi: [{ fonte: FONTE.lse, perche: 'non ha risposto' }],
      }),
    }))
    return conCambio(b, 'GBP', (r) => ({ ...r, stato: statoDaCambio({ ok: true, cambio: 0.8691, seduta: '2026-10-30', fonte: 'BCE' }) }))
  }

  it('una riga per titolo e una per il cambio della sterlina', () => {
    const a = creaAggiornamento(dati, '2026-10')
    expect(a.rifai).toBe(false)
    expect(a.titoli.map((t) => [t.id, t.quote, t.valuta])).toEqual([
      [MONDO, 100, 'EUR'],
      [TECN, 20, 'GBP'],
    ])
    expect(a.cambi.map((c) => [c.valuta, c.perTitoli, c.precedente])).toEqual([['GBP', ['TECN'], 0.8546]])
    expect(puoSalvare(a)).toBe(false)
  })

  it('"Salva" resta spento finché manca un prezzo; si accende con il prezzo scritto a mano', () => {
    const a = arrivaTutto(creaAggiornamento(dati, '2026-10'))
    expect(mancano(a).titoli.map((t) => t.id)).toEqual([TECN])
    expect(puoSalvare(a)).toBe(false)
    expect(valoreAFineMese(a)).toBeNull()
    const b = conTitolo(a, TECN, (r) => ({ ...r, aMano: 54.2 }))
    expect(puoSalvare(b)).toBe(true)
    // 100 × 13,10 + 20 × 54,20 ÷ 0,8691
    expect(valoreAFineMese(b)).toBeCloseTo(1310 + 1084 / 0.8691, 6)
    expect(valoreMesePrima(b)).toBeCloseTo(1275 + 1057 / 0.8546, 6)
    expect(daSalvare(b)).toEqual({
      mese: '2026-10',
      prezzi: [
        { titolo: MONDO, prezzo: 13.1, seduta: '2026-10-30', fonte: 'Borsa Italiana' },
        { titolo: TECN, prezzo: 54.2, fonte: 'a mano' },
      ],
      cambi: [{ valuta: 'GBP', cambio: 0.8691, seduta: '2026-10-30', fonte: 'BCE' }],
    })
  })

  it('"Rifai settembre": prima e dopo, con gli arrotondamenti del file Excel', () => {
    const a = creaAggiornamento(dati, '2026-09')
    expect(a.rifai).toBe(true)
    expect(a.titoli.find((t) => t.id === MONDO)?.prima).toEqual({ prezzo: 12.75, fonte: 'inventato', nota: undefined })
    let b = conTitolo(a, MONDO, (r) => ({
      ...r,
      stato: statoDaEsito({ ok: true, prezzo: 12.748, seduta: '2026-09-30', fonte: FONTE.borsaItaliana, tentativi: [] }),
    }))
    b = conTitolo(b, TECN, (r) => ({
      ...r,
      stato: statoDaEsito({ ok: true, prezzo: 52.9, seduta: '2026-09-30', fonte: FONTE.lse, tentativi: [] }),
    }))
    const pd = primaEDopo(b)
    expect(pd.uguali).toBe(1)
    expect(pd.diversi.map((r) => r.id)).toEqual([TECN])
    // "Tieni quello di prima": il prezzo resta quello del file, e non si manda da salvare.
    const tenuto = conCambio(
      conTitolo(b, TECN, (r) => ({ ...r, tieni: true })),
      'GBP',
      (r) => ({ ...r, stato: statoDaCambio({ ok: true, cambio: 0.8546, seduta: '2026-09-30', fonte: 'BCE' }) }),
    )
    expect(primaEDopo(tenuto).diversi).toEqual([])
    expect(daSalvare(tenuto).prezzi.map((p) => p.titolo)).toEqual([MONDO])
    expect(confrontoConPrima(12.75, 12.748).uguale).toBe(true)
    expect(confrontoConPrima(13.25, 13.255).uguale).toBe(true)
    expect(confrontoConPrima(13.36, 13.69).uguale).toBe(false)
    expect(confrontoConPrima(54.135, 54.135).uguale).toBe(true)
    expect(confrontoConPrima(12.4, 12.52).differenza).toBeCloseTo(0.9677, 3)
  })
})
