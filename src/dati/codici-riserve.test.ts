// Le prove dei codici investing.com cercati dalla pagina Dati: controllo e scrittura, sul portafoglio inventato.
import { describe, expect, it } from 'vitest'
import { applicaCodici, controllaCodici, eScritturaCodici, titoliSenzaCodice, type CodiciDelTitolo } from './codici-riserve.ts'
import { portafoglioInventato } from './portafoglio-inventato.ts'
import type { FileDati } from './tipi.ts'

const MOND = 'ZZ0000000001-MIL'
const TECN = 'ZZ0000000002-LON'
const OBBL = 'ZZ0000000003-MIL'

/** Il portafoglio inventato con TECN senza codici, come i titoli del file vero prima della ricerca. */
function senzaCodiciTecn(): FileDati {
  const d = portafoglioInventato()
  d.titoli = d.titoli!.map((t) => {
    if (t.id !== TECN) return t
    const { codiceInvesting: _i, codiceYahoo: _y, ...resto } = t
    return resto
  })
  return d
}

describe('i codici investing.com dei titoli che hai', () => {
  it('si cercano solo per i titoli che hai e che non hanno il codice: non per i venduti', () => {
    expect(titoliSenzaCodice(portafoglioInventato()).map((t) => t.id)).toEqual([])
    // L'obbligazione inventata è rimborsata: non serve il suo codice.
    expect(titoliSenzaCodice(senzaCodiciTecn()).map((t) => t.id)).toEqual([TECN])
  })

  it('si scrivono sotto il simbolo; il resto del file resta uguale e l’oggetto di partenza non cambia', () => {
    const dati = senzaCodiciTecn()
    const copia = structuredClone(dati)
    const dopo = applicaCodici(dati, { codici: [{ titolo: TECN, codiceInvesting: 123456, codiceYahoo: 'TECN.L' }] })
    expect(dati).toEqual(copia)
    const t = dopo.titoli!.find((x) => x.id === TECN)!
    const chiavi = Object.keys(t)
    const i = chiavi.indexOf('simbolo')
    expect(chiavi.slice(i, i + 3)).toEqual(['simbolo', 'codiceInvesting', 'codiceYahoo'])
    expect(t).toMatchObject({ codiceInvesting: 123456, codiceYahoo: 'TECN.L' })
    const senzaTecn = (d: FileDati) => ({ ...d, titoli: d.titoli!.filter((x) => x.id !== TECN) })
    expect(senzaTecn(dopo)).toEqual(senzaTecn(dati))
  })

  it('un titolo di Francoforte trovato su Xetra prende "borsaRiserve": "XET"; gli altri no', () => {
    const dati = senzaCodiciTecn()
    dati.titoli = dati.titoli!.map((t) => (t.id === TECN ? { ...t, borsa: 'FRA' as const } : t))
    const dopo = applicaCodici(dati, { codici: [{ titolo: TECN, codiceInvesting: 1, borsaRiserve: 'XET' }] })
    expect(dopo.titoli!.find((x) => x.id === TECN)).toMatchObject({ codiceInvesting: 1, borsaRiserve: 'XET' })
    expect(controllaCodici(senzaCodiciTecn(), { codici: [{ titolo: TECN, codiceInvesting: 1, borsaRiserve: 'XET' }] })).toEqual({
      ok: false,
      perche: 'l’altra borsa per le riserve vale solo per i titoli di Francoforte, non per TECN',
    })
  })

  it('non si scrive un codice che c’è già, né un codice che non va', () => {
    const dati = senzaCodiciTecn()
    const perche = (codici: CodiciDelTitolo[]) => {
      const ok = controllaCodici(dati, { codici })
      return ok.ok ? null : ok.perche
    }
    expect(perche([])).toBe('non c’è nessun codice da scrivere')
    expect(perche([{ titolo: 'XX', codiceInvesting: 1 }])).toBe('il titolo XX non è nel file')
    expect(perche([{ titolo: MOND, codiceInvesting: 5 }])).toBe('MOND ha già il codice investing.com')
    expect(perche([{ titolo: TECN }])).toBe('per TECN non c’è nessun codice')
    expect(perche([{ titolo: TECN, codiceInvesting: 1.5 }])).toBe('il codice investing.com di TECN non è valido')
    expect(perche([{ titolo: TECN, codiceYahoo: 'tecn l' }])).toBe('il codice Yahoo di TECN non è valido')
    expect(perche([{ titolo: TECN, codiceInvesting: 1 }, { titolo: TECN, codiceInvesting: 2 }])).toBe('TECN compare due volte')
    expect(perche([{ titolo: OBBL, codiceInvesting: 7 }])).toBeNull()
    expect(() => applicaCodici(dati, { codici: [{ titolo: MOND, codiceInvesting: 5 }] })).toThrow('MOND ha già il codice investing.com')
  })

  it('una richiesta dalle pagine si controlla prima di usarla', () => {
    expect(eScritturaCodici({ codici: [{ titolo: TECN, codiceInvesting: 1, codiceYahoo: 'TECN.L', borsaRiserve: 'XET' }] })).toBe(true)
    expect(eScritturaCodici({ codici: [{ titolo: TECN, codiceInvesting: '1' }] })).toBe(false)
    expect(eScritturaCodici({ codici: [{ titolo: TECN, borsaRiserve: 'LON' }] })).toBe(false)
    expect(eScritturaCodici({ codici: 'TECN' })).toBe(false)
    expect(eScritturaCodici(null)).toBe(false)
  })
})
