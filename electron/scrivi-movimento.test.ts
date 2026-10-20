// Le prove di registrare, correggere e togliere un movimento sul disco, su una cartella temporanea con il portafoglio inventato.
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { aVersione3 } from '../src/dati/aggiorna/versione3.ts'
import type { NuovaOperazione } from '../src/dati/movimenti.ts'
import { comeTesto, portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import { impronta } from './cartella-dati.ts'
import { scriviMovimento } from './scrivi-movimento.ts'

let cartella: string
const file = () => join(cartella, 'portafoglio.json')
const copie = async () => (await readdir(join(cartella, 'copie'))).sort()
const MOND = 'ZZ0000000001-MIL'

function orologioDaProva(inizio = '2026-10-19T18:00:00') {
  let t = new Date(inizio).getTime()
  return () => {
    const d = new Date(t)
    t += 60 * 60 * 1000
    return d
  }
}

const vendita: NuovaOperazione = { tipo: 'vendita', titolo: MOND, data: '2026-10-12', quantita: 40, prezzo: 13, cambio: 1, commissioni: 5, totale: 515 }

beforeEach(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'come-sto-andando-movimento-'))
  await writeFile(file(), comeTesto(portafoglioInventato()))
})
afterEach(async () => {
  await rm(cartella, { recursive: true, force: true })
})

describe('scrivere un movimento', () => {
  it('registra, correggi, togli: una copia prima di ogni scrittura, e alla fine il file è com’era (passato alla versione 3)', async () => {
    const orologio = orologioDaProva()
    const prima = await readFile(file(), 'utf8')
    const r = await scriviMovimento(cartella, impronta(prima), { azione: 'registra', movimento: vendita }, orologio)
    expect(r.esito).toBe('scritto')
    if (r.esito !== 'scritto') return
    expect(r.copia).toMatch(/^portafoglio 2026-10-19 \d{4} prima di registrare la vendita di MOND del 12-10-2026\.json$/)
    expect(await readFile(join(cartella, 'copie', r.copia), 'utf8')).toBe(prima)

    const c = await scriviMovimento(cartella, r.letto.impronta, { azione: 'correggi', id: r.id, campi: { quantita: 41, totale: 528 } }, orologio)
    expect(c.esito).toBe('scritto')
    if (c.esito !== 'scritto') return
    expect(c.copia).toContain('prima di correggere a mano la vendita di MOND del 12-10-2026')
    const corretta = JSON.parse(await readFile(file(), 'utf8')).operazioni.find((o: { id: string }) => o.id === r.id)
    expect(corretta).toMatchObject({ quantita: 41, totale: 528, prima: { quantita: 40, totale: 515 }, fonte: 'a mano' })

    const t = await scriviMovimento(cartella, c.letto.impronta, { azione: 'togli', id: r.id }, orologio)
    expect(t.esito).toBe('scritto')
    if (t.esito !== 'scritto') return
    expect(t.copia).toContain('prima di togliere la vendita di MOND del 12-10-2026')
    expect(await readFile(file(), 'utf8')).toBe(comeTesto(aVersione3(portafoglioInventato())))
    expect((await copie()).length).toBe(3)
  })

  it('se un altro PC ha cambiato il file non scrive niente', async () => {
    const vecchia = impronta(await readFile(file(), 'utf8'))
    const cambiato = comeTesto({ ...portafoglioInventato(), creato: '2026-10-19T19:00:00.000Z' })
    await writeFile(file(), cambiato)
    const r = await scriviMovimento(cartella, vecchia, { azione: 'registra', movimento: vendita }, orologioDaProva())
    expect(r.esito).toBe('cambiato')
    expect(await readFile(file(), 'utf8')).toBe(cambiato)
    expect((await copie()).some((c) => c.includes('registrare'))).toBe(false)
  })

  it('vendere più quote di quelle che hai non scrive niente e dice perché', async () => {
    const testo = await readFile(file(), 'utf8')
    const r = await scriviMovimento(cartella, impronta(testo), { azione: 'registra', movimento: { ...vendita, quantita: 101 } }, orologioDaProva())
    expect(r).toEqual({ esito: 'errore', perche: 'il 12/10/2026 c’erano solo 100 quote di MOND: non se ne possono vendere 101' })
    expect(await readFile(file(), 'utf8')).toBe(testo)
  })
})
