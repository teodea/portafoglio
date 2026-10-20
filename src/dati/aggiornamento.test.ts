import { describe, expect, it } from 'vitest'
import { allaChiusura, fonteDiProva, inParole, NESSUNO, prossimoStato, type EventoAggiornamento, type StatoAggiornamento } from './aggiornamento.ts'

function dopo(...eventi: EventoAggiornamento[]): StatoAggiornamento {
  return eventi.reduce(prossimoStato, NESSUNO)
}

describe("l'aggiornamento all'apertura", () => {
  it('senza versioni nuove non dice niente', () => {
    expect(dopo({ tipo: 'nessuna' })).toEqual(NESSUNO)
    expect(inParole(dopo({ tipo: 'nessuna' }))).toBeNull()
  })

  it('senza internet non dice niente: si riprova la volta dopo', () => {
    expect(dopo({ tipo: 'errore' })).toEqual(NESSUNO)
  })

  it('con una versione nuova chiede "la installo?"', () => {
    const s = dopo({ tipo: 'trovata', versione: '0.2.0' })
    expect(s).toEqual({ stato: 'disponibile', versione: '0.2.0' })
    const parole = inParole(s)
    expect(parole?.testo).toBe('È disponibile una nuova versione (0.2.0): installarla?')
    expect(parole?.bottoni.map((b) => b.testo)).toEqual(['Non ora', 'Installa'])
    expect(parole?.bottoni.find((b) => b.primario)?.installa).toBe(true)
  })

  it('"Non ora" non fa niente (la domanda torna alla prossima apertura)', () => {
    expect(dopo({ tipo: 'trovata', versione: '0.2.0' }, { tipo: 'risposta', installa: false })).toEqual(NESSUNO)
  })

  it('con il sì scarica e poi installa subito, e il programma si riapre', () => {
    const scarico = dopo({ tipo: 'trovata', versione: '0.2.0' }, { tipo: 'risposta', installa: true }, { tipo: 'avanzamento', percento: 41.6 })
    expect(scarico).toEqual({ stato: 'scarico', versione: '0.2.0', percento: 42 })
    expect(inParole(scarico)?.testo).toBe('Scaricamento della versione 0.2.0… 42%. Al termine il programma si chiude, installa la versione nuova e si riapre automaticamente.')

    const installo = prossimoStato(scarico, { tipo: 'scaricata' })
    expect(installo).toEqual({ stato: 'installo', versione: '0.2.0' })
    expect(inParole(installo)?.testo).toBe('Installazione della versione 0.2.0: il programma si chiude e si riapre automaticamente al termine. Non occorre fare nulla.')
    expect(inParole(installo)?.bottoni).toEqual([])
    expect(inParole(installo)?.chiudibile).toBe(false)
  })

  it("l'avanzamento non torna indietro e non passa il 100%", () => {
    const s = dopo(
      { tipo: 'trovata', versione: '0.2.0' },
      { tipo: 'risposta', installa: true },
      { tipo: 'avanzamento', percento: 60 },
      { tipo: 'avanzamento', percento: 30 },
    )
    expect(s).toMatchObject({ percento: 60 })
    expect(prossimoStato(s, { tipo: 'avanzamento', percento: 140 })).toMatchObject({ percento: 100 })
  })

  it('se lo scaricamento non va lo dice, e si può riprovare', () => {
    const fallita = dopo({ tipo: 'trovata', versione: '0.2.0' }, { tipo: 'risposta', installa: true }, { tipo: 'errore' })
    expect(fallita).toEqual({ stato: 'non-scaricata', versione: '0.2.0' })
    expect(inParole(fallita)?.bottoni.map((b) => b.testo)).toEqual(['Non ora', 'Riprova'])
    expect(prossimoStato(fallita, { tipo: 'risposta', installa: true })).toEqual({ stato: 'scarico', versione: '0.2.0', percento: 0 })
    expect(prossimoStato(fallita, { tipo: 'risposta', installa: false })).toEqual(NESSUNO)
  })

  it('una risposta senza domanda non cambia niente', () => {
    expect(dopo({ tipo: 'risposta', installa: true })).toEqual(NESSUNO)
    const installo: StatoAggiornamento = { stato: 'installo', versione: '0.2.0' }
    expect(prossimoStato(installo, { tipo: 'risposta', installa: false })).toEqual(installo)
    expect(prossimoStato(installo, { tipo: 'errore' })).toEqual(installo)
    expect(prossimoStato(installo, { tipo: 'trovata', versione: '0.3.0' })).toEqual(installo)
  })
})

describe('alla chiusura del programma', () => {
  it('con una versione scaricata la installa e riapre il programma, senza doverlo riaprire manualmente', () => {
    expect(allaChiusura({ stato: 'installo', versione: '0.2.0' }, { prova: false })).toBe('installa-e-riapri')
  })

  it('senza una versione pronta chiude e basta', () => {
    expect(allaChiusura(NESSUNO, { prova: false })).toBe('chiudi')
    expect(allaChiusura({ stato: 'scarico', versione: '0.2.0', percento: 50 }, { prova: false })).toBe('chiudi')
    expect(allaChiusura({ stato: 'non-scaricata', versione: '0.2.0' }, { prova: false })).toBe('chiudi')
  })

  it('con la finta fonte di versioni non installa mai', () => {
    expect(allaChiusura({ stato: 'installo', versione: '0.2.0' }, { prova: true })).toBe('chiudi')
  })
})

describe('la finta fonte di versioni, per le prove', () => {
  it('vale solo su questo PC', () => {
    expect(fonteDiProva('http://localhost:8765/')).toBe('http://localhost:8765/')
    expect(fonteDiProva('http://127.0.0.1:8765/versioni')).toBe('http://127.0.0.1:8765/versioni')
  })

  it('non accetta fonti su internet né indirizzi strani', () => {
    expect(fonteDiProva(undefined)).toBeNull()
    expect(fonteDiProva('')).toBeNull()
    expect(fonteDiProva('https://example.com/')).toBeNull()
    expect(fonteDiProva('http://localhost.example.com/')).toBeNull()
    expect(fonteDiProva('file:///C:/versioni/')).toBeNull()
    expect(fonteDiProva('non è un indirizzo')).toBeNull()
  })
})
