// Le prove della scrittura sicura, su una cartella temporanea con il portafoglio inventato.
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FONTE } from '../src/dati/aggiorna/fonti.ts'
import { aVersione3, percheDellaCopia as perche, scriviMese, type MeseDaSalvare } from '../src/dati/aggiorna/versione3.ts'
import { comeTesto, portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import type { FileDati } from '../src/dati/tipi.ts'
import { apriCartella } from './cartella-dati.ts'
import { scriviConCopia } from './scrivi.ts'

let cartella: string
const file = () => join(cartella, 'portafoglio.json')
const copie = async () => (await readdir(join(cartella, 'copie'))).sort()

function orologioDaProva(inizio = '2026-11-03T18:00:00') {
  let t = new Date(inizio).getTime()
  return () => {
    const d = new Date(t)
    t += 60 * 60 * 1000
    return d
  }
}

const OTTOBRE: MeseDaSalvare = {
  mese: '2026-10',
  prezzi: [
    { titolo: 'ZZ0000000001-MIL', prezzo: 13.1, seduta: '2026-10-30', fonte: FONTE.borsaItaliana },
    { titolo: 'ZZ0000000002-LON', prezzo: 54.2, seduta: '2026-10-30', fonte: FONTE.lse },
  ],
  cambi: [{ valuta: 'GBP', cambio: 0.8691, seduta: '2026-10-30', fonte: 'BCE' }],
}
const ottobre = (dati: FileDati) => scriviMese(aVersione3(dati), OTTOBRE, '2026-11-03T17:00:00.000Z')

beforeEach(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'come-sto-andando-scrivi-'))
  await writeFile(file(), comeTesto(portafoglioInventato()))
})
afterEach(async () => {
  await rm(cartella, { recursive: true, force: true })
})

describe('la scrittura sicura', () => {
  it('prima la copia del file com’era, poi il file nuovo in versione 3; alla riapertura nessuna copia in più', async () => {
    const orologio = orologioDaProva()
    const aperto = await apriCartella(cartella, { orologio })
    const prima = await readFile(file(), 'utf8')
    const scritto = await scriviConCopia(cartella, aperto.impronta, perche('2026-10', false), ottobre, orologio)
    expect(scritto.esito).toBe('scritto')
    if (scritto.esito !== 'scritto') return
    expect(scritto.copia).toBe("portafoglio 2026-11-03 1900 prima dell'aggiornamento di ottobre.json")
    expect(await readFile(join(cartella, 'copie', scritto.copia), 'utf8')).toBe(prima)
    const dopo = JSON.parse(await readFile(file(), 'utf8')) as FileDati
    expect(dopo.versione).toBe(3)
    expect(dopo.prezzi?.filter((p) => p.data === '2026-10-31')).toHaveLength(2)
    // Niente file temporanei lasciati in giro.
    expect((await readdir(cartella)).sort()).toEqual(['copie', 'portafoglio.json'])
    // L'impronta nuova è quella del file scritto: riaprendo non serve una copia "all'apertura".
    const copiePrima = await copie()
    const riaperto = await apriCartella(cartella, { orologio, improntaNota: scritto.letto.impronta })
    expect(riaperto.apertura.stato).toBe('pronto')
    expect(await copie()).toEqual(copiePrima)
  })

  it('se un altro PC ha cambiato il file nel frattempo, non scrive niente', async () => {
    const orologio = orologioDaProva()
    const aperto = await apriCartella(cartella, { orologio })
    const cambiato = comeTesto({ ...portafoglioInventato(), creato: '2026-11-03T10:00:00.000Z' })
    await writeFile(file(), cambiato)
    const scritto = await scriviConCopia(cartella, aperto.impronta, perche('2026-10', false), ottobre, orologio)
    expect(scritto.esito).toBe('cambiato')
    expect(await readFile(file(), 'utf8')).toBe(cambiato)
    expect(scritto.letto.apertura.stato).toBe('pronto')
  })

  it('un file nuovo che non si leggerebbe non si scrive', async () => {
    const orologio = orologioDaProva()
    const aperto = await apriCartella(cartella, { orologio })
    const prima = await readFile(file(), 'utf8')
    const copiePrima = await copie()
    await expect(
      scriviConCopia(cartella, aperto.impronta, 'prova', (d) => ({ ...d, prezzi: [{ ...d.prezzi![0], prezzo: -1 }] }), orologio),
    ).rejects.toThrow('non ho scritto niente')
    expect(await readFile(file(), 'utf8')).toBe(prima)
    expect(await copie()).toEqual(copiePrima)
  })

  it('"Rifai": il perché della copia lo dice', () => {
    expect(perche('2026-09', true)).toBe('prima di rifare settembre')
  })
})
