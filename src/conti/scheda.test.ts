// Le prove dei numeri della Scheda del titolo, su portafogli INVENTATI (codici ZZ…, nomi di fantasia).
import { describe, expect, it } from 'vitest'
import { portafoglioInventato } from '../dati/portafoglio-inventato.ts'
import type { Dividendo, FileDati, Operazione, PrezzoFineMese, Titolo } from '../dati/tipi.ts'
import { fonteMovimento, schedaDelTitolo, venditaInParole, type Pezzo } from './scheda.ts'
import type { Numero } from './spiegazione.ts'
import { contiDeiTitoli } from './titoli.ts'

function titolo(id: string, simbolo: string, extra: Partial<Titolo> = {}): Titolo {
  return {
    id,
    isin: id.slice(0, 12),
    borsa: 'MIL',
    nomeBorsa: 'Borsa Italiana',
    nome: `Fondo inventato ${simbolo}`,
    soprannome: null,
    simbolo,
    descrizioneBanca: 'INVENTATO',
    dossier: 'Dossier di prova',
    ...extra,
  }
}

let n = 0
function op(
  titolo: string,
  tipo: 'acquisto' | 'vendita',
  data: string,
  quantita: number,
  prezzo: number,
  commissioni = 0,
  extra: Partial<Operazione> = {},
): Operazione {
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
    fonte: 'Acquistotitoli-inventato.pdf',
    ...extra,
  }
}

const p = (titolo: string, data: string, prezzo: number, fonte = 'file (foglio inventato)'): PrezzoFineMese => ({
  titolo,
  data,
  prezzo,
  valuta: 'EUR',
  fonte,
})

function file(parti: Partial<FileDati>): FileDati {
  return { formato: 'portafoglio', versione: 2, creato: '2026-01-01T00:00:00.000Z', titoli: [], operazioni: [], dividendi: [], prezzi: [], ...parti }
}

/** L'ultima riga del conto è il numero stesso. */
function ultimaRiga(x: Numero): number {
  const c = x.perche.conto.at(-1)!.cifra
  if (!('n' in c)) throw new Error('l’ultima riga non è un numero')
  return c.n
}

const testo = (pezzi: Pezzo[]) => pezzi.map((x) => (typeof x === 'string' ? x : x.b)).join('')

function scheda(dati: FileDati, simbolo: string) {
  const conti = contiDeiTitoli(dati)
  const c = conti.titoli.find((t) => t.nomeCorto === simbolo)!
  return { conti, c, s: schedaDelTitolo(dati, c) }
}

describe('la fonte di un movimento', () => {
  it('il carico iniziale è "file Excel iniziale", un PDF è "PDF della banca"', () => {
    expect(fonteMovimento('file (foglio inventato, riga 4)')).toBe('file Excel iniziale')
    expect(fonteMovimento('Acquistotitoli-qualcosa.pdf')).toBe('PDF della banca')
    expect(fonteMovimento('')).toBe('—')
  })
})

describe('vendita parziale nella scheda', () => {
  // 100 quote a 10 € e 50 a 13 € (costo medio 11 €), poi 30 vendute a 15 € con 5 € di commissione.
  const A = 'ZZ0000000201-MIL'
  const dati = file({
    titoli: [titolo(A, 'AAAA')],
    operazioni: [op(A, 'acquisto', '2025-01-10', 100, 10), op(A, 'acquisto', '2025-03-10', 50, 13), op(A, 'vendita', '2025-06-10', 30, 15, 5)],
    prezzi: [p(A, '2025-01-31', 10.5), p(A, '2025-03-31', 12, 'Borsa Italiana'), p(A, '2025-05-31', 14), p(A, '2025-06-30', 16)],
  })
  const { s } = scheda(dati, 'AAAA')

  it('le operazioni vanno dalla più recente; la vendita è "Vendita parziale" con il guadagno incassato', () => {
    expect(s.operazioni.map((r) => r.cosa)).toEqual(['Vendita parziale', 'Acquisto', 'Acquisto'])
    const v = s.operazioni[0]
    expect(v.vendita?.parziale).toBe(true)
    expect(v.vendita?.guadagnoIncassato.n).toBeCloseTo((15 - 11) * 30 - 5, 10)
    expect(v.soldi.n).toBe(445)
    expect(ultimaRiga(v.soldi)).toBe(445)
    expect(v.fonte).toBe('PDF della banca')
  })

  it('la frase dice quote vendute su quante, incassato, costo medio e quote rimaste', () => {
    const frase = testo(venditaInParole(s.operazioni[0].vendita!))
    expect(frase).toContain('10/06/2025')
    expect(frase).toContain('30 quote su 150')
    expect(frase).toContain('445,00 €')
    expect(frase).toContain('11,00 €')
    expect(frase).toContain('Plusvalenza realizzata: +115,00 €')
    expect(frase).toContain('Le 120 quote rimaste mantengono il prezzo medio di carico')
  })

  it('la linea del pagato è il costo delle quote che avevi: dopo la vendita scende al costo medio', () => {
    expect(s.conVendite).toBe(true)
    const pagato = Object.fromEntries(s.punti.map((x) => [x.mese, x.pagato]))
    expect(pagato['2025-01-31']).toBeCloseTo(1000, 10)
    expect(pagato['2025-03-31']).toBeCloseTo(1650, 10)
    expect(pagato['2025-06-30']).toBeCloseTo(1650 - 30 * 11, 10)
    expect(s.punti.at(-1)!.valore).toBeCloseTo(120 * 16, 10)
  })

  it('mese per mese dal più recente, con la fonte in parole e il puntino della borsa', () => {
    expect(s.mesi.map((r) => r.mese.mese)).toEqual(['2025-06-30', '2025-05-31', '2025-03-31', '2025-01-31'])
    expect(s.mesi[0].fonte).toBe('file Excel iniziale')
    expect(s.mesi[2].borsa).toBe(true)
    expect(s.mesi[0].prezzo.n).toBe(16)
    expect(s.mesi[0].cambio).toBeNull()
    expect(s.mesi[0].prezzo.perche.titolo).toBe('Prezzo di AAAA a fine giugno 2025')
  })
})

describe('titolo in valuta', () => {
  const conti = contiDeiTitoli(portafoglioInventato())
  const t = conti.titoli.find((x) => x.nomeCorto === 'TECN')!
  const s = schedaDelTitolo(portafoglioInventato(), t)

  it('ogni mese ha il prezzo in sterline e il cambio, con il conto del prezzo in euro', () => {
    const r = s.mesi[0]
    expect(r.prezzo.perche.grande).toEqual({ tipo: 'prezzo', n: 52.85, valuta: 'GBP' })
    expect(r.cambio?.n).toBe(0.8546)
    expect(ultimaRiga(r.cambio!)).toBeCloseTo(52.85 / 0.8546, 10)
    // Il conto del prezzo è quello del valore: quote × prezzo = in sterline, ÷ cambio BCE.
    const etichette = r.prezzo.perche.conto.map((x) => x.etichetta)
    expect(etichette).toContain('= in sterline')
    expect(etichette).toContain('÷ cambio BCE')
  })

  it('l’acquisto in valuta spiega quote × prezzo, il cambio del giorno e le commissioni', () => {
    const a = s.operazioni[0]
    expect(a.cosa).toBe('Acquisto')
    const conto = Object.fromEntries(a.soldi.perche.conto.map((x) => [x.etichetta, x.cifra]))
    expect(conto['= in sterline']).toEqual({ tipo: 'prezzo', n: 800, valuta: 'GBP' })
    expect(conto['÷ cambio del giorno']).toEqual({ tipo: 'cambio', n: 0.85 })
    expect(conto['+ commissioni']).toMatchObject({ tipo: 'euro', n: 10 })
    expect(ultimaRiga(a.soldi)).toBe(951.18)
  })

  it('"Da dove vengono i numeri" scrive il valore in sterline e il cambio BCE', () => {
    const valore = s.paragrafi.find((x) => x.nome === 'Controvalore')!
    const frase = testo(valore.pezzi)
    expect(frase).toContain('20 quote × 52,85 GBP')
    expect(frase).toContain('= 1.057,00 GBP, diviso il cambio BCE del 30/09/2026 (0,8546 GBP per 1 €)')
    expect(s.paragrafi.map((x) => x.nome)).toEqual(['Controvalore', 'Prezzo', "Costo d'acquisto", 'Prezzo medio di carico', 'Dividendi', 'Plusvalenza', 'Rendimento annualizzato'])
  })
})

describe('titolo venduto, rimborso e dividendi', () => {
  const dati = portafoglioInventato()
  const conti = contiDeiTitoli(dati)
  const obbl = conti.titoli.find((x) => x.stato === 'chiuso')!
  const s = schedaDelTitolo(dati, obbl)

  it('la vendita che chiude tutto non è parziale; un rimborso si chiama così', () => {
    expect(s.operazioni[0].cosa).toBe('Vendita')
    const conRimborso = { ...dati, operazioni: dati.operazioni!.map((o) => (o.tipo === 'vendita' ? { ...o, nota: 'Rimborso a scadenza' } : o)) }
    const s2 = schedaDelTitolo(
      conRimborso,
      contiDeiTitoli(conRimborso).titoli.find((x) => x.stato === 'chiuso')!,
    )
    expect(s2.operazioni[0].cosa).toBe('Rimborso')
  })

  it('il dividendo: lordo − imposte = netto, con la nota e la fonte', () => {
    expect(s.dividendi).toHaveLength(1)
    const d = s.dividendi[0]
    expect(d.netto.n).toBe(17.5)
    expect(d.netto.perche.titolo).toBe('Cedola di Obbligazione Inventata 2027 del 01/03/2025')
    expect(d.netto.perche.conto.map((x) => x.etichetta)).toEqual(['Lordo', '− imposte', 'Netto'])
    expect(ultimaRiga(d.netto)).toBe(17.5)
  })

  it('"Da dove vengono i numeri" di un titolo venduto: pagato, incassato, dividendi, guadagno', () => {
    expect(s.paragrafi.map((x) => x.nome)).toEqual(["Costo d'acquisto", 'Ricavo delle vendite', 'Dividendi', 'Plusvalenza', 'Rendimento annualizzato'])
    const g = testo(s.paragrafi.find((x) => x.nome === 'Plusvalenza')!.pezzi)
    expect(g).toContain('Ricavo delle vendite + dividendi netti − costo d’acquisto = +31,60 €')
  })

  it('un movimento con soldi in più (rateo, ritenute) li mostra in una riga a parte', () => {
    const B = 'ZZ0000000202-MIL'
    const conRateo = file({
      titoli: [titolo(B, 'BBBB')],
      operazioni: [op(B, 'acquisto', '2025-01-10', 10, 100, 2, { totale: 1010, nota: 'Totale con il rateo' })],
      prezzi: [p(B, '2025-01-31', 101)],
    })
    const { s: sb } = scheda(conRateo, 'BBBB')
    const conto = sb.operazioni[0].soldi.perche.conto
    expect(conto.map((x) => x.etichetta)).toContain('+ altre voci (nelle note)')
    expect(conto.find((x) => x.etichetta === '+ altre voci (nelle note)')!.cifra).toMatchObject({ n: 8 })
    expect(sb.operazioni[0].soldi.perche.note[0]).toBe('Totale con il rateo')
  })
})

describe('mesi senza prezzo', () => {
  it('se manca il prezzo di un fine mese si usa l’ultimo e la riga lo dice', () => {
    const A = 'ZZ0000000203-MIL'
    const B = 'ZZ0000000204-MIL'
    const dati = file({
      titoli: [titolo(A, 'AAAA'), titolo(B, 'BBBB')],
      operazioni: [op(A, 'acquisto', '2025-01-10', 10, 10), op(B, 'acquisto', '2025-01-10', 10, 10)],
      prezzi: [p(A, '2025-01-31', 11), p(B, '2025-01-31', 11), p(B, '2025-02-28', 12)],
    })
    const { s } = scheda(dati, 'AAAA')
    expect(s.mesi[0].mese.mese).toBe('2025-02-28')
    expect(s.mesi[0].prezzoDel).toBe('2025-01-31')
    expect(s.mesi[1].prezzoDel).toBeNull()
  })

  it('i dividendi vanno dal più recente', () => {
    const A = 'ZZ0000000205-MIL'
    const div = (id: string, data: string): Dividendo => ({
      id,
      titolo: A,
      data,
      lordo: 10,
      imposte: 2.6,
      netto: 7.4,
      fonte: 'file (foglio inventato)',
    })
    const dati = file({
      titoli: [titolo(A, 'AAAA')],
      operazioni: [op(A, 'acquisto', '2025-01-10', 10, 10)],
      dividendi: [div('d1', '2025-03-01'), div('d2', '2025-09-01')],
      prezzi: [p(A, '2025-09-30', 11)],
    })
    const { s } = scheda(dati, 'AAAA')
    expect(s.dividendi.map((d) => d.dividendo.id)).toEqual(['d2', 'd1'])
    expect(s.dividendi[0].fonte).toBe('file Excel iniziale')
  })
})

describe('file alla versione 3: prezzo a mano, riserva e cambio BCE', () => {
  const A = 'ZZ0000000206-LON'
  const B = 'ZZ0000000207-MIL'
  const dati: FileDati = {
    ...file({
      titoli: [titolo(A, 'AAAA', { borsa: 'LON', nomeBorsa: 'London Stock Exchange', valuta: 'GBP' }), titolo(B, 'BBBB')],
      operazioni: [
        op(A, 'acquisto', '2025-01-10', 10, 20, 0, { valuta: 'GBP', cambio: 0.85, totale: 235.29 }),
        op(B, 'acquisto', '2025-01-10', 10, 10),
      ],
      prezzi: [
        { titolo: A, data: '2025-01-31', prezzo: 21, valuta: 'GBP', cambio: 0.84, fonte: 'London Stock Exchange', seduta: '2025-01-31' },
        {
          titolo: A,
          data: '2025-02-28',
          prezzo: 22,
          valuta: 'GBP',
          cambio: 0.83,
          fonte: 'a mano',
          quando: '2025-03-02T10:00:00.000Z',
          prima: { prezzo: 23, fonte: 'London Stock Exchange' },
        },
        {
          titolo: B,
          data: '2025-02-28',
          prezzo: 11,
          valuta: 'EUR',
          fonte: 'Euronext Milano',
          nota: 'Borsa Italiana non ha risposto',
          seduta: '2025-02-27',
        },
      ],
    }),
    versione: 3,
    cambi: [
      { valuta: 'GBP', data: '2025-01-31', cambio: 0.84, fonte: 'BCE' },
      { valuta: 'GBP', data: '2025-02-28', cambio: 0.83, fonte: 'BCE' },
    ],
  }

  it('il prezzo a mano porta il chip, quello di prima barrato e il perché nel pannello', () => {
    const { s } = scheda(dati, 'AAAA')
    const r = s.mesi[0]
    expect(r.aMano).toBe(true)
    expect(r.prima).toBe(23)
    // Il pannello lo corregge e mostra "a mano" con il prezzo di prima: la nota in parole non si ripete.
    expect(r.prezzo.perche.correggi).toEqual({ titolo: A, data: '2025-02-28' })
    expect(r.prezzo.perche.note.join(' ')).not.toContain('Inserito manualmente')
    expect(r.cambio!.perche.note[0]).toBe('Fonte del cambio: BCE.')
    expect(s.mesi[1].aMano).toBe(false)
    expect(s.mesi[1].borsa).toBe(true)
  })

  it('una riserva dice perché non è la borsa ufficiale, con il giorno di borsa vero', () => {
    const { s } = scheda(dati, 'BBBB')
    expect(s.mesi[0].fonte).toBe('Euronext Milano')
    expect(s.mesi[0].perche).toBe('Borsa Italiana non ha risposto')
    expect(s.mesi[0].prezzo.perche.frase).toContain('(27/02/2025)')
  })
})
