// Scrive nel file la correzione a mano di un prezzo, con la scrittura sicura (scrivi.ts):
// rilettura e confronto, copia in "copie" con il perché, file temporaneo, sostituzione.
// Se il file è ancora alla versione 2, passa alla versione 3 (la copia è fatta prima).
// Solo Node (niente Electron).
import { aVersione3 } from '../src/dati/aggiorna/versione3.ts'
import { applicaCorrezione, controllaCorrezione, percheDellaCopia, type Correzione } from '../src/dati/correzione.ts'
import type { Orologio } from './cartella-dati.ts'
import { scriviConCopia, type Scritto } from './scrivi.ts'

export async function scriviCorrezione(
  cartella: string,
  improntaVista: string | null,
  c: Correzione,
  orologio: Orologio = () => new Date(),
): Promise<Scritto | { esito: 'errore'; perche: string }> {
  let problema: string | null = null
  try {
    return await scriviConCopia(
      cartella,
      improntaVista,
      (dati) => percheDellaCopia(dati, c),
      (dati) => {
        const v3 = aVersione3(dati)
        const ok = controllaCorrezione(v3, c)
        if (!ok.ok) {
          problema = ok.perche
          throw new Error(ok.perche)
        }
        return applicaCorrezione(v3, c, orologio().toISOString())
      },
      orologio,
    )
  } catch (e) {
    return { esito: 'errore', perche: problema ?? (e instanceof Error ? e.message : String(e)) }
  }
}
