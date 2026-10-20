// I canali della pagina Dati nel processo principale (ticket 13): "Torna a questa copia" dalla scheda Copie
// e la correzione a mano di NIC, cambi e riferimenti; i codici investing.com cercati dalla scheda Prezzi dei titoli. La scrittura vera è in torna-copia.ts e
// scrivi-correzione-dati.ts (solo Node, così le prove le usano su una cartella temporanea).
import { ipcMain } from 'electron'
import { CANALI_CODICI, eScritturaCodici, type EsitoCodici } from '../src/dati/codici-riserve.ts'
import { CANALI_CORREZIONE_DATO, eCorrezioneDato, type EsitoCorrezioneDato } from '../src/dati/correzione-dati.ts'
import { CANALI_COPIE, type EsitoRitorno } from '../src/dati/torna-copia.ts'
import type { ContestoAggiorna } from './aggiorna.ts'
import { scriviCodici } from './scrivi-codici.ts'
import { scriviCorrezioneDato } from './scrivi-correzione-dati.ts'
import { tornaAQuestaCopia } from './torna-copia.ts'

const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function registraPaginaDati(c: ContestoAggiorna) {
  ipcMain.handle(CANALI_COPIE.tornaAQuestaCopia, async (_e, file: unknown): Promise<EsitoRitorno> => {
    const cartella = c.cartella()
    if (!cartella) return { esito: 'errore', perche: 'non c’è una cartella dei dati aperta' }
    if (typeof file !== 'string') return { esito: 'errore', perche: 'richiesta non valida' }
    try {
      const r = await tornaAQuestaCopia(cartella, file, c.impronta())
      if (r.esito === 'errore') return r
      const apertura = await c.ricorda(cartella, r.letto)
      return r.esito === 'fatto' ? { esito: 'fatto', apertura, copia: r.copia } : { esito: 'cambiato', apertura }
    } catch (e) {
      return { esito: 'errore', perche: messaggio(e) }
    }
  })

  ipcMain.handle(CANALI_CORREZIONE_DATO.correggiDato, async (_e, x: unknown): Promise<EsitoCorrezioneDato> => {
    const cartella = c.cartella()
    if (!cartella) return { esito: 'errore', perche: 'non c’è una cartella dei dati aperta' }
    if (!eCorrezioneDato(x)) return { esito: 'errore', perche: 'richiesta non valida' }
    try {
      const scritto = await scriviCorrezioneDato(cartella, c.impronta(), x)
      if (scritto.esito === 'errore') return scritto
      const apertura = await c.ricorda(cartella, scritto.letto)
      return scritto.esito === 'scritto' ? { esito: 'salvato', apertura, copia: scritto.copia } : { esito: 'cambiato', apertura }
    } catch (e) {
      return { esito: 'errore', perche: messaggio(e) }
    }
  })

  ipcMain.handle(CANALI_CODICI.scriviCodici, async (_e, x: unknown): Promise<EsitoCodici> => {
    const cartella = c.cartella()
    if (!cartella) return { esito: 'errore', perche: 'non c’è una cartella dei dati aperta' }
    if (!eScritturaCodici(x)) return { esito: 'errore', perche: 'richiesta non valida' }
    try {
      const scritto = await scriviCodici(cartella, c.impronta(), x)
      if (scritto.esito === 'errore') return scritto
      const apertura = await c.ricorda(cartella, scritto.letto)
      return scritto.esito === 'scritto' ? { esito: 'salvato', apertura, copia: scritto.copia } : { esito: 'cambiato', apertura }
    } catch (e) {
      return { esito: 'errore', perche: messaggio(e) }
    }
  })
}
