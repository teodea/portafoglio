// Le prove delle fonti dei riferimenti e del NIC senza internet: risposte d'esempio con valori inventati.
import { describe, expect, it } from 'vitest'
import { attesaIstat, leggiIstat, nicIstat } from './istat.ts'
import { chiusuraPer, leggiStoricoInvesting, valoriRiferimento } from './riferimenti.ts'

const riga = (data: string, chiusura: string) => ({
  rowDateTimestamp: `${data}T00:00:00Z`,
  last_close: chiusura,
  last_closeRaw: String(Number(chiusura.replace(/\./g, '').replace(',', '.')) + 0.00015625),
})

describe('investing.com per i riferimenti', () => {
  it('vale il numero come lo mostra il sito, in ordine di data', () => {
    const testo = JSON.stringify({ data: [riga('2026-09-30', '11.160,41'), riga('2026-09-29', '11.200,00')] })
    expect(leggiStoricoInvesting(testo)).toEqual([
      { data: '2026-09-29', prezzo: 11200 },
      { data: '2026-09-30', prezzo: 11160.41 },
    ])
    expect(leggiStoricoInvesting(JSON.stringify({ data: null }))).toEqual([])
    expect(leggiStoricoInvesting(JSON.stringify({ data: [riga('2026-09-30', '134.154,9375')] }))).toEqual([{ data: '2026-09-30', prezzo: 134154.94 }])
  })

  it('la chiusura di una fine mese e quella di un giorno di borsa chiusa', () => {
    const chiusure = [
      { data: '2024-02-15', prezzo: 1 },
      { data: '2024-02-16', prezzo: 2 },
      { data: '2024-02-29', prezzo: 3 },
      { data: '2024-03-28', prezzo: 4 },
    ]
    expect(chiusuraPer(chiusure, '2024-02-29')?.prezzo).toBe(3)
    // 31/03/2024 è domenica, venerdì 29 la borsa americana era chiusa: vale il 28.
    expect(chiusuraPer(chiusure, '2024-03-31')?.prezzo).toBe(4)
    // Lunedì 19/02/2024 borsa americana chiusa: vale venerdì 16.
    expect(chiusuraPer(chiusure, '2024-02-19')?.data).toBe('2024-02-16')
    // Una fine mese senza chiusure nel mese non prende quelle del mese prima.
    expect(chiusuraPer(chiusure, '2024-01-31')).toBeNull()
    // Un giorno senza chiusure da più di una settimana: niente.
    expect(chiusuraPer(chiusure, '2024-02-14')).toBeNull()
  })

  it('un riferimento in dollari: valori, cambio BCE dello stesso giorno, note', async () => {
    const chiesti: string[] = []
    const investing = async (url: string | URL | Request) => {
      chiesti.push(String(url))
      return new Response(JSON.stringify({ data: [riga('2024-02-16', '100,00'), riga('2024-02-29', '110,00'), riga('2026-09-30', '200,00')] }))
    }
    const bce = async (url: string | URL | Request) => {
      chiesti.push(String(url))
      return new Response(
        'KEY,FREQ,CURRENCY,TIME_PERIOD,OBS_VALUE\nEXR.D.USD.EUR.SP00.A,D,USD,2024-02-16,1.0775\nEXR.D.USD.EUR.SP00.A,D,USD,2024-02-29,1.0813\nEXR.D.USD.EUR.SP00.A,D,USD,2026-09-29,1.17\n',
      )
    }
    const e = await valoriRiferimento('sp500', ['2024-02-19', '2024-02-29', '2026-09-30', '2026-10-31'], { investing, bce }, '2026-10-19', 0)
    expect(e).toEqual({
      ok: true,
      valori: [
        { data: '2024-02-19', valore: 100, seduta: '2024-02-16', cambio: 1.0775, nota: 'il 19/02/2024 la borsa era chiusa: vale la chiusura del 16/02/2024' },
        { data: '2024-02-29', valore: 110, seduta: '2024-02-29', cambio: 1.0813 },
        { data: '2026-09-30', valore: 200, seduta: '2026-09-30', cambio: 1.17, nota: 'cambio BCE del 29/09/2026' },
      ],
      mancano: [],
    })
    // Una sola richiesta a investing.com (con la linea dell'S&P 500 con dividendi) e una alla BCE; ottobre non è finito e non si chiede.
    expect(chiesti).toHaveLength(2)
    expect(chiesti[0]).toContain('/historical/166?start-date=2024-02-09&end-date=2026-09-30')
    expect(chiesti[1]).toContain('D.USD.EUR.SP00.A?startPeriod=2024-02-09&endPeriod=2026-09-30')
  })

  it('un riferimento in euro non chiede il cambio; se investing.com non risponde lo dice', async () => {
    let bce = false
    const investing = async () => new Response(JSON.stringify({ data: [riga('2026-09-30', '146,10')] }))
    const e = await valoriRiferimento('ftsemib', ['2026-09-30', '2026-08-31'], { investing, bce: async () => ((bce = true), new Response('')) }, '2026-10-19', 0)
    expect(e).toEqual({ ok: true, valori: [{ data: '2026-09-30', valore: 146.1, seduta: '2026-09-30' }], mancano: ['2026-08-31'] })
    expect(bce).toBe(false)
    const giu = await valoriRiferimento('ftsemib', ['2026-09-30'], { investing: async () => new Response('', { status: 403 }), bce: fetch }, '2026-10-19', 0)
    expect(giu).toEqual({ ok: false, perche: 'investing.com non ha risposto (errore 403)' })
  })
})

const CSV = `DATAFLOW,FREQ,REF_AREA,DATA_TYPE,MEASURE,ECOICOP_2,TIME_PERIOD,OBS_VALUE,OBS_STATUS,NOTE_DS
IT1:167_745_DF_DCSP_NIC1B2025_6(1.0),M,IT,39,4,00,2025-11,122.4,,
IT1:167_745_DF_DCSP_NIC1B2025_6(1.0),M,IT,39,4,00,2025-12,122.6,,
IT1:167_745_DF_DCSP_NIC1B2025_6(1.0),M,IT,39,6,00,2025-12,0.2,,
IT1:167_745_DF_DCSP_NIC1B2025_6(1.0),M,IT,85,4,00,2026-01,100.4,,
IT1:167_745_DF_DCSP_NIC1B2025_6(1.0),M,IT,85,4,00,2026-02,101.1,P,
`

describe('ISTAT', () => {
  it('legge l’indice generale nelle due basi', () => {
    expect(leggiIstat(CSV)).toEqual([
      { data: '2025-11-30', valore: 122.4, base: 2015 },
      { data: '2025-12-31', valore: 122.6, base: 2015 },
      { data: '2026-01-31', valore: 100.4, base: 2025 },
      { data: '2026-02-28', valore: 101.1, base: 2025, nota: 'dato provvisorio di ISTAT' },
    ])
  })

  it('il limite: al massimo 4 richieste al minuto, a 13 secondi l’una dall’altra', () => {
    expect(attesaIstat([], 100_000)).toBe(0)
    expect(attesaIstat([95_000], 100_000)).toBe(8_000)
    // Quattro richieste nell'ultimo minuto: la quinta aspetta che la più vecchia esca dalla finestra.
    expect(attesaIstat([50_000, 63_000, 76_000, 89_000], 102_000)).toBe(8_000)
    expect(attesaIstat([10_000], 100_000)).toBe(0)
  })

  it('una sola richiesta per tutti i mesi; mesi non finiti esclusi; 404 vuol dire "non ancora"', async () => {
    const chiesti: string[] = []
    let lingua = ''
    const scarica = async (url: string | URL | Request, init?: RequestInit) => {
      chiesti.push(String(url))
      lingua = (init?.headers as Record<string, string>)['Accept-Language']
      return new Response(CSV)
    }
    const limite = { richieste: 4, finestra: 60_000, distanza: 0 }
    const e = await nicIstat(['2025-12', '2026-01', '2026-02', '2026-10'], scarica, '2026-10-19', limite)
    expect(chiesti).toEqual(['https://esploradati.istat.it/SDMXWS/rest/data/167_745_DF_DCSP_NIC1B2025_6/M.IT..4.00?startPeriod=2025-12&endPeriod=2026-02'])
    expect(e.ok && e.valori.map((v) => v.data)).toEqual(['2025-12-31', '2026-01-31', '2026-02-28'])
    // Senza una lingua vera (Node manda "*") ISTAT risponde con l'errore 500.
    expect(lingua).toBe('it')
    expect(await nicIstat(['2026-09'], async () => new Response('NoRecordsFound', { status: 404 }), '2026-10-19', limite)).toEqual({ ok: true, valori: [] })
    const troppe = await nicIstat(['2026-09'], async () => new Response('', { status: 429 }), '2026-10-19', limite)
    expect(troppe.ok).toBe(false)
    if (!troppe.ok) expect(troppe.perche).toContain('troppe richieste')
  })
})
