// Le prove della correzione a mano di NIC, cambi e riferimenti (ticket 13), sul portafoglio inventato.
import { describe, expect, it } from 'vitest'
import { conRiferimentiInventati } from '../pagine/dati/ponte-finto-dati.ts'
import { aVersione3 } from './aggiorna/versione3.ts'
import { scriviRiferimenti } from './aggiorna/riferimenti.ts'
import { controllaFile } from './controllo.ts'
import {
  applicaCorrezioneDato,
  baseNic,
  controllaCorrezioneDato,
  eCorrezioneDato,
  percheDellaCopiaDato,
  primaDelDato,
  trovaDato,
  type CorrezioneDato,
  type RifDato,
} from './correzione-dati.ts'
import { comeTesto, portafoglioInventato } from './portafoglio-inventato.ts'
import type { FileDati } from './tipi.ts'

const ORA = '2026-10-19T18:00:00.000Z'
const DOPO = '2026-10-20T09:00:00.000Z'
const AGOSTO = '2026-08-31'
const SETTEMBRE = '2026-09-30'
const NIC_AGOSTO: RifDato = { tipo: 'nic', data: AGOSTO }
const NIC_SETTEMBRE: RifDato = { tipo: 'nic', data: SETTEMBRE }
const GBP_SETTEMBRE: RifDato = { tipo: 'cambio', valuta: 'GBP', data: SETTEMBRE }
const SP_AGOSTO: RifDato = { tipo: 'riferimento', riferimento: 'sp500', data: AGOSTO }
const NASDAQ_AGOSTO: RifDato = { tipo: 'riferimento', riferimento: 'nasdaq100', data: AGOSTO }
const BTP_AGOSTO: RifDato = { tipo: 'riferimento', riferimento: 'btp10', data: AGOSTO }

/** Il portafoglio inventato con NIC e riferimenti inventati: mancano il NIC di settembre e il Nasdaq-100 di agosto. */
const conDati = (): FileDati => conRiferimentiInventati(portafoglioInventato())

const applica = (d: FileDati, c: CorrezioneDato, quando = ORA) => applicaCorrezioneDato(d, c, quando)
const siLegge = (d: FileDati) => expect(controllaFile(comeTesto(d)).ok).toBe(true)

describe('il NIC', () => {
  it('corretto a mano tiene quello di prima, e "torna" rimette il file com’era', () => {
    const dati = conDati()
    const prima = trovaDato(dati, NIC_AGOSTO)!
    const corretto = applica(dati, { azione: 'correggi', dato: NIC_AGOSTO, valore: 103.9 })
    expect(trovaDato(corretto, NIC_AGOSTO)).toEqual({
      data: AGOSTO,
      valore: 103.9,
      base: 2025,
      fonte: 'a mano',
      quando: ORA,
      prima: { valore: (prima as { valore: number }).valore, fonte: 'ISTAT', base: 2025 },
    })
    siLegge(corretto)
    const tornato = applica(corretto, { azione: 'torna', dato: NIC_AGOSTO }, DOPO)
    expect(tornato).toEqual(dati)
  })

  it('che manca si scrive a mano con la base giusta per il mese, senza un "prima"', () => {
    const dati = conDati()
    expect(trovaDato(dati, NIC_SETTEMBRE)).toBeUndefined()
    const scritto = applica(dati, { azione: 'correggi', dato: NIC_SETTEMBRE, valore: 104.6 })
    expect(trovaDato(scritto, NIC_SETTEMBRE)).toEqual({ data: SETTEMBRE, valore: 104.6, base: 2025, fonte: 'a mano', quando: ORA })
    expect(scritto.nic!.at(-1)!.data).toBe(SETTEMBRE)
    expect(controllaCorrezioneDato(scritto, { azione: 'torna', dato: NIC_SETTEMBRE }).ok).toBe(false)
    expect(baseNic('2025-12-31')).toBe(2015)
    expect(baseNic('2026-01-31')).toBe(2025)
    siLegge(scritto)
  })

  it('corretto due volte: "prima" resta quello di ISTAT', () => {
    const dati = conDati()
    const una = applica(dati, { azione: 'correggi', dato: NIC_AGOSTO, valore: 103.9 })
    const due = applica(una, { azione: 'correggi', dato: NIC_AGOSTO, valore: 104.1 }, DOPO)
    expect(primaDelDato(trovaDato(due, NIC_AGOSTO))).toEqual({ numero: (trovaDato(dati, NIC_AGOSTO) as { valore: number }).valore, fonte: 'ISTAT' })
    expect(applica(due, { azione: 'torna', dato: NIC_AGOSTO })).toEqual(dati)
  })

  it('scaricato di nuovo da ISTAT prende il posto di quello a mano', () => {
    const dati = applica(conDati(), { azione: 'correggi', dato: NIC_SETTEMBRE, valore: 104.6 })
    const scaricato = applica(dati, { azione: 'scaricato', dato: NIC_SETTEMBRE, valore: 104.7, base: 2025, nota: 'dato provvisorio di ISTAT' })
    expect(trovaDato(scaricato, NIC_SETTEMBRE)).toEqual({ data: SETTEMBRE, valore: 104.7, base: 2025, fonte: 'ISTAT', nota: 'dato provvisorio di ISTAT' })
  })

  it('un NIC a mano non lo cambia l’aggiornamento di fine mese', () => {
    const aMano = applica(conDati(), { azione: 'correggi', dato: NIC_AGOSTO, valore: 103.9 })
    const dopo = scriviRiferimenti(aMano, { nic: [{ data: AGOSTO, valore: 102, base: 2025, fonte: 'ISTAT' }] })
    expect(trovaDato(dopo, NIC_AGOSTO)).toMatchObject({ valore: 103.9, fonte: 'a mano' })
  })
})

describe('il cambio', () => {
  it('corretto a mano cambia anche il cambio sui prezzi in sterline dello stesso fine mese; "torna" rimette tutto', () => {
    const dati = aVersione3(portafoglioInventato())
    expect(trovaDato(dati, GBP_SETTEMBRE)).toMatchObject({ cambio: 0.8546, fonte: 'dal tuo file Excel' })
    const corretto = applica(dati, { azione: 'correggi', dato: GBP_SETTEMBRE, valore: 0.8561 })
    expect(trovaDato(corretto, GBP_SETTEMBRE)).toEqual({
      valuta: 'GBP',
      data: SETTEMBRE,
      cambio: 0.8561,
      fonte: 'a mano',
      quando: ORA,
      prima: { cambio: 0.8546, fonte: 'dal tuo file Excel' },
    })
    expect(corretto.prezzi!.find((p) => p.valuta === 'GBP' && p.data === SETTEMBRE)!.cambio).toBe(0.8561)
    expect(corretto.prezzi!.find((p) => p.valuta === 'GBP' && p.data === AGOSTO)!.cambio).toBe(0.8652)
    siLegge(corretto)
    expect(applica(corretto, { azione: 'torna', dato: GBP_SETTEMBRE })).toEqual(dati)
  })

  it('non si scrive un cambio di una valuta che nessun titolo ha', () => {
    const r = controllaCorrezioneDato(aVersione3(portafoglioInventato()), { azione: 'correggi', dato: { tipo: 'cambio', valuta: 'CHF', data: SETTEMBRE }, valore: 0.94 })
    expect(r).toEqual({ ok: false, perche: 'nel file non c’è nessun titolo in CHF' })
  })
})

describe('i riferimenti', () => {
  it('corretto a mano tiene il cambio del dollaro e quello di prima; "torna" rimette il file com’era', () => {
    const dati = conDati()
    const x = trovaDato(dati, SP_AGOSTO) as { valore: number; cambio: number; seduta: string }
    const corretto = applica(dati, { azione: 'correggi', dato: SP_AGOSTO, valore: 14000.5 })
    expect(trovaDato(corretto, SP_AGOSTO)).toEqual({
      riferimento: 'sp500',
      data: AGOSTO,
      valore: 14000.5,
      valuta: 'USD',
      cambio: x.cambio,
      fonte: 'a mano',
      quando: ORA,
      prima: { valore: x.valore, fonte: 'investing.com', cambio: x.cambio, seduta: x.seduta },
    })
    siLegge(corretto)
    expect(applica(corretto, { azione: 'torna', dato: SP_AGOSTO })).toEqual(dati)
  })

  it('uno in dollari che manca prende il cambio dagli altri riferimenti in dollari dello stesso giorno', () => {
    const dati = conDati()
    expect(trovaDato(dati, NASDAQ_AGOSTO)).toBeUndefined()
    const cambio = (trovaDato(dati, SP_AGOSTO) as { cambio: number }).cambio
    const scritto = applica(dati, { azione: 'correggi', dato: NASDAQ_AGOSTO, valore: 25000 })
    expect(trovaDato(scritto, NASDAQ_AGOSTO)).toEqual({ riferimento: 'nasdaq100', data: AGOSTO, valore: 25000, valuta: 'USD', cambio, fonte: 'a mano', quando: ORA })
    siLegge(scritto)
  })

  it('uno in dollari senza nessun cambio di quel giorno ha bisogno del cambio BCE', () => {
    const dati = aVersione3(portafoglioInventato())
    expect(controllaCorrezioneDato(dati, { azione: 'correggi', dato: SP_AGOSTO, valore: 14000 })).toEqual({
      ok: false,
      perche: 'per S&P 500 di agosto 2026 serve il cambio BCE del dollaro di quel giorno',
    })
    const scritto = applica(dati, { azione: 'correggi', dato: SP_AGOSTO, valore: 14000, cambio: 1.1687 })
    expect(trovaDato(scritto, SP_AGOSTO)).toMatchObject({ valore: 14000, cambio: 1.1687, valuta: 'USD' })
    siLegge(scritto)
  })

  it('uno in euro non ha cambio', () => {
    const scritto = applica(conDati(), { azione: 'correggi', dato: BTP_AGOSTO, valore: 151.2 })
    expect(trovaDato(scritto, BTP_AGOSTO)).not.toHaveProperty('cambio')
  })

  it('scaricato di nuovo da investing.com: fonte investing.com, con seduta e cambio', () => {
    const dati = conDati()
    const scaricato = applica(dati, { azione: 'scaricato', dato: NASDAQ_AGOSTO, valore: 24990.25, seduta: '2026-08-31', cambio: 1.17 })
    expect(trovaDato(scaricato, NASDAQ_AGOSTO)).toEqual({
      riferimento: 'nasdaq100',
      data: AGOSTO,
      valore: 24990.25,
      valuta: 'USD',
      cambio: 1.17,
      fonte: 'investing.com',
      seduta: '2026-08-31',
    })
    // L'ordine del file resta: riferimento, poi data.
    const nasdaq = scaricato.riferimenti!.filter((v) => v.riferimento === 'nasdaq100').map((v) => v.data)
    expect(nasdaq).toEqual([...nasdaq].sort())
  })
})

describe('i rifiuti e i perché', () => {
  it('rifiuta un numero non sensato, uno uguale, un "torna" senza prima', () => {
    const dati = conDati()
    expect(controllaCorrezioneDato(dati, { azione: 'correggi', dato: NIC_AGOSTO, valore: 0 }).ok).toBe(false)
    const ora = (trovaDato(dati, NIC_AGOSTO) as { valore: number }).valore
    expect(controllaCorrezioneDato(dati, { azione: 'correggi', dato: NIC_AGOSTO, valore: ora })).toEqual({ ok: false, perche: 'il numero nuovo è uguale a quello che c’è già' })
    expect(controllaCorrezioneDato(dati, { azione: 'torna', dato: NIC_AGOSTO }).ok).toBe(false)
    expect(() => applica(dati, { azione: 'torna', dato: NIC_AGOSTO })).toThrow()
  })

  it('non si fida delle richieste che arrivano dalle pagine', () => {
    expect(eCorrezioneDato({ azione: 'correggi', dato: NIC_AGOSTO, valore: 1 })).toBe(true)
    expect(eCorrezioneDato({ azione: 'torna', dato: GBP_SETTEMBRE })).toBe(true)
    expect(eCorrezioneDato({ azione: 'scaricato', dato: SP_AGOSTO, valore: 1, seduta: '2026-08-31', cambio: 1.1 })).toBe(true)
    expect(eCorrezioneDato({ azione: 'correggi', dato: { tipo: 'nic', data: '31/08/2026' }, valore: 1 })).toBe(false)
    expect(eCorrezioneDato({ azione: 'correggi', dato: { tipo: 'cambio', valuta: 'EUR', data: AGOSTO }, valore: 1 })).toBe(false)
    expect(eCorrezioneDato({ azione: 'correggi', dato: { tipo: 'riferimento', riferimento: 'bitcoin', data: AGOSTO }, valore: 1 })).toBe(false)
    expect(eCorrezioneDato({ azione: 'correggi', dato: NIC_AGOSTO, valore: '104,6' })).toBe(false)
    expect(eCorrezioneDato({ azione: 'cancella', dato: NIC_AGOSTO })).toBe(false)
    expect(eCorrezioneDato(null)).toBe(false)
  })

  it('il perché della copia dice cosa si fa', () => {
    const dati = conDati()
    expect(percheDellaCopiaDato(dati, { azione: 'correggi', dato: NIC_AGOSTO, valore: 1 })).toBe('prima di correggere a mano il NIC di agosto 2026')
    expect(percheDellaCopiaDato(dati, { azione: 'correggi', dato: NIC_SETTEMBRE, valore: 1 })).toBe('prima di scrivere a mano il NIC di settembre 2026')
    expect(percheDellaCopiaDato(dati, { azione: 'torna', dato: SP_AGOSTO })).toBe('prima di tornare a quello di prima per S&P 500 di agosto 2026')
    expect(percheDellaCopiaDato(dati, { azione: 'scaricato', dato: GBP_SETTEMBRE, valore: 1 })).toBe('prima di scaricare di nuovo il cambio GBP di settembre 2026')
  })
})
