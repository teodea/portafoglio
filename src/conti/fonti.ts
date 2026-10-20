// Il nome della fonte di un prezzo, scritto come in DESIGN.md ("Prezzo con fonte e cambio").
// Nel file la fonte dei mesi caricati dal file Excel è scritta per esteso, es. "file (foglio …)":
// sulle pagine diventa "file Excel iniziale", come il valore fisso della versione 3 ("dal tuo file Excel"); un prezzo inserito manualmente ("a mano" nel file) si scrive "manuale".
// Modulo puro.
import { FONTE } from '../dati/aggiorna/fonti.ts'

export type FonteInParole = {
  /** Il nome da scrivere sotto il prezzo: "file Excel iniziale", "Borsa Italiana"… */
  nome: string
  /** true se viene dalla borsa ufficiale di quotazione (puntino verde nelle tabelle). */
  borsa: boolean
  /** Il testo del file, se dice qualcosa in più del nome (es. il perché di una stima). */
  dettaglio: string | null
}

/** Il nome mostrato dei mesi caricati dal file Excel iniziale: le pagine lo confrontano con questo. */
export const NOME_FILE_EXCEL = 'file Excel iniziale'

const BORSE_UFFICIALI = [
  'Borsa Italiana',
  'Euronext Milano',
  'Deutsche Börse (Xetra)',
  'Deutsche Börse (Francoforte)',
  'London Stock Exchange',
  'Euronext Parigi',
]

export function fonteInParole(fonte: string): FonteInParole {
  const f = fonte.trim()
  if (/^file\b/i.test(f) || f === FONTE.fileExcel) return { nome: NOME_FILE_EXCEL, borsa: false, dettaglio: null }
  if (/^prezzo d.acquisto/i.test(f)) return { nome: 'prezzo d’acquisto', borsa: false, dettaglio: null }
  if (f === FONTE.aMano) return { nome: 'manuale', borsa: false, dettaglio: null }
  if (/^stima\b/i.test(f)) return { nome: 'stima', borsa: false, dettaglio: f.replace(/^stima:?\s*/i, '') || null }
  if (BORSE_UFFICIALI.includes(f)) return { nome: f, borsa: true, dettaglio: null }
  return { nome: f || '—', borsa: false, dettaglio: null }
}
