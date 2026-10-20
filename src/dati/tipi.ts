// Il file dei dati, portafoglio.json, nella cartella dei dati scelta dall'utente.
// Modulo puro: lo usano sia le pagine sia il processo principale.
//
// Versione 2: la storia caricata dal ticket "Fare il carico iniziale della storia".
// Date in formato AAAA-MM-GG; la data di un'operazione o di un dividendo è la valuta di regolamento.
// Versione 3 (ticket 6): arriva alla prima scrittura dell'applicazione, con una copia prima
// (passaggio in dati/aggiorna/versione3.ts). Aggiunge la valuta dei titoli, la fonte con un nome fisso
// su ogni prezzo (seduta, nota, prezzo di prima se è a mano) e i cambi BCE di fine mese.
// Ticket 9: i valori dei sei riferimenti di borsa e l'inflazione NIC (elenchi "riferimenti" e "nic").
// Ticket 7: i codici investing.com e Yahoo dei titoli (le riserve) e il controllo di investing.com sui prezzi.

export const FILE_DATI = 'portafoglio.json'
export const CARTELLA_COPIE = 'copie'

/** Le versioni del file che questa applicazione sa leggere. */
export const VERSIONI_CONOSCIUTE = [1, 2, 3] as const
/** La versione che scrive questa applicazione. */
export const VERSIONE_ATTUALE = 3

export const BORSE = ['MIL', 'XET', 'FRA', 'LON', 'PAR'] as const
export type Borsa = (typeof BORSE)[number]

export type FileDati = {
  formato: 'portafoglio'
  versione: (typeof VERSIONI_CONOSCIUTE)[number]
  creato: string
  titoli?: Titolo[]
  operazioni?: Operazione[]
  dividendi?: Dividendo[]
  prezzi?: PrezzoFineMese[]
  /** Dalla versione 3: i cambi BCE di fine mese (unità di valuta per 1 euro). */
  cambi?: CambioFineMese[]
  /** Dalla versione 3 (ticket 9): i valori dei riferimenti di borsa, a fine mese e alle date dei movimenti. */
  riferimenti?: ValoreRiferimento[]
  /** Dalla versione 3 (ticket 9): l'inflazione NIC di ISTAT, indice generale, un valore per mese. */
  nic?: NicDelMese[]
}

// Un titolo è ISIN più borsa: l'id è "ISIN-BORSA", es. "ZZ0000000001-MIL" (codice inventato).
export type Titolo = {
  id: string
  isin: string
  borsa: Borsa
  nomeBorsa: string
  nome: string
  soprannome: string | null
  simbolo: string | null
  descrizioneBanca: string
  dossier: string
  tipo?: 'Obbligazione'
  /** Cosa è il titolo in parole semplici, es. "Azioni di tutto il mondo". Sta solo nel file dei dati. */
  paroleSemplici?: string
  /** Dalla versione 3: la valuta in cui è quotato, es. "EUR" o "GBP". */
  valuta?: string
  /** Il codice della linea di quotazione su investing.com (riserva e controllo), es. 123456. */
  codiceInvesting?: number
  /** Il codice Yahoo (seconda riserva), es. "MOND.MI". */
  codiceYahoo?: string
  /** Se i codici delle riserve sono di un'altra borsa: "XET" per un titolo di Francoforte che le riserve hanno solo su Xetra. */
  borsaRiserve?: 'XET'
}

export type Operazione = {
  id: string
  titolo: string
  tipo: 'acquisto' | 'vendita'
  data: string
  esecuzione: string
  quantita: number
  prezzo: number // nella valuta del titolo
  valuta: string
  cambio: number // unità di valuta per 1 euro
  commissioni: number // euro
  totale: number // euro pagati (acquisto) o incassati (vendita), commissioni comprese
  rifOrdine: string | null
  /** Il PDF della banca (più PDF "a" e "b" uniti da " + "), "a mano" se è stata scritta a mano, o il foglio del file Excel. */
  fonte: string
  nota?: string
  /** Solo se corretta a mano (ticket 11): quando (ISO). */
  quando?: string
  /** Solo se corretta a mano: i campi cambiati, con il valore che avevano prima. "Torna a com'era" li rimette. */
  prima?: Partial<Pick<Operazione, CampoOperazione>>
}

/** I campi di un'operazione che si possono correggere a mano. */
export type CampoOperazione = 'data' | 'quantita' | 'prezzo' | 'cambio' | 'commissioni' | 'totale'

export type Dividendo = {
  id: string
  titolo: string
  data: string
  lordo: number
  imposte: number
  netto: number
  fonte: string
  nota?: string
  /** Solo se corretto a mano (ticket 11): quando (ISO). */
  quando?: string
  /** Solo se corretto a mano: i campi cambiati, con il valore di prima (il netto si rifà da solo, ma si tiene anche lui). */
  prima?: Partial<Pick<Dividendo, CampoDividendo | 'netto'>>
}

/** I campi di un dividendo che si possono correggere a mano; il netto è lordo meno imposte. */
export type CampoDividendo = 'data' | 'lordo' | 'imposte'

// "data" è l'ultimo giorno del mese (es. "2026-05-31"), anche se è domenica: è la chiave del mese.
// Il giorno di borsa vero della chiusura è "seduta" (dalla versione 3, es. "2026-05-29").
export type PrezzoFineMese = {
  titolo: string
  data: string
  prezzo: number // nella valuta del titolo
  valuta: string
  cambio?: number // solo per i titoli non in euro
  /** Versione 3: uno dei nomi fissi di FONTI_PREZZO (dati/aggiorna/fonti.ts). Versione 2: testo libero. */
  fonte: string
  /** Il giorno di borsa della chiusura. */
  seduta?: string
  /** In parole: perché la fonte non è la borsa ufficiale, o da dove veniva nel file Excel. */
  nota?: string
  /** Solo per i prezzi a mano: quando è stato scritto (ISO). */
  quando?: string
  /**
   * Solo per i prezzi a mano che hanno sostituito un altro prezzo: quello di prima.
   * Una correzione dal pannello (ticket 8) tiene anche seduta, nota e quando, così "Torna al prezzo di prima"
   * rimette il prezzo com'era.
   */
  prima?: { prezzo: number; fonte: string; seduta?: string; nota?: string; quando?: string }
  /** Il controllo di investing.com fatto quando il prezzo è arrivato, o perché non si è potuto fare. */
  controllo?: ControlloPrezzo
}

/**
 * Il controllo di un prezzo: il prezzo di investing.com dello stesso fine mese, nella valuta del titolo
 * (con "nota" se è di un'altra borsa o di un altro giorno), oppure perché non si è potuto fare.
 */
export type ControlloPrezzo = { prezzo: number; seduta: string; nota?: string } | { perche: string }

export type CambioFineMese = {
  valuta: string
  /** L'ultimo giorno del mese, come nei prezzi. */
  data: string
  cambio: number // unità di valuta per 1 euro
  /** "BCE", "dal tuo file Excel" o "a mano". */
  fonte: string
  seduta?: string
  quando?: string
  /** Solo per i cambi a mano che hanno sostituito un altro cambio (ticket 13 tiene anche la seduta). */
  prima?: { cambio: number; fonte: string; seduta?: string; quando?: string }
}

// ---------- ticket 9: riferimenti e inflazione ----------

/** I sei riferimenti di borsa (il settimo è l'inflazione NIC). Cosa sono e da dove vengono: dati/aggiorna/riferimenti.ts. */
export const RIFERIMENTI = ['btp10', 'ftsemib', 'eurostoxx50', 'nasdaq100', 'dowjones', 'sp500'] as const
export type IdRiferimento = (typeof RIFERIMENTI)[number]

/**
 * Il valore di un riferimento in un giorno, nella sua valuta. "data" è l'ultimo giorno del mese (la chiave
 * del mese, come nei prezzi) oppure la data di un movimento, che serve al confronto con gli stessi euro.
 * Per i riferimenti in dollari c'è il cambio BCE dello stesso giorno: in euro vale valore ÷ cambio.
 */
export type ValoreRiferimento = {
  riferimento: IdRiferimento
  data: string
  valore: number
  valuta: string
  /** Solo per i riferimenti non in euro: unità di valuta per 1 euro (BCE). */
  cambio?: number
  /** "investing.com" o "a mano". */
  fonte: string
  /** Il giorno di borsa del valore. */
  seduta?: string
  /** In parole: per esempio perché il valore è di un giorno prima. */
  nota?: string
  quando?: string
  /** Solo per i valori a mano che ne hanno sostituito un altro: quello di prima, per "Torna al valore di prima" (ticket 10 e 13). */
  prima?: { valore: number; fonte: string; cambio?: number; seduta?: string; nota?: string; quando?: string }
}

/**
 * L'indice NIC di un mese, come lo pubblica ISTAT. "data" è l'ultimo giorno del mese.
 * Fino a dicembre 2025 è in base 2015 = 100, da gennaio 2026 in base 2025 = 100: per confrontare due
 * mesi si agganciano le basi (dati/aggiorna/riferimenti.ts, nicAgganciato).
 */
export type NicDelMese = {
  data: string
  valore: number
  base: 2015 | 2025
  /** "ISTAT" o "a mano". */
  fonte: string
  nota?: string
  quando?: string
  /** Solo per i NIC a mano che ne hanno sostituito un altro: quello di prima (ticket 10; il ticket 13 tiene anche la base). */
  prima?: { valore: number; fonte: string; base?: 2015 | 2025; nota?: string; quando?: string }
}
