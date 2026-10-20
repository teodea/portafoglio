// Trascinare il PDF della banca (ticket 12): sulla pagina Movimenti apre Registra, nella zona di Registra lo legge.
import type { DragEvent } from 'react'

let inArrivo: File[] | null = null

/** Registra prende i PDF arrivati da Movimenti (una volta sola). */
export function prendiPdf(): File[] | null {
  const f = inArrivo
  inArrivo = null
  return f
}

/** Movimenti passa a Registra i PDF trascinati sulla pagina (restano qui solo il tempo di cambiare pagina). */
export function consegnaPdf(file: File[]) {
  inArrivo = file
}

/** I PDF di un trascinamento, se ce ne sono. */
export function pdfTrascinati(e: DragEvent): File[] {
  return [...(e.dataTransfer?.files ?? [])].filter((f) => /\.pdf$/i.test(f.name))
}

/** Il trascinamento porta dei file? (Durante il trascinamento i nomi non si vedono ancora.) */
export function portaFile(e: DragEvent): boolean {
  return [...(e.dataTransfer?.items ?? [])].some((i) => i.kind === 'file')
}
