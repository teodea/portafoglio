// Lo stato della cartella e del file dei dati, condiviso da tutte le pagine.
// Le pagine leggono i dati con useFile(); per cambiare qualcosa chiedono con esegui(),
// che passa dal ponte e aggiorna lo stato con quello che risponde il processo principale.
import { createContext, useContext } from 'react'
import type { Apertura } from './dati/ponte.ts'

export type FilePronto = Extract<Apertura, { stato: 'pronto' }>

export type Stato = {
  apertura: Apertura
  /** Chiede qualcosa al processo principale; null vuol dire "non è cambiato niente" (es. finestra chiusa). */
  esegui: (azione: () => Promise<Apertura | null>) => Promise<Apertura | null>
  occupato: boolean
}

export const ContestoStato = createContext<Stato | null>(null)

export function useStato(): Stato {
  const s = useContext(ContestoStato)
  if (!s) throw new Error('useStato fuori da ContestoStato')
  return s
}

/** Solo per le pagine, che si vedono solo quando il file è a posto. */
export function useFile(): FilePronto {
  const { apertura } = useStato()
  if (apertura.stato !== 'pronto') throw new Error('useFile senza un file a posto')
  return apertura
}
