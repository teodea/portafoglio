// "npm run dev": compila il processo principale, accende Vite per le pagine e apre la finestra di Electron.
// Le pagine si ricaricano da sole quando cambiano; se cambia electron/, si chiude la finestra e si rilancia.
// Gli argomenti in più passano a Electron, es.:  npm run dev -- --cartella="C:\percorso\dati" --profilo="C:\percorso\profilo"
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const tsc = spawnSync(process.execPath, [createRequire(import.meta.url).resolve('typescript/bin/tsc'), '-p', 'tsconfig.electron.json'], {
  stdio: 'inherit',
})
if (tsc.status !== 0) process.exit(tsc.status ?? 1)

const server = await createServer()
await server.listen()
const indirizzo = server.resolvedUrls?.local[0]
if (!indirizzo) throw new Error('Vite non ha un indirizzo locale')
console.log(`Pagine su ${indirizzo}`)

const electron = createRequire(import.meta.url)('electron')
const finestra = spawn(electron, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: indirizzo },
})
finestra.on('close', async (codice) => {
  await server.close()
  process.exit(codice ?? 0)
})
