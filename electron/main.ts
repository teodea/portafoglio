// Il processo principale di Electron: la finestra, i file e (dai prossimi ticket) internet.
// Le pagine non toccano i file: chiedono al processo principale con le funzioni del preload.
//
// Opzioni dalla riga di comando, per le prove:
//   --cartella=<percorso>  usa questa cartella dei dati solo per questa volta (non la ricorda)
//   --profilo=<percorso>   tiene le impostazioni qui invece che in AppData (così una prova non tocca quelle vere)
//   --oggi=AAAA-MM-GG      le pagine fanno finta che oggi sia quel giorno (striscia "Ottobre è finito");
//                          i prezzi si chiedono comunque solo per i mesi davvero finiti
//   --fonte-versioni=http://localhost:<porta>/  controlla le versioni nuove su una finta fonte locale (vedi aggiornamento.ts)
//   --spegni="Borsa Italiana,Euronext Milano"  fa finta che queste fonti non rispondano, per provare le riserve
//                          (nomi delle fonti, anche brevi: "Deutsche Börse", "investing.com", "Yahoo")
//   --prova-scegli=<percorso>  "Cambia" la cartella sceglie questa invece di aprire la finestra di Windows
//                          (solo per le prove automatiche della pagina Dati, insieme a --profilo)
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { CARTELLA_COPIE } from '../src/dati/tipi.ts'
import { CANALI, type Apertura, type QualeCartella } from '../src/dati/ponte.ts'
import { fonteDiProva } from '../src/dati/aggiornamento.ts'
import { chiudi, controllaVersioneNuova, registraFunzioniAggiornamento } from './aggiornamento.ts'
import { apriCartella, creaFileVuoto, tornaAllaCopia, type Letto } from './cartella-dati.ts'
import { leggiImpostazioni, scriviImpostazioni } from './impostazioni.ts'
import { registraAggiorna } from './aggiorna.ts'
import { registraRiferimenti } from './riferimenti.ts'
import { registraCorrezione } from './correzione.ts'
import { registraPaginaDati } from './pagina-dati.ts'
import { registraRiferimentoAMano } from './riferimento-a-mano.ts'
import { registraMovimenti } from './movimenti.ts'
import { registraPdf } from './pdf.ts'
import { registraExcel } from './excel.ts'

const NOME_APP = 'Portafoglio titoli'
const indirizzoSviluppo = process.env.VITE_DEV_SERVER_URL

function opzione(nome: string): string | undefined {
  const prefisso = `--${nome}=`
  return process.argv.find((a) => a.startsWith(prefisso))?.slice(prefisso.length)
}

app.setName(NOME_APP)
const profilo = opzione('profilo')
if (profilo) app.setPath('userData', profilo)
const cartellaDiProva = opzione('cartella')
const oggiDiProva = /^\d{4}-\d{2}-\d{2}$/.test(opzione('oggi') ?? '') ? opzione('oggi') : undefined
const fontiSpente = (opzione('spegni') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
const sceltaDiProva = opzione('prova-scegli')

// Una sola finestra alla volta: due finestre sullo stesso file si pesterebbero i piedi.
if (!app.requestSingleInstanceLock()) app.quit()

// ---------- lo stato del file, tenuto qui e non nelle pagine ----------

let cartellaAttuale: string | null = null
let improntaAttuale: string | null = null

async function ricordaLetto(cartella: string, letto: Letto): Promise<Apertura> {
  cartellaAttuale = cartella
  improntaAttuale = letto.impronta
  if (letto.apertura.stato === 'pronto' && letto.impronta && !cartellaDiProva) {
    const imp = await leggiImpostazioni(app.getPath('userData'))
    imp.impronte = { ...imp.impronte, [cartella]: letto.impronta }
    await scriviImpostazioni(app.getPath('userData'), imp)
  }
  return letto.apertura
}

// Due richieste di apertura insieme (in prova, con "npm run dev", React avvia le pagine due volte) leggono il file
// una volta sola: la seconda riceve la stessa risposta, così non si fanno due copie "all'apertura" nello stesso minuto.
let aperturaInCorso: Promise<Apertura> | null = null
function apri(): Promise<Apertura> {
  aperturaInCorso ??= apriDavvero().finally(() => {
    aperturaInCorso = null
  })
  return aperturaInCorso
}

async function apriDavvero(): Promise<Apertura> {
  const imp = await leggiImpostazioni(app.getPath('userData'))
  const cartella = cartellaDiProva ?? imp.cartella
  if (!cartella) {
    cartellaAttuale = null
    improntaAttuale = null
    return { stato: 'nessuna-cartella' }
  }
  const improntaNota = cartellaDiProva ? null : (imp.impronte?.[cartella] ?? null)
  return ricordaLetto(cartella, await apriCartella(cartella, { improntaNota }))
}

async function scegliCartella(evento: IpcMainInvokeEvent): Promise<Apertura | null> {
  const finestra = BrowserWindow.fromWebContents(evento.sender)
  const opzioni: Electron.OpenDialogOptions = {
    title: 'Scegliere la cartella dei dati',
    buttonLabel: 'Usa questa cartella',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: cartellaAttuale ?? app.getPath('documents'),
  }
  const scelta = sceltaDiProva
    ? { canceled: false, filePaths: [sceltaDiProva] }
    : finestra
      ? await dialog.showOpenDialog(finestra, opzioni)
      : await dialog.showOpenDialog(opzioni)
  if (scelta.canceled || !scelta.filePaths[0]) return null
  const cartella = scelta.filePaths[0]
  const imp = await leggiImpostazioni(app.getPath('userData'))
  imp.cartella = cartella
  await scriviImpostazioni(app.getPath('userData'), imp)
  return ricordaLetto(cartella, await apriCartella(cartella, { improntaNota: imp.impronte?.[cartella] ?? null }))
}

function registraFunzioni() {
  ipcMain.handle(CANALI.apri, () => apri())
  ipcMain.handle(CANALI.scegliCartella, (evento) => scegliCartella(evento))
  ipcMain.handle(CANALI.tornaAllaCopia, async (_evento, file: unknown) => {
    if (!cartellaAttuale || typeof file !== 'string') return apri()
    return ricordaLetto(cartellaAttuale, await tornaAllaCopia(cartellaAttuale, file, improntaAttuale))
  })
  ipcMain.handle(CANALI.creaFileVuoto, async () => {
    if (!cartellaAttuale) return apri()
    return ricordaLetto(cartellaAttuale, await creaFileVuoto(cartellaAttuale))
  })
  ipcMain.handle(CANALI.apriInEsplora, async (_evento, quale: unknown) => {
    if (!cartellaAttuale) return
    const copie = (quale as QualeCartella) === 'copie'
    const errore = await shell.openPath(copie ? join(cartellaAttuale, CARTELLA_COPIE) : cartellaAttuale)
    // La cartella delle copie può non esserci ancora: si apre quella dei dati.
    if (errore && copie) await shell.openPath(cartellaAttuale)
  })
  const contesto = { cartella: () => cartellaAttuale, impronta: () => improntaAttuale, ricorda: ricordaLetto }
  registraAggiorna(contesto, fontiSpente)
  registraCorrezione(contesto)
  registraPaginaDati(contesto)
  registraRiferimentoAMano(contesto)
  registraMovimenti(contesto)
  registraPdf()
  registraExcel()
  registraRiferimenti(fontiSpente)
}

// ---------- la finestra ----------

function creaFinestra() {
  const finestra = new BrowserWindow({
    title: NOME_APP,
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 520,
    show: false,
    // Lo stesso fondo delle pagine, così all'apertura non lampeggia il bianco nel tema scuro.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0E1116' : '#F6F7F9',
    icon: join(app.getAppPath(), indirizzoSviluppo ? 'public' : 'dist', 'favicon.ico'),
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })
  finestra.once('ready-to-show', () => finestra.show())

  // Si resta sempre dentro l'applicazione: i link verso internet si aprono nel browser.
  finestra.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  finestra.webContents.on('will-navigate', (evento, url) => {
    if (indirizzoSviluppo && url.startsWith(indirizzoSviluppo)) return
    evento.preventDefault()
    if (url.startsWith('https://')) void shell.openExternal(url)
  })

  // Il menu del tasto destro di Windows: copia, e incolla nelle caselle.
  finestra.webContents.on('context-menu', (_evento, p) => {
    const voci: Electron.MenuItemConstructorOptions[] = p.isEditable
      ? [
          { role: 'cut', label: 'Taglia' },
          { role: 'copy', label: 'Copia' },
          { role: 'paste', label: 'Incolla' },
          { type: 'separator' },
          { role: 'selectAll', label: 'Seleziona tutto' },
        ]
      : p.selectionText
        ? [{ role: 'copy', label: 'Copia' }]
        : []
    if (voci.length) Menu.buildFromTemplate(voci).popup({ window: finestra })
  })

  const ricerca = oggiDiProva ? `?oggi=${oggiDiProva}` : ''
  if (indirizzoSviluppo) void finestra.loadURL(indirizzoSviluppo + ricerca)
  else void finestra.loadFile(join(app.getAppPath(), 'dist', 'index.html'), { search: ricerca })
}

app.on('second-instance', () => {
  const finestra = BrowserWindow.getAllWindows()[0]
  if (!finestra) return
  if (finestra.isMinimized()) finestra.restore()
  finestra.focus()
})

// Chiusa la finestra, l'applicazione finisce: non resta acceso niente
// (con una versione nuova scaricata, si installa e il programma si riapre: vedi aggiornamento.ts).
app.on('window-all-closed', () => chiudi())

void app.whenReady().then(() => {
  // Niente barra dei menu: le pagine hanno già tutto. Il tema segue quello di Windows.
  Menu.setApplicationMenu(null)
  nativeTheme.themeSource = 'system'
  registraFunzioni()
  registraFunzioniAggiornamento()
  creaFinestra()
  controllaVersioneNuova(fonteDiProva(opzione('fonte-versioni')))
})
