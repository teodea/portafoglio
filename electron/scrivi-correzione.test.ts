// Le prove della correzione a mano scritta nel file, su una cartella temporanea con il portafoglio inventato.
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comeTesto, portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import type { FileDati } from '../src/dati/tipi.ts'
import { apriCartella, impronta } from './cartella-dati.ts'
import { scriviCorrezione } from './scrivi-correzione.ts'

let cartella: string
const file = () => join(cartella, 'portafoglio.json')
const copie = async () => (await readdir(join(cartella, 'copie'))).sort()
const leggi = async (): Promise<FileDati> => JSON.parse(await readFile(file(), 'utf8'))
const MOND = 'ZZ0000000001-MIL'
const SETTEMBRE = '2026-09-30'

function orologioDaProva(inizio = '2026-10-19T18:00:00') {
  let t = new Date(inizio).getTime()
  return () => {
    const d = new Date(t)
    t += 60 * 60 * 1000
    return d
  }
}

beforeEach(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'come-sto-andando-correzione-'))
  await writeFile(file(), comeTesto(portafoglioInventato()))
})
afterEach(async () => {
  await rm(cartella, { recursive: true, force: true })
})

describe('scrivere una correzione a mano', () => {
  it('copia prima, poi il prezzo "a mano" nel file (che passa alla versione 3); poi torna al prezzo di prima', async () => {
    const orologio = orologioDaProva()
    const prima = await readFile(file(), 'utf8')
    const scritto = await scriviCorrezione(cartella, impronta(prima), { tipo: 'correggi', titolo: MOND, data: SETTEMBRE, prezzo: 12.57 }, orologio)
    expect(scritto.esito).toBe('scritto')
    if (scritto.esito !== 'scritto') return
    expect(scritto.copia).toMatch(/^portafoglio 2026-10-19 \d{4} prima di correggere a mano MOND di settembre 2026\.json$/)
    expect(await copie()).toEqual([scritto.copia])
    expect(await readFile(join(cartella, 'copie', scritto.copia), 'utf8')).toBe(prima)

    const dopo = await leggi()
    expect(dopo.versione).toBe(3)
    expect(dopo.prezzi!.find((p) => p.titolo === MOND && p.data === SETTEMBRE)).toMatchObject({
      prezzo: 12.57,
      fonte: 'a mano',
      prima: { prezzo: 12.75, fonte: 'dal tuo file Excel', nota: 'inventato' },
    })
    expect(scritto.letto.apertura.stato).toBe('pronto')

    const v3 = await readFile(file(), 'utf8')
    const tornato = await scriviCorrezione(cartella, scritto.letto.impronta, { tipo: 'torna', titolo: MOND, data: SETTEMBRE }, orologio)
    expect(tornato.esito).toBe('scritto')
    if (tornato.esito !== 'scritto') return
    expect(tornato.copia).toContain('prima di tornare al prezzo di prima di MOND di settembre 2026')
    expect(await readFile(join(cartella, 'copie', tornato.copia), 'utf8')).toBe(v3)
    const ancora = await leggi()
    expect(ancora.prezzi!.find((p) => p.titolo === MOND && p.data === SETTEMBRE)).toEqual({
      titolo: MOND,
      data: SETTEMBRE,
      prezzo: 12.75,
      valuta: 'EUR',
      fonte: 'dal tuo file Excel',
      nota: 'inventato',
    })
  })

  it('se un altro PC ha cambiato il file non scrive niente e non fa la copia della correzione', async () => {
    const vecchia = impronta(await readFile(file(), 'utf8'))
    const cambiato = comeTesto({ ...portafoglioInventato(), creato: '2026-10-19T19:00:00.000Z' })
    await writeFile(file(), cambiato)
    const scritto = await scriviCorrezione(cartella, vecchia, { tipo: 'correggi', titolo: MOND, data: SETTEMBRE, prezzo: 12.57 }, orologioDaProva())
    expect(scritto.esito).toBe('cambiato')
    expect(await readFile(file(), 'utf8')).toBe(cambiato)
    // (Riaperto com'è adesso, ha solo la copia "all'apertura" di un file che l'applicazione non conosceva.)
    expect((await copie()).some((c) => c.includes('correggere'))).toBe(false)
  })

  it('una correzione che non si può fare non scrive niente e dice perché', async () => {
    const testo = await readFile(file(), 'utf8')
    const scritto = await scriviCorrezione(cartella, impronta(testo), { tipo: 'torna', titolo: MOND, data: SETTEMBRE }, orologioDaProva())
    expect(scritto).toEqual({ esito: 'errore', perche: 'il prezzo di MOND a fine settembre 2026 non ha un prezzo precedente' })
    expect(await readFile(file(), 'utf8')).toBe(testo)
    expect((await apriCartella(cartella)).apertura.stato).toBe('pronto')
  })
})
