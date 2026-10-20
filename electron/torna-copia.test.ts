// Le prove di "Torna a questa copia" (scheda Copie) e della correzione di NIC, cambi e riferimenti scritta nel
// file, su una cartella temporanea con il portafoglio inventato (ticket 13).
import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comeTesto, portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import type { FileDati } from '../src/dati/tipi.ts'
import { elencaCopie, impronta } from './cartella-dati.ts'
import { scriviCorrezioneDato } from './scrivi-correzione-dati.ts'
import { tornaAQuestaCopia } from './torna-copia.ts'

let cartella: string
const file = () => join(cartella, 'portafoglio.json')
const copie = async () => (await readdir(join(cartella, 'copie'))).sort()
const leggiTesto = () => readFile(file(), 'utf8')

function orologioDaProva(inizio = '2026-10-19T18:00:00') {
  let t = new Date(inizio).getTime()
  return () => {
    const d = new Date(t)
    t += 60 * 60 * 1000
    return d
  }
}

const VECCHIA = 'portafoglio 2026-10-16 1802 prima del primo salvataggio.json'
const vecchio = (): FileDati => ({ ...portafoglioInventato(), prezzi: portafoglioInventato().prezzi!.slice(0, 2) })

beforeEach(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'come-sto-andando-copie-'))
  await writeFile(file(), comeTesto(portafoglioInventato()))
  await mkdir(join(cartella, 'copie'))
  await writeFile(join(cartella, 'copie', VECCHIA), comeTesto(vecchio()))
})
afterEach(async () => {
  await rm(cartella, { recursive: true, force: true })
})

describe('tornare a una copia dalla scheda Copie', () => {
  it('copia prima il file di adesso, poi rimette la copia; tornando a quella appena fatta, il file è com’era', async () => {
    const orologio = orologioDaProva()
    const adesso = await leggiTesto()
    const r = await tornaAQuestaCopia(cartella, VECCHIA, impronta(adesso), orologio)
    expect(r.esito).toBe('fatto')
    if (r.esito !== 'fatto') return
    expect(r.copia).toBe('portafoglio 2026-10-19 1800 prima di tornare alla copia del 16.10.2026 alle 18.02.json')
    expect(await readFile(join(cartella, 'copie', r.copia), 'utf8')).toBe(adesso)
    expect(await leggiTesto()).toBe(comeTesto(vecchio()))
    // Riaperto senza una copia "all'apertura": l'ha scritto l'applicazione.
    expect(r.letto.apertura.stato).toBe('pronto')
    expect(await copie()).toEqual([VECCHIA, r.copia].sort())
    expect(r.letto.apertura.stato === 'pronto' && r.letto.apertura.copie[0].file).toBe(r.copia)

    // E poi di nuovo a quello di adesso.
    const indietro = await tornaAQuestaCopia(cartella, r.copia, r.letto.impronta, orologio)
    expect(indietro.esito).toBe('fatto')
    expect(await leggiTesto()).toBe(adesso)
    expect(await copie()).toHaveLength(3)
  })

  it('se il file è cambiato fuori dall’applicazione non scrive niente', async () => {
    const vista = impronta(await leggiTesto())
    await writeFile(file(), comeTesto({ ...portafoglioInventato(), creato: '2026-10-19T00:00:00.000Z' }))
    const cambiato = await leggiTesto()
    const r = await tornaAQuestaCopia(cartella, VECCHIA, vista, orologioDaProva())
    expect(r.esito).toBe('cambiato')
    expect(await leggiTesto()).toBe(cambiato)
    expect(await copie()).toContain(VECCHIA)
  })

  it('non usa una copia che non si legge, il file rotto messo da parte o un percorso', async () => {
    const adesso = await leggiTesto()
    const rotta = 'portafoglio 2026-10-17 0900 a mano.json'
    await writeFile(join(cartella, 'copie', rotta), '{ "formato": "portafoglio", ')
    await writeFile(join(cartella, 'copie', 'portafoglio rotto 2026-10-18 0900.json'), '{')
    for (const nome of [rotta, 'portafoglio rotto 2026-10-18 0900.json', '..\\portafoglio.json', 'portafoglio 2026-10-01 0900 non c’è.json']) {
      const r = await tornaAQuestaCopia(cartella, nome, impronta(adesso), orologioDaProva())
      expect(r.esito, nome).toBe('errore')
    }
    expect(await leggiTesto()).toBe(adesso)
    expect(await copie()).toHaveLength(3)
  })
})

describe('l’ordine delle copie', () => {
  it('due copie dello stesso minuto: prima quella fatta dopo (dall’ora del file)', async () => {
    const a = 'portafoglio 2026-10-19 2230 prima di tornare alla copia del 16.10.2026 alle 18.02.json'
    const b = 'portafoglio 2026-10-19 2230 all’apertura.json'
    await writeFile(join(cartella, 'copie', a), '{}')
    await writeFile(join(cartella, 'copie', b), '{}')
    await utimes(join(cartella, 'copie', a), new Date('2026-10-19T20:30:10Z'), new Date('2026-10-19T20:30:10Z'))
    await utimes(join(cartella, 'copie', b), new Date('2026-10-19T20:30:40Z'), new Date('2026-10-19T20:30:40Z'))
    expect((await elencaCopie(cartella)).map((c) => c.file)).toEqual([b, a, VECCHIA])
    await utimes(join(cartella, 'copie', a), new Date('2026-10-19T20:30:50Z'), new Date('2026-10-19T20:30:50Z'))
    expect((await elencaCopie(cartella)).map((c) => c.file)).toEqual([a, b, VECCHIA])
  })
})

describe('scrivere una correzione di NIC, cambi o riferimenti', () => {
  it('copia prima, il file passa alla versione 3, il NIC a mano è nel file', async () => {
    const prima = await leggiTesto()
    const s = await scriviCorrezioneDato(cartella, impronta(prima), { azione: 'correggi', dato: { tipo: 'nic', data: '2026-09-30' }, valore: 104.6 }, orologioDaProva())
    expect(s.esito).toBe('scritto')
    if (s.esito !== 'scritto') return
    expect(s.copia).toMatch(/^portafoglio 2026-10-19 \d{4} prima di scrivere a mano il NIC di settembre 2026\.json$/)
    expect(await readFile(join(cartella, 'copie', s.copia), 'utf8')).toBe(prima)
    const dopo = JSON.parse(await leggiTesto()) as FileDati
    expect(dopo.versione).toBe(3)
    expect(dopo.nic).toEqual([{ data: '2026-09-30', valore: 104.6, base: 2025, fonte: 'a mano', quando: expect.stringMatching(/^2026-10-19T/) }])
  })

  it('il cambio corretto si legge anche sui prezzi; con il file cambiato da un altro PC non scrive niente', async () => {
    const prima = await leggiTesto()
    const s = await scriviCorrezioneDato(cartella, impronta(prima), { azione: 'correggi', dato: { tipo: 'cambio', valuta: 'GBP', data: '2026-09-30' }, valore: 0.8561 }, orologioDaProva())
    expect(s.esito).toBe('scritto')
    const dopo = JSON.parse(await leggiTesto()) as FileDati
    expect(dopo.prezzi!.find((p) => p.valuta === 'GBP' && p.data === '2026-09-30')!.cambio).toBe(0.8561)
    const r = await scriviCorrezioneDato(cartella, impronta(prima), { azione: 'torna', dato: { tipo: 'cambio', valuta: 'GBP', data: '2026-09-30' } }, orologioDaProva())
    expect(r.esito).toBe('cambiato')
  })

  it('una correzione impossibile non scrive niente', async () => {
    const prima = await leggiTesto()
    const r = await scriviCorrezioneDato(cartella, impronta(prima), { azione: 'torna', dato: { tipo: 'nic', data: '2026-09-30' } }, orologioDaProva())
    expect(r).toEqual({ esito: 'errore', perche: 'il NIC di settembre 2026 non ha un valore precedente' })
    expect(await leggiTesto()).toBe(prima)
    expect(await copie()).toEqual([VECCHIA])
  })
})
