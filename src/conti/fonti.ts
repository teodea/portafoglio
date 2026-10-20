// Il nome della fonte di un prezzo, scritto come in DESIGN.md ("Prezzo con fonte e cambio").
// Nel file la fonte dei mesi caricati dal file Excel è scritta per esteso, es. "file (foglio …)":
// sulle pagine diventa "dal tuo file Excel". Modulo puro.

export type FonteInParole = {
  /** Il nome da scrivere sotto il prezzo: "dal tuo file Excel", "Borsa Italiana"… */
  nome: string
  /** true se viene dalla borsa ufficiale di quotazione (puntino verde nelle tabelle). */
  borsa: boolean
  /** Il testo del file, se dice qualcosa in più del nome (es. il perché di una stima). */
  dettaglio: string | null
}

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
  if (/^file\b/i.test(f)) return { nome: 'dal tuo file Excel', borsa: false, dettaglio: null }
  if (/^prezzo d.acquisto/i.test(f)) return { nome: 'prezzo d’acquisto', borsa: false, dettaglio: null }
  if (/^stima\b/i.test(f)) return { nome: 'stima', borsa: false, dettaglio: f.replace(/^stima:?\s*/i, '') || null }
  if (BORSE_UFFICIALI.includes(f)) return { nome: f, borsa: true, dettaglio: null }
  return { nome: f || '—', borsa: false, dettaglio: null }
}
