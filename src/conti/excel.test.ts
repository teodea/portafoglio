// Le prove dei sette fogli di "Scarica in Excel" (ticket 14), sul portafoglio inventato:
// i numeri sono quelli dei conti delle pagine, messi in righe come nell'esempio della bozza 27.
import { describe, expect, it } from 'vitest'
import { FONTE } from '../dati/aggiorna/fonti.ts'
import { aVersione3, scriviMese } from '../dati/aggiorna/versione3.ts'
import { applicaCorrezione } from '../dati/correzione.ts'
import { applicaCorrezioneDato } from '../dati/correzione-dati.ts'
import { eLibroExcel, type Cella, type FoglioLeggimi, type FoglioTabella, type LibroExcel } from '../dati/excel.ts'
import { portafoglioInventato } from '../dati/portafoglio-inventato.ts'
import type { FileDati } from '../dati/tipi.ts'
import { conRiferimentiInventati } from '../pagine/dati/ponte-finto-dati.ts'
import { libroExcel, NOMI_FOGLI } from './excel.ts'
import { contiDelPortafoglio } from './portafoglio.ts'
import { contiDeiTitoli, plusMinus } from './titoli.ts'

const MOND = 'ZZ0000000001-MIL'
const TECN = 'ZZ0000000002-LON'
const OGGI = '2026-10-19'

function tabella(l: LibroExcel, nome: string): FoglioTabella {
  const f = l.fogli.find((x) => x.nome === nome)
  if (!f || f.tipo !== 'tabella') throw new Error(`manca il foglio ${nome}`)
  return f
}
/** La colonna "titolo" di un foglio, riga per riga. */
function colonna(f: FoglioTabella, titolo: string): Cella[] {
  const i = f.colonne.findIndex((c) => c.titolo === titolo)
  if (i < 0) throw new Error(`manca la colonna ${titolo}`)
  return f.righe.map((r) => r[i])
}
const riga = (f: FoglioTabella, prima: string) => f.righe.find((r) => r[0] === prima)!

/** Ottobre arrivato da internet: MOND da Euronext Milano con il controllo diverso, TECN da investing.com; poi MOND corretto a mano. */
function conOttobre(): FileDati {
  const ottobre = scriviMese(
    aVersione3(conRiferimentiInventati(portafoglioInventato())),
    {
      mese: '2026-10',
      prezzi: [
        { titolo: MOND, prezzo: 13.1, seduta: '2026-10-30', fonte: FONTE.euronextMilano, nota: 'Borsa Italiana non ha risposto', controllo: { prezzo: 13.18, seduta: '2026-10-30' } },
        { titolo: TECN, prezzo: 53.2, seduta: '2026-10-30', fonte: FONTE.investing, nota: 'London Stock Exchange non ha risposto', controllo: { perche: 'il prezzo viene già da investing.com' } },
      ],
      cambi: [{ valuta: 'GBP', cambio: 0.8712, seduta: '2026-10-30', fonte: 'BCE' }],
    },
    '2026-11-03T18:00:00.000Z',
  )
  return applicaCorrezione(ottobre, { tipo: 'correggi', titolo: MOND, data: '2026-10-31', prezzo: 13.12 }, '2026-11-04T10:00:00.000Z')
}

describe('il libro', () => {
  const libro = libroExcel(portafoglioInventato(), OGGI)

  it('ha i sette fogli decisi nella mappa, in ordine, e passa il controllo del processo principale', () => {
    expect(libro.fogli.map((f) => f.nome)).toEqual([...NOMI_FOGLI])
    expect(libro.oggi).toBe(OGGI)
    expect(eLibroExcel(libro)).toBe(true)
    // Passa intero dal ponte: niente funzioni, niente oggetti strani.
    expect(JSON.parse(JSON.stringify(libro))).toEqual(libro)
  })

  it('in ogni tabella ogni riga ha una cella per colonna, e i numeri sono numeri', () => {
    for (const f of libro.fogli) {
      if (f.tipo !== 'tabella') continue
      for (const r of f.righe) expect(r).toHaveLength(f.colonne.length)
      f.colonne.forEach((c, i) => {
        if (!c.formato || c.formato === 'data') return
        for (const r of f.righe) expect(r[i] === null || typeof r[i] === 'number', `${f.nome}, ${c.titolo}: ${String(r[i])}`).toBe(true)
      })
    }
  })

  it('nessuna formula: nessun testo comincia con "="', () => {
    const testi = libro.fogli.flatMap((f) => (f.tipo === 'tabella' ? f.righe.flat() : f.righe.flatMap((r) => r.celle)))
    expect(testi.filter((c) => typeof c === 'string' && c.startsWith('='))).toEqual([])
  })
})

describe('Leggimi', () => {
  it('la data, fino a quando ci sono i prezzi e i numeri del portafoglio, gli stessi della pagina Portafoglio', () => {
    const dati = portafoglioInventato()
    const f = libroExcel(dati, OGGI).fogli[0] as FoglioLeggimi
    const conti = contiDelPortafoglio(dati)
    const testo = f.righe.map((r) => r.celle.join(' | '))
    expect(testo[0]).toBe('Portafoglio titoli: esportazione dei dati')
    expect(testo[1]).toBe('Esportato il 19/10/2026. Prezzi fino al 30/09/2026.')
    const numero = (etichetta: string) => f.righe.find((r) => r.celle[0] === etichetta)?.celle[1]
    expect(numero('Controvalore')).toBe(conti.valore.n)
    expect(numero('Capitale investito')).toBe(conti.investiti.n)
    expect(numero(plusMinus(conti.guadagno.n!))).toBe(conti.guadagno.n)
    expect(numero('Rendimento annualizzato')).toBe(conti.medioAnnuo.n)
    expect(numero('Rendimento da inizio anno (2026)')).toBe(conti.annoInCorso.n)
    expect(numero('Dividendi netti')).toBe(conti.dividendi.n)
    expect(f.righe.find((r) => r.celle[0] === 'Rendimento annualizzato')?.formato).toBe('percentuale')
    // Un rigo per foglio, con cosa c'è.
    for (const nome of NOMI_FOGLI.slice(1)) expect(f.righe.some((r) => r.celle[0] === nome)).toBe(true)
  })

  it('senza riferimenti dice che arrivano col primo aggiornamento; con i riferimenti no', () => {
    const senza = libroExcel(portafoglioInventato(), OGGI).fogli[0] as FoglioLeggimi
    const con = libroExcel(conRiferimentiInventati(portafoglioInventato()), OGGI).fogli[0] as FoglioLeggimi
    const riga = (f: FoglioLeggimi) => String(f.righe.find((r) => r.celle[0] === 'Inflazione e riferimenti')?.celle[1])
    expect(riga(senza)).toContain('i dati arrivano con il primo aggiornamento')
    expect(riga(con)).not.toContain('i dati arrivano con il primo aggiornamento')
  })

  it('un file vuoto si scarica lo stesso', () => {
    const vuoto: FileDati = { formato: 'portafoglio', versione: 2, creato: '2026-10-19T10:00:00.000Z', titoli: [], operazioni: [], dividendi: [], prezzi: [] }
    const l = libroExcel(vuoto, OGGI)
    expect(eLibroExcel(l)).toBe(true)
    expect((l.fogli[0] as FoglioLeggimi).righe[1].celle[0]).toBe('Esportato il 19/10/2026. Nel file non ci sono ancora prezzi di fine mese.')
  })
})

describe('Titoli', () => {
  it('un titolo per riga, anche i venduti, con i numeri dei conti dei titoli', () => {
    const dati = portafoglioInventato()
    const f = tabella(libroExcel(dati, OGGI), 'Titoli')
    const conti = contiDeiTitoli(dati)
    expect(f.righe).toHaveLength(conti.titoli.length)
    expect(colonna(f, 'Simbolo')).toEqual(conti.titoli.map((c) => c.nomeCorto))
    expect(colonna(f, 'Controvalore')).toEqual(conti.titoli.map((c) => c.valore.n))
    expect(colonna(f, 'Plus/minus')).toEqual(conti.titoli.map((c) => c.guadagno.n))
    expect(colonna(f, 'Rendimento')).toEqual(conti.titoli.map((c) => c.dallAcquisto.n))
    expect(colonna(f, 'Venduto')).toEqual(conti.titoli.map((c) => (c.stato === 'chiuso' ? 'sì' : '')))
    const tecn = riga(f, 'TECN')
    expect(tecn[f.colonne.findIndex((c) => c.titolo === 'Valuta')]).toBe('GBP')
    expect(typeof tecn[f.colonne.findIndex((c) => c.titolo === 'Cambio')]).toBe('number')
    expect(riga(f, 'MOND')[f.colonne.findIndex((c) => c.titolo === 'Cambio')]).toBeNull()
    expect(colonna(f, 'Primo acquisto').every((c) => c === null || (typeof c === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(c.data)))).toBe(true)
  })

  it('la fonte del prezzo come sotto il prezzo nelle pagine', () => {
    const f = tabella(libroExcel(conOttobre(), OGGI), 'Titoli')
    expect(riga(f, 'MOND')[f.colonne.findIndex((c) => c.titolo === 'Fonte del prezzo')]).toBe('manuale')
    expect(riga(f, 'TECN')[f.colonne.findIndex((c) => c.titolo === 'Fonte del prezzo')]).toBe('investing.com (riserva)')
  })
})

describe('Operazioni e Dividendi', () => {
  it('dal più vecchio; il totale è negativo per gli acquisti e positivo per le vendite', () => {
    const dati = portafoglioInventato()
    const f = tabella(libroExcel(dati, OGGI), 'Operazioni')
    expect(f.righe).toHaveLength(dati.operazioni!.length)
    const date = colonna(f, 'Data').map((c) => (c as { data: string }).data)
    expect(date).toEqual(date.slice().sort())
    const cosa = colonna(f, 'Tipo')
    const totali = colonna(f, 'Totale in euro') as number[]
    cosa.forEach((c, i) => expect(Math.sign(totali[i])).toBe(c === 'acquisto' ? -1 : 1))
    expect(colonna(f, 'Fonte').every((x) => typeof x === 'string' && x.length > 0)).toBe(true)
  })

  it('lordo, imposte e netto dei dividendi', () => {
    const dati = portafoglioInventato()
    const f = tabella(libroExcel(dati, OGGI), 'Dividendi')
    expect(f.righe).toHaveLength(dati.dividendi!.length)
    const lordo = colonna(f, 'Lordo') as number[]
    const imposte = colonna(f, 'Imposte') as number[]
    const netto = colonna(f, 'Netto') as number[]
    netto.forEach((n, i) => expect(n).toBeCloseTo(lordo[i] - imposte[i], 6))
  })
})

describe('Prezzi di fine mese', () => {
  it('un prezzo per riga, dal mese più vecchio, con quote e valore in euro dei conti', () => {
    const dati = portafoglioInventato()
    const f = tabella(libroExcel(dati, OGGI), 'Prezzi di fine mese')
    expect(f.righe).toHaveLength(dati.prezzi!.length)
    const date = colonna(f, 'Fine mese').map((c) => (c as { data: string }).data)
    expect(date).toEqual(date.slice().sort())
    const conti = contiDeiTitoli(dati)
    const mond = conti.titoli.find((c) => c.id === MOND)!
    const settembre = f.righe.find((r) => r[1] === 'MOND' && (r[0] as { data: string }).data === '2026-09-30')!
    const ultimo = mond.mesi.find((m) => m.mese === '2026-09-30')!
    expect(settembre[f.colonne.findIndex((c) => c.titolo === 'Quote')]).toBe(ultimo.quote)
    expect(settembre[f.colonne.findIndex((c) => c.titolo === 'Controvalore')]).toBe(ultimo.valore.n)
    expect(settembre[f.colonne.findIndex((c) => c.titolo === 'Fonte')]).toBe('file Excel iniziale')
  })

  it('la fonte, il perché, il controllo di investing.com e il prezzo a mano con quello di prima', () => {
    const f = tabella(libroExcel(conOttobre(), OGGI), 'Prezzi di fine mese')
    const ottobre = (s: string) => f.righe.find((r) => r[1] === s && (r[0] as { data: string }).data === '2026-10-31')!
    const cella = (r: Cella[], t: string) => r[f.colonne.findIndex((c) => c.titolo === t)]
    const mond = ottobre('MOND')
    expect(cella(mond, 'Prezzo')).toBe(13.12)
    expect(cella(mond, 'Fonte')).toBe('manuale')
    expect(cella(mond, 'Manuale')).toBe('sì')
    expect(cella(mond, 'Prezzo precedente')).toBe(13.1)
    const tecn = ottobre('TECN')
    expect(cella(tecn, 'Fonte')).toBe('investing.com (riserva)')
    expect(cella(tecn, 'Nota')).toBe('London Stock Exchange non ha risposto')
    expect(cella(tecn, 'Controllo investing.com')).toBe('non eseguito: il prezzo viene già da investing.com')
    expect(cella(tecn, 'Cambio')).toBe(0.8712)
  })

  it('il controllo diverso si dice con la differenza', () => {
    const dati = scriviMese(
      aVersione3(portafoglioInventato()),
      {
        mese: '2026-10',
        prezzi: [
          { titolo: MOND, prezzo: 13.1, seduta: '2026-10-30', fonte: FONTE.borsaItaliana, controllo: { prezzo: 13.18, seduta: '2026-10-30' } },
          { titolo: TECN, prezzo: 53.2, seduta: '2026-10-30', fonte: FONTE.lse, controllo: { prezzo: 53.2, seduta: '2026-10-30' } },
        ],
        cambi: [{ valuta: 'GBP', cambio: 0.8712, seduta: '2026-10-30', fonte: 'BCE' }],
      },
      '2026-11-03T18:00:00.000Z',
    )
    const f = tabella(libroExcel(dati, OGGI), 'Prezzi di fine mese')
    const controllo = (s: string) => f.righe.find((r) => r[1] === s && (r[0] as { data: string }).data === '2026-10-31')![f.colonne.findIndex((c) => c.titolo === 'Controllo investing.com')]
    expect(controllo('MOND')).toBe('differenza di +0,6%: investing.com 13,18')
    expect(controllo('TECN')).toBe('stesso prezzo')
  })
})

describe('Valore mese per mese', () => {
  it('un titolo per riga e un mese per colonna, con il totale e i soldi investiti della pagina Portafoglio', () => {
    const dati = portafoglioInventato()
    const f = tabella(libroExcel(dati, OGGI), 'Valore mese per mese')
    const conti = contiDelPortafoglio(dati)
    expect(f.colonne.slice(2).map((c) => c.data)).toEqual(conti.serie.map((s) => s.mese))
    expect(f.colonne.slice(2).every((c) => c.formato === 'euroTondo')).toBe(true)
    expect(f.righe).toHaveLength(conti.titoli.titoli.length + 2)
    expect(riga(f, 'Totale').slice(2)).toEqual(conti.serie.map((s) => s.valore.n))
    expect(riga(f, 'Capitale investito').slice(2)).toEqual(conti.serie.map((s) => s.investiti))
    expect(f.grassetto).toEqual([f.righe.length - 2, f.righe.length - 1])
    // La somma dei titoli fa il totale, mese per mese.
    conti.serie.forEach((s, j) => {
      const somma = f.righe.slice(0, -2).reduce((a, r) => a + ((r[j + 2] as number | null) ?? 0), 0)
      expect(somma).toBeCloseTo(s.valore.n ?? 0, 6)
    })
  })
})

describe('Inflazione e riferimenti', () => {
  it('un mese per riga dal più vecchio, con NIC e base, cambi e i sei riferimenti; vuoto dove manca', () => {
    const dati = conRiferimentiInventati(portafoglioInventato())
    const f = tabella(libroExcel(dati, OGGI), 'Inflazione e riferimenti')
    expect(f.colonne.map((c) => c.titolo)).toEqual([
      'Fine mese',
      'Inflazione NIC',
      'Base NIC',
      'Cambio GBP',
      'BTP 10 anni (EUR)',
      'FTSE MIB (EUR)',
      'Euro Stoxx 50 (EUR)',
      'Nasdaq-100 (USD)',
      'Dow Jones (USD)',
      'S&P 500 (USD)',
      'Inseriti manualmente',
    ])
    const date = colonna(f, 'Fine mese').map((c) => (c as { data: string }).data)
    expect(date).toEqual(date.slice().sort())
    const mese = (d: string) => f.righe.find((r) => (r[0] as { data: string }).data === d)!
    const cella = (r: Cella[], t: string) => r[f.colonne.findIndex((c) => c.titolo === t)]
    // Il NIC di settembre 2026 non è ancora uscito, il Nasdaq-100 di agosto 2026 manca: celle vuote.
    expect(cella(mese('2026-09-30'), 'Inflazione NIC')).toBeNull()
    expect(cella(mese('2026-08-31'), 'Nasdaq-100 (USD)')).toBeNull()
    expect(typeof cella(mese('2026-08-31'), 'Inflazione NIC')).toBe('number')
    expect(cella(mese('2026-08-31'), 'Base NIC')).toBe('2025 = 100')
    expect(cella(mese('2025-08-31'), 'Base NIC')).toBe('2015 = 100')
  })

  it('i dati scritti a mano si dicono nell’ultima colonna', () => {
    const dati = applicaCorrezioneDato(conRiferimentiInventati(portafoglioInventato()), { azione: 'correggi', dato: { tipo: 'nic', data: '2026-08-31' }, valore: 103.9 }, '2026-10-19T18:00:00.000Z')
    const f = tabella(libroExcel(dati, OGGI), 'Inflazione e riferimenti')
    const agosto = f.righe.find((r) => (r[0] as { data: string }).data === '2026-08-31')!
    expect(agosto[1]).toBe(103.9)
    expect(agosto.at(-1)).toBe('Inflazione NIC')
  })
})
