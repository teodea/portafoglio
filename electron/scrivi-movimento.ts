// Scrive nel file un movimento registrato, corretto a mano, rimesso com'era o tolto (ticket 11),
// con la scrittura sicura (scrivi.ts): rilettura e confronto, copia in "copie" con il perché,
// file temporaneo, sostituzione. Se il file è ancora alla versione 2, passa alla versione 3 (la copia è fatta prima).
// Solo Node (niente Electron).
import { aVersioneAttuale } from '../src/dati/aggiorna/versione3.ts'
import { applicaModifica, controllaModifica, percheDellaCopia, type ModificaMovimento } from '../src/dati/movimenti.ts'
import type { Letto, Orologio } from './cartella-dati.ts'
import { scriviConCopia } from './scrivi.ts'

export type ScrittoMovimento =
  | { esito: 'scritto'; letto: Letto; copia: string; id: string }
  | { esito: 'cambiato'; letto: Letto }
  | { esito: 'errore'; perche: string }

export async function scriviMovimento(
  cartella: string,
  improntaVista: string | null,
  m: ModificaMovimento,
  orologio: Orologio = () => new Date(),
): Promise<ScrittoMovimento> {
  let problema: string | null = null
  let id = ''
  try {
    const scritto = await scriviConCopia(
      cartella,
      improntaVista,
      (dati) => percheDellaCopia(dati, m),
      (dati) => {
        const v3 = aVersioneAttuale(dati)
        const ok = controllaModifica(v3, m)
        if (!ok.ok) {
          problema = ok.perche
          throw new Error(ok.perche)
        }
        const fatto = applicaModifica(v3, m, orologio().toISOString())
        id = fatto.id
        return fatto.dati
      },
      orologio,
    )
    return scritto.esito === 'scritto' ? { ...scritto, id } : scritto
  } catch (e) {
    return { esito: 'errore', perche: problema ?? (e instanceof Error ? e.message : String(e)) }
  }
}
