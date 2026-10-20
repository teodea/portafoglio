// Registra dal PDF nel processo principale (ticket 12): leggere i campi dei PDF della banca, aprirli
// con il programma di Windows ("Guarda il PDF") e cercare i codici delle riserve di un titolo nuovo.
// Le pagine mandano solo i percorsi dei file scelti o trascinati (il preload li prende dai File).
import { ipcMain, shell } from 'electron'
import type { PdfAperto } from '../src/dati/pdf-fineco.ts'
import { CANALI_PDF, eBorsa, type CodiciTrovati, type RichiestaCodici } from '../src/dati/titolo-nuovo.ts'
import { apriPdf } from './leggi-pdf.ts'

export function registraPdf() {
  // "Guarda il PDF" apre solo i PDF letti in questa sessione: le pagine non aprono file a caso.
  const letti = new Set<string>()
  ipcMain.handle(CANALI_PDF.leggiPdf, async (_e, percorsi: unknown): Promise<PdfAperto[]> => {
    if (!Array.isArray(percorsi)) return []
    const aperti: PdfAperto[] = []
    for (const p of percorsi.slice(0, 10)) {
      if (typeof p !== 'string' || !p) {
        aperti.push({ nome: 'file', percorso: null, perche: 'non riesco a sapere dove sta il file' })
        continue
      }
      const a = await apriPdf(p)
      if ('campi' in a) letti.add(p)
      aperti.push(a)
    }
    return aperti
  })
  ipcMain.handle(CANALI_PDF.guardaPdf, async (_e, percorso: unknown) => {
    if (typeof percorso === 'string' && letti.has(percorso)) await shell.openPath(percorso)
  })
  ipcMain.handle(CANALI_PDF.cercaCodici, async (_e, r: unknown): Promise<CodiciTrovati> => {
    const x = r as RichiestaCodici
    if (typeof x !== 'object' || x === null || typeof x.isin !== 'string' || !eBorsa(x.borsa) || typeof x.simbolo !== 'string' || typeof x.valuta !== 'string')
      return { investing: [], perche: 'richiesta non valida', yahoo: null }
    const { cercaCodici } = await import('./fonti/cerca-codici.ts')
    const { scaricaComeBrowser } = await import('./fonti/rete.ts')
    return cercaCodici(
      { isin: x.isin, borsa: x.borsa, simbolo: x.simbolo, valuta: x.valuta, ...(typeof x.indirizzo === 'string' ? { indirizzo: x.indirizzo } : {}) },
      { investing: scaricaComeBrowser, yahoo: fetch },
    )
  })
}
