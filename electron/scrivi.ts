// La scrittura sicura del file dei dati (spec, sezione 7), in quest'ordine:
//   1. si rilegge il file e si confronta con quello caricato: se è cambiato (un altro PC, Blocco note) ci si ferma;
//   2. si fa la copia in "copie", con la data e il perché;
//   3. si scrive in un file temporaneo;
//   4. si sostituisce l'originale.
// Il file nuovo si controlla come all'apertura prima di scriverlo: un file che non si leggerebbe non si scrive.
// Solo Node (niente Electron), così le prove lo usano su una cartella temporanea.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { controllaFile } from '../src/dati/controllo.ts'
import { FILE_DATI, type FileDati } from '../src/dati/tipi.ts'
import { apriCartella, faiCopia, impronta, scriviSicuro, type Letto, type Orologio } from './cartella-dati.ts'

export type Scritto =
  | { esito: 'scritto'; letto: Letto; copia: string }
  /** Il file non è più quello letto: non si è scritto niente, e si riapre com'è adesso. */
  | { esito: 'cambiato'; letto: Letto }

/** Come scrive il file l'applicazione: due spazi di rientro e un a capo in fondo. */
export function testoDelFile(dati: FileDati): string {
  return JSON.stringify(dati, null, 2) + '\n'
}

export async function scriviConCopia(
  percorso: string,
  improntaVista: string | null,
  /** Il perché della copia, es. "prima dell'aggiornamento di ottobre"; può dipendere dal file com'era. */
  perche: string | ((dati: FileDati) => string),
  cambia: (dati: FileDati) => FileDati,
  orologio: Orologio = () => new Date(),
): Promise<Scritto> {
  const file = join(percorso, FILE_DATI)
  let attuale: Buffer | null
  try {
    attuale = await readFile(file)
  } catch {
    attuale = null
  }
  // 1. Rilettura e confronto.
  if (!attuale || !improntaVista || impronta(attuale) !== improntaVista)
    return { esito: 'cambiato', letto: await apriCartella(percorso, { orologio }) }
  const esito = controllaFile(attuale.toString('utf8'))
  if (!esito.ok) return { esito: 'cambiato', letto: await apriCartella(percorso, { orologio }) }

  const nuovo = testoDelFile(cambia(esito.dati))
  const controllo = controllaFile(nuovo)
  if (!controllo.ok) throw new Error(`il file nuovo non sarebbe a posto (${controllo.problema.spiegazione}): non ho scritto niente`)

  // 2. La copia del file com'era.
  const copia = await faiCopia(percorso, typeof perche === 'string' ? perche : perche(esito.dati), orologio())
  // 3 e 4. File temporaneo, poi sostituzione.
  await scriviSicuro(file, nuovo)
  // Riaperto con l'impronta nuova: è l'applicazione che l'ha scritto, quindi niente copia "all'apertura".
  const letto = await apriCartella(percorso, { orologio, improntaNota: impronta(nuovo) })
  return { esito: 'scritto', letto, copia }
}
