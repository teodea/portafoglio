// Le prove della scrittura nel file di un riferimento corretto a mano (ticket 10), su una cartella temporanea
// con il portafoglio inventato e valori di fantasia.
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comeTesto, portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import type { FileDati } from '../src/dati/tipi.ts'
import { impronta } from './cartella-dati.ts'
import { scriviRiferimento } from './scrivi-riferimento.ts'

let cartella: string
const file = () => join(cartella, 'portafoglio.json')
const copie = async () => (await readdir(join(cartella, 'copie'))).sort()
const leggi = async (): Promise<FileDati> => JSON.parse(await readFile(file(), 'utf8'))
const SET = '2026-09-30'

function conRiferimento(): FileDati {
  return {
    ...portafoglioInventato(),
    riferimenti: [{ riferimento: 'sp500', data: SET, valore: 11000, valuta: 'USD', cambio: 1.1, fonte: 'investing.com', seduta: SET }],
  }
}
const orologio = () => new Date('2026-10-19T18:00:00')

beforeEach(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'come-sto-andando-riferimento-'))
  await writeFile(file(), comeTesto(conRiferimento()))
})
afterEach(async () => {
  await rm(cartella, { recursive: true, force: true })
})

describe('scrivere il valore di un riferimento', () => {
  it('copia prima, poi il valore "a mano" (il file passa alla versione 3); poi torna al valore di prima', async () => {
    const prima = await readFile(file(), 'utf8')
    const scritto = await scriviRiferimento(cartella, impronta(prima), { tipo: 'correggi', id: 'sp500', data: SET, valore: 11200 }, orologio)
    expect(scritto.esito).toBe('scritto')
    if (scritto.esito !== 'scritto') return
    expect(scritto.copia).toBe('portafoglio 2026-10-19 1800 prima di correggere a mano S&P 500 a fine settembre 2026.json')
    expect(await readFile(join(cartella, 'copie', scritto.copia), 'utf8')).toBe(prima)
    const dopo = await leggi()
    expect(dopo.versione).toBe(3)
    expect(dopo.riferimenti![0]).toMatchObject({ valore: 11200, cambio: 1.1, fonte: 'a mano', prima: { valore: 11000, fonte: 'investing.com', seduta: SET } })

    const tornato = await scriviRiferimento(cartella, scritto.letto.impronta, { tipo: 'torna', id: 'sp500', data: SET }, orologio)
    expect(tornato.esito).toBe('scritto')
    expect((await leggi()).riferimenti).toEqual(conRiferimento().riferimenti)
    expect(await copie()).toHaveLength(2)
  })

  it('se un altro PC ha cambiato il file non scrive niente', async () => {
    const vecchia = impronta(await readFile(file(), 'utf8'))
    const cambiato = comeTesto({ ...conRiferimento(), creato: '2026-10-19T19:00:00.000Z' })
    await writeFile(file(), cambiato)
    const scritto = await scriviRiferimento(cartella, vecchia, { tipo: 'correggi', id: 'sp500', data: SET, valore: 11200 }, orologio)
    expect(scritto.esito).toBe('cambiato')
    expect(await readFile(file(), 'utf8')).toBe(cambiato)
  })

  it('una scrittura che non si può fare non tocca il file e dice perché', async () => {
    const prima = await readFile(file(), 'utf8')
    const scritto = await scriviRiferimento(cartella, impronta(prima), { tipo: 'torna', id: 'sp500', data: SET }, orologio)
    expect(scritto).toEqual({ esito: 'errore', perche: 'S&P 500 a fine settembre 2026 non ha un valore di prima' })
    expect(await readFile(file(), 'utf8')).toBe(prima)
  })
})
