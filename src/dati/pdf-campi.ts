// Legge i campi del modulo di un PDF (ticket 12): i PDF di Fineco hanno i dati in campi di testo
// (AMM021, CED026), che si leggono senza interpretare il testo della pagina.
// Lo usa il processo principale (electron/pdf.ts); nel browser, durante lo sviluppo, il ponte finto.
// Niente file: riceve i byte. Usa pdf-lib, che è solo JavaScript.
import { PDFDocument, PDFTextField, PDFDropdown, PDFOptionList } from 'pdf-lib'
import type { CampiPdf } from './pdf-fineco.ts'

/** I campi di testo del modulo: { nome del campo: testo }. Un PDF senza modulo dà {}. Se il file non è un PDF, un errore. */
export async function campiDelPdf(byte: Uint8Array | ArrayBuffer): Promise<CampiPdf> {
  const doc = await PDFDocument.load(byte, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false })
  const campi: CampiPdf = {}
  for (const f of doc.getForm().getFields()) {
    let v: string | undefined
    if (f instanceof PDFTextField) v = f.getText()
    else if (f instanceof PDFDropdown || f instanceof PDFOptionList) v = f.getSelected().join(', ')
    if (v !== undefined) campi[f.getName()] = v
  }
  return campi
}
