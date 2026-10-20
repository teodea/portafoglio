// "Scarica in Excel" (ticket 14, mappa 27): il file "Portafoglio titoli <data>.xlsx" nella cartella Download.
// Le pagine preparano i fogli con i conti che hanno già (conti/excel.ts); il processo principale li scrive
// in un .xlsx vero con ExcelJS (electron/excel.ts). Qui c'è quello che serve a entrambi: la forma dei fogli,
// il canale, il controllo di quello che arriva dalle pagine e il nome del file.
// Modulo puro.

/** Come si scrive un numero in Excel. I numeri restano numeri: cambia solo come si vedono. */
export const FORMATI = {
  /** 31/12/2026 */
  data: 'DD/MM/YYYY',
  /** set 26, per le colonne dei mesi */
  mese: 'mmm yy',
  /** 1.234,56 € */
  euro: '#,##0.00 "€"',
  /** 1.235 € */
  euroTondo: '#,##0 "€"',
  /** 12,34 oppure 123,456: due decimali, fino a quattro se ci sono */
  prezzo: '#,##0.00##',
  /** 0,8546 oppure 0,85478 */
  cambio: '#,##0.0000#',
  /** 1.000 */
  quote: '#,##0',
  /** +3,4% */
  percentuale: '+0.0%;-0.0%;0.0%',
  /** 120,4 (l'indice NIC) */
  nic: '#,##0.0',
  /** 14.123,45 (un riferimento, nella sua valuta) */
  valore: '#,##0.00',
} as const

export type Formato = keyof typeof FORMATI

/** Una cella: testo, numero, una data "AAAA-MM-GG" oppure vuota. */
export type Cella = string | number | { data: string } | null

export type Colonna = {
  /** L'intestazione; con "data" l'intestazione è quel giorno, scritto con il formato "mese" (es. le colonne dei mesi). */
  titolo: string
  data?: string
  /** Come si vedono i numeri della colonna. */
  formato?: Formato
  /** La larghezza, in caratteri; se manca, quella dell'intestazione (tra 12 e 40). Le colonne di testo si allargano fino al testo più lungo (al massimo 60). */
  larghezza?: number
}

/** Un foglio a tabella: l'intestazione in grassetto su fondo grigio, ferma in alto con la prima colonna, e il filtro. */
export type FoglioTabella = {
  tipo: 'tabella'
  nome: string
  colonne: Colonna[]
  righe: Cella[][]
  /** Le righe da scrivere in grassetto (indici in "righe"), es. i totali. */
  grassetto?: number[]
}

export type RigaLeggimi = {
  celle: Cella[]
  /** "titolo" grande, "grassetto" per le intestazioni dei pezzi. */
  stile?: 'titolo' | 'grassetto'
  /** Il formato dei numeri della riga. */
  formato?: Formato
}

/** Il foglio Leggimi: righe libere, due colonne. */
export type FoglioLeggimi = {
  tipo: 'leggimi'
  nome: string
  righe: RigaLeggimi[]
  larghezze: number[]
}

export type Foglio = FoglioTabella | FoglioLeggimi

export type LibroExcel = {
  /** Il giorno in cui si scarica, "AAAA-MM-GG": dà il nome al file. */
  oggi: string
  fogli: Foglio[]
}

export type EsitoExcel =
  | {
      esito: 'fatto'
      /** Il nome del file, es. "Portafoglio titoli 19-10-2026.xlsx". */
      nome: string
      /** Il percorso completo, per "Apri il file". */
      percorso: string
    }
  | { esito: 'errore'; perche: string }

export type PonteExcel = {
  /** Scrive il file nella cartella Download e dice come si chiama. */
  scaricaInExcel(libro: LibroExcel): Promise<EsitoExcel>
  /** Apre in Excel un file appena scaricato (solo i file "Portafoglio titoli …" della cartella Download). */
  apriFileScaricato(percorso: string): Promise<void>
}

export const CANALI_EXCEL = { scaricaInExcel: 'excel:scarica', apriFileScaricato: 'excel:apri' } as const

const GIORNO = /^\d{4}-\d{2}-\d{2}$/

/** "2026-10-19" → "Portafoglio titoli 19-10-2026.xlsx"; con n > 1, "Portafoglio titoli 19-10-2026 (2).xlsx". */
export function nomeFileExcel(oggi: string, n = 1): string {
  const [a, m, g] = oggi.split('-')
  return `Portafoglio titoli ${g}-${m}-${a}${n > 1 ? ` (${n})` : ''}.xlsx`
}

/** Un file che questa applicazione può aver scaricato: "Portafoglio titoli ….xlsx". */
export function eFileScaricato(nome: string): boolean {
  return /^Portafoglio titoli \d{2}-\d{2}-\d{4}( \(\d+\))?\.xlsx$/.test(nome)
}

// ---------- il controllo di quello che arriva dalle pagine ----------

const testo = (x: unknown): x is string => typeof x === 'string'
const formato = (x: unknown) => x === undefined || (testo(x) && x in FORMATI)

function cella(x: unknown): boolean {
  if (x === null || testo(x)) return true
  if (typeof x === 'number') return Number.isFinite(x)
  return typeof x === 'object' && testo((x as { data?: unknown }).data) && GIORNO.test((x as { data: string }).data)
}

function colonna(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false
  const c = x as Record<string, unknown>
  return (
    testo(c.titolo) &&
    (c.data === undefined || (testo(c.data) && GIORNO.test(c.data))) &&
    formato(c.formato) &&
    (c.larghezza === undefined || (typeof c.larghezza === 'number' && c.larghezza > 0 && c.larghezza < 256))
  )
}

const righeDiCelle = (x: unknown) => Array.isArray(x) && x.every((r) => Array.isArray(r) && r.every(cella))

function foglio(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false
  const f = x as Record<string, unknown>
  // Excel vuole nomi dei fogli fino a 31 caratteri, senza \ / ? * [ ] :
  if (!testo(f.nome) || !f.nome || f.nome.length > 31 || /[\\/?*[\]:]/.test(f.nome)) return false
  if (f.tipo === 'tabella')
    return (
      Array.isArray(f.colonne) &&
      f.colonne.length > 0 &&
      f.colonne.every(colonna) &&
      righeDiCelle(f.righe) &&
      (f.grassetto === undefined || (Array.isArray(f.grassetto) && f.grassetto.every((i) => Number.isInteger(i))))
    )
  if (f.tipo === 'leggimi')
    return (
      Array.isArray(f.righe) &&
      f.righe.every((r) => {
        if (typeof r !== 'object' || r === null) return false
        const x = r as Record<string, unknown>
        return righeDiCelle([x.celle]) && (x.stile === undefined || x.stile === 'titolo' || x.stile === 'grassetto') && formato(x.formato)
      }) &&
      Array.isArray(f.larghezze) &&
      f.larghezze.every((l) => typeof l === 'number' && l > 0 && l < 256)
    )
  return false
}

/** Quello che arriva dalle pagine ha la forma di un libro Excel (prima di scriverlo). */
export function eLibroExcel(x: unknown): x is LibroExcel {
  if (typeof x !== 'object' || x === null) return false
  const l = x as Record<string, unknown>
  if (!testo(l.oggi) || !GIORNO.test(l.oggi) || !Array.isArray(l.fogli) || !l.fogli.length || !l.fogli.every(foglio)) return false
  const nomi = l.fogli.map((f) => (f as { nome: string }).nome.toLowerCase())
  return new Set(nomi).size === nomi.length
}
