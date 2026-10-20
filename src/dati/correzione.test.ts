// Le prove della correzione a mano di un prezzo (ticket 8), sul portafoglio inventato.
import { describe, expect, it } from 'vitest'
import { spiegazioneDelPrezzo } from '../conti/prezzo-a-mano.ts'
import { contiDeiTitoli } from '../conti/titoli.ts'
import { schedaDelTitolo } from '../conti/scheda.ts'
import { FONTE } from './aggiorna/fonti.ts'
import { aVersione3, scriviMese } from './aggiorna/versione3.ts'
import { controllaFile } from './controllo.ts'
import { applicaCorrezione, controllaCorrezione, eCorrezione, percheDellaCopia, trovaPrezzo, type Correzione } from './correzione.ts'
import { comeTesto, portafoglioInventato } from './portafoglio-inventato.ts'
import type { FileDati } from './tipi.ts'

const MOND = 'ZZ0000000001-MIL'
const TECN = 'ZZ0000000002-LON'
const SETTEMBRE = '2026-09-30'
const ORA = '2026-10-19T18:00:00.000Z'
const DOPO = '2026-10-20T09:00:00.000Z'

/** Il portafoglio inventato com'è dopo un aggiornamento di ottobre dalle borse: versione 3, con seduta. */
function conOttobre(): FileDati {
  return scriviMese(
    aVersione3(portafoglioInventato()),
    {
      mese: '2026-10',
      prezzi: [
        {
          titolo: MOND,
          prezzo: 13.1,
          seduta: '2026-10-30',
          fonte: FONTE.euronextMilano,
          nota: 'Borsa Italiana non ha risposto',
          controllo: { prezzo: 13.12, seduta: '2026-10-30' },
        },
        { titolo: TECN, prezzo: 54.2, seduta: '2026-10-30', fonte: FONTE.lse },
      ],
      cambi: [{ valuta: 'GBP', cambio: 0.8691, seduta: '2026-10-30', fonte: 'BCE' }],
    },
    '2026-11-03T17:00:00.000Z',
  )
}
const correggi = (titolo: string, data: string, prezzo: number): Correzione => ({ tipo: 'correggi', titolo, data, prezzo })
const torna = (titolo: string, data: string): Correzione => ({ tipo: 'torna', titolo, data })

describe('correggere a mano un prezzo', () => {
  it('il prezzo diventa "a mano", con la data e il prezzo di prima (fonte, seduta e nota comprese)', () => {
    const dati = conOttobre()
    const nuovo = applicaCorrezione(dati, correggi(MOND, '2026-10-31', 13.01), ORA)
    expect(trovaPrezzo(nuovo, { titolo: MOND, data: '2026-10-31' })).toEqual({
      titolo: MOND,
      data: '2026-10-31',
      prezzo: 13.01,
      valuta: 'EUR',
      fonte: 'a mano',
      quando: ORA,
      prima: { prezzo: 13.1, fonte: 'Euronext Milano', seduta: '2026-10-30', nota: 'Borsa Italiana non ha risposto' },
      // Il controllo di investing.com resta, per confrontarlo con il prezzo scritto a mano.
      controllo: { prezzo: 13.12, seduta: '2026-10-30' },
    })
    // Gli altri prezzi, le operazioni e i cambi non si toccano; l'oggetto ricevuto nemmeno.
    expect(nuovo.prezzi!.filter((p) => !(p.titolo === MOND && p.data === '2026-10-31'))).toEqual(
      dati.prezzi!.filter((p) => !(p.titolo === MOND && p.data === '2026-10-31')),
    )
    expect(nuovo.operazioni).toEqual(dati.operazioni)
    expect(nuovo.cambi).toEqual(dati.cambi)
    expect(trovaPrezzo(dati, { titolo: MOND, data: '2026-10-31' })!.prezzo).toBe(13.1)
  })

  it('un titolo in valuta tiene il suo cambio', () => {
    const nuovo = applicaCorrezione(conOttobre(), correggi(TECN, '2026-10-31', 45.2), ORA)
    const p = trovaPrezzo(nuovo, { titolo: TECN, data: '2026-10-31' })!
    expect(p).toMatchObject({ prezzo: 45.2, valuta: 'GBP', cambio: 0.8691, fonte: 'a mano', prima: { prezzo: 54.2, fonte: 'London Stock Exchange' } })
  })

  it('il file corretto si legge come all’apertura', () => {
    const nuovo = applicaCorrezione(conOttobre(), correggi(MOND, SETTEMBRE, 12.57), ORA)
    expect(controllaFile(comeTesto(nuovo)).ok).toBe(true)
  })

  it('torna al prezzo di prima: il prezzo è di nuovo com’era, anche nel testo del file', () => {
    const dati = conOttobre()
    const corretto = applicaCorrezione(dati, correggi(MOND, '2026-10-31', 13.01), ORA)
    const tornato = applicaCorrezione(corretto, torna(MOND, '2026-10-31'), DOPO)
    expect(comeTesto(tornato)).toBe(comeTesto(dati))
  })

  it('corretto due volte, "prima" resta quello di partenza', () => {
    const dati = conOttobre()
    const una = applicaCorrezione(dati, correggi(MOND, '2026-10-31', 1.31), ORA)
    const due = applicaCorrezione(una, correggi(MOND, '2026-10-31', 13.01), DOPO)
    expect(trovaPrezzo(due, { titolo: MOND, data: '2026-10-31' })).toMatchObject({ prezzo: 13.01, quando: DOPO, prima: { prezzo: 13.1 } })
    expect(comeTesto(applicaCorrezione(due, torna(MOND, '2026-10-31'), DOPO))).toBe(comeTesto(dati))
  })

  it('un prezzo scritto a mano nell’aggiornamento, poi corretto, torna a quello scritto a mano', () => {
    const v3 = aVersione3(portafoglioInventato())
    const aMano = scriviMese(
      v3,
      {
        mese: '2026-10',
        prezzi: [
          { titolo: MOND, prezzo: 13, fonte: FONTE.aMano },
          { titolo: TECN, prezzo: 54.2, seduta: '2026-10-30', fonte: FONTE.lse },
        ],
        cambi: [{ valuta: 'GBP', cambio: 0.8691, seduta: '2026-10-30', fonte: 'BCE' }],
      },
      ORA,
    )
    const corretto = applicaCorrezione(aMano, correggi(MOND, '2026-10-31', 13.2), DOPO)
    expect(trovaPrezzo(corretto, { titolo: MOND, data: '2026-10-31' })!.prima).toEqual({ prezzo: 13, fonte: 'a mano', quando: ORA })
    expect(comeTesto(applicaCorrezione(corretto, torna(MOND, '2026-10-31'), DOPO))).toBe(comeTesto(aMano))
  })

  it('dal file alla versione 2: il prezzo del file Excel tiene la sua nota nel prezzo di prima', () => {
    const v3 = aVersione3(portafoglioInventato())
    const p = trovaPrezzo(applicaCorrezione(v3, correggi(MOND, SETTEMBRE, 12.57), ORA), { titolo: MOND, data: SETTEMBRE })!
    expect(p.prima).toEqual({ prezzo: 12.75, fonte: 'dal tuo file Excel', nota: 'inventato' })
  })

  it('dice di no quando non si può', () => {
    const dati = conOttobre()
    expect(controllaCorrezione(dati, correggi(MOND, '2026-07-31', 12))).toEqual({ ok: false, perche: 'nel file non c’è il prezzo di MOND a fine luglio 2026' })
    expect(controllaCorrezione(dati, correggi(MOND, SETTEMBRE, 0)).ok).toBe(false)
    expect(controllaCorrezione(dati, correggi(MOND, SETTEMBRE, Number.NaN)).ok).toBe(false)
    expect(controllaCorrezione(dati, correggi(MOND, SETTEMBRE, 12.75))).toEqual({ ok: false, perche: 'il prezzo nuovo è uguale a quello presente' })
    expect(controllaCorrezione(dati, torna(MOND, SETTEMBRE)).ok).toBe(false)
    expect(() => applicaCorrezione(dati, torna(MOND, SETTEMBRE), ORA)).toThrow('non ha un prezzo precedente')
  })

  it('il processo principale accetta solo richieste con la forma giusta', () => {
    expect(eCorrezione(correggi(MOND, SETTEMBRE, 12))).toBe(true)
    expect(eCorrezione(torna(MOND, SETTEMBRE))).toBe(true)
    expect(eCorrezione({ tipo: 'correggi', titolo: MOND, data: SETTEMBRE, prezzo: '12' })).toBe(false)
    expect(eCorrezione({ tipo: 'cancella', titolo: MOND, data: SETTEMBRE })).toBe(false)
    expect(eCorrezione({ tipo: 'torna', titolo: MOND, data: 'settembre' })).toBe(false)
    expect(eCorrezione(null)).toBe(false)
  })

  it('il perché della copia dice cosa si è corretto', () => {
    const dati = conOttobre()
    expect(percheDellaCopia(dati, correggi(MOND, SETTEMBRE, 12))).toBe('prima di correggere a mano MOND di settembre 2026')
    expect(percheDellaCopia(dati, torna(TECN, '2026-10-31'))).toBe('prima di tornare al prezzo di prima di TECN di ottobre 2026')
  })
})

describe('il prezzo corretto nei conti e nel pannello', () => {
  const dati = applicaCorrezione(conOttobre(), correggi(MOND, '2026-10-31', 14), ORA)
  const conti = contiDeiTitoli(dati)
  const mond = conti.titoli.find((t) => t.id === MOND)!

  it('i conti usano il prezzo corretto', () => {
    // 100 quote × 14 € (era 13,10 €).
    expect(mond.valore.n).toBeCloseTo(1400, 6)
    expect(mond.ultimoPrezzo).toMatchObject({ prezzo: 14, fonte: 'a mano' })
  })

  it('ogni numero fatto con un solo prezzo di fine mese porta il riferimento per correggerlo', () => {
    expect(mond.prezzo.perche.correggi).toEqual({ titolo: MOND, data: '2026-10-31' })
    expect(mond.valore.perche.correggi).toEqual({ titolo: MOND, data: '2026-10-31' })
    expect(mond.mesi.find((m) => m.mese === SETTEMBRE)!.valore.perche.correggi).toEqual({ titolo: MOND, data: SETTEMBRE })
    // Il guadagno e i totali vengono da più numeri: niente correzione.
    expect(mond.guadagno.perche.correggi).toBeUndefined()
    expect(conti.totaliDelMese.get('2026-10-31')!.valore.perche.correggi).toBeUndefined()
  })

  it('un mese senza il suo prezzo (vale quello di prima) non si corregge da lì', () => {
    const senzaOttobre: FileDati = { ...dati, prezzi: dati.prezzi!.filter((p) => !(p.titolo === TECN && p.data === '2026-10-31')) }
    const tecn = contiDeiTitoli(senzaOttobre).titoli.find((t) => t.id === TECN)!
    const ottobre = tecn.mesi.find((m) => m.mese === '2026-10-31')!
    expect(ottobre.prezzo!.data).toBe(SETTEMBRE)
    expect(ottobre.valore.perche.correggi).toBeUndefined()
  })

  it('nella scheda il prezzo porta il chip e quello di prima barrato; il pannello si rifà sui dati nuovi', () => {
    const riga = schedaDelTitolo(dati, mond).mesi[0]
    expect(riga.aMano).toBe(true)
    expect(riga.prima).toBe(13.1)
    const s = spiegazioneDelPrezzo(dati, { titolo: MOND, data: '2026-10-31' })!
    expect(s.titolo).toBe('Prezzo di MOND a fine ottobre 2026')
    expect(s.grande).toEqual({ tipo: 'prezzo', n: 14, valuta: 'EUR' })
    expect(s.correggi).toEqual({ titolo: MOND, data: '2026-10-31' })
    expect(spiegazioneDelPrezzo(dati, { titolo: MOND, data: '2020-01-31' })).toBeNull()
  })
})
