// Lettore JSON che sa dire in parole dov'è un errore e su che riga sta ogni dato.
// JSON.parse dice solo "Unexpected token": qui serve "alla riga 812 manca una virgola",
// e per i controlli successivi serve la riga di ogni valore (es. "/prezzi/40/prezzo" → riga 813).
// Modulo puro.

export type ErroreJson = {
  /** 1 = prima riga del file. */
  riga: number
  colonna: number
  /** In parole, senza la riga: "manca una virgola tra due dati". */
  spiegazione: string
  /** Pochissime parole da mettere accanto alla riga: "qui manca una virgola". */
  breve: string
}

export type JsonLetto =
  | { ok: true; valore: unknown; righe: Map<string, number> }
  | { ok: false; errore: ErroreJson }

class Rotto extends Error {
  readonly indice: number
  readonly spiegazione: string
  readonly breve: string
  constructor(indice: number, spiegazione: string, breve: string) {
    super(spiegazione)
    this.indice = indice
    this.spiegazione = spiegazione
    this.breve = breve
  }
}

/** Il percorso di un valore, come "/titoli/3/isin". La radice è "". */
export function percorso(...parti: (string | number)[]): string {
  return parti.map((p) => '/' + String(p).replaceAll('~', '~0').replaceAll('/', '~1')).join('')
}

export function leggiJson(testoOriginale: string): JsonLetto {
  // Blocco note può salvare con il BOM all'inizio: non è un errore.
  const testo = testoOriginale.startsWith('﻿') ? testoOriginale.slice(1) : testoOriginale
  const inizioRighe = [0]
  for (let k = 0; k < testo.length; k++) if (testo[k] === '\n') inizioRighe.push(k + 1)
  const rigaDi = (indice: number) => {
    let basso = 0
    let alto = inizioRighe.length - 1
    while (basso < alto) {
      const medio = (basso + alto + 1) >> 1
      if (inizioRighe[medio] <= indice) basso = medio
      else alto = medio - 1
    }
    return { riga: basso + 1, colonna: indice - inizioRighe[basso] + 1 }
  }

  const righe = new Map<string, number>()
  let i = 0
  // Dove è finito l'ultimo valore letto: serve per dire "manca una virgola" sulla riga giusta.
  let fineUltimo = 0
  // L'ultimo valore letto, se era un numero: serve per riconoscere "12,5".
  let numeroAppenaLetto: { inizio: number; fine: number } | null = null
  // Dov'è l'ultima virgola tra due dati: serve per dire "virgola di troppo" sulla riga giusta.
  let ultimaVirgola = 0

  const spazi = () => {
    while (i < testo.length) {
      const c = testo[i]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++
      else break
    }
  }

  const fineFile = (): never => {
    throw new Rotto(
      testo.length,
      'il file finisce prima del previsto: forse manca una } o una ] alla fine',
      'qui finisce il file',
    )
  }

  const valore = (dove: string): unknown => {
    spazi()
    if (i >= testo.length) fineFile()
    righe.set(dove, rigaDi(i).riga)
    const c = testo[i]
    numeroAppenaLetto = null
    let v: unknown
    if (c === '{') v = oggetto(dove)
    else if (c === '[') v = lista(dove)
    else if (c === '"') v = stringa()
    else if (c === '-' || (c >= '0' && c <= '9')) v = numero()
    else if (/[A-Za-z]/.test(c)) v = parola()
    else if (c === ',') throw new Rotto(i, 'c’è una virgola dove dovrebbe esserci un dato', 'qui c’è una virgola di troppo')
    else if (c === "'")
      throw new Rotto(i, 'un testo è tra apici \' invece che tra virgolette "', 'qui serve la virgoletta "')
    else throw new Rotto(i, `c’è un carattere che non dovrebbe esserci: ${c}`, `qui c’è ${c}`)
    fineUltimo = i
    if (typeof v !== 'number') numeroAppenaLetto = null
    return v
  }

  const dopoValore = (chiusura: '}' | ']') => {
    // Dopo un valore ci vuole una virgola o la chiusura.
    spazi()
    if (i >= testo.length) fineFile()
    const c = testo[i]
    if (c === ',' || c === chiusura) return
    const altraChiusura = chiusura === '}' ? ']' : '}'
    if (c === altraChiusura)
      throw new Rotto(i, `c’è una ${c} dove ci vorrebbe una ${chiusura}`, `qui ci vorrebbe ${chiusura}`)
    const iniziaUnDato = c === '"' || c === '{' || c === '[' || c === '-' || (c >= '0' && c <= '9') || /[A-Za-z]/.test(c)
    if (iniziaUnDato) {
      throw new Rotto(fineUltimo - 1, 'manca una virgola tra due dati', 'qui manca la virgola')
    }
    throw new Rotto(i, `c’è un carattere che non dovrebbe esserci: ${c}`, `qui c’è ${c}`)
  }

  const oggetto = (dove: string): Record<string, unknown> => {
    const risultato: Record<string, unknown> = {}
    i++ // {
    spazi()
    if (testo[i] === '}') {
      i++
      return risultato
    }
    // Il numero appena prima della virgola, se la virgola lo segue attaccata ("12,5").
    let numeroConVirgola: { inizio: number; fine: number } | null = null
    for (;;) {
      spazi()
      if (i >= testo.length) fineFile()
      const c = testo[i]
      if (c === '}') throw new Rotto(ultimaVirgola, 'c’è una virgola di troppo prima di }', 'qui c’è una virgola di troppo')
      if (c !== '"') {
        // "prezzo": 12,5 → dopo la virgola arriva una cifra invece del nome di un dato.
        const n = numeroConVirgola
        if (c >= '0' && c <= '9' && n && rigaDi(n.inizio).riga === rigaDi(i).riga) {
          let fine = i
          while (fine < testo.length && testo[fine] >= '0' && testo[fine] <= '9') fine++
          const scritto = testo.slice(n.inizio, fine)
          throw new Rotto(
            n.inizio,
            `il numero ${scritto} è scritto con la virgola: nel file i decimali vanno con il punto (${scritto.replace(',', '.')})`,
            'qui il numero ha la virgola',
          )
        }
        throw new Rotto(i, 'il nome di un dato non è tra virgolette', 'qui manca la virgoletta "')
      }
      const chiave = stringa()
      spazi()
      if (testo[i] !== ':') {
        if (i >= testo.length) fineFile()
        throw new Rotto(i, `mancano i due punti : dopo "${chiave}"`, 'qui mancano i due punti')
      }
      i++
      risultato[chiave] = valore(dove + percorso(chiave))
      const numeroLetto = numeroAppenaLetto as { inizio: number; fine: number } | null
      dopoValore('}')
      if (testo[i] === '}') {
        i++
        return risultato
      }
      numeroConVirgola = numeroLetto && numeroLetto.fine === i ? numeroLetto : null
      ultimaVirgola = i
      i++ // ,
    }
  }

  const lista = (dove: string): unknown[] => {
    const risultato: unknown[] = []
    i++ // [
    spazi()
    if (testo[i] === ']') {
      i++
      return risultato
    }
    for (;;) {
      spazi()
      if (testo[i] === ']') throw new Rotto(ultimaVirgola, 'c’è una virgola di troppo prima di ]', 'qui c’è una virgola di troppo')
      risultato.push(valore(dove + percorso(risultato.length)))
      dopoValore(']')
      if (testo[i] === ']') {
        i++
        return risultato
      }
      ultimaVirgola = i
      i++ // ,
    }
  }

  const stringa = (): string => {
    const inizio = i
    i++ // "
    let risultato = ''
    for (;;) {
      if (i >= testo.length) fineFile()
      if (testo[i] === '\n' || testo[i] === '\r')
        throw new Rotto(inizio, 'un testo comincia con " ma non finisce: manca la virgoletta di chiusura', 'qui manca la virgoletta di chiusura')
      const c = testo[i]
      if (c === '"') {
        i++
        return risultato
      }
      if (c === '\\') {
        const e = testo[i + 1]
        const sostituti: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
        if (e in sostituti) {
          risultato += sostituti[e]
          i += 2
        } else if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(testo.slice(i + 2, i + 6))) {
          risultato += String.fromCharCode(parseInt(testo.slice(i + 2, i + 6), 16))
          i += 6
        } else {
          throw new Rotto(i, 'c’è una barra rovesciata \\ da sola: dentro un testo va scritta due volte (\\\\)', 'qui c’è una \\ da sola')
        }
        continue
      }
      if (c < ' ') throw new Rotto(i, 'dentro un testo c’è un carattere di controllo (per esempio una tabulazione)', 'qui c’è un carattere strano')
      risultato += c
      i++
    }
  }

  const numero = (): number => {
    const inizio = i
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(testo.slice(i, i + 64))
    if (!m) throw new Rotto(i, 'c’è un numero scritto male', 'qui il numero è scritto male')
    i += m[0].length
    numeroAppenaLetto = { inizio, fine: i }
    return Number(m[0])
  }

  const parola = (): unknown => {
    const m = /^[A-Za-z]+/.exec(testo.slice(i, i + 32))!
    const p = m[0]
    if (p === 'true' || p === 'false' || p === 'null') {
      i += p.length
      return p === 'true' ? true : p === 'false' ? false : null
    }
    throw new Rotto(i, `c’è la parola ${p} senza virgolette: un testo va scritto tra virgolette "`, 'qui manca la virgoletta "')
  }

  try {
    spazi()
    if (i >= testo.length) {
      return { ok: false, errore: { riga: 1, colonna: 1, spiegazione: 'il file è vuoto', breve: 'il file è vuoto' } }
    }
    const v = valore('')
    spazi()
    if (i < testo.length)
      throw new Rotto(i, 'dopo la fine dei dati c’è dell’altro testo', 'qui c’è testo in più')
    return { ok: true, valore: v, righe }
  } catch (e) {
    if (!(e instanceof Rotto)) throw e
    const { riga, colonna } = rigaDi(Math.min(e.indice, Math.max(0, testo.length - 1)))
    return { ok: false, errore: { riga, colonna, spiegazione: e.spiegazione, breve: e.breve } }
  }
}
