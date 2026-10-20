// Il controllo prima di pubblicare: in app/ non devono esserci dati dell'utente
// (codici ISIN, nomi o simboli dei titoli, numeri d'ordine, quote, prezzi o importi).
//
//   node scripts/controlla-dati.ts                         controllo generico: nessun codice ISIN vero nei file
//   node scripts/controlla-dati.ts --dati "C:\…\portafoglio.json"
//                                                          in più cerca uno per uno i dati di quel file
//
// La GitHub Action fa il controllo generico (non ha il file dei dati). Quello con --dati si fa sul PC,
// prima di ogni "git subtree push": legge il file dei dati, non lo scrive e non lo copia da nessuna parte.
// Esce con 1 se trova qualcosa, e dice dove.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Un dato da non pubblicare: che cos'è e come si cerca. */
export type Tratto = {
  tipo: string
  valore: string
  /** "parola": deve stare da solo (codici, simboli); "testo": anche dentro una frase, senza maiuscole; "numero": non attaccato ad altre cifre. */
  come: 'parola' | 'testo' | 'numero'
}

export type Trovato = { file: string; riga: number; tipo: string; valore: string }

// I codici ISIN inventati delle prove cominciano con ZZ o XX, che non sono paesi.
const PAESI_INVENTATI = new Set(['ZZ', 'XX'])

/** Il controllo della cifra finale di un ISIN (lettere come numeri, A=10 … Z=35, poi Luhn). */
export function isinValido(codice: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(codice)) return false
  const cifre = [...codice.slice(0, 11)].map((c) => (/[0-9]/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('')
  let somma = 0
  for (let i = 0; i < cifre.length; i++) {
    let n = Number(cifre[cifre.length - 1 - i])
    if (i % 2 === 0) {
      n *= 2
      if (n > 9) n -= 9
    }
    somma += n
  }
  return (10 - (somma % 10)) % 10 === Number(codice[11])
}

/** I codici ISIN veri (cifra di controllo giusta, paese non inventato) dentro un testo. */
export function isinVeri(testo: string): string[] {
  const trovati = testo.match(/\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/g) ?? []
  return [...new Set(trovati.filter((c) => !PAESI_INVENTATI.has(c.slice(0, 2)) && isinValido(c)))]
}

/** Le forme in cui un importo può comparire in un file: 1234.5, 1234.50, 1234,50, 1.234,50. */
export function formeDelNumero(n: number): string[] {
  const forme = new Set<string>([String(n)])
  if (!Number.isInteger(n)) {
    const due = n.toFixed(2)
    forme.add(due)
    for (const f of [String(n), due]) {
      const [intero, decimali] = f.split('.')
      forme.add(`${intero},${decimali}`)
      forme.add(`${intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimali}`)
    }
  }
  return [...forme]
}

/** Un numero è abbastanza particolare da cercarlo se ha almeno 5 cifre (es. 432.17, 12000): 10 o 2,5 sono ovunque. */
function particolare(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && String(Math.abs(n)).replace(/[^0-9]/g, '').replace(/^0+/, '').length >= 5
}

/** I dati da non pubblicare, presi dal file dei dati dell'utente. */
export function trattiDelFile(dati: unknown): Tratto[] {
  const d = (dati ?? {}) as Record<string, unknown>
  const lista = (k: string) => (Array.isArray(d[k]) ? (d[k] as Record<string, unknown>[]) : [])
  const tratti = new Map<string, Tratto>()
  const aggiungi = (tipo: string, valore: unknown, come: Tratto['come']) => {
    if (typeof valore !== 'string') return
    const v = valore.trim()
    if (v.length < (come === 'testo' ? 6 : 3)) return
    tratti.set(`${come}:${v.toLowerCase()}`, { tipo, valore: v, come })
  }
  const numero = (tipo: string, valore: unknown) => {
    if (!particolare(valore)) return
    for (const f of formeDelNumero(valore)) tratti.set(`numero:${f}`, { tipo, valore: f, come: 'numero' })
  }

  for (const t of lista('titoli')) {
    aggiungi('codice ISIN di un titolo', t.isin, 'parola')
    aggiungi('codice di un titolo', t.id, 'parola')
    aggiungi('simbolo di un titolo', t.simbolo, 'parola')
    aggiungi('nome di un titolo', t.nome, 'testo')
    aggiungi('parole semplici di un titolo', t.soprannome, 'testo')
    aggiungi('descrizione della banca', t.descrizioneBanca, 'testo')
    for (const [k, v] of Object.entries(t)) {
      if (/codice|investing|yahoo/i.test(k)) aggiungi(`codice di un titolo (${k})`, v, 'parola')
    }
  }
  for (const o of lista('operazioni')) {
    aggiungi("numero d'ordine", o.rifOrdine, 'parola')
    for (const k of ['quantita', 'prezzo', 'totale', 'commissioni']) numero(`${k} di un'operazione`, o[k])
  }
  for (const v of lista('dividendi')) for (const k of ['lordo', 'imposte', 'netto']) numero(`${k} di un dividendo`, v[k])
  for (const p of lista('prezzi')) numero('prezzo di fine mese', p.prezzo)
  return [...tratti.values()]
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Dove compaiono i tratti in un file. */
export function cercaNelTesto(file: string, testo: string, tratti: Tratto[], conNumeri = true): Trovato[] {
  const trovati: Trovato[] = []
  const righe = testo.split(/\r?\n/)
  const prove = tratti
    .filter((t) => conNumeri || t.come !== 'numero')
    .map((t) => ({
      t,
      re:
        t.come === 'testo'
          ? new RegExp(escape(t.valore), 'i')
          : t.come === 'parola'
            ? new RegExp(`(?<![A-Za-z0-9])${escape(t.valore)}(?![A-Za-z0-9])`)
            : new RegExp(`(?<![0-9.,])${escape(t.valore)}(?![0-9]|[.,][0-9])`),
    }))
  righe.forEach((riga, i) => {
    for (const isin of isinVeri(riga)) trovati.push({ file, riga: i + 1, tipo: 'codice ISIN vero', valore: isin })
    for (const { t, re } of prove) if (re.test(riga)) trovati.push({ file, riga: i + 1, tipo: t.tipo, valore: t.valore })
  })
  // Un ISIN dell'utente si trova due volte (come ISIN vero e come dato del file): basta una.
  const visti = new Set<string>()
  return trovati.filter((x) => {
    const chiave = `${x.riga}:${x.valore}`
    if (visti.has(chiave)) return false
    visti.add(chiave)
    return true
  })
}

const BINARI = new Set(['.png', '.ico', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.pdf', '.xlsx', '.xls', '.exe', '.zip'])

/** Tutti i file di app/ che andrebbero pubblicati: quelli in git più quelli nuovi non ignorati. */
function fileDaPubblicare(cartella: string): string[] {
  const uscita = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '.'], { cwd: cartella, encoding: 'utf8' })
  return [...new Set(uscita.split('\0').filter(Boolean))]
}

function principale() {
  const cartella = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const i = process.argv.indexOf('--dati')
  const percorsoDati = i >= 0 ? process.argv[i + 1] : undefined
  if (i >= 0 && !percorsoDati) {
    console.error('Manca il percorso dopo --dati')
    process.exit(2)
  }
  const tratti = percorsoDati ? trattiDelFile(JSON.parse(readFileSync(percorsoDati, 'utf8'))) : []

  const file = fileDaPubblicare(cartella)
  const trovati: Trovato[] = []
  for (const f of file) {
    if (BINARI.has(extname(f).toLowerCase())) continue
    let testo: string
    try {
      testo = readFileSync(join(cartella, f), 'utf8')
    } catch {
      continue // un file cancellato ma non ancora tolto da git
    }
    // Nel package-lock ci sono solo nomi e versioni di librerie, con impronte piene di cifre: lì niente numeri.
    trovati.push(...cercaNelTesto(f, testo, tratti, !f.endsWith('package-lock.json')))
  }

  const cosa = percorsoDati ? `codici ISIN veri e ${tratti.length} dati del file dei dati` : 'codici ISIN veri'
  if (trovati.length === 0) {
    console.log(`Niente di personale: ${file.length} file controllati (${cosa}).`)
    return
  }
  console.error(`ATTENZIONE: ${trovati.length} dati da non pubblicare (${file.length} file controllati, ${cosa}):`)
  for (const t of trovati) console.error(`  ${t.file}:${t.riga}  ${t.tipo}: ${t.valore}`)
  process.exit(1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principale()
