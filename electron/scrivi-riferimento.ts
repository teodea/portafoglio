// Scrive nel file il valore di un riferimento o il NIC dal pannello della classifica (ticket 10): la correzione
// a mano, il ritorno al valore di prima o i valori scaricati di nuovo. Con la scrittura sicura (scrivi.ts):
// rilettura e confronto, copia in "copie" con il perché, file temporaneo, sostituzione.
// Se il file è ancora alla versione 2, passa alla versione 3 (la copia è fatta prima). Solo Node (niente Electron).
import { aVersioneAttuale } from '../src/dati/aggiorna/versione3.ts'
import { applicaScrittura, controllaScrittura, percheDellaCopiaRiferimento, type ScritturaRiferimento } from '../src/dati/correzione-riferimento.ts'
import type { Orologio } from './cartella-dati.ts'
import { scriviConCopia, type Scritto } from './scrivi.ts'

export async function scriviRiferimento(
  cartella: string,
  improntaVista: string | null,
  s: ScritturaRiferimento,
  orologio: Orologio = () => new Date(),
): Promise<Scritto | { esito: 'errore'; perche: string }> {
  let problema: string | null = null
  try {
    return await scriviConCopia(
      cartella,
      improntaVista,
      percheDellaCopiaRiferimento(s),
      (dati) => {
        const v3 = aVersioneAttuale(dati)
        const ok = controllaScrittura(v3, s)
        if (!ok.ok) {
          problema = ok.perche
          throw new Error(ok.perche)
        }
        return applicaScrittura(v3, s, orologio().toISOString())
      },
      orologio,
    )
  } catch (e) {
    return { esito: 'errore', perche: problema ?? (e instanceof Error ? e.message : String(e)) }
  }
}
