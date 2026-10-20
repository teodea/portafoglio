// Legge dal disco i campi del modulo di un PDF della banca (ticket 12). Solo Node: le prove lo usano
// su un PDF inventato in una cartella temporanea.
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { campiDelPdf } from '../src/dati/pdf-campi.ts'
import type { PdfAperto } from '../src/dati/pdf-fineco.ts'

/** Un PDF della banca pesa mezzo megabyte: oltre questo non è un PDF della banca. */
const MASSIMO = 20 * 1024 * 1024

/** Legge i campi del modulo di un PDF dal disco. Non lancia errori: il perché va nella risposta. */
export async function apriPdf(percorso: string): Promise<PdfAperto> {
  const nome = basename(percorso)
  if (!/\.pdf$/i.test(nome)) return { nome, percorso, perche: 'non è un PDF' }
  try {
    const s = await stat(percorso)
    if (s.size > MASSIMO) return { nome, percorso, perche: 'il file è troppo grande per essere un PDF della banca' }
    return { nome, percorso, campi: await campiDelPdf(await readFile(percorso)) }
  } catch (e) {
    const codice = (e as NodeJS.ErrnoException).code
    return { nome, percorso, perche: codice === 'ENOENT' ? 'il file non esiste più' : 'il file non si apre come PDF' }
  }
}

