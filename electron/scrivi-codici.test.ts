// Le prove della scrittura dei codici investing.com, su una cartella temporanea con il portafoglio inventato.
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comeTesto, portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import type { FileDati } from '../src/dati/tipi.ts'
import { impronta } from './cartella-dati.ts'
import { scriviCodici } from './scrivi-codici.ts'

let cartella: string
const file = () => join(cartella, 'portafoglio.json')
const copie = async () => (await readdir(join(cartella, 'copie')).catch(() => [] as string[])).sort()
const TECN = 'ZZ0000000002-LON'
const orologio = () => new Date('2026-10-20T09:30:00')

beforeEach(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'come-sto-andando-codici-'))
  const d = portafoglioInventato()
  d.titoli = d.titoli!.map((t) => {
    if (t.id !== TECN) return t
    const { codiceInvesting: _i, codiceYahoo: _y, ...resto } = t
    return resto
  })
  await writeFile(file(), comeTesto(d))
})
afterEach(async () => {
  await rm(cartella, { recursive: true, force: true })
})

describe('scrivere i codici investing.com', () => {
  it('copia prima, poi i codici nel file e nient’altro', async () => {
    const prima = await readFile(file(), 'utf8')
    const scritto = await scriviCodici(cartella, impronta(prima), { codici: [{ titolo: TECN, codiceInvesting: 4242, codiceYahoo: 'TECN.L' }] }, orologio)
    expect(scritto.esito).toBe('scritto')
    if (scritto.esito !== 'scritto') return
    expect(scritto.copia).toBe('portafoglio 2026-10-20 0930 prima dei codici delle riserve.json')
    expect(await readFile(join(cartella, 'copie', scritto.copia), 'utf8')).toBe(prima)
    const dopo: FileDati = JSON.parse(await readFile(file(), 'utf8'))
    const vecchio: FileDati = JSON.parse(prima)
    expect(dopo.titoli!.find((t) => t.id === TECN)).toMatchObject({ codiceInvesting: 4242, codiceYahoo: 'TECN.L' })
    expect({ ...dopo, titoli: [] }).toEqual({ ...vecchio, titoli: [] })
    expect(scritto.letto.apertura.stato).toBe('pronto')
  })

  it('se il file è cambiato da un altro PC non scrive niente: lo riapre com’è (con la copia "all’apertura")', async () => {
    const prima = await readFile(file(), 'utf8')
    const scritto = await scriviCodici(cartella, 'impronta-vecchia', { codici: [{ titolo: TECN, codiceInvesting: 4242 }] }, orologio)
    expect(scritto.esito).toBe('cambiato')
    expect(await copie()).toEqual(["portafoglio 2026-10-20 0930 all'apertura.json"])
    expect(await readFile(file(), 'utf8')).toBe(prima)
  })

  it('un codice che c’è già: niente copia, niente scrittura, il perché in parole', async () => {
    const prima = await readFile(file(), 'utf8')
    const scritto = await scriviCodici(cartella, impronta(prima), { codici: [{ titolo: 'ZZ0000000001-MIL', codiceInvesting: 1 }] }, orologio)
    expect(scritto).toEqual({ esito: 'errore', perche: 'MOND ha già il codice investing.com' })
    expect(await copie()).toEqual([])
    expect(await readFile(file(), 'utf8')).toBe(prima)
  })
})
