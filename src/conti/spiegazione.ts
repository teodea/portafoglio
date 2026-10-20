// Il "Da dove viene" di un numero: il conto riga per riga, in parole, con la fonte.
// Ogni conto del modulo restituisce il numero insieme alla sua spiegazione, così i due
// non possono mai dire cose diverse. Modulo puro: niente React, niente file.
import type { RifPrezzo } from '../dati/correzione.ts'
import type { RifDato } from '../dati/correzione-dati.ts'
import type { FileDati } from '../dati/tipi.ts'
import type { RifValore } from '../dati/correzione-riferimento.ts'

/** Un numero da scrivere, con il suo tipo: la pagina sa come formattarlo. */
export type Cifra =
  /** 12.345,60 € */
  | { tipo: 'euro'; n: number; decimali?: number }
  /** +12.345,60 € oppure −12.345,60 €, del colore del segno */
  | { tipo: 'guadagno'; n: number; decimali?: number }
  /** frazione: 0,0342 → +3,42%, del colore del segno */
  | { tipo: 'percentuale'; n: number }
  /** 1.000 quote */
  | { tipo: 'quote'; n: number }
  /** 12,34 € oppure 52,85 GBP; "esatto" con tutti i decimali (52,845 GBP), dove il conto lo moltiplica */
  | { tipo: 'prezzo'; n: number; valuta: string; esatto?: true }
  /** 0,85461 (unità di valuta per 1 euro) */
  | { tipo: 'cambio'; n: number }
  | { tipo: 'testo'; testo: string }

export type RigaConto = { etichetta: string; cifra: Cifra }

export type Spiegazione = {
  /** La testata del pannello, in parole: "Plusvalenza di MOND". */
  titolo: string
  /** Il numero spiegato, in grande. */
  grande: Cifra
  /** Una parola dopo il numero grande: "all'anno". */
  dopo?: string
  /** Che cos'è il numero, in una frase, prima del conto. */
  frase?: string
  /** Il conto, una riga per passaggio; l'ultima è il risultato. Vuoto se non c'è un conto. */
  conto: RigaConto[]
  /** Fonte e regola, in frasi brevi. */
  note: string[]
  /** Se il numero viene da un solo prezzo di fine mese, quel prezzo: il pannello offre di correggerlo a mano (ticket 8). */
  correggi?: RifPrezzo
  /** Se il numero è un NIC, un cambio o un riferimento di fine mese: il pannello offre di correggerlo o scriverlo (ticket 13). */
  correggiDato?: RifDato
  /** Rifà la spiegazione sui dati di adesso, dopo una correzione (se manca, il pannello rifà quella del prezzo). */
  rifai?: (dati: FileDati) => Spiegazione | null
  /** Un secondo conto con il suo titolo, dopo il primo: per un riferimento, gli stessi euro movimento per movimento (ticket 10). */
  passi?: { titolo: string; righe: RigaConto[] }
  /**
   * Se il numero è il confronto con un riferimento o con l'inflazione: il pannello mostra il valore di fine mese
   * con la sua fonte, "Scarica di nuovo" e la correzione a mano (ticket 10).
   */
  riferimento?: RifValore
  /** Se il numero è un movimento (acquisto, vendita o dividendo), il suo codice: il pannello offre di correggerlo o toglierlo (ticket 11). */
  movimento?: string
  /** Non è un numero: il pannello "Scarica in Excel" della pagina Dati (ticket 14). */
  excel?: true
}

/** Un numero con la sua spiegazione. n è null quando il numero non c'è ("—"): la spiegazione dice perché. */
export type Numero = { n: number | null; perche: Spiegazione }

export const euro = (n: number, decimali = 2): Cifra => ({ tipo: 'euro', n, decimali })
export const guadagno = (n: number, decimali = 2): Cifra => ({ tipo: 'guadagno', n, decimali })
export const percentuale = (n: number): Cifra => ({ tipo: 'percentuale', n })
export const quote = (n: number): Cifra => ({ tipo: 'quote', n })
export const prezzo = (n: number, valuta: string): Cifra => ({ tipo: 'prezzo', n, valuta })
export const prezzoEsatto = (n: number, valuta: string): Cifra => ({ tipo: 'prezzo', n, valuta, esatto: true })
export const cambio = (n: number): Cifra => ({ tipo: 'cambio', n })
export const testo = (t: string): Cifra => ({ tipo: 'testo', testo: t })
export const riga = (etichetta: string, cifra: Cifra): RigaConto => ({ etichetta, cifra })
