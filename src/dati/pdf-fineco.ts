// I PDF della banca (Fineco): dai campi del modulo al movimento da registrare (ticket 12).
// Modulo puro: i campi li legge il processo principale (dati/pdf-campi.ts), qui si capisce cosa dicono.
//
// Due moduli, come in mappa/issues/06 e 26:
// - AMM021, acquisti e vendite: Operazione "ACQUISTO TITOLI" o "VENDITA TITOLI", Rif_ordine, Mercato,
//   Valuta_regolamento (la data che conta), Quantita, Prezzo_eseguito, Divisa, Cambio_applicato,
//   Tot_Commissioni_Spese, Tot_EUR_debito_credito (senza segno: pagato o incassato);
// - CED026, dividendi e cedole: Operazione "DIVIDENDI" (o una cedola), Valuta_regolamento, Quantita,
//   Importo_unitario, Controvalore_lordo, Importo_ritenuta, Controvalore_netto.
// I numeri sono scritti all'italiana, a volte con la valuta in fondo: "1234,50 EUR ".
//
// Esempio (inventato). Un PDF "a" con 73 quote e un PDF "b" con 27 quote dello stesso numero d'ordine
// sono lo stesso acquisto eseguito in due pezzi: si sommano in un solo acquisto di 100 quote (mappa, ticket 04).
import { quoteAlGiorno } from './movimenti.ts'
import type { Borsa, FileDati, Titolo } from './tipi.ts'

/** I campi del modulo di un PDF, come testo: { Isin: "ZZ0000000001", Quantita: "73,000", … }. */
export type CampiPdf = Record<string, string>

/** Un PDF letto dal processo principale: il nome del file, dove sta, e i suoi campi (o perché non si legge). */
export type PdfAperto = { nome: string; percorso: string | null } & ({ campi: CampiPdf } | { perche: string })

type Comune = {
  /** Il nome del file, es. "Acquistotitoli a.pdf". */
  nome: string
  percorso: string | null
  isin: string
  /** Il codice della banca: per gli ETF di solito il simbolo di borsa. */
  simbolo: string
  /** La descrizione breve della banca, es. "INVENTATO MONDO ACC". */
  descrizione: string
  /** La data di valuta di regolamento: il giorno in cui i soldi escono o entrano. */
  data: string
  /** Cose da far vedere accanto ai numeri, in parole. */
  avvisi: string[]
}

export type LettoOperazione = Comune & {
  tipo: 'acquisto' | 'vendita'
  /** Il campo "Mercato" com'è scritto, es. "EURONEXT MILAN" o "FUORI MERCATO/NON REGOLAMENTATO ITA". */
  mercato: string
  /** La borsa di quotazione, se il PDF la dice. */
  borsa: Borsa | null
  fuoriMercato: boolean
  rifOrdine: string | null
  esecuzione: string | null
  quantita: number
  prezzo: number
  valuta: string
  cambio: number
  commissioni: number
  totale: number
  /** "Rimborso a scadenza", se il PDF lo dice. */
  nota?: string
}

export type LettoDividendo = Comune & {
  tipo: 'dividendo'
  quantita: number | null
  perQuota: number | null
  lordo: number
  imposte: number
  netto: number | null
  valuta: string
  /** La cedola di un'obbligazione: si registra come dividendo, con la scritta "Cedola dell'obbligazione". */
  cedola: boolean
}

export type Letto = LettoOperazione | LettoDividendo

/** Uno o più PDF dello stesso movimento, già sommati; "pezzi" sono i PDF di partenza se erano più di uno. */
export type LettoUnito = Letto & { pdf: string[]; percorsi: (string | null)[]; pezzi: LettoOperazione[] | null }

export type Esito<T> = { ok: true; letto: T } | { ok: false; perche: string }

// ---------- le parole del PDF ----------

/** Il campo "Mercato" del PDF → la borsa di quotazione. Fuori mercato non dice la borsa. */
const MERCATI: [RegExp, Borsa][] = [
  [/EURONEXT MILAN|BORSA ITALIANA|ETFPLUS|MTA\b|MILANO/, 'MIL'],
  [/XETRA/, 'XET'],
  [/FRANCOFORTE|FRANKFURT/, 'FRA'],
  [/LONDON|LONDRA/, 'LON'],
  [/SBF|FRANCIA|PARIGI|PARIS/, 'PAR'],
]

export function borsaDelMercato(mercato: string): Borsa | null {
  const m = mercato.toUpperCase()
  if (/FUORI MERCATO/.test(m)) return null
  return MERCATI.find(([re]) => re.test(m))?.[1] ?? null
}

/** "1234,50 EUR " → 1234.5; "1.234,5" → 1234.5; "120,000" → 120. null se non è un numero. */
export function numeroDelPdf(testo: string | undefined): number | null {
  if (testo === undefined) return null
  let t = testo.trim().replace(/\s*[A-Z]{3}$/, '').replace(/\s/g, '')
  if (!t || t === '-') return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

/** La valuta scritta in fondo a un importo: "0,06 USD" → "USD"; null se non c'è. */
function valutaDellImporto(testo: string | undefined): string | null {
  return /([A-Z]{3})\s*$/.exec(testo ?? '')?.[1] ?? null
}

/** "06/05/2024" o "02/05/2024 11:54:04" → "2024-05-06"; null se non è una data. */
export function dataDelPdf(testo: string | undefined): string | null {
  const m = /^\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(testo ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const testo = (c: CampiPdf, k: string) => (c[k] ?? '').trim()

const NON_RICONOSCIUTO =
  'non risulta un acquisto, una vendita o un dividendo di Fineco (mancano i campi del modulo della banca). Il movimento si può inserire manualmente'

/** Dai campi del modulo al movimento letto. Se manca qualcosa di importante, dice cosa. */
export function leggiCampi(nome: string, percorso: string | null, c: CampiPdf): Esito<Letto> {
  const operazione = testo(c, 'Operazione').toUpperCase()
  const isin = testo(c, 'Isin').toUpperCase()
  if (!operazione || !isin) return { ok: false, perche: `${nome} ${NON_RICONOSCIUTO}` }
  const data = dataDelPdf(c.Valuta_regolamento)
  const comune = { nome, percorso, isin, simbolo: testo(c, 'Simbolo'), descrizione: testo(c, 'Descrizione'), avvisi: [] as string[] }
  const manca = (cosa: string): Esito<Letto> => ({ ok: false, perche: `in ${nome} manca ${cosa}` })
  if (!data) return manca('la data di valuta')

  if (/DIVIDEND|CEDOL|PROVENT/.test(operazione)) {
    const lordo = numeroDelPdf(c.Controvalore_lordo)
    const imposte = numeroDelPdf(c.Importo_ritenuta) ?? 0
    if (lordo === null) return manca('il lordo')
    const valuta = testo(c, 'Divisa').toUpperCase() || 'EUR'
    const l: LettoDividendo = {
      ...comune,
      tipo: 'dividendo',
      data,
      quantita: numeroDelPdf(c.Quantita),
      perQuota: numeroDelPdf(c.Importo_unitario),
      lordo,
      imposte,
      netto: numeroDelPdf(c.Controvalore_netto),
      valuta,
      cedola: /CEDOL/.test(operazione) || testo(c, 'Cedola') !== '',
    }
    // Un dividendo in un'altra valuta non l'abbiamo ancora visto (spec, sezione 10): si avvisa di controllare.
    const inValuta = [c.Controvalore_lordo, c.Importo_ritenuta].map(valutaDellImporto).find((v) => v && v !== 'EUR')
    if (valuta !== 'EUR' || inValuta)
      l.avvisi.push(
        `Il PDF è in ${inValuta ?? valuta}: un dividendo in un’altra valuta non si è ancora presentato. Verificare che lordo e imposte siano in euro, come gli importi accreditati sul conto.`,
      )
    const spese = (numeroDelPdf(c.Commissioni) ?? 0) + (numeroDelPdf(c.Spese) ?? 0) + (numeroDelPdf(c.Commissioni_valutarie) ?? 0)
    if (spese > 0) l.avvisi.push(`Il PDF riporta anche ${spese.toFixed(2).replace('.', ',')} € di commissioni o spese, che qui non si registrano.`)
    return { ok: true, letto: l }
  }

  const acquisto = /ACQUISTO|SOTTOSCRIZ/.test(operazione)
  const vendita = /VENDITA|RIMBORSO/.test(operazione)
  if (!acquisto && !vendita) return { ok: false, perche: `${nome}: l’operazione “${testo(c, 'Operazione')}” non è un acquisto, una vendita o un dividendo` }
  const quantita = numeroDelPdf(c.Quantita)
  const prezzo = numeroDelPdf(c.Prezzo_eseguito)
  const totale = numeroDelPdf(c.Tot_EUR_debito_credito)
  if (quantita === null || quantita <= 0) return manca('le quote')
  if (prezzo === null) return manca('il prezzo')
  if (totale === null) return manca('il totale in euro')
  const mercato = testo(c, 'Mercato')
  const rif = testo(c, 'Rif_ordine').replace(/^0+/, '')
  const commissioni = numeroDelPdf(c.Tot_Commissioni_Spese) ?? (numeroDelPdf(c.Commissioni) ?? 0) + (numeroDelPdf(c.Spese) ?? 0)
  const l: LettoOperazione = {
    ...comune,
    tipo: acquisto ? 'acquisto' : 'vendita',
    data,
    mercato,
    borsa: borsaDelMercato(mercato),
    fuoriMercato: /FUORI MERCATO/i.test(mercato),
    rifOrdine: rif || null,
    esecuzione: dataDelPdf(c.Data_ora_esecuzione),
    quantita,
    prezzo,
    valuta: testo(c, 'Divisa').toUpperCase() || 'EUR',
    cambio: numeroDelPdf(c.Cambio_applicato) || 1,
    commissioni,
    totale,
  }
  if (/RIMBORSO/.test(operazione)) l.nota = 'Rimborso a scadenza'
  const bolli = numeroDelPdf(c.Bolli) ?? 0
  const rateo = numeroDelPdf(c.Ritenuta_rateo) ?? 0
  if (bolli > 0 || rateo > 0)
    l.avvisi.push('Il PDF riporta anche bolli o una ritenuta sul rateo: sono già compresi nel totale della banca, che è l’importo registrato.')
  return { ok: true, letto: l }
}

// ---------- più PDF insieme ----------

const due = (n: number) => Math.round(n * 100) / 100
const cinque = (n: number) => Math.round(n * 1e5) / 1e5

/**
 * Più PDF insieme: vanno bene solo i pezzi dello stesso ordine (stesso numero d'ordine, stesso titolo),
 * che si sommano in un solo movimento. Lo stesso file messo due volte conta una volta.
 */
export function unisciPdf(letti: Letto[]): Esito<LettoUnito> {
  const unici = letti.filter((l, i) => letti.findIndex((x) => x.nome === l.nome) === i)
  if (unici.length === 0) return { ok: false, perche: 'non c’è nessun PDF da leggere' }
  const primo = unici[0]
  const base = { pdf: unici.map((l) => l.nome), percorsi: unici.map((l) => l.percorso) }
  if (unici.length === 1) return { ok: true, letto: { ...primo, ...base, pezzi: null } }
  const diversi =
    'I PDF scelti sono di movimenti diversi. Registrarli uno alla volta; insieme solo le parti dello stesso ordine (per esempio “a” e “b”)'
  if (primo.tipo === 'dividendo') return { ok: false, perche: diversi }
  const ops = unici as LettoOperazione[]
  if (!ops.every((o) => o.tipo === primo.tipo && o.isin === primo.isin && o.rifOrdine !== null && o.rifOrdine === primo.rifOrdine))
    return { ok: false, perche: diversi }
  const quantita = ops.reduce((s, o) => s + o.quantita, 0)
  const avvisi = [...new Set(ops.flatMap((o) => o.avvisi))]
  const date = [...new Set(ops.map((o) => o.data))].sort()
  if (date.length > 1) avvisi.push(`Le parti hanno date di valuta diverse (${date.map((d) => d.split('-').reverse().join('/')).join(', ')}): si usa l’ultima.`)
  const cambi = [...new Set(ops.map((o) => o.cambio))]
  if (cambi.length > 1) avvisi.push('Le parti hanno cambi diversi: si usa quello della prima. Il totale della banca è comunque la somma delle parti.')
  const esecuzioni = ops.map((o) => o.esecuzione).filter((x): x is string => x !== null).sort()
  return {
    ok: true,
    letto: {
      ...(primo as LettoOperazione),
      ...base,
      data: date[date.length - 1],
      esecuzione: esecuzioni[0] ?? null,
      quantita,
      prezzo: cinque(ops.reduce((s, o) => s + o.quantita * o.prezzo, 0) / quantita),
      commissioni: due(ops.reduce((s, o) => s + o.commissioni, 0)),
      totale: due(ops.reduce((s, o) => s + o.totale, 0)),
      avvisi,
      pezzi: ops,
    },
  }
}

// ---------- quale titolo è ----------

export type TitoloDelPdf =
  /** Un titolo che è già nel file. "altraBorsa": venduto su una borsa diversa da quella del titolo. */
  | { quale: 'trovato'; id: string; altraBorsa?: string }
  /** Un acquisto di un titolo che non c'è ancora: si apre il riquadro "Titolo nuovo". */
  | { quale: 'nuovo'; borsa: Borsa | null }
  /** Una vendita o un dividendo di un titolo che non hai: non si può registrare. */
  | { quale: 'non-hai'; perche: string }

/**
 * Il titolo del PDF: ISIN più borsa (un titolo è ISIN più borsa, vedi GLOSSARY.md). Se il PDF non dice la borsa
 * ("fuori mercato") o è un dividendo, basta l'ISIN; con più titoli dello stesso ISIN vale quello di cui avevi quote.
 */
export function titoloDelPdf(dati: FileDati, l: Letto): TitoloDelPdf {
  const titoli = dati.titoli ?? []
  const stessoIsin = titoli.filter((t) => t.isin === l.isin)
  const conQuote = (lista: Titolo[], giorno: string) => lista.filter((t) => quoteAlGiorno(dati, t.id, giorno) > 0)
  const unoSolo = (lista: Titolo[]) => (lista.length === 1 ? lista[0] : null)
  const nome = l.simbolo || l.descrizione || l.isin

  if (l.tipo === 'dividendo') {
    const t = unoSolo(conQuote(stessoIsin, l.data)) ?? unoSolo(stessoIsin)
    if (t) return { quale: 'trovato', id: t.id }
    return {
      quale: 'non-hai',
      perche:
        stessoIsin.length === 0
          ? `nel file non c’è ${nome} (ISIN ${l.isin}): registrare prima il suo acquisto, poi il dividendo`
          : `nel file ci sono più titoli con l’ISIN ${l.isin} e nessuno aveva quote il ${l.data.split('-').reverse().join('/')}`,
    }
  }

  if (l.borsa) {
    const t = titoli.find((x) => x.id === `${l.isin}-${l.borsa}`) ?? titoli.find((x) => x.isin === l.isin && x.borsa === l.borsa)
    if (t) return { quale: 'trovato', id: t.id }
  }
  if (l.tipo === 'acquisto') {
    if (!l.borsa) {
      const t = unoSolo(conQuote(stessoIsin, l.data)) ?? unoSolo(stessoIsin)
      if (t) return { quale: 'trovato', id: t.id }
    }
    return { quale: 'nuovo', borsa: l.borsa }
  }
  // Una vendita: le quote che hai, anche se le vendi su un'altra borsa.
  const t = unoSolo(conQuote(stessoIsin, l.data))
  if (t) return l.borsa && t.borsa !== l.borsa ? { quale: 'trovato', id: t.id, altraBorsa: l.mercato } : { quale: 'trovato', id: t.id }
  return {
    quale: 'non-hai',
    perche:
      stessoIsin.length === 0
        ? `nel file non c’è ${nome} (ISIN ${l.isin}): non se ne può registrare la vendita. Se è stato acquistato, registrare prima l’acquisto`
        : `il ${l.data.split('-').reverse().join('/')} non c’erano quote di ${nome}`,
  }
}

// ---------- già registrato? ----------

const cifre = (s: string | null | undefined) => (s ?? '').replace(/^0+/, '')
const giorni = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000

/**
 * Il movimento già registrato con questo PDF, o null. Un acquisto o una vendita si riconoscono dal numero
 * d'ordine della banca; un dividendo dal titolo e dalla data (o dallo stesso lordo pochi giorni prima o dopo).
 */
export function giaRegistrato(dati: FileDati, l: Letto): string | null {
  const isin = (id: string) => (dati.titoli ?? []).find((t) => t.id === id)?.isin
  if (l.tipo === 'dividendo') {
    const d = (dati.dividendi ?? []).find(
      (x) => isin(x.titolo) === l.isin && (x.data === l.data || ((x.prima?.lordo ?? x.lordo) === l.lordo && giorni(x.data, l.data) <= 40)),
    )
    return d?.id ?? null
  }
  const ops = dati.operazioni ?? []
  if (l.rifOrdine) {
    const o = ops.find((x) => x.tipo === l.tipo && (cifre(x.rifOrdine) === l.rifOrdine || x.id === `op-${l.rifOrdine}`))
    if (o) return o.id
  }
  const o = ops.find(
    (x) => x.tipo === l.tipo && isin(x.titolo) === l.isin && (x.prima?.data ?? x.data) === l.data && (x.prima?.quantita ?? x.quantita) === l.quantita,
  )
  return o?.id ?? null
}
