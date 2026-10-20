// I nomi delle copie nella sottocartella "copie" della cartella dei dati.
// Il nome dice tutto, così si legge anche da Esplora file e non serve un elenco a parte:
//   portafoglio 2026-11-03 1802 prima dell'aggiornamento di ottobre.json
//   portafoglio 2026-10-19 2015 all'apertura.json
//   portafoglio rotto 2026-11-04 0912.json        (il file che non si leggeva, messo da parte)
// Se nello stesso minuto ci sono due copie, la seconda ha " (2)" in fondo.
// Modulo puro.

export type Copia = {
  /** Il nome del file dentro "copie". */
  file: string
  /** Data e ora locali, "AAAA-MM-GGTHH:MM". */
  quando: string
  /** Perché è stata fatta, in parole: "prima dell'aggiornamento di ottobre". Vuoto se non si sa. */
  perche: string
  /** true per il file rotto messo da parte: non è una copia a cui tornare. */
  rotta: boolean
  /** 1, oppure 2, 3… per le copie fatte nello stesso minuto. */
  numero: number
}

const NOME = /^portafoglio (rotto )?(\d{4}-\d{2}-\d{2}) (\d{2})(\d{2})(?: (.*?))?(?: \((\d+)\))?\.json$/

export const PERCHE_APERTURA = "all'apertura"

function dueCifre(n: number): string {
  return String(n).padStart(2, '0')
}

function dataOra(d: Date): { giorno: string; ora: string } {
  return {
    giorno: `${d.getFullYear()}-${dueCifre(d.getMonth() + 1)}-${dueCifre(d.getDate())}`,
    ora: `${dueCifre(d.getHours())}${dueCifre(d.getMinutes())}`,
  }
}

// Caratteri che Windows non accetta nei nomi dei file.
function pulisci(perche: string): string {
  // oxlint-disable-next-line no-control-regex -- i caratteri di controllo sono proprio quelli da togliere
  return perche.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function nomeCopia(quando: Date, perche: string, numero = 1): string {
  const { giorno, ora } = dataOra(quando)
  const p = pulisci(perche)
  return `portafoglio ${giorno} ${ora}${p ? ' ' + p : ''}${numero > 1 ? ` (${numero})` : ''}.json`
}

export function nomeRotto(quando: Date, numero = 1): string {
  const { giorno, ora } = dataOra(quando)
  return `portafoglio rotto ${giorno} ${ora}${numero > 1 ? ` (${numero})` : ''}.json`
}

export function leggiNome(file: string): Copia | null {
  const m = NOME.exec(file)
  if (!m) return null
  return {
    file,
    quando: `${m[2]}T${m[3]}:${m[4]}`,
    perche: m[5] ?? '',
    rotta: Boolean(m[1]),
    numero: m[6] ? Number(m[6]) : 1,
  }
}

/** Le copie dalla più recente alla più vecchia; i file con altri nomi si ignorano. */
export function ordinaCopie(nomi: string[]): Copia[] {
  return nomi
    .map(leggiNome)
    .filter((c): c is Copia => c !== null)
    .sort((a, b) => b.quando.localeCompare(a.quando) || b.numero - a.numero)
}

/**
 * La frase dopo una scrittura: dove trovare la copia, senza il nome tecnico del file, che è lungo due righe
 * (collaudo del 19/10). Il nome intero si vede nella pagina Dati, scheda Copie, e in Esplora file.
 */
export const FRASE_COPIA = 'Prima di scrivere ho fatto una copia del file: la trovi nella pagina Dati, scheda Copie, in cima all’elenco.'

/** "19/10/2026 alle 20:15" */
export function quandoInParole(quando: string): string {
  const [giorno, ora] = quando.split('T')
  return `${giorno.split('-').reverse().join('/')} alle ${ora}`
}
