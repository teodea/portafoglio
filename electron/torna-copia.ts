// "Torna a questa copia" dalla scheda Copie della pagina Dati, con il file a posto (ticket 13).
// Come la scrittura sicura (scrivi.ts):
//   1. si rilegge il file e si confronta con quello caricato: se è cambiato (un altro PC, Blocco note) ci si ferma;
//   2. si controlla che la copia scelta si legga;
//   3. si copia il file di adesso in "copie", con il perché ("prima di tornare alla copia del …");
//   4. si rimette la copia scelta, byte per byte, con un file temporaneo e la sostituzione.
// Il file di adesso non si perde mai: "Torna a questa copia" sulla copia appena fatta lo rimette com'era.
// Solo Node (niente Electron), così le prove lo usano su una cartella temporanea.
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { controllaFile } from '../src/dati/controllo.ts'
import { leggiNome } from '../src/dati/copie.ts'
import { percheDelRitorno, type EsitoRitorno } from '../src/dati/torna-copia.ts'
import { CARTELLA_COPIE, FILE_DATI } from '../src/dati/tipi.ts'
import { apriCartella, faiCopia, impronta, scriviSicuro, type Letto, type Orologio } from './cartella-dati.ts'

export type Ritorno = { esito: 'fatto'; letto: Letto; copia: string } | { esito: 'cambiato'; letto: Letto } | Extract<EsitoRitorno, { esito: 'errore' }>

export async function tornaAQuestaCopia(
  percorso: string,
  fileCopia: string,
  improntaVista: string | null,
  orologio: Orologio = () => new Date(),
): Promise<Ritorno> {
  // Solo un nome di copia dentro "copie", niente percorsi; il file rotto messo da parte non è una copia a cui tornare.
  const scelta = basename(fileCopia) === fileCopia ? leggiNome(fileCopia) : null
  if (!scelta) return { esito: 'errore', perche: 'la copia scelta non è stata trovata' }
  if (scelta.rotta) return { esito: 'errore', perche: 'si tratta del file non leggibile messo da parte, non di una copia a cui tornare' }

  const file = join(percorso, FILE_DATI)
  let attuale: Buffer | null
  try {
    attuale = await readFile(file)
  } catch {
    attuale = null
  }
  // 1. Rilettura e confronto.
  if (!attuale || !improntaVista || impronta(attuale) !== improntaVista) return { esito: 'cambiato', letto: await apriCartella(percorso, { orologio }) }

  // 2. La copia scelta deve leggersi.
  let copia: Buffer
  try {
    copia = await readFile(join(percorso, CARTELLA_COPIE, fileCopia))
  } catch {
    return { esito: 'errore', perche: `${fileCopia} non è nella cartella copie` }
  }
  const esito = controllaFile(copia.toString('utf8'))
  if (!esito.ok)
    return {
      esito: 'errore',
      perche: `la copia ${fileCopia} non è leggibile${esito.problema.riga ? ` (riga ${esito.problema.riga})` : ''} e non è stata usata`,
    }

  // 3. La copia del file di adesso.
  const fatta = await faiCopia(percorso, percheDelRitorno(scelta), orologio())
  // 4. La copia scelta al suo posto.
  await scriviSicuro(file, copia)
  // Riaperto con l'impronta nuova: l'ha scritto l'applicazione, quindi niente copia "all'apertura".
  const letto = await apriCartella(percorso, { orologio, improntaNota: impronta(copia) })
  return { esito: 'fatto', letto, copia: fatta }
}
