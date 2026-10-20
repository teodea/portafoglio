// Le prove della scrittura del file Excel (ticket 14): si scrive il libro del portafoglio inventato in una
// cartella temporanea e si rilegge con ExcelJS, come farebbe Excel: fogli, numeri come numeri, date come date,
// formati, intestazione ferma e filtro, e il secondo file dello stesso giorno con "(2)".
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { libroExcel, NOMI_FOGLI } from '../src/conti/excel.ts'
import { contiDelPortafoglio } from '../src/conti/portafoglio.ts'
import { FORMATI } from '../src/dati/excel.ts'
import { portafoglioInventato } from '../src/dati/portafoglio-inventato.ts'
import { conRiferimentiInventati } from '../src/pagine/dati/ponte-finto-dati.ts'
import { scriviLibro } from './scrivi-excel.ts'

let cartella: string
beforeEach(async () => {
  cartella = await mkdtemp(join(tmpdir(), 'excel-'))
})
afterEach(async () => {
  await rm(cartella, { recursive: true, force: true })
})

async function rileggi(percorso: string) {
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.readFile(percorso)
  return libro
}

describe('il file Excel', () => {
  it('si chiama "Portafoglio titoli <data>.xlsx" e il secondo dello stesso giorno non sostituisce il primo', async () => {
    const libro = libroExcel(portafoglioInventato(), '2026-10-19')
    const primo = await scriviLibro(libro, cartella)
    const secondo = await scriviLibro(libro, cartella)
    expect(primo).toEqual({ nome: 'Portafoglio titoli 19-10-2026.xlsx', percorso: join(cartella, 'Portafoglio titoli 19-10-2026.xlsx') })
    expect(secondo.nome).toBe('Portafoglio titoli 19-10-2026 (2).xlsx')
    expect((await readdir(cartella)).sort()).toEqual(['Portafoglio titoli 19-10-2026 (2).xlsx', 'Portafoglio titoli 19-10-2026.xlsx'])
  })

  it('ha i sette fogli, con numeri come numeri e date come date, senza formule', async () => {
    const dati = conRiferimentiInventati(portafoglioInventato())
    const { percorso } = await scriviLibro(libroExcel(dati, '2026-10-19'), cartella)
    const wb = await rileggi(percorso)
    expect(wb.worksheets.map((w) => w.name)).toEqual([...NOMI_FOGLI])

    const leggimi = wb.getWorksheet('Leggimi')!
    expect(leggimi.getCell('A1').value).toBe('Portafoglio titoli: esportazione dei dati')
    expect(leggimi.getCell('A1').font?.bold).toBe(true)
    expect(leggimi.getCell('A1').font?.size).toBe(14)
    const valore = leggimi.getColumn(1).values.indexOf('Controvalore')
    expect(leggimi.getCell(valore, 2).value).toBe(contiDelPortafoglio(dati).valore.n)
    expect(leggimi.getCell(valore, 2).numFmt).toBe(FORMATI.euro)
    expect(leggimi.getColumn(2).width).toBe(100)

    const titoli = wb.getWorksheet('Titoli')!
    expect(titoli.getCell('A1').value).toBe('Simbolo')
    expect(titoli.getCell('A1').font?.bold).toBe(true)
    expect(titoli.getCell('A1').fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } })
    expect(titoli.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 1 })
    expect(titoli.autoFilter).toBeTruthy()
    const valoreCol = (titoli.getRow(1).values as unknown[]).indexOf('Controvalore')
    expect(typeof titoli.getCell(2, valoreCol).value).toBe('number')
    expect(titoli.getCell(2, valoreCol).numFmt).toBe(FORMATI.euro)

    const operazioni = wb.getWorksheet('Operazioni')!
    const data = operazioni.getCell('A2')
    expect(data.value).toBeInstanceOf(Date)
    expect(data.numFmt).toBe(FORMATI.data)
    expect((data.value as Date).toISOString().slice(0, 10)).toBe(dati.operazioni!.map((o) => o.data).sort()[0])

    const mesi = wb.getWorksheet('Valore mese per mese')!
    expect(mesi.getCell('C1').value).toBeInstanceOf(Date)
    expect(mesi.getCell('C1').numFmt).toBe(FORMATI.mese)
    expect(mesi.getCell(mesi.rowCount, 1).value).toBe('Capitale investito')
    expect(mesi.getCell(mesi.rowCount, 1).font?.bold).toBe(true)

    // Nessuna cella è una formula.
    for (const ws of wb.worksheets)
      ws.eachRow((r) =>
        r.eachCell((c) => {
          expect(c.type, `${ws.name}!${c.address}`).not.toBe(ExcelJS.ValueType.Formula)
        }),
      )
  })
})
