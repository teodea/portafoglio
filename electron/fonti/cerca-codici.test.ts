// La ricerca dei codici di un titolo nuovo, con una rete FINTA: risposte inventate come quelle dei siti.
import { describe, expect, it } from 'vitest'
import type { RichiestaCodici } from '../../src/dati/titolo-nuovo.ts'
import { cercaCodici, leggiIndirizzo, scegliLinee } from './cerca-codici.ts'
import type { Scarica } from './comune.ts'

const ADESSO = Date.parse('2026-10-19T12:00:00Z')
const r: RichiestaCodici = { isin: 'ZZ0000000009', borsa: 'MIL', simbolo: 'NUOV', valuta: 'EUR' }

const lineeFinte = [
  { pairId: 11, name: 'Fondo Nuovo (Xetra)', symbol: 'NUOV', exchange: 'Xetra', exchangeID: 4, link: '/etfs/fondo-nuovo?cid=11' },
  { pairId: 12, name: 'Fondo Nuovo USD', symbol: 'NUOVUSD', exchange: 'Milano', exchangeID: 6, link: '/etfs/fondo-nuovo-usd' },
  { pairId: 13, name: 'Fondo Nuovo', symbol: 'NUOV', exchange: 'Milano', exchangeID: 6, link: '/etfs/fondo-nuovo?cid=13' },
]

function rete(chiamate: string[], opzioni: { investing?: 'giu'; yahoo?: 'nessuno' } = {}): { investing: Scarica; yahoo: Scarica } {
  const risposta = (corpo: unknown, stato = 200) => Promise.resolve(new Response(JSON.stringify(corpo), { status: stato }))
  return {
    investing: (url) => {
      chiamate.push(url)
      if (opzioni.investing === 'giu') return risposta({}, 503)
      if (url.includes('SearchInnerPage')) return risposta({ quotes: lineeFinte })
      return risposta({ data: [{ rowDateTimestamp: '2026-10-16T00:00:00Z', last_closeRaw: '21.37' }] })
    },
    yahoo: (url) => {
      chiamate.push(url)
      if (url.includes('/search')) return risposta({ quotes: opzioni.yahoo === 'nessuno' ? [] : [{ symbol: 'NUOV.MI' }] })
      if (opzioni.yahoo === 'nessuno') return risposta({ chart: { result: null, error: { description: 'Not Found' } } }, 404)
      return risposta({
        chart: { result: [{ meta: { currency: 'EUR', exchangeTimezoneName: 'Europe/Rome' }, timestamp: [1760601600], indicators: { quote: [{ close: [21.4] }] } }] },
      })
    },
  }
}

describe('cercaCodici', () => {
  it('le linee sulla borsa del titolo, prima quella con lo stesso simbolo; il prezzo di ieri; il codice Yahoo', async () => {
    const chiamate: string[] = []
    const c = await cercaCodici(r, rete(chiamate), ADESSO, 0)
    expect(c.investing.map((l) => l.codice)).toEqual([13, 12])
    expect(c.investing[0]).toMatchObject({ nome: 'Fondo Nuovo', borsa: 'Milano', prezzo: 21.37, seduta: '2026-10-16' })
    expect(c.yahoo).toBe('NUOV.MI')
    expect(c.perche).toBeUndefined()
    // Poche richieste: la ricerca, Yahoo (ricerca e grafico) e il prezzo delle due linee.
    expect(chiamate.length).toBeLessThanOrEqual(5)
  })
  it('investing.com non risponde: lo dice, e Yahoo si cerca lo stesso', async () => {
    const c = await cercaCodici(r, rete([], { investing: 'giu' }), ADESSO, 0)
    expect(c.investing).toEqual([])
    expect(c.perche).toMatch(/investing.com non ha risposto \(errore 503\)/)
    expect(c.yahoo).toBe('NUOV.MI')
  })
  it('Yahoo non lo conosce: niente codice Yahoo', async () => {
    const c = await cercaCodici(r, rete([], { yahoo: 'nessuno' }), ADESSO, 0)
    expect(c.yahoo).toBeNull()
  })
  it('una borsa dove investing.com non lo ha', async () => {
    const c = await cercaCodici({ ...r, borsa: 'PAR' }, rete([]), ADESSO, 0)
    expect(c.investing).toEqual([])
    expect(c.perche).toMatch(/non sulla sua borsa/)
  })
  it('con l’indirizzo incollato vale quello', async () => {
    const c = await cercaCodici({ ...r, indirizzo: 'https://it.investing.com/etfs/fondo-nuovo-usd' }, rete([]), ADESSO, 0)
    expect(c.investing.map((l) => l.codice)).toEqual([12])
    const conCid = await cercaCodici({ ...r, indirizzo: 'https://it.investing.com/etfs/altro?cid=777' }, rete([]), ADESSO, 0)
    expect(conCid.investing[0].codice).toBe(777)
    const sbagliato = await cercaCodici({ ...r, indirizzo: 'https://esempio.it/x' }, rete([]), ADESSO, 0)
    expect(sbagliato.perche).toMatch(/non è una pagina di investing.com/)
  })
})

describe('pezzi della ricerca', () => {
  it('leggiIndirizzo', () => {
    expect(leggiIndirizzo('https://it.investing.com/etfs/xyz?cid=123')).toEqual({ percorso: '/etfs/xyz', cid: 123 })
    expect(leggiIndirizzo('https://www.investing.com/etfs/xyz/')).toEqual({ percorso: '/etfs/xyz', cid: null })
    expect(leggiIndirizzo('ciao')).toBeNull()
  })
  it('scegliLinee mette in fondo le linee con un’altra valuta nel simbolo', () => {
    expect(scegliLinee(lineeFinte, { ...r, simbolo: 'ALTRO' }).map((q) => q.pairId)).toEqual([13, 12])
  })
})
