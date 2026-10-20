// "Scarica in Excel" nel processo principale (ticket 14): riceve i fogli preparati dalle pagine, li scrive
// nella cartella Download (scrivi-excel.ts) e apre il file in Excel se lo chiedi.
import { app, ipcMain, shell } from 'electron'
import { basename, dirname, resolve } from 'node:path'
import { CANALI_EXCEL, eFileScaricato, eLibroExcel, type EsitoExcel } from '../src/dati/excel.ts'
import { scriviLibro } from './scrivi-excel.ts'

const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function registraExcel() {
  ipcMain.handle(CANALI_EXCEL.scaricaInExcel, async (_e, libro: unknown): Promise<EsitoExcel> => {
    if (!eLibroExcel(libro)) return { esito: 'errore', perche: 'richiesta non valida' }
    try {
      return { esito: 'fatto', ...(await scriviLibro(libro, app.getPath('downloads'))) }
    } catch (e) {
      return { esito: 'errore', perche: messaggio(e) }
    }
  })

  // Solo i file scaricati da qui: un file "Portafoglio titoli ….xlsx" nella cartella Download.
  ipcMain.handle(CANALI_EXCEL.apriFileScaricato, async (_e, percorso: unknown) => {
    if (typeof percorso !== 'string') return
    const p = resolve(percorso)
    if (dirname(p).toLowerCase() !== resolve(app.getPath('downloads')).toLowerCase() || !eFileScaricato(basename(p))) return
    await shell.openPath(p)
  })
}
