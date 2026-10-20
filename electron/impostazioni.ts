// Cosa ricorda l'applicazione su questo PC, fuori dalla cartella dei dati:
// la cartella scelta e l'impronta del file come l'ha lasciato l'ultima volta.
// Sta in impostazioni.json nella cartella dell'applicazione di Windows (AppData\Roaming\Portafoglio titoli).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { scriviSicuro } from './cartella-dati.ts'

export type Impostazioni = {
  cartella?: string
  /** Per cartella: l'impronta del file dei dati l'ultima volta che l'applicazione l'ha letto o scritto. */
  impronte?: Record<string, string>
}

const NOME = 'impostazioni.json'

export async function leggiImpostazioni(cartellaApp: string): Promise<Impostazioni> {
  try {
    const v: unknown = JSON.parse(await readFile(join(cartellaApp, NOME), 'utf8'))
    return typeof v === 'object' && v !== null ? (v as Impostazioni) : {}
  } catch {
    return {}
  }
}

export async function scriviImpostazioni(cartellaApp: string, impostazioni: Impostazioni): Promise<void> {
  await scriviSicuro(join(cartellaApp, NOME), JSON.stringify(impostazioni, null, 2) + '\n')
}
