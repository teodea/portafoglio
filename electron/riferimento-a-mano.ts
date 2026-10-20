// Il valore di un riferimento o il NIC dal pannello della classifica (ticket 10), nel processo principale:
// il canale per le pagine. La scrittura vera è in scrivi-riferimento.ts.
import { ipcMain } from 'electron'
import type { EsitoCorrezione } from '../src/dati/correzione.ts'
import { CANALI_RIFERIMENTO_A_MANO, eScritturaRiferimento } from '../src/dati/correzione-riferimento.ts'
import type { ContestoAggiorna } from './aggiorna.ts'
import { scriviRiferimento } from './scrivi-riferimento.ts'

export function registraRiferimentoAMano(c: ContestoAggiorna) {
  ipcMain.handle(CANALI_RIFERIMENTO_A_MANO.scriviRiferimento, async (_e, x: unknown): Promise<EsitoCorrezione> => {
    const cartella = c.cartella()
    if (!cartella) return { esito: 'errore', perche: 'non c’è una cartella dei dati aperta' }
    if (!eScritturaRiferimento(x)) return { esito: 'errore', perche: 'richiesta non valida' }
    try {
      const scritto = await scriviRiferimento(cartella, c.impronta(), x)
      if (scritto.esito === 'errore') return scritto
      const apertura = await c.ricorda(cartella, scritto.letto)
      return scritto.esito === 'scritto' ? { esito: 'salvato', apertura, copia: scritto.copia } : { esito: 'cambiato', apertura }
    } catch (e) {
      return { esito: 'errore', perche: e instanceof Error ? e.message : String(e) }
    }
  })
}
