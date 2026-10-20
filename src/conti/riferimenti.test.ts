// Le prove del confronto con i riferimenti (ticket 10), su portafogli e riferimenti INVENTATI:
// codici ZZ…, nomi di fantasia e valori tondi, così i conti si fanno a mente.
import { describe, expect, it } from 'vitest'
import { RACCORDO_2015_2025 } from '../dati/aggiorna/riferimenti.ts'
import type { FileDati, NicDelMese, Operazione, PrezzoFineMese, Titolo, ValoreRiferimento } from '../dati/tipi.ts'
import { contiDelPortafoglio } from './portafoglio.ts'
import { classifica, confrontoConIRiferimenti, lunghezzaBarra, nomeMisura, spiegazioneDelConfronto, type Confronto } from './riferimenti.ts'
import { senzaSoldiNuovi } from './titoli.ts'
import { xirr } from './xirr.ts'

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
const nic = (data: string, valore: number, base: 2015 | 2025 = 2025): NicDelMese => ({ data, valore, base, fonte: 'ISTAT' })

function file(parti: Partial<FileDati>): FileDati {
  return { formato: 'portafoglio', versione: 3, creato: '2026-01-01T00:00:00.000Z', titoli: [titolo], operazioni: [], dividendi: [], prezzi: [], ...parti }
}

function confronto(d: FileDati): Confronto {
  const c = confrontoConIRiferimenti(d, contiDelPortafoglio(d))
  if (!c) throw new Error('niente confronto')
  return c
}
const riga = (c: Confronto, id: string) => c.riferimenti.find((r) => r.id === id)!

// Tre movimenti: 1.000 € il 15/03/2025, altri 500 € il 16/06/2025, 300 € tolti il 15/01/2026. Fine mese: 30/09/2026.
const OPS = [op('acquisto', '2025-03-14', 1000), op('acquisto', '2025-06-16', 500), op('vendita', '2026-01-15', 300)]
const PREZZI = [prezzo('2025-12-31', 12), prezzo('2026-09-30', 13)]
// Il BTP inventato: 100 il 14/03/2025, 125 il 16/06/2025, 140 al 31/12/2025, 150 il 15/01/2026, 160 a fine settembre.
const BTP = [rif('btp10', '2025-03-14', 100), rif('btp10', '2025-06-16', 125), rif('btp10', '2025-12-31', 140), rif('btp10', '2026-01-15', 150), rif('btp10', '2026-09-30', 160)]

describe('gli stessi euro, nelle stesse date', () => {
  const d = file({ operazioni: OPS, prezzi: PREZZI, riferimenti: BTP })
  const c = confronto(d)
  const btp = riga(c, 'btp10')

  it('ogni movimento cresce quanto il riferimento dal suo giorno alla fine: 1.000 × 1,6 + 500 × 1,28 − 300 × 160/150', () => {
    expect(btp.valore).toBeCloseTo(1000 * 1.6 + 500 * 1.28 - 300 * (160 / 150), 6)
    expect(btp.manca).toBeNull()
  })

  it("dall'inizio è (valore − soldi investiti) ÷ soldi investiti, con gli stessi soldi investiti del portafoglio", () => {
    const valore = 1000 * 1.6 + 500 * 1.28 - 320
    expect(btp.inizio).toBeCloseTo((valore - 1200) / 1200, 9)
    expect(c.portafoglio.valore).toBeCloseTo(1200 / 10 * 13, 6) // 120 quote a 13 €, senza dividendi
  })

  it('il medio annuo conta quando sono entrati e usciti i soldi (XIRR)', () => {
    const valore = 1000 * 1.6 + 500 * 1.28 - 320
    const atteso = xirr([
      { data: '2025-03-14', importo: -1000 },
      { data: '2025-06-16', importo: -500 },
      { data: '2026-01-15', importo: 300 },
      { data: '2026-09-30', importo: valore },
    ])
    expect(btp.medio).toBeCloseTo(atteso!, 9)
  })

  it("l'anno si misura dal 31/12, senza contare come guadagno i soldi tolti nell'anno", () => {
    const v0 = 1000 * 1.4 + 500 * (140 / 125)
    const valore = 1000 * 1.6 + 500 * 1.28 - 320
    const atteso = senzaSoldiNuovi('2025-12-31', '2026-09-30', { v0, v1: valore, flussi: [{ data: '2026-01-15', importo: -300 }], dividendi: 0 }).r
    expect(btp.anno).toBeCloseTo(atteso!, 9)
  })

  it('il pannello ha i quattro numeri, il conto movimento per movimento e il riferimento da scaricare o correggere', () => {
    expect(btp.perche.titolo).toBe('BTP 10 anni: gli stessi euro')
    expect(btp.perche.conto.map((r) => r.etichetta)).toEqual(['Soldi investiti (messi − tolti)', 'Valore a fine settembre', 'Anno 2026', "Dall'inizio", 'Medio annuo'])
    const passi = btp.perche.passi!.righe
    expect(passi).toHaveLength(1 + 3 + 1)
    expect(passi[1].etichetta).toBe('14/03/2025: messi (INV) 1.000,00 € × 160,00 ÷ 100,00')
    expect(passi[1].cifra).toMatchObject({ tipo: 'euro', n: 1600 })
    expect(passi[3].cifra).toMatchObject({ tipo: 'euro' })
    expect((passi[3].cifra as { n: number }).n).toBeCloseTo(-320, 9)
    expect(passi.at(-1)!.etichetta).toBe('Valore a fine settembre')
    expect(btp.perche.riferimento).toEqual({ id: 'btp10', data: '2026-09-30' })
  })
})

describe('i riferimenti in dollari', () => {
  it('si portano in euro con il cambio dello stesso giorno: valore ÷ cambio', () => {
    // 1.000 € il 14/03/2025 quando l'indice valeva 1.100 $ con 1,10 $ per euro (1.000 €); a fine settembre 1.320 $ con 1,20 (1.100 €).
    const d = file({ operazioni: [OPS[0]], prezzi: PREZZI, riferimenti: [rif('sp500', '2025-03-14', 1100, 1.1), rif('sp500', '2025-12-31', 1200, 1.2), rif('sp500', '2026-09-30', 1320, 1.2)] })
    const sp = riga(confronto(d), 'sp500')
    expect(sp.valore).toBeCloseTo(1100, 6) // +10% in euro, anche se in dollari è +20%
    expect(sp.perche.passi!.righe[0].etichetta).toBe('S&P 500 a fine settembre 2026: 1.320,00 USD ÷ 1,2000')
  })
})

describe("l'inflazione", () => {
  it('fa crescere gli stessi euro con il NIC del mese del movimento, con le due basi agganciate', () => {
    // 1.000 € a marzo 2025 (NIC 122,5 in base 2015), fine settembre 2026 (NIC 104,6 in base 2025).
    const d = file({ operazioni: [OPS[0]], prezzi: PREZZI, nic: [nic('2025-03-31', 122.5, 2015), nic('2025-12-31', 122.6, 2015), nic('2026-09-30', 104.6)] })
    const inf = riga(confronto(d), 'nic')
    expect(inf.valore).toBeCloseTo((1000 * 104.6) / (122.5 / RACCORDO_2015_2025), 6)
    expect(inf.finoA).toBeNull()
    expect(inf.nome).toBe('Inflazione')
  })

  it('senza il NIC dell’ultimo mese arriva al mese prima e lo dice: "fino ad agosto"', () => {
    const d = file({ operazioni: [OPS[0]], prezzi: PREZZI, nic: [nic('2025-03-31', 100), nic('2025-12-31', 101), nic('2026-08-31', 102)] })
    const inf = riga(confronto(d), 'nic')
    expect(inf.finoA).toBe('fino ad agosto')
    expect(inf.fino).toBe('2026-08-31')
    expect(inf.valore).toBeCloseTo(1020, 6)
    expect(inf.perche.dopo).toBe('a fine agosto')
    expect(inf.perche.note.some((x) => x.startsWith('Il NIC di settembre non c’è ancora'))).toBe(true)
    // Il pannello offre di scrivere il NIC che manca, quello di settembre.
    expect(inf.perche.riferimento).toEqual({ id: 'nic', data: '2026-09-30' })
  })
})

describe('quando mancano dei valori', () => {
  it('un riferimento senza valori nel file dice "manca" e perché', () => {
    const c = confronto(file({ operazioni: OPS, prezzi: PREZZI }))
    const sp = riga(c, 'sp500')
    expect(sp.valore).toBeNull()
    expect(sp.manca).toBe('Nel file non ci sono ancora i valori di S&P 500: arrivano con Aggiorna fine mese.')
    expect(sp.perche.grande).toEqual({ tipo: 'testo', testo: 'manca' })
    expect(riga(c, 'nic').manca).toBe('Nel file non ci sono ancora i valori del NIC: arrivano con Aggiorna fine mese.')
  })

  it('se manca il valore del giorno di un movimento, lo dice con la data', () => {
    const senza = BTP.filter((v) => v.data !== '2025-06-16')
    const btp = riga(confronto(file({ operazioni: OPS, prezzi: PREZZI, riferimenti: senza })), 'btp10')
    expect(btp.manca).toBe('Nel file manca il valore di BTP 10 anni: del 16/06/2025.')
  })

  it('senza il valore al 31/12 manca solo l’anno', () => {
    const btp = riga(confronto(file({ operazioni: OPS, prezzi: PREZZI, riferimenti: BTP.filter((v) => v.data !== '2025-12-31') })), 'btp10')
    expect(btp.anno).toBeNull()
    expect(btp.medio).not.toBeNull()
    expect(btp.perche.note).toContain("L'anno non c'è: manca il valore di fine dicembre 2025.")
  })

  it('un valore scritto a mano segna la riga', () => {
    const aMano = BTP.map((v) => (v.data === '2026-09-30' ? { ...v, fonte: 'a mano' } : v))
    const btp = riga(confronto(file({ operazioni: OPS, prezzi: PREZZI, riferimenti: aMano })), 'btp10')
    expect(btp.aMano).toBe(true)
    expect(btp.perche.note).toContain('Il valore di fine settembre è scritto a mano.')
  })
})

describe('il portafoglio nel confronto', () => {
  it('vale i titoli più i dividendi incassati, con gli stessi numeri del riquadro della risposta', () => {
    const d = file({
      operazioni: OPS,
      prezzi: PREZZI,
      dividendi: [{ id: 'd1', titolo: T, data: '2026-05-29', lordo: 30, imposte: 4, netto: 26, fonte: 'inventato' }],
    })
    const conti = contiDelPortafoglio(d)
    const c = confrontoConIRiferimenti(d, conti)!
    expect(c.portafoglio.valore).toBeCloseTo(conti.valore.n! + 26, 9)
    expect(c.portafoglio.medio).toBe(conti.medioAnnuo.n)
    expect(c.portafoglio.anno).toBe(conti.annoInCorso.n)
    expect(c.portafoglio.inizio).toBe(conti.dallInizio.n)
    expect(c.portafoglio.perche.passi!.righe.map((r) => r.etichetta)).toEqual(['Valore dei titoli a fine settembre', '+ dividendi netti incassati', 'Valore nel confronto'])
  })

  it('senza prezzi di fine mese non c’è confronto', () => {
    const d = file({ operazioni: OPS })
    expect(confrontoConIRiferimenti(d, contiDelPortafoglio(d))).toBeNull()
  })
})

describe('la classifica', () => {
  const d = file({
    operazioni: OPS,
    prezzi: PREZZI,
    riferimenti: [
      ...BTP,
      // FTSE MIB inventato che raddoppia, Euro Stoxx 50 che perde
      ...BTP.map((v) => ({ ...v, riferimento: 'ftsemib' as const, valore: v.data === '2026-09-30' ? 320 : v.valore })),
      ...BTP.map((v) => ({ ...v, riferimento: 'eurostoxx50' as const, valore: v.data === '2026-09-30' ? 80 : v.valore })),
    ],
  })
  const c = confronto(d)

  it('mette i riferimenti dal migliore al peggiore, e in fondo quelli che mancano', () => {
    const k = classifica(c, 'inizio')
    const nomi = k.righe.map((x) => x.riga.nome)
    expect(nomi.slice(0, 4)).toEqual(['FTSE MIB', 'BTP 10 anni', 'Il tuo portafoglio', 'Euro Stoxx 50'])
    expect(nomi.slice(4)).toEqual(['Nasdaq-100', 'Dow Jones', 'S&P 500', 'Inflazione'])
    expect(k.righe.slice(4).every((x) => x.n === null)).toBe(true)
  })

  it('conta quanti riferimenti fai meglio, su quanti hanno il numero', () => {
    const k = classifica(c, 'inizio')
    expect(k.batti).toBe(1)
    expect(k.su).toBe(3)
    expect(k.senza).toEqual(['Nasdaq-100', 'Dow Jones', 'S&P 500', 'Inflazione'])
  })

  it('la barra parte da zero: un valore negativo ha solo un segno minimo', () => {
    expect(lunghezzaBarra(-0.2, 0.5)).toBe(1)
    expect(lunghezzaBarra(0.25, 0.5)).toBe(50)
    expect(lunghezzaBarra(null, 0.5)).toBe(1)
  })

  it('i bottoni della misura', () => {
    expect(nomeMisura('medio', '2026')).toBe('All’anno in media')
    expect(nomeMisura('anno', '2026')).toBe('Anno 2026')
    expect(nomeMisura('inizio', '2026')).toBe('Dall’inizio')
  })

  it('il pannello si rifà sui dati nuovi dopo una correzione', () => {
    const btp = riga(c, 'btp10')
    const corretto = { ...d, riferimenti: d.riferimenti!.map((v) => (v.riferimento === 'btp10' && v.data === '2026-09-30' ? { ...v, valore: 176, fonte: 'a mano' } : v)) }
    const nuova = spiegazioneDelConfronto(corretto, btp.perche)!
    expect(nuova.grande).toMatchObject({ tipo: 'euro' })
    expect((nuova.grande as { n: number }).n).toBeCloseTo((btp.valore! * 176) / 160, 6)
  })
})
