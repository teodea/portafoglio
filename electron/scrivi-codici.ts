// Scrive nel file i codici investing.com e Yahoo trovati dalla pagina Dati (collaudo del 19/10, punto 7), con la
// scrittura sicura (scrivi.ts): rilettura e confronto, copia in "copie" con il perché, file temporaneo, sostituzione.
// Solo Node (niente Electron).
import { applicaCodici, controllaCodici, PERCHE_CODICI, type ScritturaCodici } from '../src/dati/codici-riserve.ts'
import type { Orologio } from './cartella-dati.ts'
import { scriviConCopia, type Scritto } from './scrivi.ts'

export async function scriviCodici(
  cartella: string,
  improntaVista: string | null,
  s: ScritturaCodici,
  orologio: Orologio = () => new Date(),
): Promise<Scritto | { esito: 'errore'; perche: string }> {
  let problema: string | null = null
  try {
    return await scriviConCopia(
      cartella,
      improntaVista,
      PERCHE_CODICI,
      (dati) => {
        const ok = controllaCodici(dati, s)
        if (!ok.ok) {
          problema = ok.perche
          throw new Error(ok.perche)
        }
        return applicaCodici(dati, s)
      },
      orologio,
    )
  } catch (e) {
    return { esito: 'errore', perche: problema ?? (e instanceof Error ? e.message : String(e)) }
  }
}
