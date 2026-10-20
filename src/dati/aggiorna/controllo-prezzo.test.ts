// Le prove del controllo di investing.com e dei codici delle riserve, con il portafoglio inventato.
import { describe, expect, it } from 'vitest'
import { contiDeiTitoli } from '../../conti/titoli.ts'
import { controllaFile } from '../controllo.ts'
import { comeTesto, portafoglioInventato } from '../portafoglio-inventato.ts'
import {
  confronta,
  confrontoDellaRiga,
  contaControlli,
  controlloInParole,
  controlloValido,
  stessoPrezzo,
} from './controllo-prezzo.ts'
import { FONTE, ORDINE_FONTI } from './fonti.ts'
import { conTitolo, creaAggiornamento, daSalvare, richiestaDi, statoDaCambio, statoDaEsito, type Aggiornamento } from './lista.ts'
import { aVersioneAttuale, controllaMese, scriviMese } from './versione3.ts'

const MONDO = 'ZZ0000000001-MIL'
const TECN = 'ZZ0000000002-LON'

describe('l’ordine delle fonti', () => {
  it('prima la borsa, poi investing.com, poi Yahoo, per ogni borsa', () => {
    expect(ORDINE_FONTI.MIL).toEqual(['Borsa Italiana', 'Euronext Milano', 'investing.com (riserva)', 'Yahoo (seconda riserva)'])
    for (const ordine of Object.values(ORDINE_FONTI)) expect(ordine.slice(-2)).toEqual([FONTE.investing, FONTE.yahoo])
  })
})

describe('uguale o diverso', () => {
  it('uguali se lo sono arrotondati come il meno preciso, ma almeno al centesimo', () => {
    expect(stessoPrezzo(13.1, 13.1)).toBe(true)
    expect(stessoPrezzo(31.42, 31.418)).toBe(true) // il file Excel arrotondava
    expect(stessoPrezzo(72.318, 72.32)).toBe(true)
    expect(stessoPrezzo(437, 437.4)).toBe(false)
    expect(stessoPrezzo(13.1, 13.18)).toBe(false)
    expect(stessoPrezzo(6.137, 6.138)).toBe(false)
  })

  it('il confronto: uguale, diverso di quanto, o perché non si è fatto', () => {
    expect(confronta(13.1, undefined)).toBeNull()
    expect(confronta(13.1, { prezzo: 13.1, seduta: '2026-10-30' })).toEqual({ tipo: 'uguale', controllo: 13.1 })
    const d = confronta(50, { prezzo: 50.3, seduta: '2026-10-30', nota: 'prezzo di Xetra, altra borsa' })
    expect(d).toMatchObject({ tipo: 'diverso', controllo: 50.3, nota: 'prezzo di Xetra, altra borsa' })
    expect(d?.tipo === 'diverso' && d.differenza).toBeCloseTo(0.6, 6)
    expect(confronta(13.1, { perche: 'investing.com non ha risposto' })).toEqual({ tipo: 'non-fatto', perche: 'investing.com non ha risposto' })
  })

  it('in una frase, per il pannello', () => {
    expect(controlloInParole(13.1, 'EUR', { prezzo: 13.1, seduta: '2026-10-30' })).toBe('Controllo con investing.com: stesso prezzo.')
    expect(controlloInParole(50, 'EUR', { prezzo: 50.3, seduta: '2026-10-30' })).toBe(
      'Controllo con investing.com: 50,30 €, differenza di +0,6%. Di norma vale il prezzo della borsa.',
    )
    expect(controlloInParole(13.1, 'EUR', { perche: 'il prezzo viene già da investing.com' })).toBe(
      'Controllo con investing.com non eseguito: il prezzo viene già da investing.com.',
    )
    expect(controlloInParole(13.1, 'EUR', undefined)).toBeNull()
  })

  it('il conto per il riquadro "<Mese> è salvato"', () => {
    const c = contaControlli([
      { titolo: 'MOND', confronto: { tipo: 'uguale', controllo: 1 } },
      { titolo: 'TECN', confronto: { tipo: 'diverso', controllo: 2, differenza: 0.6 } },
      { titolo: 'OBBL', confronto: { tipo: 'non-fatto', perche: 'x' } },
      { titolo: 'NUOV', confronto: { tipo: 'non-fatto', perche: 'investing.com non si può chiedere: nel file manca il codice investing.com del titolo' } },
      { titolo: 'ALTRO', confronto: null },
    ])
    expect(c).toEqual({ uguali: 1, diversi: [{ titolo: 'TECN', differenza: 0.6 }], nonFatti: 2, senzaCodice: 1 })
  })

  it('il controllo mandato dalla schermata ha la forma giusta', () => {
    expect(controlloValido({ prezzo: 13.1, seduta: '2026-10-30' })).toBe(true)
    expect(controlloValido({ perche: 'investing.com non ha risposto' })).toBe(true)
    expect(controlloValido({ prezzo: -1, seduta: '2026-10-30' })).toBe(false)
    expect(controlloValido({ prezzo: 13.1 })).toBe(false)
    expect(controlloValido('uguale')).toBe(false)
  })
})

describe('la lista di Aggiorna con le riserve e il controllo', () => {
  const dati = portafoglioInventato()
  const arrivato = (a: Aggiornamento, id: string, prezzo: number, controllo?: { prezzo: number; seduta: string } | { perche: string }) =>
    conTitolo(a, id, (r) => ({
      ...r,
      stato: statoDaEsito({ ok: true, prezzo, seduta: '2026-10-30', fonte: FONTE.borsaItaliana, tentativi: [], ...(controllo ? { controllo } : {}) }),
    }))

  it('dal PC escono i codici delle riserve scritti nel file, mai le quote', () => {
    const a = creaAggiornamento(dati, '2026-10')
    const r = a.titoli.find((x) => x.id === MONDO)!
    expect(richiestaDi(r)).toEqual({
      isin: 'ZZ0000000001',
      borsa: 'MIL',
      simbolo: 'MOND',
      valuta: 'EUR',
      codiceInvesting: 900001,
      codiceYahoo: 'MOND.MI',
    })
  })

  it('il controllo della riga: sul prezzo che si salverebbe; niente per il prezzo a mano', () => {
    let a = creaAggiornamento(dati, '2026-10')
    a = arrivato(a, MONDO, 13.1, { prezzo: 13.18, seduta: '2026-10-30' })
    const r = a.titoli.find((x) => x.id === MONDO)!
    expect(confrontoDellaRiga(r)).toMatchObject({ tipo: 'diverso', controllo: 13.18 })
    expect(confrontoDellaRiga({ ...r, aMano: 13.18 })).toBeNull()
    // "Rifai": tenuto il prezzo di prima (dal file Excel, arrotondato), si confronta quello.
    expect(confrontoDellaRiga({ ...r, tieni: true, prima: { prezzo: 13.18, fonte: FONTE.fileExcel } })).toMatchObject({ tipo: 'uguale' })
  })

  it('"Salva" manda il controllo, e nel file resta accanto al prezzo', () => {
    let a = creaAggiornamento(dati, '2026-10')
    a = arrivato(a, MONDO, 13.1, { prezzo: 13.1, seduta: '2026-10-30' })
    a = arrivato(a, TECN, 54.135, { perche: 'investing.com non ha risposto' })
    a = { ...a, cambi: a.cambi.map((c) => ({ ...c, stato: statoDaCambio({ ok: true, cambio: 0.8691, seduta: '2026-10-30', fonte: 'BCE' }) })) }
    const mese = daSalvare(a)
    expect(mese.prezzi.find((p) => p.titolo === MONDO)).toMatchObject({ controllo: { prezzo: 13.1, seduta: '2026-10-30' } })
    const v3 = aVersioneAttuale(dati)
    expect(controllaMese(v3, mese)).toEqual({ ok: true })
    const dopo = scriviMese(v3, mese, '2026-11-03T10:00:00.000Z')
    const scritto = dopo.prezzi!.find((p) => p.titolo === TECN && p.data === '2026-10-31')!
    expect(scritto.controllo).toEqual({ perche: 'investing.com non ha risposto' })
    // Il file si rilegge con il controllo dell'apertura.
    expect(controllaFile(comeTesto(dopo)).ok).toBe(true)
    // Un controllo con una forma sbagliata non si scrive.
    const rotto = { ...mese, prezzi: mese.prezzi.map((p) => ({ ...p, controllo: { prezzo: 'tanto' } })) } as unknown as typeof mese
    expect(controllaMese(v3, rotto)).toMatchObject({ ok: false })
  })

  it('il pannello "Da dove viene" del valore dice il controllo e il perché della riserva', () => {
    const v3 = aVersioneAttuale(dati)
    const prezzi = (v3.prezzi ?? []).map((p) =>
      p.titolo === MONDO && p.data === '2026-09-30'
        ? {
            ...p,
            fonte: FONTE.investing,
            seduta: '2026-09-30',
            nota: 'Borsa Italiana non ha risposto (errore 503)',
            controllo: { perche: 'il prezzo viene già da investing.com' },
          }
        : p,
    )
    const conti = contiDeiTitoli({ ...v3, prezzi })
    const mondo = conti.titoli.find((t) => t.id === MONDO)!
    expect(mondo.valore.perche.note).toEqual(
      expect.arrayContaining([
        expect.stringContaining('investing.com (riserva)'),
        'Borsa Italiana non ha risposto (errore 503).',
        'Controllo con investing.com non eseguito: il prezzo viene già da investing.com.',
      ]),
    )
  })
})

describe('il file dei dati con i codici delle riserve', () => {
  const dati = aVersioneAttuale(portafoglioInventato())

  it('i codici si leggono; un codice sbagliato si dice in parole', () => {
    expect(controllaFile(comeTesto(dati)).ok).toBe(true)
    const conBorsa = { ...dati, titoli: dati.titoli!.map((t, i) => (i === 0 ? { ...t, borsaRiserve: 'XET' as const } : t)) }
    expect(controllaFile(comeTesto(conBorsa)).ok).toBe(true)
    const sbagliato = JSON.parse(comeTesto(dati))
    sbagliato.titoli[0].codiceInvesting = '900001'
    const esito = controllaFile(JSON.stringify(sbagliato, null, 2))
    expect(esito.ok).toBe(false)
    if (!esito.ok) expect(esito.problema.spiegazione).toContain('"codiceInvesting" dovrebbe essere un numero')
  })

  it('un controllo rotto nel file si dice in parole', () => {
    const rotto = JSON.parse(comeTesto(dati))
    rotto.prezzi[0].controllo = { prezzo: 12 }
    const esito = controllaFile(JSON.stringify(rotto, null, 2))
    expect(esito.ok).toBe(false)
    if (!esito.ok) expect(esito.problema.spiegazione).toContain('"controllo" dovrebbe avere "prezzo" e "seduta", oppure "perche"')
  })
})
