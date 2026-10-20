// I file nella cartella dei dati: leggere e controllare portafoglio.json, le copie in "copie",
// tornare a una copia quando il file è rotto. Solo Node (niente Electron), così le prove lo usano
// su una cartella temporanea con un portafoglio inventato.
//
// Regole (spec, sezione 5): niente si scrive senza un clic dell'utente; prima di ogni scrittura
// si fa una copia; il file rotto non si cancella; se il file è cambiato nel frattempo ci si ferma.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { controllaFile } from '../src/dati/controllo.ts'
import { nomeCopia, nomeRotto, ordinaCopie, PERCHE_APERTURA, type Copia } from '../src/dati/copie.ts'
import type { Apertura, Cartella } from '../src/dati/ponte.ts'
import { CARTELLA_COPIE, FILE_DATI, type FileDati } from '../src/dati/tipi.ts'

export type Orologio = () => Date

export function descriviCartella(percorso: string): Cartella {
  return { percorso, nome: basename(percorso) || percorso }
}

export function impronta(testo: string | Buffer): string {
  return createHash('sha256').update(testo).digest('hex')
}

async function eUnaCartella(percorso: string): Promise<boolean> {
  try {
    return (await stat(percorso)).isDirectory()
  } catch {
    return false
  }
}

export async function elencaCopie(cartella: string): Promise<Copia[]> {
  try {
    const copie = ordinaCopie(await readdir(join(cartella, CARTELLA_COPIE)))
    // Il nome ha solo ore e minuti: le copie dello stesso minuto si mettono in ordine con l'ora del file (ticket 13).
    const ora = new Map<string, number>()
    for (const c of copie) ora.set(c.file, await stat(join(cartella, CARTELLA_COPIE, c.file)).then((s) => s.mtimeMs, () => 0))
    return copie.sort((a, b) => b.quando.localeCompare(a.quando) || ora.get(b.file)! - ora.get(a.file)! || b.numero - a.numero)
  } catch {
    return []
  }
}

/** Scrive senza mai lasciare un file a metà: prima un file temporaneo, poi lo sostituisce. */
export async function scriviSicuro(percorso: string, contenuto: string | Buffer): Promise<void> {
  const temporaneo = percorso + '.scrittura'
  await writeFile(temporaneo, contenuto)
  await rename(temporaneo, percorso)
}

// Un nome libero in "copie": se c'è già un file con lo stesso nome si aggiunge (2), (3)…
async function nomeLibero(cartellaCopie: string, nome: (numero: number) => string): Promise<string> {
  for (let n = 1; ; n++) if (!existsSync(join(cartellaCopie, nome(n)))) return nome(n)
}

/** Copia il file dei dati com'è adesso in "copie", con la data e il perché. Restituisce il nome. */
export async function faiCopia(cartella: string, perche: string, adesso: Date): Promise<string> {
  const cartellaCopie = join(cartella, CARTELLA_COPIE)
  await mkdir(cartellaCopie, { recursive: true })
  const nome = await nomeLibero(cartellaCopie, (n) => nomeCopia(adesso, perche, n))
  await copyFile(join(cartella, FILE_DATI), join(cartellaCopie, nome))
  return nome
}

/**
 * Quello che resta in memoria dopo l'apertura: l'impronta del file letto,
 * per accorgersi se qualcuno lo cambia prima di una scrittura (due PC sullo stesso file).
 */
export type Letto = { apertura: Apertura; impronta: string | null }

export type OpzioniApertura = {
  orologio?: Orologio
  /**
   * L'impronta del file come l'ha lasciato l'ultima volta questa applicazione su questo PC.
   * Se il file è ancora quello, non serve una copia all'apertura.
   */
  improntaNota?: string | null
}

/**
 * Apre la cartella e controlla il file. Se il file è a posto ma è cambiato fuori dall'applicazione
 * (Blocco note, un altro PC, la prima apertura) e non è uguale all'ultima copia, ne fa una copia
 * "all'apertura": così "Torna all'ultima copia" ha sempre dove tornare.
 */
export async function apriCartella(percorso: string, opzioni: OpzioniApertura = {}): Promise<Letto> {
  const orologio = opzioni.orologio ?? (() => new Date())
  const cartella = descriviCartella(percorso)
  if (!(await eUnaCartella(percorso))) return { apertura: { stato: 'cartella-mancante', cartella }, impronta: null }
  const file = join(percorso, FILE_DATI)
  let contenuto: Buffer
  try {
    contenuto = await readFile(file)
  } catch {
    return { apertura: { stato: 'file-mancante', cartella }, impronta: null }
  }
  const adesso = orologio()
  const controllato = adesso.toISOString()
  const esito = controllaFile(contenuto.toString('utf8'))
  let copie = await elencaCopie(percorso)
  if (!esito.ok) {
    return {
      apertura: { stato: 'rotto', cartella, problema: esito.problema, controllato, copie },
      impronta: impronta(contenuto),
    }
  }
  const giaNoto = opzioni.improntaNota === impronta(contenuto)
  const ultima = copie.find((c) => !c.rotta)
  const ugualeAllUltima = ultima ? await stessoContenuto(join(percorso, CARTELLA_COPIE, ultima.file), contenuto) : false
  if (!giaNoto && !ugualeAllUltima) {
    try {
      await faiCopia(percorso, PERCHE_APERTURA, adesso)
      copie = await elencaCopie(percorso)
    } catch {
      // Una cartella in sola lettura non impedisce di guardare i dati.
    }
  }
  return {
    apertura: { stato: 'pronto', cartella, dati: esito.dati, controllato, copie },
    impronta: impronta(contenuto),
  }
}

async function stessoContenuto(file: string, contenuto: Buffer): Promise<boolean> {
  try {
    return (await readFile(file)).equals(contenuto)
  } catch {
    return false
  }
}

/**
 * Con il file rotto: mette da parte il file rotto in "copie" come "portafoglio rotto <data>.json"
 * e rimette al suo posto la copia scelta. Non tocca niente se:
 * - il file è cambiato da quando è stato controllato (qualcuno l'ha corretto o cambiato: si riapre e basta);
 * - la copia scelta non esiste o non si legge nemmeno lei.
 */
export async function tornaAllaCopia(
  percorso: string,
  fileCopia: string,
  improntaVista: string | null,
  orologio: Orologio = () => new Date(),
): Promise<Letto> {
  const cartellaCopie = join(percorso, CARTELLA_COPIE)
  const file = join(percorso, FILE_DATI)
  const riapriConAvviso = async (avviso: string): Promise<Letto> => {
    const letto = await apriCartella(percorso, { orologio })
    if (letto.apertura.stato === 'rotto') letto.apertura.avviso = avviso
    return letto
  }

  // Solo un nome di file dentro "copie", niente percorsi.
  if (basename(fileCopia) !== fileCopia || !ordinaCopie([fileCopia]).length)
    return riapriConAvviso('La copia scelta non è stata trovata.')

  let attuale: Buffer | null = null
  try {
    attuale = await readFile(file)
  } catch {
    attuale = null
  }
  if (attuale && impronta(attuale) !== improntaVista) {
    // Il file non è più quello controllato: si guarda di nuovo, senza toccarlo.
    return riapriConAvviso('Il file dei dati è cambiato nel frattempo: è stato controllato di nuovo e lasciato invariato.')
  }

  let copia: Buffer
  try {
    copia = await readFile(join(cartellaCopie, fileCopia))
  } catch {
    return riapriConAvviso('La copia scelta non è nella cartella copie.')
  }
  const esitoCopia = controllaFile(copia.toString('utf8'))
  if (!esitoCopia.ok)
    return riapriConAvviso(
      `Anche la copia ${fileCopia} non è leggibile${esitoCopia.problema.riga ? ` (riga ${esitoCopia.problema.riga})` : ''} e non è stata usata. Sceglierne un’altra.`,
    )

  // Prima di scrivere: il file rotto va in "copie", non si cancella.
  const adesso = orologio()
  if (attuale) {
    await mkdir(cartellaCopie, { recursive: true })
    const nome = await nomeLibero(cartellaCopie, (n) => nomeRotto(adesso, n))
    await writeFile(join(cartellaCopie, nome), attuale)
  }
  await scriviSicuro(file, copia)
  return apriCartella(percorso, { orologio })
}

/** Nella cartella non c'è portafoglio.json: se l'utente lo chiede, se ne crea uno vuoto. */
export async function creaFileVuoto(percorso: string, orologio: Orologio = () => new Date()): Promise<Letto> {
  const file = join(percorso, FILE_DATI)
  if (!existsSync(file)) {
    const vuoto: FileDati = {
      formato: 'portafoglio',
      versione: 2,
      creato: orologio().toISOString(),
      titoli: [],
      operazioni: [],
      dividendi: [],
      prezzi: [],
    }
    await scriviSicuro(file, JSON.stringify(vuoto, null, 2) + '\n')
  }
  return apriCartella(percorso, { orologio })
}
