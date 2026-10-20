// Dal PDF alla bozza di Registra, e il titolo nuovo nel file (ticket 12), sul portafoglio inventato
// e con i campi di PDF inventati.
import { describe, expect, it } from 'vitest'
import { aVersione3 } from '../../dati/aggiorna/versione3.ts'
import { controllaFile } from '../../dati/controllo.ts'
import { applicaModifica, controllaModifica, percheDellaCopia } from '../../dati/movimenti.ts'
import { campiAcquisto, campiDividendo } from '../../dati/pdf-inventati.ts'
import { comeTesto, portafoglioInventato } from '../../dati/portafoglio-inventato.ts'
import { bozzaDaiPdf, leggiBozzaPdf, NUOVO, type BozzaPdf } from './dal-pdf.ts'

const MOND = 'ZZ0000000001-MIL'
const QUANDO = '2026-10-19T18:00:00.000Z'
const base = () => aVersione3(portafoglioInventato())
const pdf = (nome: string, campi = campiAcquisto()) => ({ nome, percorso: `C:\\Prove\\${nome}`, campi })

function bozza(aperti: Parameters<typeof bozzaDaiPdf>[1], dati = base()): BozzaPdf {
  const e = bozzaDaiPdf(dati, aperti)
  if (!e.ok) throw new Error(e.perche)
  return e.bozza
}

describe('dal PDF alla bozza', () => {
  it('un acquisto di un titolo che hai: i campi scritti come li scrive una persona, tutti "dal PDF"', () => {
    const b = bozza([pdf('acquisto.pdf')])
    expect(b).toMatchObject({ tipo: 'acquisto', origine: 'pdf', pdf: ['acquisto.pdf'], rifOrdine: '123456789', esecuzione: '2026-10-08' })
    expect(b.testi).toMatchObject({ titolo: MOND, data: '12/10/2026', quantita: '73', prezzo: '12,5', cambio: '1', commissioni: '2,95', totale: '915,45' })
    expect(b.dalPdf).toEqual(b.testi)
    expect(b.dalPdfInfo).toMatchObject({ percorsi: ['C:\\Prove\\acquisto.pdf'], doppio: null, nuovo: null, pezzi: null })
    const l = leggiBozzaPdf(base(), b)
    expect(l.mancano).toEqual([])
    expect(l.movimento).toMatchObject({ tipo: 'acquisto', titolo: MOND, data: '2026-10-12', quantita: 73, prezzo: 12.5, totale: 915.45, pdf: ['acquisto.pdf'], rifOrdine: '123456789' })
    expect(l.movimento).not.toHaveProperty('dalPdf')
  })
  it('un numero cambiato prima di registrare entra "a mano", con il valore del PDF', () => {
    const b = bozza([pdf('acquisto.pdf')])
    const cambiata = { ...b, testi: { ...b.testi, commissioni: '3,95', totale: '916,45' } }
    const m = leggiBozzaPdf(base(), cambiata).movimento!
    expect(m).toMatchObject({ commissioni: 3.95, totale: 916.45, dalPdf: { commissioni: 2.95, totale: 915.45 } })
  })
  it('due pezzi dello stesso ordine: un solo acquisto, con i pezzi da mostrare', () => {
    const b = bozza([
      pdf('a.pdf'),
      pdf('b.pdf', campiAcquisto({ Quantita: '27,000', Prezzo_eseguito: '12,50000', Tot_Commissioni_Spese: '0,00 EUR ', Tot_EUR_debito_credito: '337,50 EUR ' })),
    ])
    expect(b.testi.quantita).toBe('100')
    expect(b.testi.totale).toBe('1252,95')
    expect(b.dalPdfInfo!.pezzi).toHaveLength(2)
    expect(b.dalPdfInfo!.ordine).toBe('123456789')
  })
  it('un dividendo: data, lordo e imposte; le quote del PDF per il controllo', () => {
    const b = bozza([pdf('div.pdf', campiDividendo())])
    expect(b.testi).toMatchObject({ titolo: MOND, data: '30/09/2026', lordo: '20', imposte: '5,2' })
    expect(b.dalPdfInfo!.quotePdf).toBe(100)
    expect(leggiBozzaPdf(base(), b).movimento).toMatchObject({ tipo: 'dividendo', lordo: 20, imposte: 5.2, pdf: ['div.pdf'] })
  })
  it('una cedola porta la scritta "Cedola dell’obbligazione"', () => {
    const b = bozza([pdf('c.pdf', campiDividendo({ Isin: 'ZZ0000000003', Valuta_regolamento: '01/03/2025', Operazione: 'CEDOLE' }))])
    expect(b.nota).toBe('Cedola dell’obbligazione')
  })
  it('un PDF già registrato si riconosce (si rifiuta con "Apri quel movimento")', () => {
    const b = bozza([pdf('acquisto.pdf')])
    const m = leggiBozzaPdf(base(), b).movimento!
    const { dati, id } = applicaModifica(base(), { azione: 'registra', movimento: m }, QUANDO)
    const di_nuovo = bozza([pdf('acquisto.pdf')], dati)
    expect(di_nuovo.dalPdfInfo!.doppio).toBe(id)
    // Anche il processo principale non lo registra due volte.
    const no = controllaModifica(dati, { azione: 'registra', movimento: m })
    expect(!no.ok && no.perche).toMatch(/già registrato/)
  })
  it('rifiuti in parole: non un PDF, una vendita di un titolo che non hai', () => {
    expect(bozzaDaiPdf(base(), [{ nome: 'foto.jpg', percorso: null, campi: {} }])).toMatchObject({ ok: false })
    const v = bozzaDaiPdf(base(), [pdf('v.pdf', campiAcquisto({ Isin: 'ZZ0000000009', Operazione: 'VENDITA TITOLI' }))])
    expect(!v.ok && v.perche).toMatch(/non puoi venderlo/)
    const r = bozzaDaiPdf(base(), [{ nome: 'rotto.pdf', percorso: null, perche: 'il file non si apre come PDF' }])
    expect(!r.ok && r.perche).toMatch(/Non riesco a leggere rotto.pdf/)
  })
})

describe('il titolo nuovo', () => {
  const nuovoPdf = () =>
    pdf('nuovo.pdf', campiAcquisto({ Isin: 'ZZ0000000009', Simbolo: 'NUOV', Descrizione: 'INVENTATO NUOVO ACC', Rif_ordine: '555', Mercato: 'XETRA-GERMANIA' }))

  it('il PDF di un titolo che non hai apre il riquadro, con ISIN, simbolo e borsa dal PDF', () => {
    const b = bozza([nuovoPdf()])
    expect(b.testi.titolo).toBe(NUOVO)
    expect(b.dalPdfInfo!.nuovo).toMatchObject({ isin: 'ZZ0000000009', simbolo: 'NUOV', borsa: 'XET', parole: '', descrizioneBanca: 'INVENTATO NUOVO ACC', fuoriMercato: false })
  })
  it('la frase si vede subito; "Sì, registra" aspetta le parole semplici', () => {
    const b = bozza([nuovoPdf()])
    const l = leggiBozzaPdf(base(), b)
    expect(l.movimento).toMatchObject({ titolo: 'ZZ0000000009-XET', quantita: 73 })
    expect(l.mancano).toEqual(['cos’è il titolo nuovo, in parole semplici'])
    expect(l.vista.titoloNuovo).toMatchObject({ id: 'ZZ0000000009-XET', nomeBorsa: 'Xetra', simbolo: 'NUOV', paroleSemplici: '', dossier: 'Dossier di prova' })
  })
  it('fuori mercato: la borsa si sceglie', () => {
    const b = bozza([pdf('n.pdf', campiAcquisto({ Isin: 'ZZ0000000009', Simbolo: 'NUOV', Mercato: 'FUORI MERCATO/NON REGOLAMENTATO ITA' }))])
    expect(b.dalPdfInfo!.nuovo).toMatchObject({ borsa: null, fuoriMercato: true })
    const l = leggiBozzaPdf(base(), b)
    expect(l.movimento).toBeNull()
    expect(l.mancano).toContain('la borsa di quotazione del titolo nuovo')
  })
  it('registrato con il titolo: entra nel file, il file si legge, la copia ha il nome giusto; tolto, il file torna com’era', () => {
    const b = bozza([nuovoPdf()])
    const scritta: BozzaPdf = { ...b, dalPdfInfo: { ...b.dalPdfInfo!, nuovo: { ...b.dalPdfInfo!.nuovo!, parole: 'Fondo inventato per le prove', codiceInvesting: 990001, codiceYahoo: 'nuov.de' } } }
    const l = leggiBozzaPdf(base(), scritta)
    expect(l.mancano).toEqual([])
    const t = l.vista.titoloNuovo!
    expect(t).toMatchObject({ codiceInvesting: 990001, codiceYahoo: 'NUOV.DE', valuta: 'EUR' })
    const richiesta = { azione: 'registra' as const, movimento: l.movimento!, titoloNuovo: t }
    expect(controllaModifica(base(), richiesta)).toEqual({ ok: true })
    expect(percheDellaCopia(base(), richiesta)).toBe('prima di registrare l’acquisto di NUOV del 12-10-2026')
    const { dati, id } = applicaModifica(base(), richiesta, QUANDO)
    expect(dati.titoli!.map((x) => x.id)).toContain('ZZ0000000009-XET')
    expect(controllaFile(comeTesto(dati)).ok).toBe(true)
    const tolto = applicaModifica(dati, { azione: 'togli', id }, QUANDO).dati
    expect(comeTesto(tolto)).toBe(comeTesto(base()))
  })
  it('senza parole semplici, o se il titolo c’è già, il processo principale non lo aggiunge', () => {
    const b = bozza([nuovoPdf()])
    const l = leggiBozzaPdf(base(), b)
    const t = l.vista.titoloNuovo!
    const senza = controllaModifica(base(), { azione: 'registra', movimento: l.movimento!, titoloNuovo: t })
    expect(!senza.ok && senza.perche).toMatch(/parole semplici/)
    const gia = controllaModifica(base(), { azione: 'registra', movimento: { ...l.movimento!, titolo: MOND }, titoloNuovo: { ...t, id: MOND, isin: 'ZZ0000000001', borsa: 'MIL', paroleSemplici: 'x' } })
    expect(!gia.ok && gia.perche).toMatch(/c’è già/)
  })
})
