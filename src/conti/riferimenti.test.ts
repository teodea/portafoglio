// Le prove dell'"Andamento dei mercati", su un portafoglio e indici INVENTATI:
// codici ZZ…, nomi di fantasia e valori tondi, così i conti si fanno a mente.
import { describe, expect, it } from 'vitest'
import { RACCORDO_2015_2025 } from '../dati/aggiorna/riferimenti.ts'
import type { FileDati, NicDelMese, Operazione, PrezzoFineMese, Titolo, ValoreRiferimento } from '../dati/tipi.ts'
import { contiDelPortafoglio } from './portafoglio.ts'
import { andamenti, type Andamenti, type PeriodoAndamenti } from './riferimenti.ts'
import { senzaSoldiNuovi } from './titoli.ts'

const T = 'ZZ0000000001-MIL'
const titolo: Titolo = {
  id: T,
  isin: 'ZZ0000000001',
  borsa: 'MIL',
  nomeBorsa: 'Borsa Italiana',
  nome: 'Fondo inventato',
  soprannome: null,
  simbolo: 'INV',
  descrizioneBanca: 'INVENTATO',
  dossier: 'Dossier di prova',
}

let n = 0
function op(tipo: 'acquisto' | 'vendita', data: string, totale: number): Operazione {
  return { id: `op-${++n}`, titolo: T, tipo, data, esecuzione: data, quantita: totale / 10, prezzo: 10, valuta: 'EUR', cambio: 1, commissioni: 0, totale, rifOrdine: null, fonte: 'inventato' }
}
const fine = (anno: number, mese: number) => new Date(Date.UTC(anno, mese, 0)).toISOString().slice(0, 10)
/** I fine mese da marzo 2025 a settembre 2026: 19 mesi. */
const MESI = Array.from({ length: 19 }, (_, k) => fine(2025, 3 + k))
const prezzo = (data: string, p: number): PrezzoFineMese => ({ titolo: T, data, prezzo: p, valuta: 'EUR', fonte: 'Borsa Italiana' })
const rif = (riferimento: ValoreRiferimento['riferimento'], data: string, valore: number, cambio?: number): ValoreRiferimento => ({
  riferimento,
  data,
  valore,
  valuta: cambio ? 'USD' : 'EUR',
  ...(cambio ? { cambio } : {}),
  fonte: 'investing.com',
  seduta: data,
})
const nic = (data: string, valore: number, base: 2015 | 2025): NicDelMese => ({ data, valore, base, fonte: 'ISTAT' })

// 1.000 € il 14/03/2025, altri 500 € il 16/06/2025, 300 € tolti il 15/01/2026; il prezzo sale di 0,10 € al mese.
const OPS = [op('acquisto', '2025-03-14', 1000), op('acquisto', '2025-06-16', 500), op('vendita', '2026-01-15', 300)]
const PREZZI = MESI.map((m, k) => prezzo(m, 10 + k / 10))
// L'S&P 500 inventato: 5.000 punti a fine marzo 2025, poi 100 punti in più ogni mese, in dollari.
const SP = MESI.map((m, k) => rif('sp500', m, 5000 + 100 * k, 1.1))
// Il FTSE MIB inventato: c'è da giugno 2025 (40.000, poi +400 al mese), ma manca settembre 2026.
const MIB = MESI.slice(3, -1).map((m, k) => rif('ftsemib', m, 40000 + 400 * k))
// Il NIC: 122,633 in base 2015 fino a dicembre 2025 (100 in base 2025), poi 102 fino ad agosto; settembre non è uscito.
const NIC = MESI.slice(0, -1).map((m) => (m < '2026-01-01' ? nic(m, RACCORDO_2015_2025 * 100, 2015) : nic(m, 102, 2025)))

function file(parti: Partial<FileDati>): FileDati {
  return { formato: 'portafoglio', versione: 4, creato: '2026-01-01T00:00:00.000Z', titoli: [titolo], operazioni: OPS, dividendi: [], prezzi: PREZZI, ...parti }
}
function calcola(d: FileDati, periodo: PeriodoAndamenti = 'tutto'): Andamenti {
  const a = andamenti(d, contiDelPortafoglio(d), periodo)
  if (!a) throw new Error('niente andamenti')
  return a
}
const linea = (a: Andamenti, id: string) => a.serie.linee.find((l) => l.id === id)!
const riga = (a: Andamenti, id: string) => a.righe.find((r) => r.id === id)!

describe('dall’inizio', () => {
  const d = file({ riferimenti: [...MIB, ...SP], nic: NIC, dividendi: [{ id: 'd1', titolo: T, data: '2025-11-20', lordo: 40, imposte: 10, netto: 30, fonte: 'inventato' }] })
  const a = calcola(d)

  it('i fine mese del controvalore; il portafoglio, i cinque indici e l’inflazione, sempre nello stesso ordine', () => {
    expect(a.serie.mesi).toEqual(MESI)
    expect(a.da).toBe('2025-03-31')
    expect(a.fine).toBe('2026-09-30')
    expect(a.serie.linee.map((l) => l.nome)).toEqual(['Portafoglio', 'FTSE MIB', 'Euro Stoxx 50', 'Nasdaq-100', 'Dow Jones', 'S&P 500', 'Inflazione'])
    expect(a.righe.map((r) => r.id)).toEqual(['portafoglio', 'ftsemib', 'eurostoxx50', 'nasdaq100', 'dowjones', 'sp500', 'nic'])
  })

  it('un indice: valore in punti ÷ primo valore − 1, in dollari senza cambio', () => {
    const sp = linea(a, 'sp500').punti
    expect(sp[0]).toBe(0)
    expect(sp[6]).toBeCloseTo(5600 / 5000 - 1, 12)
    expect(sp[18]).toBeCloseTo(6800 / 5000 - 1, 12)
    const r = riga(a, 'sp500')
    expect(r).toMatchObject({ valore: 6800, unita: 'punti', valuta: 'USD', manca: null, aMano: false })
    expect(r.variazione).toBeCloseTo(0.36, 12)
    expect(r.perche.grande).toEqual({ tipo: 'testo', testo: '6.800,00 punti in dollari' })
    expect(r.perche.riferimento).toEqual({ id: 'sp500', data: '2026-09-30' })
    expect(r.perche.conto.map((x) => x.etichetta)).toEqual(['S&P 500 a fine marzo 2025', 'S&P 500 a fine settembre 2026', 'Variazione (valore finale ÷ valore iniziale − 1)'])
  })

  it('un indice che c’è da più tardi parte dal suo primo valore; senza l’ultimo fine mese la riga dice cosa manca', () => {
    const mib = linea(a, 'ftsemib').punti
    expect(mib.slice(0, 3)).toEqual([null, null, null])
    expect(mib[3]).toBe(0)
    expect(mib[17]).toBeCloseTo(45600 / 40000 - 1, 12)
    expect(mib[18]).toBeNull()
    const r = riga(a, 'ftsemib')
    expect(r.valore).toBeNull()
    expect(r.variazione).toBeNull()
    expect(r.manca).toBe('Nel file manca il valore di FTSE MIB di fine settembre 2026.')
  })

  it('un indice senza valori: la linea manca e la riga dice che arriva con Aggiorna fine mese', () => {
    expect(linea(a, 'eurostoxx50').punti.every((p) => p === null)).toBe(true)
    expect(riga(a, 'eurostoxx50').manca).toBe('I valori di Euro Stoxx 50 non sono ancora nel file: si scaricano con Aggiorna fine mese.')
  })

  it('il portafoglio: (controvalore + dividendi netti − capitale investito) ÷ capitale investito, a ogni fine mese', () => {
    const conti = contiDelPortafoglio(d)
    const tu = linea(a, 'portafoglio').punti
    conti.serie.forEach((p, k) => {
      const div = p.mese >= '2025-11-30' ? 30 : 0
      expect(tu[k]).toBeCloseTo((p.valore.n! + div - p.investiti) / p.investiti, 12)
    })
    expect(riga(a, 'portafoglio')).toMatchObject({ unita: 'euro', valore: conti.serie.at(-1)!.valore.n! + 30 })
  })

  it('l’inflazione: le basi si agganciano; senza il NIC di settembre arriva ad agosto', () => {
    const inf = linea(a, 'nic').punti
    expect(inf[0]).toBeCloseTo(0, 12)
    expect(inf[17]).toBeCloseTo(0.02, 12)
    expect(inf[18]).toBeNull()
    const r = riga(a, 'nic')
    expect(r.finoA).toBe('fino ad agosto')
    expect(r.variazione).toBeCloseTo(0.02, 12)
    expect(r.perche.riferimento).toEqual({ id: 'nic', data: '2026-08-31' })
  })
})

describe('negli ultimi 12 mesi', () => {
  const d = file({ riferimenti: SP, nic: NIC })
  const a = calcola(d, '12')

  it('dal fine mese di un anno fa: 13 fine mese, ogni linea riparte da zero', () => {
    expect(a.serie.mesi).toEqual(MESI.slice(-13))
    expect(a.da).toBe('2025-09-30')
    expect(linea(a, 'sp500').punti[0]).toBe(0)
    expect(linea(a, 'sp500').punti[12]).toBeCloseTo(6800 / 5600 - 1, 12)
    expect(riga(a, 'sp500').perche.titolo).toBe('S&P 500 da fine settembre 2025')
  })

  it('il portafoglio al netto dei versamenti e dei prelievi, come il rendimento da inizio anno', () => {
    const conti = contiDelPortafoglio(d)
    const p0 = conti.serie.at(-13)!
    const p1 = conti.serie.at(-1)!
    const atteso = senzaSoldiNuovi('2025-09-30', '2026-09-30', { v0: p0.valore.n!, v1: p1.valore.n!, flussi: [{ data: '2026-01-15', importo: -300 }], dividendi: 0 }).r!
    const tu = linea(a, 'portafoglio').punti
    expect(tu[0]).toBe(0)
    expect(tu[12]).toBeCloseTo(atteso, 12)
    expect(riga(a, 'portafoglio').variazione).toBeCloseTo(atteso, 12)
  })
})

describe('i valori di prima', () => {
  it('in un file della versione 3 i valori con i dividendi non si usano: arrivano in punti con Aggiorna fine mese', () => {
    const a = calcola(file({ versione: 3, riferimenti: SP }))
    expect(linea(a, 'sp500').punti.every((p) => p === null)).toBe(true)
    expect(riga(a, 'sp500').manca).toBe('I valori di S&P 500 non sono ancora nel file: si scaricano con Aggiorna fine mese.')
  })

  it('“Da dove viene” si rifà sui dati nuovi, con la matita per un valore a mano', () => {
    const d = file({ riferimenti: SP })
    const s = riga(calcola(d), 'sp500').perche
    const corretto = { ...d, riferimenti: SP.map((v) => (v.data === '2026-09-30' ? { ...v, valore: 7000, fonte: 'a mano' } : v)) }
    const nuova = s.rifai!(corretto)!
    expect(nuova.grande).toEqual({ tipo: 'testo', testo: '7.000,00 punti in dollari' })
    expect(nuova.note).toContain('Almeno uno dei due valori è inserito manualmente.')
    expect(riga(calcola(corretto), 'sp500').aMano).toBe(true)
  })
})
