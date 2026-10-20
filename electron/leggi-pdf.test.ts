// Leggere dal disco i campi di un PDF della banca: un PDF INVENTATO, fatto qui con pdf-lib, con i campi
// del modulo d'acquisto (stessi nomi di Fineco, numeri e codici di fantasia).
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { leggiCampi } from '../src/dati/pdf-fineco.ts'
import { campiAcquisto } from '../src/dati/pdf-inventati.ts'
import { apriPdf } from './leggi-pdf.ts'

let cartella = ''

async function pdfConCampi(campi: Record<string, string>): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const pagina = doc.addPage([595, 842])
  const form = doc.getForm()
  let y = 800
  for (const [nome, valore] of Object.entries(campi)) {
    const f = form.createTextField(nome)
    f.setText(valore)
    f.addToPage(pagina, { x: 50, y, width: 300, height: 14 })
    y -= 18
  }
  return doc.save()
}

beforeAll(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'pdf-prova-'))
})
afterAll(async () => {
  await rm(cartella, { recursive: true, force: true })
})

describe('apriPdf', () => {
  it('legge i campi del modulo, che poi diventano un acquisto', async () => {
    const percorso = join(cartella, 'Acquisto inventato a.pdf')
    await writeFile(percorso, await pdfConCampi(campiAcquisto()))
    const a = await apriPdf(percorso)
    expect(a.nome).toBe('Acquisto inventato a.pdf')
    expect('campi' in a && a.campi.Isin).toBe('ZZ0000000001')
    if (!('campi' in a)) return
    const l = leggiCampi(a.nome, a.percorso, a.campi)
    expect(l.ok && l.letto).toMatchObject({ tipo: 'acquisto', quantita: 73, totale: 915.45, rifOrdine: '123456789' })
  })
  it('un PDF senza modulo dà nessun campo (e poi "non sembra un acquisto")', async () => {
    const percorso = join(cartella, 'vuoto.pdf')
    const doc = await PDFDocument.create()
    doc.addPage()
    await writeFile(percorso, await doc.save())
    const a = await apriPdf(percorso)
    expect('campi' in a && a.campi).toEqual({})
  })
  it('un file che non è un PDF, o che non c’è, lo dice', async () => {
    const finto = join(cartella, 'finto.pdf')
    await writeFile(finto, 'non sono un pdf')
    expect(await apriPdf(finto)).toMatchObject({ perche: 'il file non si apre come PDF' })
    expect(await apriPdf(join(cartella, 'manca.pdf'))).toMatchObject({ perche: 'il file non esiste più' })
    expect(await apriPdf(join(cartella, 'foto.jpg'))).toMatchObject({ perche: 'non è un PDF' })
  })
})
