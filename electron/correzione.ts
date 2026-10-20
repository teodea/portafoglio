// La correzione a mano di un prezzo nel processo principale: il canale per le pagine.
// La scrittura vera è in scrivi-correzione.ts (solo Node, così le prove la usano su una cartella temporanea).
import { ipcMain } from 'electron'
import { CANALI_CORREZIONE, eCorrezione, type EsitoCorrezione } from '../src/dati/correzione.ts'
import type { ContestoAggiorna } from './aggiorna.ts'
import { scriviCorrezione } from './scrivi-correzione.ts'

export function registraCorrezione(c: ContestoAggiorna) {
  ipcMain.handle(CANALI_CORREZIONE.correggiPrezzo, async (_e, x: unknown): Promise<EsitoCorrezione> => {
    const cartella = c.cartella()
    if (!cartella) return { esito: 'errore', perche: 'non c’è una cartella dei dati aperta' }
    if (!eCorrezione(x)) return { esito: 'errore', perche: 'richiesta non valida' }
    try {
      const scritto = await scriviCorrezione(cartella, c.impronta(), x)
      if (scritto.esito === 'errore') return scritto
      const apertura = await c.ricorda(cartella, scritto.letto)
      return scritto.esito === 'scritto' ? { esito: 'salvato', apertura, copia: scritto.copia } : { esito: 'cambiato', apertura }
    } catch (e) {
      return { esito: 'errore', perche: e instanceof Error ? e.message : String(e) }
    }
  })
}
