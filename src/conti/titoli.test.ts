// Le prove dei conti dei titoli, su portafogli INVENTATI (codici ZZ…, nomi di fantasia).
import { describe, expect, it } from 'vitest'
import { portafoglioInventato } from '../dati/portafoglio-inventato.ts'
import type { FileDati, Operazione, PrezzoFineMese, Titolo } from '../dati/tipi.ts'
import { cifra, euro, guadagnoEuro, percentuale } from '../formato.ts'
import { fonteInParole } from './fonti.ts'
import type { Numero } from './spiegazione.ts'
import { contiDeiTitoli } from './titoli.ts'
import { xirr } from './xirr.ts'

function titolo(id: string, simbolo: string | null, extra: Partial<Titolo> = {}): Titolo {
  return {
    id,
    isin: id.slice(0, 12),
    borsa: 'MIL',
    nomeBorsa: 'Borsa Italiana',
    nome: `Fondo inventato ${id}`,
    soprannome: null,
    simbolo,
    descrizioneBanca: 'INVENTATO',
    dossier: 'Dossier di prova',
    ...extra,
  }
}

let n = 0
function op(titolo: string, tipo: 'acquisto' | 'vendita', data: string, quantita: number, prezzo: number, commissioni = 0): Operazione {
  const lordo = quantita * prezzo
  return {
    id: `op-${++n}`,
    titolo,
    tipo,
    data,
    esecuzione: data,
    quantita,
    prezzo,
    valuta: 'EUR',
    cambio: 1,
    commissioni,
    totale: tipo === 'acquisto' ? lordo + commissioni : lordo - commissioni,
    rifOrdine: null,
    fonte: 'inventato',
  }
}

const p = (titolo: string, data: string, prezzo: number): PrezzoFineMese => ({ titolo, data, prezzo, valuta: 'EUR', fonte: 'file (foglio inventato)' })

function file(parti: Partial<FileDati>): FileDati {
  return { formato: 'portafoglio', versione: 2, creato: '2026-01-01T00:00:00.000Z', titoli: [], operazioni: [], dividendi: [], prezzi: [], ...parti }
}

/** L'ultima riga del conto è il numero stesso: la spiegazione non può dire altro. */
function ultimaRiga(x: Numero): number {
  const c = x.perche.conto.at(-1)!.cifra
  if (!('n' in c)) throw new Error('l’ultima riga non è un numero')
  return c.n
}

describe('costo medio e vendite parziali', () => {
  // L'esempio della spec: 100 quote a 10 € e 50 a 13 € fanno un costo medio di 11 €.
  const A = 'ZZ0000000101-MIL'
  const dati = file({
    titoli: [titolo(A, 'AAAA')],
    operazioni: [op(A, 'acquisto', '2025-01-10', 100, 10), op(A, 'acquisto', '2025-03-10', 50, 13), op(A, 'vendita', '2025-06-10', 30, 15, 5)],
    prezzi: [p(A, '2025-05-31', 14), p(A, '2025-06-30', 16)],
  })
  const c = contiDeiTitoli(dati).titoli[0]

  it('il costo medio è 11 € e le quote rimaste lo tengono', () => {
    expect(c.vendite[0].costoMedio).toBeCloseTo(11, 10)
    expect(c.costoMedio.n).toBeCloseTo(11, 10)
    expect(c.quote).toBe(120)
  })

  it('guadagno incassato = (prezzo di vendita − costo medio) × quote vendute − commissione', () => {
    const v = c.vendite[0]
    expect(v.parziale).toBe(true)
    expect(v.quotePrima).toBe(150)
    expect(v.guadagnoIncassato.n).toBeCloseTo((15 - 11) * 30 - 5, 10)
    expect(ultimaRiga(v.guadagnoIncassato)).toBeCloseTo(115, 10)
    expect(v.guadagnoIncassato.perche.note.join(' ')).toContain('120 quote rimaste')
  })

  it('pagato, incassato e guadagno', () => {
    expect(c.pagato.n).toBe(1650)
    expect(c.incassato.n).toBe(445)
    // 120 quote × 16 € + 445 incassati − 1.650 pagati
    expect(c.valore.n).toBe(1920)
    expect(c.guadagno.n).toBeCloseTo(1920 + 445 - 1650, 10)
    expect(c.dallAcquisto.n).toBeCloseTo(715 / 1650, 10)
    expect(ultimaRiga(c.guadagno)).toBeCloseTo(c.guadagno.n!, 10)
    expect(ultimaRiga(c.costoMedio)).toBeCloseTo(11, 10)
  })

  it('il mese della vendita non conta come perdita i soldi tolti', () => {
    // maggio: 150 × 14 = 2.100; giugno: 120 × 16 = 1.920 più 445 tolti → (1.920 − 2.100 + 445) / (2.100 − 445 × 20/30)
    const giugno = c.mesi.find((m) => m.mese === '2025-06-30')!
    const atteso = (1920 - 2100 + 445) / (2100 - (445 * 20) / 30)
    expect(giugno.sulMese.n).toBeCloseTo(atteso, 10)
    expect(ultimaRiga(giugno.sulMese)).toBeCloseTo(atteso, 10)
  })
})

describe('il portafoglio inventato', () => {
  const conti = contiDeiTitoli(portafoglioInventato())
  const per = (s: string) => conti.titoli.find((t) => t.nomeCorto === s)!

  it('si conta all’ultimo fine mese con i prezzi', () => {
    expect(conti.fine).toBe('2026-09-30')
    expect(conti.mesi).toEqual(['2026-08-31', '2026-09-30'])
  })

  it('titolo in euro: valore = quote × prezzo, guadagno = valore − pagato', () => {
    const m = per('MOND')
    expect(m.stato).toBe('aperto')
    expect(m.valore.n).toBeCloseTo(1275, 10)
    expect(m.pagato.n).toBe(1005)
    expect(m.guadagno.n).toBeCloseTo(270, 10)
    expect(m.dallAcquisto.n).toBeCloseTo(270 / 1005, 10)
    expect(m.ultimoMese.n).toBeCloseTo(12.75 / 12.4 - 1, 10)
  })

  it('titolo in valuta: tutto in euro al cambio BCE, con il prezzo in sterline e il cambio nel conto', () => {
    const t = per('TECN')
    expect(t.valuta).toBe('GBP')
    expect(t.valore.n).toBeCloseTo((20 * 52.85) / 0.8546, 8)
    expect(t.valoreInValuta).toBeCloseTo(1057, 8)
    const righe = t.valore.perche.conto.map((r) => r.etichetta)
    expect(righe).toContain('÷ cambio BCE')
    expect(t.valore.perche.conto.find((r) => r.etichetta === '÷ cambio BCE')!.cifra).toEqual({ tipo: 'cambio', n: 0.8546 })
    // Il mese in euro conta anche il cambio; la nota dice di quanto è cambiato il prezzo in sterline.
    const atteso = (20 * 52.85) / 0.8546 / ((20 * 51.2) / 0.8652) - 1
    expect(t.ultimoMese.n).toBeCloseTo(atteso, 10)
    expect(t.ultimoMese.perche.note.join(' ')).toContain('In sterline il prezzo è passato')
  })

  it('titolo venduto: guadagno con incassato e cedole, niente medio annuo', () => {
    const o = per('Obbligazione Inventata 2027')
    expect(o.stato).toBe('chiuso')
    expect(o.paroleSemplici).toBeNull()
    expect(o.guadagno.n).toBeCloseTo(1007.05 + 17.5 - 992.95, 8)
    expect(o.medioAnnuo.n).toBeNull()
    expect(o.vendite[0].parziale).toBe(false)
  })

  it('i titoli che hai, sommati, e il guadagno di tutto il portafoglio', () => {
    expect(conti.aperti.quanti).toBe(2)
    expect(conti.aperti.valore.n).toBeCloseTo(1275 + (20 * 52.85) / 0.8546, 8)
    expect(conti.aperti.pagato.n).toBeCloseTo(1005 + 951.18, 8)
    expect(ultimaRiga(conti.aperti.guadagno)).toBeCloseTo(conti.aperti.guadagno.n!, 8)
    expect(conti.guadagnoTotale).toBeCloseTo(conti.aperti.guadagno.n! + 31.6, 8)
  })

  it('dividendi per anno', () => {
    expect(conti.dividendi.anni).toEqual(['2025'])
    expect(conti.dividendi.totale.n).toBe(17.5)
  })
})

describe('medio annuo', () => {
  it('XIRR: 1.000 € che diventano 1.210 € in due anni fanno circa +10% all’anno', () => {
    const r = xirr([
      { data: '2024-01-01', importo: -1000 },
      { data: '2026-01-01', importo: 1210 },
    ])
    expect(r).toBeCloseTo(0.1, 3)
  })

  it('XIRR: senza soldi ricevuti non c’è un tasso', () => {
    expect(xirr([{ data: '2024-01-01', importo: -1000 }])).toBeNull()
    expect(
      xirr([
        { data: '2024-01-01', importo: -1000 },
        { data: '2025-01-01', importo: -10 },
      ]),
    ).toBeNull()
  })

  it('conta quando entra ogni euro: il secondo acquisto pesa per il tempo che è rimasto', () => {
    const A = 'ZZ0000000201-MIL'
    const dati = file({
      titoli: [titolo(A, 'BBBB')],
      operazioni: [op(A, 'acquisto', '2024-01-31', 100, 10), op(A, 'acquisto', '2025-01-31', 100, 10)],
      prezzi: [p(A, '2024-01-31', 10), p(A, '2026-01-31', 11)],
    })
    const c = contiDeiTitoli(dati).titoli[0]
    // +10% in tutto, ma metà dei soldi è rimasta un anno solo: il medio annuo è più alto del composto semplice.
    expect(c.dallAcquisto.n).toBeCloseTo(0.1, 10)
    expect(c.medioAnnuo.n!).toBeGreaterThan(Math.pow(1.1, 1 / 2) - 1)
    // 1.000 × (1+r)^2 + 1.000 × (1+r) = 2.200  →  1 + r = (−1 + √9,8) ÷ 2 ≈ 1,0652
    expect(c.medioAnnuo.n!).toBeCloseTo((Math.sqrt(9.8) - 1) / 2 - 1, 3)
    expect(c.medioAnnuo.perche.dopo).toBe("all'anno")
  })

  it('sotto i sei mesi non si mostra, e la spiegazione dice perché', () => {
    const A = 'ZZ0000000301-MIL'
    const dati = file({
      titoli: [titolo(A, 'CCCC')],
      operazioni: [op(A, 'acquisto', '2026-06-15', 10, 100)],
      prezzi: [p(A, '2026-06-30', 101), p(A, '2026-09-30', 110)],
    })
    const c = contiDeiTitoli(dati).titoli[0]
    expect(c.medioAnnuo.n).toBeNull()
    expect(c.medioAnnuo.perche.frase).toContain('meno di sei mesi')
    // Il primo mese non ha una variazione: il titolo è entrato in quel mese.
    expect(c.mesi[0].sulMese.n).toBeNull()
  })
})

describe('il mese senza i soldi nuovi', () => {
  it('un acquisto a metà mese non è guadagno', () => {
    const A = 'ZZ0000000401-MIL'
    const B = 'ZZ0000000402-MIL'
    const dati = file({
      titoli: [titolo(A, 'DDDD'), titolo(B, 'EEEE')],
      operazioni: [op(A, 'acquisto', '2026-07-15', 100, 10), op(B, 'acquisto', '2026-09-15', 100, 10)],
      prezzi: [p(A, '2026-08-31', 10), p(A, '2026-09-30', 10), p(B, '2026-09-30', 10)],
    })
    const conti = contiDeiTitoli(dati)
    // Il valore passa da 1.000 a 2.000 €, ma i 1.000 € in più sono soldi messi: il mese è 0%.
    expect(conti.totaliDelMese.get('2026-09-30')!.valore.n).toBe(2000)
    expect(conti.ultimoMese.n).toBeCloseTo(0, 10)
  })
})

describe('un titolo comprato dopo l’ultimo fine mese', () => {
  it('ha il pagato, ma valore e guadagno arrivano con l’aggiornamento', () => {
    const A = 'ZZ0000000501-MIL'
    const B = 'ZZ0000000502-MIL'
    const dati = file({
      titoli: [titolo(A, 'FFFF'), titolo(B, 'GGGG')],
      operazioni: [op(A, 'acquisto', '2026-01-15', 10, 10), op(B, 'acquisto', '2026-10-05', 10, 20)],
      prezzi: [p(A, '2026-09-30', 12)],
    })
    const conti = contiDeiTitoli(dati)
    const nuovo = conti.titoli.find((t) => t.id === B)!
    expect(nuovo.stato).toBe('nuovo')
    expect(nuovo.pagato.n).toBe(200)
    expect(nuovo.valore.n).toBeNull()
    expect(nuovo.guadagno.n).toBeNull()
    // Non entra nei titoli che hai a fine mese.
    expect(conti.aperti.quanti).toBe(1)
    expect(conti.aperti.pagato.n).toBe(100)
  })
})

describe('le parole semplici', () => {
  it('vengono dal file dei dati; senza simbolo il nome corto è il nome', () => {
    const A = 'ZZ0000000601-MIL'
    const dati = file({ titoli: [titolo(A, null, { nome: 'Obbligazione Inventata 2030', paroleSemplici: '  Prestito di prova  ' })], prezzi: [] })
    const c = contiDeiTitoli(dati).titoli[0]
    expect(c.nomeCorto).toBe('Obbligazione Inventata 2030')
    expect(c.paroleSemplici).toBe('Prestito di prova')
  })
})

describe('fonti e numeri scritti', () => {
  it('i nomi delle fonti', () => {
    expect(fonteInParole('file (foglio qualunque)').nome).toBe('file Excel iniziale')
    expect(fonteInParole('Borsa Italiana')).toEqual({ nome: 'Borsa Italiana', borsa: true, dettaglio: null })
    expect(fonteInParole('stima: rimborso alla pari').dettaglio).toBe('rimborso alla pari')
  })

  it('all’italiana, con il vero segno meno', () => {
    expect(euro(1234)).toBe('1.234 €')
    expect(euro(-1234.5, 2)).toBe('−1.234,50 €')
    expect(guadagnoEuro(0.004, 2)).toBe('0,00 €')
    expect(guadagnoEuro(32990)).toBe('+32.990 €')
    expect(percentuale(-0.0342)).toBe('−3,4%')
    expect(percentuale(-0.0004)).toBe('0,0%')
    expect(cifra({ tipo: 'prezzo', n: 52.845, valuta: 'GBP' })).toBe('52,845 GBP')
    expect(cifra({ tipo: 'cambio', n: 0.8546 })).toBe('0,8546')
  })
})
