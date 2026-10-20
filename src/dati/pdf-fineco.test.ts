// Le prove della lettura dei PDF della banca, con campi INVENTATI (stessi nomi dei campi dei moduli Fineco).
import { describe, expect, it } from 'vitest'
import { aVersioneAttuale } from './aggiorna/versione3.ts'
import { applicaModifica } from './movimenti.ts'
import { borsaDelMercato, dataDelPdf, giaRegistrato, leggiCampi, numeroDelPdf, titoloDelPdf, unisciPdf, type CampiPdf, type Letto, type LettoOperazione } from './pdf-fineco.ts'
import { campiAcquisto, campiDividendo } from './pdf-inventati.ts'
import { portafoglioInventato } from './portafoglio-inventato.ts'

const MOND = 'ZZ0000000001-MIL'
const base = () => aVersioneAttuale(portafoglioInventato())

function letto(nome: string, c: CampiPdf): Letto {
  const l = leggiCampi(nome, null, c)
  if (!l.ok) throw new Error(l.perche)
  return l.letto
}

describe('le parole del PDF', () => {
  it('numeri all’italiana, con la valuta in fondo', () => {
    expect(numeroDelPdf('1234,50 EUR ')).toBe(1234.5)
    expect(numeroDelPdf('120,000')).toBe(120)
    expect(numeroDelPdf('1.234,5')).toBe(1234.5)
    expect(numeroDelPdf('0,04321 EUR')).toBe(0.04321)
    expect(numeroDelPdf('-')).toBeNull()
    expect(numeroDelPdf('')).toBeNull()
  })
  it('date, anche con l’ora', () => {
    expect(dataDelPdf('06/05/2024')).toBe('2024-05-06')
    expect(dataDelPdf('02/05/2024 11:54:04')).toBe('2024-05-02')
    expect(dataDelPdf('ieri')).toBeNull()
  })
  it('il mercato dice la borsa; fuori mercato no', () => {
    expect(borsaDelMercato('EURONEXT MILAN')).toBe('MIL')
    expect(borsaDelMercato('XETRA-GERMANIA')).toBe('XET')
    expect(borsaDelMercato('LONDON STOCK EXCHANGE')).toBe('LON')
    expect(borsaDelMercato('SBF-FRANCIA')).toBe('PAR')
    expect(borsaDelMercato('FUORI MERCATO/NON REGOLAMENTATO ITA')).toBeNull()
    expect(borsaDelMercato('ESTERO FUORI MERCATO NON')).toBeNull()
  })
})

describe('leggere i campi', () => {
  it('un acquisto: valuta di regolamento, numero d’ordine senza zeri davanti, totale della banca', () => {
    const l = letto('acquisto.pdf', campiAcquisto()) as LettoOperazione
    expect(l).toMatchObject({
      tipo: 'acquisto',
      isin: 'ZZ0000000001',
      simbolo: 'MOND',
      data: '2026-10-12',
      esecuzione: '2026-10-08',
      borsa: 'MIL',
      fuoriMercato: false,
      rifOrdine: '123456789',
      quantita: 73,
      prezzo: 12.5,
      valuta: 'EUR',
      cambio: 1,
      commissioni: 2.95,
      totale: 915.45,
    })
    expect(l.avvisi).toEqual([])
  })
  it('una vendita usa lo stesso modulo; un rimborso è una vendita con la scritta', () => {
    expect(letto('v.pdf', campiAcquisto({ Operazione: 'VENDITA TITOLI' })).tipo).toBe('vendita')
    const r = letto('r.pdf', campiAcquisto({ Operazione: 'RIMBORSO TITOLI' })) as LettoOperazione
    expect(r.tipo).toBe('vendita')
    expect(r.nota).toBe('Rimborso a scadenza')
  })
  it('un dividendo: lordo, imposte, netto, quote e lordo per quota', () => {
    expect(letto('d.pdf', campiDividendo())).toMatchObject({
      tipo: 'dividendo',
      data: '2026-09-30',
      quantita: 100,
      perQuota: 0.2,
      lordo: 20,
      imposte: 5.2,
      netto: 14.8,
      cedola: false,
      avvisi: [],
    })
  })
  it('una cedola è un dividendo segnato come cedola', () => {
    const l = letto('c.pdf', campiDividendo({ Operazione: 'CEDOLE', Cedola: '  3' }))
    expect(l.tipo === 'dividendo' && l.cedola).toBe(true)
  })
  it('un dividendo in dollari si legge, ma con l’avviso di controllare', () => {
    const l = letto('usd.pdf', campiDividendo({ Divisa: 'USD', Controvalore_lordo: '22,00 USD' }))
    expect(l.avvisi[0]).toMatch(/USD/)
  })
  it('un PDF senza i campi della banca non si riconosce', () => {
    const l = leggiCampi('foto.pdf', null, {})
    expect(l.ok).toBe(false)
    expect(!l.ok && l.perche).toMatch(/non risulta un acquisto/)
  })
  it('manca un numero importante: lo dice', () => {
    const l = leggiCampi('x.pdf', null, campiAcquisto({ Tot_EUR_debito_credito: '' }))
    expect(!l.ok && l.perche).toMatch(/il totale/)
  })
})

describe('PDF "a" e "b" dello stesso ordine', () => {
  const a = letto('acquisto a.pdf', campiAcquisto({ Quantita: '73,000', Prezzo_eseguito: '12,50000', Tot_Commissioni_Spese: '2,95 EUR ', Tot_EUR_debito_credito: '915,45 EUR ' }))
  const b = letto(
    'acquisto b.pdf',
    campiAcquisto({ Quantita: '27,000', Prezzo_eseguito: '12,51000', Tot_Commissioni_Spese: '0,00 EUR ', Tot_EUR_debito_credito: '337,77 EUR ', Data_ora_esecuzione: '08/10/2026 10:15:02' }),
  )
  it('si sommano in un solo acquisto: quote, commissioni, totale, prezzo medio', () => {
    const u = unisciPdf([a, b])
    expect(u.ok).toBe(true)
    if (!u.ok) return
    expect(u.letto).toMatchObject({ quantita: 100, commissioni: 2.95, totale: 1253.22, prezzo: 12.5027, pdf: ['acquisto a.pdf', 'acquisto b.pdf'] })
    expect(u.letto.pezzi).toHaveLength(2)
  })
  it('lo stesso file messo due volte conta una volta', () => {
    const u = unisciPdf([a, a])
    expect(u.ok && u.letto.pezzi).toBeNull()
  })
  it('PDF di ordini diversi non si sommano', () => {
    const c = letto('altro.pdf', campiAcquisto({ Rif_ordine: '999' }))
    expect(unisciPdf([a, c]).ok).toBe(false)
    expect(unisciPdf([a, letto('d.pdf', campiDividendo())]).ok).toBe(false)
  })
})

describe('quale titolo è', () => {
  it('ISIN più borsa: il titolo che c’è già', () => {
    expect(titoloDelPdf(base(), letto('a.pdf', campiAcquisto()))).toEqual({ quale: 'trovato', id: MOND })
  })
  it('lo stesso ISIN su un’altra borsa è un titolo nuovo', () => {
    expect(titoloDelPdf(base(), letto('a.pdf', campiAcquisto({ Mercato: 'XETRA-GERMANIA' })))).toEqual({ quale: 'nuovo', borsa: 'XET' })
  })
  it('fuori mercato: basta l’ISIN, se il titolo c’è', () => {
    expect(titoloDelPdf(base(), letto('a.pdf', campiAcquisto({ Mercato: 'FUORI MERCATO/NON REGOLAMENTATO ITA' })))).toEqual({ quale: 'trovato', id: MOND })
  })
  it('un ISIN che non c’è: titolo nuovo, con la borsa se il PDF la dice', () => {
    expect(titoloDelPdf(base(), letto('a.pdf', campiAcquisto({ Isin: 'ZZ0000000009' })))).toEqual({ quale: 'nuovo', borsa: 'MIL' })
    expect(titoloDelPdf(base(), letto('a.pdf', campiAcquisto({ Isin: 'ZZ0000000009', Mercato: 'FUORI MERCATO' })))).toEqual({ quale: 'nuovo', borsa: null })
  })
  it('una vendita o un dividendo di un titolo che non hai non si registrano', () => {
    const v = titoloDelPdf(base(), letto('v.pdf', campiAcquisto({ Isin: 'ZZ0000000009', Operazione: 'VENDITA TITOLI' })))
    expect(v.quale).toBe('non-hai')
    const d = titoloDelPdf(base(), letto('d.pdf', campiDividendo({ Isin: 'ZZ0000000009' })))
    expect(d.quale === 'non-hai' && d.perche).toMatch(/registrare prima il suo acquisto/)
  })
  it('un dividendo si riconosce dall’ISIN', () => {
    expect(titoloDelPdf(base(), letto('d.pdf', campiDividendo()))).toEqual({ quale: 'trovato', id: MOND })
  })
})

describe('già registrato?', () => {
  it('un acquisto con lo stesso numero d’ordine è già registrato', () => {
    const l = letto('a.pdf', campiAcquisto())
    expect(giaRegistrato(base(), l)).toBeNull()
    const { dati, id } = applicaModifica(
      base(),
      { azione: 'registra', movimento: { tipo: 'acquisto', titolo: MOND, data: '2026-10-12', quantita: 73, prezzo: 12.5, cambio: 1, commissioni: 2.95, totale: 915.45, rifOrdine: '123456789', pdf: ['a.pdf'] } },
      '2026-10-19T10:00:00Z',
    )
    expect(id).toBe('op-123456789')
    expect(giaRegistrato(dati, l)).toBe(id)
  })
  it('un dividendo dello stesso titolo nello stesso giorno è già registrato', () => {
    const l = letto('d.pdf', campiDividendo())
    expect(giaRegistrato(base(), l)).toBeNull()
    const { dati, id } = applicaModifica(base(), { azione: 'registra', movimento: { tipo: 'dividendo', titolo: MOND, data: '2026-09-30', lordo: 20, imposte: 5.2, pdf: ['d.pdf'] } }, '2026-10-19T10:00:00Z')
    expect(giaRegistrato(dati, l)).toBe(id)
  })
})
