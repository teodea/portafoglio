// Le prove di registrare, correggere a mano e togliere un movimento, sul portafoglio inventato.
import { describe, expect, it } from 'vitest'
import { aVersione3 } from './aggiorna/versione3.ts'
import { controllaFile } from './controllo.ts'
import { applicaModifica, controllaModifica, percheDellaCopia, quoteAlGiorno, type ModificaMovimento, type NuovaOperazione } from './movimenti.ts'
import { comeTesto, portafoglioInventato } from './portafoglio-inventato.ts'
import type { FileDati } from './tipi.ts'

const MOND = 'ZZ0000000001-MIL'
const TECN = 'ZZ0000000002-LON'
const OBBL = 'ZZ0000000003-MIL'
const QUANDO = '2026-10-19T18:00:00.000Z'
const base = () => aVersione3(portafoglioInventato())

const acquisto: NuovaOperazione = {
  tipo: 'acquisto',
  titolo: MOND,
  data: '2026-10-12',
  quantita: 10,
  prezzo: 12,
  cambio: 1,
  commissioni: 5,
  totale: 125,
}

function fai(dati: FileDati, m: ModificaMovimento) {
  return applicaModifica(dati, m, QUANDO)
}

describe('registrare un movimento scritto a mano', () => {
  it('l’acquisto entra al suo posto nell’ordine delle date, con la fonte "a mano"', () => {
    const { dati, id } = fai(base(), { azione: 'registra', movimento: acquisto })
    expect(id).toBe(`op-${MOND}-2026-10-12-acquisto`)
    const o = dati.operazioni!.find((x) => x.id === id)
    expect(o).toEqual({
      id,
      titolo: MOND,
      tipo: 'acquisto',
      data: '2026-10-12',
      esecuzione: '2026-10-12',
      quantita: 10,
      prezzo: 12,
      valuta: 'EUR',
      cambio: 1,
      commissioni: 5,
      totale: 125,
      rifOrdine: null,
      fonte: 'a mano',
    })
    expect(dati.operazioni!.at(-1)!.id).toBe(id)
    // Un acquisto più vecchio va tra gli altri, senza spostarli.
    const vecchio = fai(base(), { azione: 'registra', movimento: { ...acquisto, data: '2024-04-02' } }).dati
    expect(vecchio.operazioni!.map((x) => x.id)).toEqual(['op-1', `op-${MOND}-2024-04-02-acquisto`, 'op-2', 'op-3', 'op-4'])
    expect(controllaFile(comeTesto(dati)).ok).toBe(true)
  })

  it('un titolo in sterline prende la valuta del titolo; lo stesso giorno due volte ha due codici diversi', () => {
    const m: NuovaOperazione = { ...acquisto, titolo: TECN, prezzo: 50, cambio: 0.85, commissioni: 10, totale: 598.24 }
    const uno = fai(base(), { azione: 'registra', movimento: m })
    const due = fai(uno.dati, { azione: 'registra', movimento: m })
    expect(uno.dati.operazioni!.find((o) => o.id === uno.id)!.valuta).toBe('GBP')
    expect(due.id).toBe(`${uno.id}-2`)
  })

  it('il dividendo: il netto è lordo meno imposte', () => {
    const { dati, id } = fai(base(), { azione: 'registra', movimento: { tipo: 'dividendo', titolo: MOND, data: '2026-08-31', lordo: 20, imposte: 5.2 } })
    expect(id).toBe('div-ZZ0000000001-2026-08-31')
    expect(dati.dividendi!.find((d) => d.id === id)).toEqual({
      id,
      titolo: MOND,
      data: '2026-08-31',
      lordo: 20,
      imposte: 5.2,
      netto: 14.8,
      fonte: 'a mano',
    })
  })

  it('dal PDF (ticket 12): la fonte sono i PDF e un numero cambiato prima di registrare resta "a mano" con quello del PDF', () => {
    const { dati, id } = fai(base(), {
      azione: 'registra',
      movimento: { ...acquisto, pdf: ['Acquisto a.pdf', 'Acquisto b.pdf'], rifOrdine: '123', esecuzione: '2026-10-09', dalPdf: { quantita: 10, commissioni: 4 } },
    })
    expect(id).toBe('op-123')
    const o = dati.operazioni!.find((x) => x.id === id)!
    expect(o).toMatchObject({ fonte: 'Acquisto a.pdf + Acquisto b.pdf', rifOrdine: '123', esecuzione: '2026-10-09', quando: QUANDO, prima: { commissioni: 4 } })
  })

  it('non si vendono più quote di quelle che si hanno', () => {
    const vendita: NuovaOperazione = { ...acquisto, tipo: 'vendita', quantita: 101, totale: 1207 }
    expect(controllaModifica(base(), { azione: 'registra', movimento: vendita })).toEqual({
      ok: false,
      perche: 'il 12/10/2026 avevi solo 100 quote di MOND: non puoi venderne 101',
    })
    expect(controllaModifica(base(), { azione: 'registra', movimento: { ...vendita, quantita: 100, totale: 1195 } }).ok).toBe(true)
    // Prima del primo acquisto non c'è niente da vendere.
    expect(controllaModifica(base(), { azione: 'registra', movimento: { ...vendita, quantita: 1, totale: 7, data: '2024-01-02' } })).toEqual({
      ok: false,
      perche: 'il 02/01/2024 non avevi quote di MOND: non puoi venderne 1',
    })
    expect(() => fai(base(), { azione: 'registra', movimento: vendita })).toThrow(/solo 100 quote/)
  })

  it('i numeri devono essere sensati', () => {
    const prova = (m: Partial<NuovaOperazione>) => controllaModifica(base(), { azione: 'registra', movimento: { ...acquisto, ...m } })
    expect(prova({ titolo: '' })).toEqual({ ok: false, perche: 'scegli il titolo' })
    expect(prova({ data: '2026-02-30' }).ok).toBe(false)
    expect(prova({ quantita: 0 }).ok).toBe(false)
    expect(prova({ cambio: 0.9 })).toEqual({ ok: false, perche: 'il titolo è in euro: il cambio è 1' })
    expect(prova({ commissioni: -1 }).ok).toBe(false)
    const div = (lordo: number, imposte: number, data = '2026-08-31') =>
      controllaModifica(base(), { azione: 'registra', movimento: { tipo: 'dividendo', titolo: MOND, data, lordo, imposte } })
    expect(div(10, 11)).toEqual({ ok: false, perche: 'le imposte non possono essere più del lordo' })
    expect(div(10, 1, '2024-01-01')).toEqual({ ok: false, perche: 'il 01/01/2024 non avevi quote di MOND' })
  })
})

describe('correggere a mano, tornare a com’era, togliere', () => {
  it('registra, correggi, torna e togli: il file torna identico a com’era', () => {
    const partenza = base()
    const testoPrima = comeTesto(partenza)
    const r = fai(partenza, { azione: 'registra', movimento: acquisto })
    const c = fai(r.dati, { azione: 'correggi', id: r.id, campi: { quantita: 11, totale: 137 } })
    const o = c.dati.operazioni!.find((x) => x.id === r.id)!
    expect(o).toMatchObject({ quantita: 11, totale: 137, quando: QUANDO, prima: { quantita: 10, totale: 125 } })
    // "quando" e "prima" vanno in fondo: i campi di prima restano nel loro ordine.
    expect(Object.keys(o).slice(-2)).toEqual(['quando', 'prima'])
    expect(controllaFile(comeTesto(c.dati)).ok).toBe(true)

    const t = fai(c.dati, { azione: 'torna', id: r.id })
    expect(comeTesto(t.dati)).toBe(comeTesto(r.dati))
    const via = fai(c.dati, { azione: 'togli', id: r.id })
    expect(comeTesto(via.dati)).toBe(testoPrima)
  })

  it('correggere due volte: "prima" resta il valore di partenza; tornare al valore di partenza toglie il segno', () => {
    const d = base()
    const uno = fai(d, { azione: 'correggi', id: 'op-1', campi: { prezzo: 10.5 } }).dati
    const due = fai(uno, { azione: 'correggi', id: 'op-1', campi: { prezzo: 10.6, commissioni: 6 } }).dati
    expect(due.operazioni![0]).toMatchObject({ prezzo: 10.6, commissioni: 6, prima: { prezzo: 10, commissioni: 5 } })
    const tre = fai(due, { azione: 'correggi', id: 'op-1', campi: { prezzo: 10 } }).dati
    expect(tre.operazioni![0].prima).toEqual({ commissioni: 5 })
    const quattro = fai(tre, { azione: 'correggi', id: 'op-1', campi: { commissioni: 5 } }).dati
    expect(comeTesto(quattro)).toBe(comeTesto(d))
  })

  it('il dividendo corretto rifà il netto e lo rimette tornando a com’era', () => {
    const d = base()
    const c = fai(d, { azione: 'correggi', id: 'div-1', campi: { lordo: 21 } }).dati
    expect(c.dividendi![0]).toMatchObject({ lordo: 21, imposte: 2.5, netto: 18.5, prima: { lordo: 20, netto: 17.5 } })
    expect(controllaFile(comeTesto(c)).ok).toBe(true)
    expect(comeTesto(fai(c, { azione: 'torna', id: 'div-1' }).dati)).toBe(comeTesto(d))
    // Cambiare solo la data non tocca il netto.
    const data = fai(d, { azione: 'correggi', id: 'div-1', campi: { data: '2025-03-03' } }).dati
    expect(data.dividendi![0]).toMatchObject({ data: '2025-03-03', netto: 17.5, prima: { data: '2025-03-01' } })
  })

  it('non si corregge o si toglie un acquisto se poi una vendita resta senza quote', () => {
    const d = base()
    expect(controllaModifica(d, { azione: 'togli', id: 'op-3' })).toEqual({
      ok: false,
      perche: 'il 15/09/2025 non avevi quote di Obbligazione Inventata 2027: non puoi venderne 1.000',
    })
    expect(controllaModifica(d, { azione: 'correggi', id: 'op-3', campi: { quantita: 900 } }).ok).toBe(false)
    expect(controllaModifica(d, { azione: 'correggi', id: 'op-4', campi: { data: '2024-02-01' } }).ok).toBe(false)
    expect(controllaModifica(d, { azione: 'togli', id: 'op-4' }).ok).toBe(true)
    expect(controllaModifica(d, { azione: 'togli', id: 'div-1' }).ok).toBe(true)
  })

  it('i rifiuti dicono perché', () => {
    const d = base()
    expect(controllaModifica(d, { azione: 'torna', id: 'op-1' })).toEqual({ ok: false, perche: 'l’acquisto di MOND del 12/02/2024 non è stato corretto a mano' })
    expect(controllaModifica(d, { azione: 'correggi', id: 'op-1', campi: { prezzo: 10 } })).toEqual({ ok: false, perche: 'non hai cambiato niente' })
    expect(controllaModifica(d, { azione: 'correggi', id: 'div-1', campi: { imposte: 30 } })).toEqual({ ok: false, perche: 'le imposte non possono essere più del lordo' })
    expect(controllaModifica(d, { azione: 'togli', id: 'non-c-e' })).toEqual({ ok: false, perche: 'nel file non c’è più questo movimento' })
    expect(controllaModifica(d, { azione: 'correggi', id: 'op-1', campi: { valuta: 'USD' } as never }).ok).toBe(false)
  })

  it('il perché della copia, senza "/" nel nome del file', () => {
    const d = base()
    expect(percheDellaCopia(d, { azione: 'registra', movimento: acquisto })).toBe('prima di registrare l’acquisto di MOND del 12-10-2026')
    expect(percheDellaCopia(d, { azione: 'correggi', id: 'op-4', campi: {} })).toBe(
      'prima di correggere a mano la vendita di Obbligazione Inventata 2027 del 15-09-2025',
    )
    expect(percheDellaCopia(d, { azione: 'torna', id: 'div-1' })).toBe('prima di rimettere com’era la cedola di Obbligazione Inventata 2027 del 01-03-2025')
    expect(percheDellaCopia(d, { azione: 'togli', id: 'op-1' })).toBe('prima di togliere l’acquisto di MOND del 12-02-2024')
  })

  it('le quote di un giorno contano gli acquisti e le vendite fino a quel giorno', () => {
    const d = base()
    expect(quoteAlGiorno(d, OBBL, '2025-09-14')).toBe(1000)
    expect(quoteAlGiorno(d, OBBL, '2025-09-15')).toBe(0)
    expect(quoteAlGiorno(d, MOND, '2024-02-11')).toBe(0)
  })
})

describe('il controllo del file con le correzioni dei movimenti', () => {
  it('rifiuta un "prima" fatto male o senza "quando"', () => {
    const d = base()
    const conPrima = (prima: unknown, quando?: string) =>
      controllaFile(comeTesto({ ...d, operazioni: d.operazioni!.map((o, i) => (i === 0 ? { ...o, ...(quando ? { quando } : {}), prima } : o)) } as FileDati))
    expect(conPrima({ prezzo: 9 }, QUANDO).ok).toBe(true)
    expect(conPrima({ prezzo: '9' }, QUANDO).ok).toBe(false)
    expect(conPrima({ valuta: 'USD' }, QUANDO).ok).toBe(false)
    expect(conPrima({}, QUANDO).ok).toBe(false)
    const senzaQuando = conPrima({ prezzo: 9 })
    expect(senzaQuando.ok).toBe(false)
    if (!senzaQuando.ok) expect(senzaQuando.problema.spiegazione).toContain('manca "quando"')
  })
})
