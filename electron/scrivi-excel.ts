// Scrive il libro di "Scarica in Excel" (ticket 14) in un .xlsx vero, con ExcelJS: numeri come numeri,
// date come date, il formato solo per come si vedono; niente formule. Come l'esempio della bozza 27:
// intestazione in grassetto su fondo grigio, ferma in alto con la prima colonna, e il filtro.
// Solo Node, senza Electron: così le prove lo usano su una cartella temporanea.
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { FORMATI, nomeFileExcel, type Cella, type FoglioLeggimi, type FoglioTabella, type LibroExcel } from '../src/dati/excel.ts'

const FONDO_INTESTAZIONE = 'FFEEF2F7'

/** Una data "AAAA-MM-GG" come giorno di Excel, senza spostamenti di fuso orario. */
function giorno(d: string): Date {
  const [a, m, g] = d.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, g))
}

function valore(c: Cella): ExcelJS.CellValue {
  if (c === null || c === '') return null
  if (typeof c === 'object') return giorno(c.data)
  return c
}

/** La lunghezza del testo più lungo della colonna i. */
function testoPiuLungo(righe: Cella[][], i: number): number {
  return righe.reduce((n, r) => (typeof r[i] === 'string' ? Math.max(n, (r[i] as string).length) : n), 0)
}

function foglioTabella(libro: ExcelJS.Workbook, f: FoglioTabella) {
  const ws = libro.addWorksheet(f.nome, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })
  const intestazione = ws.addRow(f.colonne.map((c) => (c.data ? giorno(c.data) : c.titolo)))
  intestazione.eachCell((cella, i) => {
    cella.font = { bold: true }
    cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FONDO_INTESTAZIONE } }
    cella.alignment = { wrapText: true, vertical: 'top' }
    if (f.colonne[i - 1].data) cella.numFmt = FORMATI.mese
  })
  for (const r of f.righe) ws.addRow(r.map(valore))
  f.colonne.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    // Le colonne di testo si allargano fino al testo più lungo, al massimo 60 caratteri: i nomi lunghi dei titoli,
    // "Borsa Italiana" (collaudo del 19/10). I numeri tengono la loro larghezza.
    const base = c.larghezza ?? Math.max(12, Math.min(40, c.titolo.length + 4))
    col.width = c.formato ? base : Math.max(base, Math.min(60, testoPiuLungo(f.righe, i) + 2))
    if (!c.formato) return
    const formato = FORMATI[c.formato]
    for (let r = 2; r <= f.righe.length + 1; r++) ws.getCell(r, i + 1).numFmt = formato
  })
  for (const i of f.grassetto ?? []) ws.getRow(i + 2).font = { bold: true }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: f.righe.length + 1, column: f.colonne.length } }
}

function foglioLeggimi(libro: ExcelJS.Workbook, f: FoglioLeggimi) {
  const ws = libro.addWorksheet(f.nome)
  for (const r of f.righe) {
    const riga = ws.addRow(r.celle.map(valore))
    if (r.stile === 'titolo') riga.getCell(1).font = { bold: true, size: 14 }
    if (r.stile === 'grassetto') riga.font = { bold: true }
    if (r.formato) {
      const formato = FORMATI[r.formato]
      riga.eachCell((cella) => {
        if (typeof cella.value === 'number') cella.numFmt = formato
      })
    }
  }
  f.larghezze.forEach((l, i) => (ws.getColumn(i + 1).width = l))
}

/** Il libro in memoria, pronto da scrivere. */
export function creaLibro(l: LibroExcel): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Portafoglio titoli'
  libro.created = giorno(l.oggi)
  for (const f of l.fogli) {
    if (f.tipo === 'tabella') foglioTabella(libro, f)
    else foglioLeggimi(libro, f)
  }
  return libro
}

const esiste = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  )

/**
 * Scrive il libro nella cartella (la cartella Download) e dice come si chiama il file.
 * Non sostituisce mai un file che c'è già: il secondo dello stesso giorno è "Portafoglio titoli 19-10-2026 (2).xlsx".
 */
export async function scriviLibro(l: LibroExcel, cartella: string): Promise<{ nome: string; percorso: string }> {
  let n = 1
  while (await esiste(join(cartella, nomeFileExcel(l.oggi, n)))) n++
  const nome = nomeFileExcel(l.oggi, n)
  const percorso = join(cartella, nome)
  await creaLibro(l).xlsx.writeFile(percorso)
  return { nome, percorso }
}
