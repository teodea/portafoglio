// Una finestra di Electron che non si vede, per le borse che danno i prezzi solo alle loro pagine
// (Deutsche Börse vuole le firme calcolate dalla pagina; Londra un permesso che la pagina chiede da sola).
// Si apre la pagina pubblica del titolo, come farebbe una persona, e si legge quello che mostra.
// Una sola finestra alla volta; si chiude subito dopo. I cookie stanno in memoria e spariscono alla chiusura.
import { BrowserWindow, session, type WebContents } from 'electron'
import { AGENTE, NonVa } from './comune.ts'

const PARTIZIONE = 'fonti' // senza "persist:": niente resta sul disco

let coda: Promise<unknown> = Promise.resolve()

function sessione() {
  const s = session.fromPartition(PARTIZIONE)
  s.setUserAgent(AGENTE)
  // Niente finestre di permessi (notifiche, posizione…): si risponde sempre di no.
  s.setPermissionRequestHandler((_wc, _permesso, risposta) => risposta(false))
  return s
}

/** Apre l'indirizzo in una finestra nascosta e ci fa il lavoro. Le richieste si mettono in fila. */
export function conFinestraNascosta<T>(
  indirizzo: string,
  lavoro: (wc: WebContents) => Promise<T>,
  prima?: (wc: WebContents) => void,
  secondi = 90,
): Promise<T> {
  const turno = coda.then(async () => {
    const finestra = new BrowserWindow({
      show: false,
      width: 1366,
      height: 900,
      webPreferences: {
        session: sessione(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        offscreen: false,
        spellcheck: false,
      },
    })
    finestra.webContents.setAudioMuted(true)
    finestra.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    let timer: NodeJS.Timeout | undefined
    try {
      prima?.(finestra.webContents)
      const scaduto = new Promise<never>((_, no) => {
        timer = setTimeout(() => no(new NonVa('non ha risposto in tempo')), secondi * 1000)
      })
      const fatto = (async () => {
        try {
          await finestra.loadURL(indirizzo)
        } catch (e) {
          // Una pagina che si ferma a metà caricamento (ERR_ABORTED per un rimando) va bene lo stesso.
          if (!(e instanceof Error && /ERR_ABORTED/.test(e.message)))
            throw new NonVa('la pagina non si apre: controllare la connessione a internet')
        }
        return await lavoro(finestra.webContents)
      })()
      return await Promise.race([fatto, scaduto])
    } finally {
      clearTimeout(timer)
      if (!finestra.isDestroyed()) finestra.destroy()
    }
  })
  coda = turno.catch(() => undefined)
  return turno
}

const pausa = (ms: number) => new Promise((fatto) => setTimeout(fatto, ms))

/** Esegue il codice nella pagina finché restituisce qualcosa di diverso da null (o finisce il tempo). */
export async function aspettaNellaPagina<T>(wc: WebContents, codice: string, secondi: number, ogni = 600): Promise<T | null> {
  const fine = Date.now() + secondi * 1000
  while (Date.now() < fine) {
    if (wc.isDestroyed()) return null
    try {
      const v = (await wc.executeJavaScript(codice, true)) as T | null
      if (v !== null && v !== undefined) return v
    } catch {
      // La pagina si sta ancora caricando: si riprova.
    }
    await pausa(ogni)
  }
  return null
}
