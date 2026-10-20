import { describe, expect, it } from 'vitest'
import { controllaFile } from './controllo.ts'
import { comeTesto, portafoglioInventato } from './portafoglio-inventato.ts'
import type { Titolo } from './tipi.ts'

const buono = comeTesto(portafoglioInventato())
const righe = buono.split('\n')
/** Il numero (da 1) della prima riga che contiene questo testo, dopo la riga "dopo". */
const rigaCon = (testo: string, dopo = 0) => righe.findIndex((r, n) => n >= dopo && r.includes(testo)) + 1

/** Cambia una riga del file buono, come farebbe qualcuno con Blocco note. */
function cambiaRiga(numero: number, cambia: (riga: string) => string): string {
  return righe.map((r, n) => (n === numero - 1 ? cambia(r) : r)).join('\n')
}

function problemaDi(testo: string) {
  const esito = controllaFile(testo)
  if (esito.ok) throw new Error('il file doveva essere rotto')
  return esito.problema
}

describe('il controllo del file all’apertura', () => {
  it('legge il portafoglio inventato senza problemi', () => {
    const esito = controllaFile(buono)
    expect(esito.ok).toBe(true)
    if (esito.ok) {
      expect(esito.dati.titoli).toHaveLength(3)
      expect(esito.dati.prezzi?.[3].cambio).toBe(0.8546)
    }
  })

  it('accetta il file salvato da Blocco note con il BOM e gli a capo di Windows', () => {
    expect(controllaFile('﻿' + buono.replaceAll('\n', '\r\n')).ok).toBe(true)
  })

  it('una virgola mancante: dice la riga dove manca, non quella dopo', () => {
    // Nel primo prezzo si toglie la virgola dopo "valuta": "EUR".
    const riga = rigaCon('"valuta": "EUR"', rigaCon('"prezzi"'))
    const p = problemaDi(cambiaRiga(riga, (r) => r.replace(/,$/, '')))
    expect(p.riga).toBe(riga)
    expect(p.spiegazione).toBe('manca una virgola tra due dati')
    expect(p.scrittura).toBe(true)
    expect(p.estratto.map((r) => r.numero)).toEqual([riga - 1, riga, riga + 1])
  })

  it('una virgola di troppo prima di }', () => {
    const riga = rigaCon('"fonte": "inventato"')
    const p = problemaDi(cambiaRiga(riga, (r) => r + ','))
    expect(p.riga).toBe(riga)
    expect(p.spiegazione).toContain('virgola di troppo')
  })

  it('un numero scritto con la virgola italiana', () => {
    const riga = rigaCon('"prezzo": 12.4')
    const p = problemaDi(cambiaRiga(riga, (r) => r.replace('12.4', '12,4')))
    expect(p.riga).toBe(riga)
    expect(p.spiegazione).toContain('12,4')
    expect(p.spiegazione).toContain('12.4')
  })

  it('una virgoletta di chiusura dimenticata', () => {
    const riga = rigaCon('"simbolo": "TECN"')
    const p = problemaDi(cambiaRiga(riga, (r) => r.replace('"TECN"', '"TECN')))
    expect(p.riga).toBe(riga)
    expect(p.spiegazione).toContain('virgoletta di chiusura')
  })

  it('il file tagliato a metà', () => {
    const p = problemaDi(buono.slice(0, buono.length / 2))
    expect(p.spiegazione).toContain('finisce prima del previsto')
  })

  it('il file vuoto', () => {
    expect(problemaDi('   \n').spiegazione).toBe('il file è vuoto')
  })

  it('un prezzo scritto come testo: è JSON giusto ma il dato non va', () => {
    const riga = rigaCon('"prezzo": 12.75')
    const p = problemaDi(cambiaRiga(riga, (r) => r.replace('12.75', '"12,75"')))
    expect(p.riga).toBe(riga)
    expect(p.scrittura).toBe(false)
    expect(p.spiegazione).toContain('il prezzo n. 2')
    expect(p.spiegazione).toContain('dovrebbe essere un numero')
    expect(p.spiegazione).toContain('togli le virgolette')
  })

  it('una data impossibile', () => {
    const riga = rigaCon('"data": "2024-02-12"')
    const p = problemaDi(cambiaRiga(riga, (r) => r.replace('2024-02-12', '2024-02-30')))
    expect(p.riga).toBe(riga)
    expect(p.spiegazione).toContain('AAAA-MM-GG')
  })

  it('un’operazione di un titolo che non esiste', () => {
    const dati = portafoglioInventato()
    dati.operazioni![1].titolo = 'ZZ9999999999-MIL'
    const p = problemaDi(comeTesto(dati))
    expect(p.spiegazione).toContain('ZZ9999999999-MIL')
    expect(p.riga).toBe(comeTesto(dati).split('\n').findIndex((r) => r.includes('ZZ9999999999-MIL')) + 1)
  })

  it('un dato che manca e i problemi che seguono', () => {
    const dati = portafoglioInventato()
    delete (dati.titoli![0] as Partial<Titolo>).isin
    delete (dati.titoli![1] as Partial<Titolo>).borsa
    const p = problemaDi(comeTesto(dati))
    expect(p.spiegazione).toContain('manca il dato "isin"')
    expect(p.altri).toBe(1)
  })

  it('un file che non è quello dei dati', () => {
    expect(problemaDi('{"ciao": 1}').spiegazione).toContain('"formato": "portafoglio"')
  })

  it('un file di una versione più nuova', () => {
    const dati = { ...portafoglioInventato(), versione: 9 }
    expect(problemaDi(JSON.stringify(dati)).spiegazione).toContain('più nuova')
  })
})
