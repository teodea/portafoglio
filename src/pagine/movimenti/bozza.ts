// La bozza della schermata Registra: i campi come li scrive una persona ("12,75", "12/10/2026"),
// e il movimento che ne viene fuori, con quello che manca. Modulo puro.
//
// Il ticket 12 (Registra dal PDF) riempie la stessa bozza dai campi del PDF: origine "pdf", i nomi dei PDF,
// e in "dalPdf" i testi letti dal PDF. Un campo uguale a quello del PDF si segna "dal PDF", uno cambiato "a mano"
// (e il valore del PDF va nel movimento come "dalPdf", così resta segnato anche nel file).
import { valutaDelTitolo } from '../../dati/aggiorna/mesi.ts'
import { quoteAlGiorno, type NuovoMovimento, type TipoMovimento } from '../../dati/movimenti.ts'
import type { FileDati, Titolo } from '../../dati/tipi.ts'

export type CampoBozza = 'titolo' | 'data' | 'quantita' | 'prezzo' | 'cambio' | 'commissioni' | 'totale' | 'lordo' | 'imposte'

export type Bozza = {
  tipo: TipoMovimento
  /** Scritto a mano, o letto dal PDF della banca (ticket 12). */
  origine: 'mano' | 'pdf'
  testi: Record<CampoBozza, string>
  /** Solo dal PDF: i testi letti dal PDF, per segnare "dal PDF" o "a mano". */
  dalPdf?: Partial<Record<CampoBozza, string>>
  pdf?: string[]
  rifOrdine?: string | null
  esecuzione?: string
  nota?: string
  /** true quando il totale l'hai scritto tu: allora non si rifà più da solo. */
  totaleScritto: boolean
}

export function bozzaVuota(tipo: TipoMovimento): Bozza {
  return {
    tipo,
    origine: 'mano',
    testi: { titolo: '', data: '', quantita: '', prezzo: '', cambio: '', commissioni: '0', totale: '', lordo: '', imposte: '' },
    totaleScritto: false,
  }
}

// ---------- leggere quello che scrive una persona ----------

/** "12,75", "1.234,5", "0", "54.135" (un solo punto = decimali) → numero; null se non è un numero. */
export function leggiNumero(testo: string): number | null {
  let t = testo.trim().replace(/\s|€|£|\$/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

/** "12/10/2026", "12-10-2026", "12.10.2026", "1/2/2026" → "2026-10-12"; null se non è una data vera. */
export function leggiData(testo: string): string | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(testo)
  if (!m) return null
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}

/**
 * Un numero come si scrive in una casella da correggere: "1234,5" (senza i punti delle migliaia).
 * Con almeno = 2, gli euro: "120,50" e non "120,5".
 */
export function numeroNellaCasella(n: number, almeno = 0): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: almeno, maximumFractionDigits: Math.max(6, almeno), useGrouping: false })
}

/** "2026-10-12" → "12/10/2026" */
export function dataNellaCasella(iso: string): string {
  return iso.split('-').reverse().join('/')
}

const due = (n: number) => Math.round(n * 100) / 100

/** Il totale che viene dal conto: quote × prezzo ÷ cambio, più (acquisto) o meno (vendita) le commissioni. */
export function totaleDalConto(tipo: 'acquisto' | 'vendita', quantita: number, prezzo: number, cambio: number, commissioni: number): number {
  const controvalore = (quantita * prezzo) / (cambio || 1)
  return due(tipo === 'acquisto' ? controvalore + commissioni : controvalore - commissioni)
}

// ---------- i titoli tra cui scegliere ----------

export type Scelta = { titolo: Titolo; quote: number; valuta: string }

/** I titoli tra cui scegliere: per una vendita solo quelli che hai; prima quelli che hai, poi gli altri. */
export function titoliDaScegliere(dati: FileDati, tipo: TipoMovimento): Scelta[] {
  const tutti = (dati.titoli ?? []).map((t) => ({ titolo: t, quote: quoteAlGiorno(dati, t.id, '9999-12-31'), valuta: valutaDelTitolo(dati, t) }))
  const nome = (s: Scelta) => s.titolo.simbolo ?? s.titolo.nome
  const lista = tipo === 'vendita' ? tutti.filter((s) => s.quote > 0) : tutti
  return lista.sort((a, b) => (a.quote > 0) === (b.quote > 0) ? nome(a).localeCompare(nome(b)) : a.quote > 0 ? -1 : 1)
}

// ---------- dalla bozza al movimento ----------

export type Letta = {
  /** Il movimento da registrare, se c'è tutto. */
  movimento: NuovoMovimento | null
  /** In parole, quello che manca o che non va: "la data", "il prezzo". */
  mancano: string[]
  /** La valuta del titolo scelto. */
  valuta: string
  /** Solo per acquisti e vendite: il totale che viene dal conto (null se mancano i numeri). */
  conto: number | null
}

/** Legge la bozza: il movimento se c'è tutto, se no cosa manca. Il controllo delle quote lo fa controllaModifica. */
export function leggiBozza(dati: FileDati, b: Bozza): Letta {
  const t = (dati.titoli ?? []).find((x) => x.id === b.testi.titolo)
  const valuta = t ? valutaDelTitolo(dati, t) : 'EUR'
  const mancano: string[] = []
  if (!t) mancano.push('il titolo')
  const data = leggiData(b.testi.data)
  if (!data) mancano.push(b.testi.data.trim() ? 'una data vera, scritta come 12/10/2026' : 'la data')
  const num = (k: CampoBozza, nome: string, zero = false) => {
    const n = leggiNumero(b.testi[k])
    if (n === null || (!zero && n === 0)) {
      mancano.push(b.testi[k].trim() ? `${nome} scritto come numero (es. 12,75)` : nome)
      return null
    }
    return n
  }
  const pdf = b.pdf && b.pdf.length > 0 ? { pdf: b.pdf } : {}
  const nota = b.nota ? { nota: b.nota } : {}

  if (b.tipo === 'dividendo') {
    const lordo = num('lordo', 'il lordo')
    const imposte = num('imposte', 'le imposte', true)
    if (lordo !== null && imposte !== null && imposte > lordo) mancano.push('imposte non più grandi del lordo')
    const movimento: NuovoMovimento | null =
      t && data && lordo !== null && imposte !== null && mancano.length === 0
        ? { tipo: 'dividendo', titolo: t.id, data, lordo, imposte, ...pdf, ...nota, ...dalPdf(b, ['data', 'lordo', 'imposte']) }
        : null
    return { movimento, mancano, valuta, conto: null }
  }

  const quantita = num('quantita', 'le quote')
  const prezzo = num('prezzo', 'il prezzo per quota')
  const cambio = valuta === 'EUR' ? 1 : num('cambio', 'il cambio')
  const commissioni = num('commissioni', 'le commissioni', true)
  const conto = quantita !== null && prezzo !== null && cambio !== null && commissioni !== null ? totaleDalConto(b.tipo, quantita, prezzo, cambio, commissioni) : null
  // Scritto a mano, il totale si fa da solo con il conto finché non lo scrivi tu (se manca un numero, manca già quello).
  const totale = b.totaleScritto || b.origine === 'pdf' ? num('totale', 'il totale') : conto
  const movimento: NuovoMovimento | null =
    t && data && quantita !== null && prezzo !== null && cambio !== null && commissioni !== null && totale !== null && mancano.length === 0
      ? {
          tipo: b.tipo,
          titolo: t.id,
          data,
          quantita,
          prezzo,
          cambio,
          commissioni,
          totale,
          ...pdf,
          ...(b.rifOrdine !== undefined ? { rifOrdine: b.rifOrdine } : {}),
          ...(b.esecuzione ? { esecuzione: b.esecuzione } : {}),
          ...nota,
          ...dalPdf(b, ['data', 'quantita', 'prezzo', 'cambio', 'commissioni', 'totale']),
        }
      : null
  return { movimento, mancano, valuta, conto }
}

/** I valori del PDF dei campi che hai cambiato prima di registrare (ticket 12). */
function dalPdf(b: Bozza, campi: CampoBozza[]): { dalPdf?: Record<string, string | number> } {
  if (b.origine !== 'pdf' || !b.dalPdf) return {}
  const r: Record<string, string | number> = {}
  for (const k of campi) {
    const letto = b.dalPdf[k]
    if (letto === undefined || !campoCambiato(b, k)) continue
    const v = k === 'data' ? leggiData(letto) : leggiNumero(letto)
    if (v !== null) r[k] = v
  }
  return Object.keys(r).length > 0 ? { dalPdf: r } : {}
}

/** Il campo è diverso da quello letto dal PDF? (Per l'etichetta "a mano" accanto al campo.) */
export function campoCambiato(b: Bozza, k: CampoBozza): boolean {
  const letto = b.dalPdf?.[k]
  if (letto === undefined) return false
  if (k === 'titolo') return letto !== b.testi[k]
  if (k === 'data') return leggiData(letto) !== leggiData(b.testi[k])
  return leggiNumero(letto) !== leggiNumero(b.testi[k])
}
