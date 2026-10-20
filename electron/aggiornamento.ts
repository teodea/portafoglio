// L'aggiornamento dell'applicazione installata, con electron-updater.
// All'apertura (una volta sola) si guarda nelle Release di GitHub se c'è una versione nuova; se c'è,
// le pagine chiedono "la installo?". Con il sì si scarica e si installa alla chiusura, senza riaprire niente.
// Ad applicazione chiusa non resta acceso niente: nessun controllo, nessun servizio.
//
// Per le prove: --fonte-versioni=http://localhost:<porta>/ usa una finta fonte di versioni su questo PC
// (una cartella con latest.yml e l'installatore) e alla chiusura NON installa: scrive solo nel registro
// che cosa installerebbe.
import { app, BrowserWindow, ipcMain } from 'electron'
import { appendFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import updater from 'electron-updater'
import { CANALI_AGGIORNAMENTO, NESSUNO, prossimoStato, type EventoAggiornamento, type StatoAggiornamento } from '../src/dati/aggiornamento.ts'

const { autoUpdater } = updater

let stato: StatoAggiornamento = NESSUNO

function registro(): string {
  return join(app.getPath('userData'), 'aggiornamento.log')
}

/** Il registro dell'aggiornamento, in AppData: serve solo a capire cosa è successo se qualcosa non va. */
function scrivi(livello: string, ...parti: unknown[]) {
  const riga = `${new Date().toISOString()} ${livello} ${parti.map((p) => (p instanceof Error ? p.message : String(p))).join(' ')}\n`
  void (async () => {
    try {
      // Il registro non cresce senza fine: oltre 200 KB si ricomincia.
      const grande = await stat(registro()).then((s) => s.size > 200_000, () => false)
      await (grande ? writeFile(registro(), riga) : appendFile(registro(), riga))
    } catch {
      // Se non si riesce a scrivere il registro, pazienza: l'aggiornamento va avanti lo stesso.
    }
  })()
}

function cambia(evento: EventoAggiornamento) {
  const nuovo = prossimoStato(stato, evento)
  if (nuovo === stato) return
  stato = nuovo
  for (const finestra of BrowserWindow.getAllWindows()) finestra.webContents.send(CANALI_AGGIORNAMENTO.cambiato, stato)
}

/** Le funzioni per le pagine. Si registrano sempre, anche quando non si controlla (lo stato resta "nessuno"). */
export function registraFunzioniAggiornamento() {
  ipcMain.handle(CANALI_AGGIORNAMENTO.leggi, () => stato)
  ipcMain.handle(CANALI_AGGIORNAMENTO.rispondi, (_evento, installa: unknown) => {
    const prima = stato
    cambia({ tipo: 'risposta', installa: installa === true })
    if (prima !== stato && stato.stato === 'scarico') {
      scrivi('info', `Sì: scarico la versione ${stato.versione}`)
      autoUpdater.downloadUpdate().catch((e: unknown) => {
        scrivi('errore', 'Scaricamento non riuscito:', e)
        cambia({ tipo: 'errore' })
      })
    } else if (prima.stato !== stato.stato) {
      scrivi('info', 'Non ora: lo richiedo la prossima volta')
    }
    return stato
  })
}

/**
 * Il controllo all'apertura. Si fa solo nell'applicazione installata (o con la finta fonte delle prove):
 * con "npm run dev" non si controlla niente.
 */
export function controllaVersioneNuova(fonteDiProva: string | null) {
  if (!app.isPackaged && !fonteDiProva) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = !fonteDiProva
  autoUpdater.disableWebInstaller = true
  autoUpdater.logger = {
    info: (...p: unknown[]) => scrivi('info', ...p),
    warn: (...p: unknown[]) => scrivi('attenzione', ...p),
    error: (...p: unknown[]) => scrivi('errore', ...p),
    debug: () => {},
  }
  if (fonteDiProva) {
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.setFeedURL({ provider: 'generic', url: fonteDiProva })
    scrivi('info', `Prova: fonte di versioni ${fonteDiProva}; alla chiusura non installo niente`)
    app.on('will-quit', () => {
      if (stato.stato !== 'pronta') return
      const percorso = (autoUpdater as unknown as { installerPath?: string | null }).installerPath ?? '(sconosciuto)'
      scrivi('info', `Prova: alla chiusura installerei la versione ${stato.versione} da ${percorso}`)
    })
  }

  autoUpdater.on('update-available', (info) => cambia({ tipo: 'trovata', versione: info.version }))
  autoUpdater.on('update-not-available', () => cambia({ tipo: 'nessuna' }))
  autoUpdater.on('download-progress', (p) => cambia({ tipo: 'avanzamento', percento: p.percent }))
  autoUpdater.on('update-downloaded', (info) => {
    scrivi('info', `Versione ${info.version} scaricata: si installa alla chiusura`)
    cambia({ tipo: 'scaricata' })
  })
  autoUpdater.on('error', () => cambia({ tipo: 'errore' }))

  scrivi('info', `Versione installata ${app.getVersion()}: controllo se ce n'è una nuova`)
  autoUpdater.checkForUpdates().catch((e: unknown) => {
    // Niente internet o GitHub che non risponde: non si dice niente, si riprova alla prossima apertura.
    scrivi('attenzione', 'Controllo non riuscito:', e)
  })
}
