// Scrive nel file la correzione a mano (o il valore scaricato di nuovo) di un NIC, di un cambio o di un
// riferimento, con la scrittura sicura (scrivi.ts): rilettura e confronto, copia in "copie" con il perché,
// file temporaneo, sostituzione. Se il file è ancora alla versione 2, passa alla versione 3 (la copia è fatta prima).
// Solo Node (niente Electron).
import { aVersioneAttuale } from '../src/dati/aggiorna/versione3.ts'
import { applicaCorrezioneDato, controllaCorrezioneDato, percheDellaCopiaDato, type CorrezioneDato } from '../src/dati/correzione-dati.ts'
import type { Orologio } from './cartella-dati.ts'
import { scriviConCopia, type Scritto } from './scrivi.ts'

export async function scriviCorrezioneDato(
  cartella: string,
  improntaVista: string | null,
  c: CorrezioneDato,
  orologio: Orologio = () => new Date(),
): Promise<Scritto | { esito: 'errore'; perche: string }> {
  let problema: string | null = null
  try {
    return await scriviConCopia(
      cartella,
      improntaVista,
      (dati) => percheDellaCopiaDato(dati, c),
      (dati) => {
        const v3 = aVersioneAttuale(dati)
        const ok = controllaCorrezioneDato(v3, c)
        if (!ok.ok) {
          problema = ok.perche
          throw new Error(ok.perche)
        }
        return applicaCorrezioneDato(v3, c, orologio().toISOString())
      },
      orologio,
    )
  } catch (e) {
    return { esito: 'errore', perche: problema ?? (e instanceof Error ? e.message : String(e)) }
  }
}
