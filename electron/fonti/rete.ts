// La rete di Chromium, per i siti che rispondono solo a un browser vero (investing.com rifiuta
// le richieste di Node con l'errore 403). Stessa sessione in memoria delle finestre nascoste:
// niente resta sul disco. Solo Electron: le prove usano fonti finte.
import { session } from 'electron'
import { AGENTE, type Scarica } from './comune.ts'

export const scaricaComeBrowser: Scarica = (url, init) => {
  const s = session.fromPartition('fonti')
  s.setUserAgent(AGENTE)
  return s.fetch(url, init)
}
