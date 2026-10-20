// Le prove della correzione a mano di un riferimento o del NIC e dei valori scaricati di nuovo (ticket 10),
// su un file inventato con valori di fantasia.
import { describe, expect, it } from 'vitest'
import { controllaFile } from './controllo.ts'
import {
  applicaScrittura,
  baseDelNic,
  controllaScrittura,
  eScritturaRiferimento,
  percheDellaCopiaRiferimento,
  qualeValore,
  trovaValore,
  type ScritturaRiferimento,
} from './correzione-riferimento.ts'
import { comeTesto } from './portafoglio-inventato.ts'
import type { FileDati, ValoreRiferimento } from './tipi.ts'

const SET = '2026-09-30'
const QUANDO = '2026-10-19T18:00:00.000Z'

function file(): FileDati {
  return {
    formato: 'portafoglio',
    versione: 4,
    creato: '2026-01-01T00:00:00.000Z',
    titoli: [],
    operazioni: [],
    dividendi: [],
    prezzi: [],
    riferimenti: [
      { riferimento: 'ftsemib', data: '2026-08-31', valore: 150, valuta: 'EUR', fonte: 'investing.com', seduta: '2026-08-31' },
      { riferimento: 'ftsemib', data: SET, valore: 146.1, valuta: 'EUR', fonte: 'investing.com', seduta: SET },
      { riferimento: 'sp500', data: SET, valore: 11000, valuta: 'USD', cambio: 1.1, fonte: 'investing.com', seduta: SET, nota: 'cambio BCE del 29/09/2026' },
    ],
    nic: [
      { data: '2025-12-31', valore: 122.6, base: 2015, fonte: 'ISTAT' },
      { data: '2026-08-31', valore: 103.9, base: 2025, fonte: 'ISTAT' },
    ],
  }
}

const correggi = (id: ScritturaRiferimento['id'], valore: number, cambio?: number): ScritturaRiferimento => ({ tipo: 'correggi', id, data: SET, valore, ...(cambio ? { cambio } : {}) })

describe('correggere a mano il valore di un riferimento', () => {
  it('scrive "a mano" e tiene il valore di prima con la sua fonte, la seduta, il cambio e la nota', () => {
    const d = applicaScrittura(file(), correggi('sp500', 11200), QUANDO)
    expect(trovaValore(d, { id: 'sp500', data: SET })).toEqual({
      riferimento: 'sp500',
      data: SET,
      valore: 11200,
      valuta: 'USD',
      cambio: 1.1,
      fonte: 'a mano',
      quando: QUANDO,
      prima: { valore: 11000, fonte: 'investing.com', cambio: 1.1, seduta: SET, nota: 'cambio BCE del 29/09/2026' },
    })
    // Il file scritto si riapre senza errori.
    expect(controllaFile(comeTesto(d)).ok).toBe(true)
  })

  it('"Torna al valore di prima" rimette il file com’era', () => {
    const prima = file()
    const corretto = applicaScrittura(prima, correggi('sp500', 11200, 1.12), QUANDO)
    expect((trovaValore(corretto, { id: 'sp500', data: SET }) as ValoreRiferimento).cambio).toBe(1.12)
    const tornato = applicaScrittura(corretto, { tipo: 'torna', id: 'sp500', data: SET }, QUANDO)
    expect(tornato).toEqual(prima)
  })

  it('corretto due volte, "prima" resta il valore di partenza', () => {
    const una = applicaScrittura(file(), correggi('ftsemib', 140), QUANDO)
    const due = applicaScrittura(una, correggi('ftsemib', 141), QUANDO)
    expect(trovaValore(due, { id: 'ftsemib', data: SET })).toMatchObject({ valore: 141, fonte: 'a mano', prima: { valore: 146.1, fonte: 'investing.com' } })
  })

  it('un valore che mancava si scrive a mano; in dollari serve anche il cambio', () => {
    const senza = { ...file(), riferimenti: file().riferimenti!.filter((v) => v.riferimento !== 'sp500') }
    expect(controllaScrittura(senza, correggi('sp500', 11000))).toEqual({ ok: false, perche: 'per S&P 500 a fine settembre 2026 serve anche il cambio BCE del dollaro' })
    const d = applicaScrittura(senza, correggi('sp500', 11000, 1.1), QUANDO)
    expect(trovaValore(d, { id: 'sp500', data: SET })).toEqual({ riferimento: 'sp500', data: SET, valore: 11000, valuta: 'USD', cambio: 1.1, fonte: 'a mano', quando: QUANDO })
    // Senza un valore di prima non si torna indietro.
    expect(controllaScrittura(d, { tipo: 'torna', id: 'sp500', data: SET }).ok).toBe(false)
  })

  it('rifiuta un numero che non va o uguale a quello che c’è', () => {
    expect(controllaScrittura(file(), correggi('ftsemib', 0)).ok).toBe(false)
    expect(controllaScrittura(file(), correggi('ftsemib', 146.1))).toEqual({ ok: false, perche: 'il valore nuovo è uguale a quello presente' })
    expect(() => applicaScrittura(file(), correggi('ftsemib', -3), QUANDO)).toThrow()
  })
})

describe('correggere a mano il NIC', () => {
  it('il NIC che manca si scrive con la base del suo anno, e il ritorno lo rimette', () => {
    expect(baseDelNic('2025-12-31')).toBe(2015)
    expect(baseDelNic(SET)).toBe(2025)
    const d = applicaScrittura(file(), correggi('nic', 104.6), QUANDO)
    expect(trovaValore(d, { id: 'nic', data: SET })).toEqual({ data: SET, valore: 104.6, base: 2025, fonte: 'a mano', quando: QUANDO })
    expect(d.nic!.map((x) => x.data)).toEqual(['2025-12-31', '2026-08-31', SET])

    const agosto = applicaScrittura(file(), { tipo: 'correggi', id: 'nic', data: '2026-08-31', valore: 104 }, QUANDO)
    expect(trovaValore(agosto, { id: 'nic', data: '2026-08-31' })).toMatchObject({ valore: 104, base: 2025, fonte: 'a mano', prima: { valore: 103.9, fonte: 'ISTAT' } })
    expect(applicaScrittura(agosto, { tipo: 'torna', id: 'nic', data: '2026-08-31' }, QUANDO)).toEqual(file())
  })
})

describe('i valori scaricati di nuovo', () => {
  it('sostituiscono quelli con lo stesso giorno (anche a mano) e aggiungono quelli che mancavano, in ordine', () => {
    const aMano = applicaScrittura(file(), correggi('ftsemib', 140), QUANDO)
    const s: ScritturaRiferimento = {
      tipo: 'scaricati',
      id: 'ftsemib',
      riferimenti: [
        { riferimento: 'ftsemib', data: SET, valore: 146.2, valuta: 'EUR', fonte: 'investing.com', seduta: SET },
        { riferimento: 'ftsemib', data: '2026-07-31', valore: 151, valuta: 'EUR', fonte: 'investing.com', seduta: '2026-07-31' },
      ],
      nic: [],
    }
    const d = applicaScrittura(aMano, s, QUANDO)
    expect(d.riferimenti!.filter((v) => v.riferimento === 'ftsemib').map((v) => [v.data, v.valore, v.fonte])).toEqual([
      ['2026-07-31', 151, 'investing.com'],
      ['2026-08-31', 150, 'investing.com'],
      [SET, 146.2, 'investing.com'],
    ])
    expect(d.riferimenti!.at(-1)!.riferimento).toBe('sp500')
  })

  it('rifiuta valori di un altro riferimento, senza fonte o senza il cambio del dollaro', () => {
    const v = { riferimento: 'ftsemib' as const, data: SET, valore: 1, valuta: 'EUR', fonte: 'investing.com' }
    expect(controllaScrittura(file(), { tipo: 'scaricati', id: 'sp500', riferimenti: [v], nic: [] }).ok).toBe(false)
    expect(controllaScrittura(file(), { tipo: 'scaricati', id: 'ftsemib', riferimenti: [{ ...v, fonte: 'a mano' }], nic: [] }).ok).toBe(false)
    expect(controllaScrittura(file(), { tipo: 'scaricati', id: 'sp500', riferimenti: [{ ...v, riferimento: 'sp500', valuta: 'USD' }], nic: [] }).ok).toBe(false)
    expect(controllaScrittura(file(), { tipo: 'scaricati', id: 'nic', riferimenti: [], nic: [] }).ok).toBe(false)
  })
})

describe('le richieste dalle pagine e il nome della copia', () => {
  it('il processo principale accetta solo richieste con la forma giusta', () => {
    expect(eScritturaRiferimento({ tipo: 'correggi', id: 'sp500', data: SET, valore: 1 })).toBe(true)
    expect(eScritturaRiferimento({ tipo: 'torna', id: 'nic', data: SET })).toBe(true)
    expect(eScritturaRiferimento({ tipo: 'scaricati', id: 'nic', riferimenti: [], nic: [] })).toBe(true)
    expect(eScritturaRiferimento({ tipo: 'correggi', id: 'msci', data: SET, valore: 1 })).toBe(false)
    expect(eScritturaRiferimento({ tipo: 'correggi', id: 'sp500', data: '30/09/2026', valore: 1 })).toBe(false)
    expect(eScritturaRiferimento({ tipo: 'correggi', id: 'sp500', data: SET, valore: '1' })).toBe(false)
    expect(eScritturaRiferimento(null)).toBe(false)
  })

  it('dice in parole quale valore e perché la copia', () => {
    expect(qualeValore({ id: 'sp500', data: SET })).toBe('S&P 500 a fine settembre 2026')
    expect(qualeValore({ id: 'nic', data: SET })).toBe('il NIC di settembre 2026')
    expect(percheDellaCopiaRiferimento(correggi('sp500', 1))).toBe('prima di correggere a mano S&P 500 a fine settembre 2026')
    expect(percheDellaCopiaRiferimento({ tipo: 'torna', id: 'nic', data: SET })).toBe('prima di tornare al NIC di prima di settembre 2026')
    expect(percheDellaCopiaRiferimento({ tipo: 'scaricati', id: 'ftsemib', riferimenti: [], nic: [] })).toBe('prima di scrivere FTSE MIB scaricato di nuovo')
  })
})
