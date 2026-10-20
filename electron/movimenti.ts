// Registrare, correggere a mano e togliere un movimento nel processo principale: il canale per le pagine.
// La scrittura vera è in scrivi-movimento.ts (solo Node, così le prove la usano su una cartella temporanea).
import { ipcMain } from 'electron'
import { CANALI_MOVIMENTI, eModifica, type EsitoMovimento } from '../src/dati/movimenti.ts'
import type { ContestoAggiorna } from './aggiorna.ts'
import { scriviMovimento } from './scrivi-movimento.ts'

export function registraMovimenti(c: ContestoAggiorna) {
  ipcMain.handle(CANALI_MOVIMENTI.modificaMovimento, async (_e, x: unknown): Promise<EsitoMovimento> => {
    const cartella = c.cartella()
    if (!cartella) return { esito: 'errore', perche: 'non c’è una cartella dei dati aperta' }
    if (!eModifica(x)) return { esito: 'errore', perche: 'richiesta non valida' }
    try {
      const scritto = await scriviMovimento(cartella, c.impronta(), x)
      if (scritto.esito === 'errore') return scritto
      const apertura = await c.ricorda(cartella, scritto.letto)
      return scritto.esito === 'scritto' ? { esito: 'salvato', apertura, copia: scritto.copia, id: scritto.id } : { esito: 'cambiato', apertura }
    } catch (e) {
      return { esito: 'errore', perche: e instanceof Error ? e.message : String(e) }
    }
  })
}
