// Le prove dei file nella cartella dei dati, su una cartella temporanea con il portafoglio inventato.
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comeTesto, portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import { apriCartella, creaFileVuoto, tornaAllaCopia } from './cartella-dati.ts'

let cartella: string
const buono = comeTesto(portafoglioInventato())
const rotto = buono.replace('"valuta": "EUR",', '"valuta": "EUR"')

// Un orologio che va avanti di un'ora a ogni lettura, così ogni copia ha il suo nome.
function orologioDaProva(inizio = '2026-10-19T09:00:00') {
  let t = new Date(inizio).getTime()
  return () => {
    const d = new Date(t)
    t += 60 * 60 * 1000
    return d
  }
}

const copieNellaCartella = async () => (await readdir(join(cartella, 'copie'))).sort()
const fileDati = () => readFile(join(cartella, 'portafoglio.json'), 'utf8')

beforeEach(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'come-sto-andando-prova-'))
})
afterEach(async () => {
  await rm(cartella, { recursive: true, force: true })
})

describe('aprire la cartella dei dati', () => {
  it('una cartella che non c’è più', async () => {
    const { apertura } = await apriCartella(join(cartella, 'non-esiste'))
    expect(apertura.stato).toBe('cartella-mancante')
  })

  it('una cartella senza portafoglio.json: non crea niente da sola', async () => {
    const { apertura } = await apriCartella(cartella)
    expect(apertura.stato).toBe('file-mancante')
    expect(await readdir(cartella)).toEqual([])
  })

  it('il file a posto: lo legge e fa una copia all’apertura, una volta sola', async () => {
    await writeFile(join(cartella, 'portafoglio.json'), buono)
    const orologio = orologioDaProva()
    const primo = await apriCartella(cartella, { orologio })
    expect(primo.apertura.stato).toBe('pronto')
    if (primo.apertura.stato === 'pronto') expect(primo.apertura.dati.titoli).toHaveLength(3)
    expect(await copieNellaCartella()).toEqual(["portafoglio 2026-10-19 0900 all'apertura.json"])

    // Riaperto uguale: nessuna copia nuova.
    await apriCartella(cartella, { orologio })
    expect(await copieNellaCartella()).toHaveLength(1)
  })

  it('il file che l’applicazione conosce già non si copia di nuovo', async () => {
    await writeFile(join(cartella, 'portafoglio.json'), buono)
    const { impronta } = await apriCartella(cartella, { orologio: orologioDaProva() })
    await rm(join(cartella, 'copie'), { recursive: true })
    await apriCartella(cartella, { improntaNota: impronta })
    await expect(readdir(join(cartella, 'copie'))).rejects.toThrow()
  })

  it('il file rotto: dice dov’è l’errore e non scrive niente', async () => {
    await writeFile(join(cartella, 'portafoglio.json'), rotto)
    const { apertura } = await apriCartella(cartella)
    expect(apertura.stato).toBe('rotto')
    if (apertura.stato === 'rotto') {
      expect(apertura.problema.spiegazione).toBe('manca una virgola tra due dati')
      expect(apertura.problema.riga).toBe(rotto.split('\n').findIndex((r) => r.endsWith('"valuta": "EUR"')) + 1)
    }
    expect(await readdir(cartella)).toEqual(['portafoglio.json'])
    expect(await fileDati()).toBe(rotto)
  })
})

describe('"Torna all’ultima copia" con il file rotto', () => {
  it('mette da parte il file rotto in copie e rimette la copia', async () => {
    const orologio = orologioDaProva()
    await writeFile(join(cartella, 'portafoglio.json'), buono)
    await apriCartella(cartella, { orologio }) // copia delle 9:00
    await writeFile(join(cartella, 'portafoglio.json'), rotto) // qualcuno lo rompe con Blocco note

    const letto = await apriCartella(cartella, { orologio })
    expect(letto.apertura.stato).toBe('rotto')
    if (letto.apertura.stato !== 'rotto') return
    const ultima = letto.apertura.copie.find((c) => !c.rotta)!
    expect(ultima.perche).toBe("all'apertura")

    const dopo = await tornaAllaCopia(cartella, ultima.file, letto.impronta, orologio)
    expect(dopo.apertura.stato).toBe('pronto')
    expect(await fileDati()).toBe(buono)
    // Il file rotto non si cancella; e non serve un'altra copia di quello rimesso.
    expect(await copieNellaCartella()).toEqual([
      "portafoglio 2026-10-19 0900 all'apertura.json",
      'portafoglio rotto 2026-10-19 1100.json',
    ])
    expect(await readFile(join(cartella, 'copie', 'portafoglio rotto 2026-10-19 1100.json'), 'utf8')).toBe(rotto)
    // Nessun file temporaneo lasciato in giro.
    expect((await readdir(cartella)).sort()).toEqual(['copie', 'portafoglio.json'])
  })

  it('non tocca niente se il file è cambiato nel frattempo', async () => {
    const orologio = orologioDaProva()
    await writeFile(join(cartella, 'portafoglio.json'), buono)
    await apriCartella(cartella, { orologio })
    await writeFile(join(cartella, 'portafoglio.json'), rotto)
    const letto = await apriCartella(cartella, { orologio })
    if (letto.apertura.stato !== 'rotto') throw new Error('doveva essere rotto')

    const rottoDiverso = rotto.replace('"MOND"', '"MOND2"')
    await writeFile(join(cartella, 'portafoglio.json'), rottoDiverso) // un altro PC l'ha cambiato
    const dopo = await tornaAllaCopia(cartella, letto.apertura.copie[0].file, letto.impronta, orologio)
    expect(dopo.apertura.stato).toBe('rotto')
    if (dopo.apertura.stato === 'rotto') expect(dopo.apertura.avviso).toContain('è cambiato')
    expect(await fileDati()).toBe(rottoDiverso)
  })

  it('non usa una copia rotta anche lei', async () => {
    await writeFile(join(cartella, 'portafoglio.json'), rotto)
    const letto = await apriCartella(cartella)
    await mkdir(join(cartella, 'copie'))
    await writeFile(join(cartella, 'copie', "portafoglio 2026-10-01 1000 all'apertura.json"), '{')
    const dopo = await tornaAllaCopia(cartella, "portafoglio 2026-10-01 1000 all'apertura.json", letto.impronta)
    expect(dopo.apertura.stato).toBe('rotto')
    if (dopo.apertura.stato === 'rotto') expect(dopo.apertura.avviso).toContain('non è leggibile')
    expect(await fileDati()).toBe(rotto)
  })

  it('accetta solo nomi di copie, non percorsi', async () => {
    await writeFile(join(cartella, 'portafoglio.json'), rotto)
    const letto = await apriCartella(cartella)
    const dopo = await tornaAllaCopia(cartella, '..\\..\\altro.json', letto.impronta)
    expect(dopo.apertura.stato).toBe('rotto')
    expect(await fileDati()).toBe(rotto)
  })
})

describe('un portafoglio nuovo', () => {
  it('crea un file vuoto che il controllo accetta', async () => {
    const { apertura } = await creaFileVuoto(cartella, orologioDaProva())
    expect(apertura.stato).toBe('pronto')
    if (apertura.stato === 'pronto') expect(apertura.dati.titoli).toEqual([])
  })
})
