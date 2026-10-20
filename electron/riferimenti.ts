// Riferimenti e inflazione nel processo principale: i valori dei sei riferimenti (investing.com e BCE)
// e il NIC (ISTAT). Internet solo quando lo chiede la schermata, cioè quando l'utente ha premuto un tasto.
import { ipcMain } from 'electron'
import { CANALI_RIFERIMENTI } from '../src/dati/aggiorna/ponte-riferimenti.ts'
import { RIFERIMENTI, type IdRiferimento } from '../src/dati/tipi.ts'
import { nicIstat } from './fonti/istat.ts'
import { scaricaComeBrowser } from './fonti/rete.ts'
import { valoriRiferimento } from './fonti/riferimenti.ts'

// investing.com risponde solo a un browser vero (a Node dice 403): si chiede con la rete di Chromium (rete.ts).

const DATA = /^\d{4}-\d{2}-\d{2}$/
const MESE = /^\d{4}-(0[1-9]|1[0-2])$/
const elencoDi = (x: unknown, forma: RegExp): string[] | null =>
  Array.isArray(x) && x.length <= 2000 && x.every((d) => typeof d === 'string' && forma.test(d)) ? (x as string[]) : null

/** spente: per le prove (--spegni="investing.com,ISTAT"), le fonti che fanno finta di non rispondere. */
export function registraRiferimenti(spente: readonly string[] = []) {
  const spenta = (nome: string) => spente.some((x) => x.toLowerCase() === nome.toLowerCase())
  ipcMain.handle(CANALI_RIFERIMENTI.valoriRiferimento, async (_e, id: unknown, date: unknown) => {
    const d = elencoDi(date, DATA)
    if (typeof id !== 'string' || !(RIFERIMENTI as readonly string[]).includes(id) || !d) return { ok: false, perche: 'richiesta non valida' }
    if (spenta('investing.com')) return { ok: false, perche: 'investing.com non ha risposto (spento per la prova)' }
    return valoriRiferimento(id as IdRiferimento, d, { investing: scaricaComeBrowser, bce: fetch })
  })
  ipcMain.handle(CANALI_RIFERIMENTI.nicIstat, async (_e, mesi: unknown) => {
    const m = elencoDi(mesi, MESE)
    if (!m) return { ok: false, perche: 'richiesta non valida' }
    if (spenta('ISTAT')) return { ok: false, perche: 'ISTAT non ha risposto (spento per la prova)' }
    return nicIstat(m)
  })
}
