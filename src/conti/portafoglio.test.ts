// Le prove dei conti del portafoglio, su portafogli INVENTATI (codici ZZ…, nomi di fantasia).
import { describe, expect, it } from 'vitest'
import { portafoglioInventato } from '../dati/portafoglio-inventato.ts'
import type { Dividendo, FileDati, Operazione, PrezzoFineMese, Titolo } from '../dati/tipi.ts'
import { corto, griglia } from '../pagine/portafoglio/griglia.ts'
import { contiDelPortafoglio, meglioPeggio } from './portafoglio.ts'
import type { Numero } from './spiegazione.ts'
import { contiDeiTitoli } from './titoli.ts'

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

const div = (titolo: string, data: string, netto: number): Dividendo => ({
  id: `div-${++n}`,
  titolo,
  data,
  lordo: netto,
  imposte: 0,
  netto,
  fonte: 'inventato',
})

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

describe('il portafoglio inventato', () => {
  const dati = portafoglioInventato()
  const titoli = contiDeiTitoli(dati)
  const c = contiDelPortafoglio(dati, titoli)
  const valore = 1275 + (20 * 52.85) / 0.8546
  const pagato = 1005 + 951.18 + 992.95
  const incassato = 1007.05

  it('soldi investiti = pagato per comprare − incassato vendendo', () => {
    expect(c.investiti.n).toBeCloseTo(pagato - incassato, 8)
    expect(ultimaRiga(c.investiti)).toBeCloseTo(c.investiti.n!, 8)
  })

  it('il guadagno comprende i titoli venduti e i dividendi, ed è la somma dei titoli', () => {
    const g = valore + incassato + 17.5 - pagato
    expect(c.guadagno.n).toBeCloseTo(g, 8)
    expect(c.guadagno.n).toBeCloseTo(titoli.guadagnoTotale, 8)
    expect(ultimaRiga(c.guadagno)).toBeCloseTo(g, 8)
    expect(c.guadagno.perche.note.join(' ')).toContain('Comprende i titoli già venduti (Obbligazione Inventata 2027)')
  })

  it('% dall’inizio = guadagno ÷ soldi investiti', () => {
    expect(c.dallInizio.n).toBeCloseTo(c.guadagno.n! / c.investiti.n!, 10)
    expect(ultimaRiga(c.dallInizio)).toBeCloseTo(c.dallInizio.n!, 10)
  })

  it('il valore, il mese e i dividendi', () => {
    expect(c.fine).toBe('2026-09-30')
    expect(c.anno).toBe('2026')
    expect(c.valore.n).toBeCloseTo(valore, 8)
    expect(c.mese.n).toBeCloseTo(titoli.ultimoMese.n!, 12)
    expect(c.dividendi.n).toBe(17.5)
    expect(ultimaRiga(c.dividendi)).toBe(17.5)
  })

  it('l’anno non si conta se manca il valore al 31/12 dell’anno prima', () => {
    // Il file inventato ha i prezzi solo da agosto 2026, ma gli acquisti sono del 2024.
    expect(c.annoInCorso.n).toBeNull()
    expect(c.annoInCorso.perche.frase).toContain('31/12/2025')
  })

  it('la serie del grafico: un punto per fine mese, con i soldi investiti fino a quel giorno', () => {
    expect(c.serie.map((s) => s.mese)).toEqual(['2026-08-31', '2026-09-30'])
    expect(c.serie[1].valore.n).toBeCloseTo(valore, 8)
    expect(c.serie[1].investiti).toBeCloseTo(pagato - incassato, 8)
  })
})

describe('medio annuo del portafoglio', () => {
  const A = 'ZZ0000000701-MIL'
  const B = 'ZZ0000000702-MIL'

  it('1.000 € che diventano 1.210 € in due anni fanno circa +10% all’anno', () => {
    const dati = file({ titoli: [titolo(A, 'HHHH')], operazioni: [op(A, 'acquisto', '2024-09-30', 100, 10)], prezzi: [p(A, '2026-09-30', 12.1)] })
    const c = contiDelPortafoglio(dati)
    expect(c.medioAnnuo.n).toBeCloseTo(0.1, 3)
    expect(c.medioAnnuo.perche.dopo).toBe("all'anno")
    expect(ultimaRiga(c.medioAnnuo)).toBeCloseTo(c.medioAnnuo.n!, 10)
  })

  it('conta quando entra ogni euro: i soldi entrati dopo pesano meno', () => {
    // 1.000 € a settembre 2024 e 1.000 € a settembre 2025, che valgono 2.200 € a settembre 2026:
    // 1.000 × (1+r)^2 + 1.000 × (1+r) = 2.200  →  1 + r = (−1 + √9,8) ÷ 2
    const dati = file({
      titoli: [titolo(A, 'HHHH'), titolo(B, 'IIII')],
      operazioni: [op(A, 'acquisto', '2024-09-30', 100, 10), op(B, 'acquisto', '2025-09-30', 100, 10)],
      prezzi: [p(A, '2026-09-30', 11), p(B, '2026-09-30', 11)],
    })
    const c = contiDelPortafoglio(dati)
    expect(c.dallInizio.n).toBeCloseTo(0.1, 10)
    expect(c.medioAnnuo.n!).toBeCloseTo((Math.sqrt(9.8) - 1) / 2 - 1, 3)
  })

  it('i dividendi sono soldi ricevuti: alzano il medio annuo', () => {
    const senza = file({ titoli: [titolo(A, 'HHHH')], operazioni: [op(A, 'acquisto', '2024-09-30', 100, 10)], prezzi: [p(A, '2026-09-30', 11)] })
    const con = { ...senza, dividendi: [div(A, '2025-09-30', 50)] }
    const a = contiDelPortafoglio(senza).medioAnnuo.n!
    const b = contiDelPortafoglio(con).medioAnnuo.n!
    expect(b).toBeGreaterThan(a)
    expect(contiDelPortafoglio(con).medioAnnuo.perche.conto.some((r) => r.etichetta.includes('dividendo di HHHH'))).toBe(true)
  })

  it('sotto i sei mesi non si mostra, e la spiegazione dice perché', () => {
    const dati = file({ titoli: [titolo(A, 'HHHH')], operazioni: [op(A, 'acquisto', '2026-06-15', 100, 10)], prezzi: [p(A, '2026-09-30', 11)] })
    const c = contiDelPortafoglio(dati)
    expect(c.medioAnnuo.n).toBeNull()
    expect(c.medioAnnuo.perche.frase).toContain('meno di sei mesi')
  })
})

describe('l’anno in corso senza i soldi nuovi', () => {
  const A = 'ZZ0000000801-MIL'
  const B = 'ZZ0000000802-MIL'

  it('i soldi messi durante l’anno non sono guadagno: contano solo da quando sono entrati', () => {
    // 31/12/2025: 1.000 €. Il 30/06/2026 si comprano 1.000 € di un altro titolo. 30/09/2026: 1.200 + 1.050 €.
    const dati = file({
      titoli: [titolo(A, 'LLLL'), titolo(B, 'MMMM')],
      operazioni: [op(A, 'acquisto', '2025-06-30', 100, 10), op(B, 'acquisto', '2026-06-30', 100, 10)],
      prezzi: [p(A, '2025-12-31', 10), p(A, '2026-09-30', 12), p(B, '2026-09-30', 10.5)],
      dividendi: [div(A, '2026-03-31', 20)],
    })
    const c = contiDelPortafoglio(dati)
    const giorni = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5
    const peso = giorni('2026-06-30', '2026-09-30') / giorni('2025-12-31', '2026-09-30')
    const atteso = (2250 - 1000 - 1000 + 20) / (1000 + 1000 * peso)
    expect(c.annoInCorso.n).toBeCloseTo(atteso, 10)
    expect(ultimaRiga(c.annoInCorso)).toBeCloseTo(atteso, 10)
    expect(c.annoInCorso.perche.conto.map((r) => r.etichetta)).toContain('− soldi messi nel 2026')
    expect(c.annoInCorso.perche.note[0]).toContain('acquisto di MMMM')
  })

  it('una vendita nell’anno non è una perdita', () => {
    // 31/12/2025: 200 quote a 10 €. Il 31/03/2026 se ne vendono 100 a 10 €. 30/09/2026: 100 quote a 11 €.
    const dati = file({
      titoli: [titolo(A, 'LLLL')],
      operazioni: [op(A, 'acquisto', '2025-06-30', 200, 10), op(A, 'vendita', '2026-03-31', 100, 10)],
      prezzi: [p(A, '2025-12-31', 10), p(A, '2026-09-30', 11)],
    })
    const c = contiDelPortafoglio(dati)
    expect(c.annoInCorso.n!).toBeGreaterThan(0)
    expect(c.annoInCorso.perche.conto.map((r) => r.etichetta)).toContain('+ soldi tolti nel 2026 (vendite)')
  })

  it('un portafoglio cominciato nell’anno si misura dal prezzo d’acquisto', () => {
    const dati = file({ titoli: [titolo(A, 'LLLL')], operazioni: [op(A, 'acquisto', '2026-01-31', 100, 10)], prezzi: [p(A, '2026-09-30', 11)] })
    const c = contiDelPortafoglio(dati)
    // Valore iniziale zero: tutto il guadagno (100 €) diviso i soldi messi, pesati per i giorni.
    const peso = (Date.parse('2026-09-30') - Date.parse('2026-01-31')) / (Date.parse('2026-09-30') - Date.parse('2025-12-31'))
    expect(c.annoInCorso.n).toBeCloseTo(100 / (1000 * peso), 10)
    expect(c.annoInCorso.perche.note.join(' ')).toContain('cominciato nel 2026')
  })
})

describe('i movimenti dopo l’ultimo fine mese', () => {
  it('non entrano nei conti finché non c’è il prezzo, e la spiegazione lo dice', () => {
    const A = 'ZZ0000000901-MIL'
    const B = 'ZZ0000000902-MIL'
    const dati = file({
      titoli: [titolo(A, 'NNNN'), titolo(B, 'OOOO')],
      operazioni: [op(A, 'acquisto', '2025-01-15', 100, 10), op(A, 'acquisto', '2026-10-05', 10, 12), op(B, 'acquisto', '2026-10-06', 10, 20)],
      dividendi: [div(A, '2026-10-10', 5)],
      prezzi: [p(A, '2025-12-31', 11), p(A, '2026-09-30', 12)],
    })
    const c = contiDelPortafoglio(dati)
    expect(c.investiti.n).toBe(1000)
    expect(c.guadagno.n).toBeCloseTo(200, 10)
    expect(c.dividendi.n).toBe(0)
    expect(c.guadagno.perche.note.join(' ')).toContain('3 movimenti dopo il 30/09/2026')
    expect(c.dividendi.perche.note.join(' ')).toContain('Un dividendo arrivato dopo il 30/09/2026')
  })
})

describe('un file senza prezzi', () => {
  it('niente numeri, e ogni trattino spiega perché', () => {
    const A = 'ZZ0000001001-MIL'
    const c = contiDelPortafoglio(file({ titoli: [titolo(A, 'PPPP')], operazioni: [op(A, 'acquisto', '2026-01-15', 10, 10)] }))
    expect(c.fine).toBeNull()
    expect(c.guadagno.n).toBeNull()
    expect(c.guadagno.perche.frase).toContain('primo aggiornamento')
    expect(c.serie).toEqual([])
  })
})

describe('i titoli che vanno meglio e peggio', () => {
  // Sette titoli inventati, comprati a 10 € il 31/12/2025: a settembre valgono da 7 a 13 €.
  const ids = ['ZZ0000001101-MIL', 'ZZ0000001102-MIL', 'ZZ0000001103-MIL', 'ZZ0000001104-MIL', 'ZZ0000001105-MIL', 'ZZ0000001106-MIL', 'ZZ0000001107-MIL']
  const simboli = ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG']
  const fine = [13, 7, 12, 8, 11, 9, 10]
  const agosto = [12, 7.5, 12.5, 7.5, 11, 9, 9]
  const dati = file({
    titoli: ids.map((id, i) => titolo(id, simboli[i])),
    operazioni: ids.map((id) => op(id, 'acquisto', '2025-12-31', 100, 10)),
    prezzi: ids.flatMap((id, i) => [p(id, '2026-08-31', agosto[i]), p(id, '2026-09-30', fine[i])]),
  })
  const titoli = contiDeiTitoli(dati).titoli
  const nomi = (xs: { conto: { nomeCorto: string } }[]) => xs.map((x) => x.conto.nomeCorto)

  it('dall’acquisto: i 3 migliori dal primo, i 3 peggiori dal peggiore', () => {
    const mp = meglioPeggio(titoli, 'acquisto')
    expect(nomi(mp.meglio)).toEqual(['QA', 'QC', 'QE'])
    expect(nomi(mp.peggio)).toEqual(['QB', 'QD', 'QF'])
    expect(mp.meglio[0].numero.n).toBeCloseTo(0.3, 10)
  })

  it('sull’ultimo mese', () => {
    const mp = meglioPeggio(titoli, 'mese')
    expect(nomi(mp.meglio)).toEqual(['QG', 'QA', 'QD'])
    expect(nomi(mp.peggio)).toEqual(['QB', 'QC', 'QF'])
  })

  it('con pochi titoli un titolo non sta in tutte e due le colonne', () => {
    expect(nomi(meglioPeggio(titoli.slice(0, 4), 'acquisto').meglio)).toHaveLength(2)
    expect(nomi(meglioPeggio(titoli.slice(0, 4), 'acquisto').peggio)).toHaveLength(2)
    const uno = meglioPeggio(titoli.slice(0, 1), 'acquisto')
    expect(uno.meglio).toHaveLength(1)
    expect(uno.peggio).toHaveLength(0)
  })

  it('un titolo entrato nell’ultimo mese non ha il mese: resta fuori e si dice', () => {
    const N = 'ZZ0000001199-MIL'
    const conNuovo = file({
      ...dati,
      titoli: [...dati.titoli!, titolo(N, 'QN')],
      operazioni: [...dati.operazioni!, op(N, 'acquisto', '2026-09-15', 10, 10)],
      prezzi: [...dati.prezzi!, p(N, '2026-09-30', 10)],
    })
    const mp = meglioPeggio(contiDeiTitoli(conNuovo).titoli, 'mese')
    expect(mp.senzaNumero.map((t) => t.nomeCorto)).toEqual(['QN'])
    expect([...nomi(mp.meglio), ...nomi(mp.peggio)]).not.toContain('QN')
  })
})

describe('le cifre a sinistra del grafico', () => {
  it('cinque linee tonde che contengono tutti i valori', () => {
    const g = griglia(24_000, 440_000)
    expect(g).toHaveLength(5)
    expect(g[0]).toBeLessThanOrEqual(24_000)
    expect(g[4]).toBeGreaterThanOrEqual(440_000)
    expect(g[1] - g[0]).toBe(g[4] - g[3])
    expect(g.map(corto)).toEqual(['0', '125k', '250k', '375k', '500k'])
  })

  it('un solo valore non rompe la griglia', () => {
    const g = griglia(1000, 1000)
    expect(g[0]).toBeLessThanOrEqual(1000)
    expect(g[4]).toBeGreaterThanOrEqual(1000)
  })
})
