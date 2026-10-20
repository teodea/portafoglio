// Aggiorna fine mese nel processo principale: i prezzi dalle borse, i cambi BCE e il salvataggio del mese.
// Internet solo quando lo chiede la schermata (cioè quando l'utente ha premuto il tasto).
import { ipcMain } from 'electron'
import { ALTRA_BORSA, type RichiestaPrezzo } from '../src/dati/aggiorna/fonti.ts'
import { CANALI_AGGIORNA, type EsitoSalva } from '../src/dati/aggiorna/ponte-aggiorna.ts'
import {
  aVersioneAttuale,
  controllaMese,
  meseGiaNelFile,
  percheDellaCopia,
  scriviMese,
  type MeseDaSalvare,
} from '../src/dati/aggiorna/versione3.ts'
import { BORSE } from '../src/dati/tipi.ts'
import type { Apertura } from '../src/dati/ponte.ts'
import type { Letto } from './cartella-dati.ts'
import { cambioBce } from './fonti/bce.ts'
import { conFontiSpente, LETTORI, prezzoFineMese } from './fonti/index.ts'
import { scriviConCopia } from './scrivi.ts'

/** Quello che serve sapere del processo principale: la cartella aperta, l'impronta del file letto. */
export type ContestoAggiorna = {
  cartella: () => string | null
  impronta: () => string | null
  ricorda: (cartella: string, letto: Letto) => Promise<Apertura>
}

const MESE = /^\d{4}-(0[1-9]|1[0-2])$/

function richiestaValida(r: unknown): r is RichiestaPrezzo {
  const x = r as RichiestaPrezzo
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof x.isin === 'string' &&
    /^[A-Z0-9]{12}$/.test(x.isin) &&
    (BORSE as readonly string[]).includes(x.borsa) &&
    (x.simbolo === null || typeof x.simbolo === 'string') &&
    typeof x.valuta === 'string' &&
    (x.codiceInvesting === undefined || (Number.isInteger(x.codiceInvesting) && x.codiceInvesting > 0)) &&
    (x.codiceYahoo === undefined || (typeof x.codiceYahoo === 'string' && /^[A-Za-z0-9.\-=^]{1,20}$/.test(x.codiceYahoo))) &&
    (x.borsaRiserve === undefined || x.borsaRiserve in ALTRA_BORSA)
  )
}

export function registraAggiorna(c: ContestoAggiorna, spente: string[] = []) {
  // Per le prove: le fonti spente apposta (--spegni) non rispondono.
  const lettori = conFontiSpente(LETTORI, spente)
  ipcMain.handle(CANALI_AGGIORNA.prezzoFineMese, async (_e, richiesta: unknown, mese: unknown) => {
    if (!richiestaValida(richiesta) || typeof mese !== 'string' || !MESE.test(mese))
      return { ok: false, perche: 'richiesta non valida', tentativi: [] }
    return prezzoFineMese(richiesta, mese, lettori)
  })

  ipcMain.handle(CANALI_AGGIORNA.cambioFineMese, async (_e, valuta: unknown, mese: unknown) => {
    if (typeof valuta !== 'string' || typeof mese !== 'string' || !MESE.test(mese)) return { ok: false, perche: 'richiesta non valida' }
    return cambioBce(valuta, mese)
  })

  ipcMain.handle(CANALI_AGGIORNA.salvaMese, async (_e, m: unknown): Promise<EsitoSalva> => {
    const cartella = c.cartella()
    if (!cartella) return { esito: 'errore', perche: 'non c’è una cartella dei dati aperta' }
    const mese = m as MeseDaSalvare
    if (!mese || typeof mese !== 'object' || !Array.isArray(mese.prezzi) || !Array.isArray(mese.cambi) || typeof mese.mese !== 'string')
      return { esito: 'errore', perche: 'dati del mese non validi' }
    let problema: string | null = null
    try {
      const scritto = await scriviConCopia(
        cartella,
        c.impronta(),
        // Se il mese c'era già nel file, è un "Rifai".
        (dati) => percheDellaCopia(mese.mese, meseGiaNelFile(dati, mese.mese)),
        (dati) => {
          const v3 = aVersioneAttuale(dati)
          const ok = controllaMese(v3, mese)
          if (!ok.ok) {
            problema = ok.perche
            throw new Error(ok.perche)
          }
          return scriviMese(v3, mese, new Date().toISOString())
        },
      )
      const apertura = await c.ricorda(cartella, scritto.letto)
      return scritto.esito === 'scritto' ? { esito: 'salvato', apertura, copia: scritto.copia } : { esito: 'cambiato', apertura }
    } catch (e) {
      return { esito: 'errore', perche: problema ?? (e instanceof Error ? e.message : String(e)) }
    }
  })
}
