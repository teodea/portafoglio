// Il controllo del file dei dati all'apertura: si legge il testo, si controlla che sia
// JSON e che ogni dato abbia la forma dei tipi (tipi.ts), e si dice in parole riga e problema.
// Modulo puro: niente file, niente React. Lo usa il processo principale, lo provano le prove Vitest.
import { leggiJson, percorso } from './json.ts'
import { FONTI_CAMBIO, FONTI_PREZZO } from './aggiorna/fonti.ts'
import { FONTI_NIC, FONTI_RIFERIMENTO } from './aggiorna/riferimenti.ts'
import { BORSE, RIFERIMENTI, VERSIONI_CONOSCIUTE, type FileDati } from './tipi.ts'

export type RigaDelFile = { numero: number; testo: string }

export type Problema = {
  /** Riga del file dove sta il problema (1 = prima riga), se si sa. */
  riga: number | null
  /** In parole, senza la riga: "manca una virgola tra due dati". */
  spiegazione: string
  /** Pochissime parole da mettere accanto alla riga: "qui manca la virgola". */
  breve: string
  /** Le righe intorno al problema, per mostrarle sullo schermo. */
  estratto: RigaDelFile[]
  /** Se oltre a questo ci sono altri problemi, quanti. */
  altri: number
  /** true se il file non è nemmeno JSON (una virgola, una virgoletta…). */
  scrittura: boolean
}

export type Controllo = { ok: true; dati: FileDati } | { ok: false; problema: Problema }

type Trovato = { percorso: string; spiegazione: string; breve: string }

export function controllaFile(testo: string): Controllo {
  const letto = leggiJson(testo)
  const righeDelTesto = testo.replace(/^﻿/, '').split(/\r?\n/)
  if (!letto.ok) {
    const { riga, spiegazione, breve } = letto.errore
    return {
      ok: false,
      problema: { riga, spiegazione, breve, estratto: estratto(righeDelTesto, riga), altri: 0, scrittura: true },
    }
  }
  const trovati = controllaForma(letto.valore)
  if (trovati.length === 0) return { ok: true, dati: letto.valore as FileDati }
  const primo = trovati[0]
  const riga = rigaDelPercorso(letto.righe, primo.percorso)
  return {
    ok: false,
    problema: {
      riga,
      spiegazione: primo.spiegazione,
      breve: primo.breve,
      estratto: riga ? estratto(righeDelTesto, riga) : [],
      altri: trovati.length - 1,
      scrittura: false,
    },
  }
}

function rigaDelPercorso(righe: Map<string, number>, p: string): number | null {
  // Se il dato manca del tutto, vale la riga del suo contenitore.
  for (let q = p; ; q = q.slice(0, q.lastIndexOf('/'))) {
    const r = righe.get(q)
    if (r !== undefined) return r
    if (q === '') return null
  }
}

function estratto(righe: string[], riga: number): RigaDelFile[] {
  const da = Math.max(1, riga - 1)
  const a = Math.min(righe.length, riga + 1)
  const risultato: RigaDelFile[] = []
  for (let n = da; n <= a; n++) {
    const t = righe[n - 1]
    risultato.push({ numero: n, testo: t.length > 140 ? t.slice(0, 140) + '…' : t })
  }
  return risultato
}

// ---------- la forma dei dati ----------

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/
function dataValida(s: string): boolean {
  const m = DATA.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function descrivi(v: unknown): string {
  if (v === undefined) return 'nessun valore'
  if (v === null) return 'null'
  if (typeof v === 'string') return `"${v.length > 40 ? v.slice(0, 40) + '…' : v}"`
  if (Array.isArray(v)) return 'una lista'
  if (typeof v === 'object') return 'un gruppo di dati'
  return String(v)
}

type Regola =
  | 'testo'
  | 'testo-o-null'
  | 'data'
  | 'numero'
  | 'numero-positivo'
  | 'numero-non-negativo'
  | { scelta: readonly string[] }
  | { numeri: readonly number[] }

// Il controllo di un campo: restituisce il problema in parole, o null se va bene.
function controllaCampo(nome: string, v: unknown, regola: Regola, facoltativo: boolean): Omit<Trovato, 'percorso'> | null {
  if (v === undefined) {
    if (facoltativo) return null
    return { spiegazione: `manca il dato "${nome}"`, breve: `qui manca "${nome}"` }
  }
  const comeTesto = typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())
  if (typeof regola === 'object' && 'numeri' in regola) {
    if (typeof v === 'number' && regola.numeri.includes(v)) return null
    return {
      spiegazione: `"${nome}" dovrebbe essere uno di questi numeri: ${regola.numeri.join(', ')}; invece c’è ${descrivi(v)}`,
      breve: `qui "${nome}" non è valido`,
    }
  }
  switch (regola) {
    case 'testo':
      if (typeof v === 'string') return null
      return { spiegazione: `"${nome}" dovrebbe essere un testo tra virgolette, invece c’è ${descrivi(v)}`, breve: `qui "${nome}" non è un testo` }
    case 'testo-o-null':
      if (typeof v === 'string' || v === null) return null
      return { spiegazione: `"${nome}" dovrebbe essere un testo tra virgolette (o null), invece c’è ${descrivi(v)}`, breve: `qui "${nome}" non è un testo` }
    case 'data':
      if (typeof v === 'string' && dataValida(v)) return null
      return {
        spiegazione: `"${nome}" dovrebbe essere una data scritta AAAA-MM-GG tra virgolette (es. "2026-09-30"), invece c’è ${descrivi(v)}`,
        breve: 'qui la data non è valida',
      }
    case 'numero':
    case 'numero-positivo':
    case 'numero-non-negativo': {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        const consiglio = comeTesto ? ` (togliere le virgolette${String(v).includes(',') ? ' e usare il punto per i decimali' : ''})` : ''
        return { spiegazione: `"${nome}" dovrebbe essere un numero, invece c’è ${descrivi(v)}${consiglio}`, breve: `qui "${nome}" non è un numero` }
      }
      if (regola === 'numero-positivo' && v <= 0)
        return { spiegazione: `"${nome}" dovrebbe essere maggiore di zero, invece c’è ${v}`, breve: `qui "${nome}" non è valido` }
      if (regola === 'numero-non-negativo' && v < 0)
        return { spiegazione: `"${nome}" non può essere negativo, invece c’è ${v}`, breve: `qui "${nome}" non è valido` }
      return null
    }
    default:
      if (typeof v === 'string' && regola.scelta.includes(v)) return null
      return {
        spiegazione: `"${nome}" dovrebbe essere uno di questi: ${regola.scelta.map((s) => `"${s}"`).join(', ')}; invece c’è ${descrivi(v)}`,
        breve: `qui "${nome}" non è valido`,
      }
  }
}

type Schema = Record<string, { regola: Regola; facoltativo?: boolean }>

const SCHEMA_TITOLO: Schema = {
  id: { regola: 'testo' },
  isin: { regola: 'testo' },
  borsa: { regola: { scelta: BORSE } },
  nomeBorsa: { regola: 'testo' },
  nome: { regola: 'testo' },
  soprannome: { regola: 'testo-o-null' },
  simbolo: { regola: 'testo-o-null' },
  descrizioneBanca: { regola: 'testo' },
  dossier: { regola: 'testo' },
  tipo: { regola: { scelta: ['Obbligazione'] }, facoltativo: true },
  paroleSemplici: { regola: 'testo', facoltativo: true },
  valuta: { regola: 'testo', facoltativo: true },
  codiceInvesting: { regola: 'numero-positivo', facoltativo: true },
  codiceYahoo: { regola: 'testo', facoltativo: true },
  borsaRiserve: { regola: { scelta: ['XET'] }, facoltativo: true },
}

const SCHEMA_OPERAZIONE: Schema = {
  id: { regola: 'testo' },
  titolo: { regola: 'testo' },
  tipo: { regola: { scelta: ['acquisto', 'vendita'] } },
  data: { regola: 'data' },
  esecuzione: { regola: 'testo' },
  quantita: { regola: 'numero-positivo' },
  prezzo: { regola: 'numero-non-negativo' },
  valuta: { regola: 'testo' },
  cambio: { regola: 'numero-positivo' },
  commissioni: { regola: 'numero-non-negativo' },
  totale: { regola: 'numero-non-negativo' },
  rifOrdine: { regola: 'testo-o-null' },
  fonte: { regola: 'testo' },
  nota: { regola: 'testo', facoltativo: true },
  quando: { regola: 'testo', facoltativo: true },
}

const SCHEMA_DIVIDENDO: Schema = {
  id: { regola: 'testo' },
  titolo: { regola: 'testo' },
  data: { regola: 'data' },
  lordo: { regola: 'numero-non-negativo' },
  imposte: { regola: 'numero-non-negativo' },
  netto: { regola: 'numero-non-negativo' },
  fonte: { regola: 'testo' },
  nota: { regola: 'testo', facoltativo: true },
  quando: { regola: 'testo', facoltativo: true },
}

// Il "prima" di un movimento corretto a mano (ticket 11): solo i campi cambiati, con il valore di prima.
const SCHEMA_PRIMA_OPERAZIONE: Schema = {
  data: { regola: 'data', facoltativo: true },
  quantita: { regola: 'numero-positivo', facoltativo: true },
  prezzo: { regola: 'numero-non-negativo', facoltativo: true },
  cambio: { regola: 'numero-positivo', facoltativo: true },
  commissioni: { regola: 'numero-non-negativo', facoltativo: true },
  totale: { regola: 'numero-non-negativo', facoltativo: true },
}
const SCHEMA_PRIMA_DIVIDENDO: Schema = {
  data: { regola: 'data', facoltativo: true },
  lordo: { regola: 'numero-non-negativo', facoltativo: true },
  imposte: { regola: 'numero-non-negativo', facoltativo: true },
  netto: { regola: 'numero-non-negativo', facoltativo: true },
}

const SCHEMA_PREZZO: Schema = {
  titolo: { regola: 'testo' },
  data: { regola: 'data' },
  prezzo: { regola: 'numero-positivo' },
  valuta: { regola: 'testo' },
  cambio: { regola: 'numero-positivo', facoltativo: true },
  fonte: { regola: 'testo' },
  seduta: { regola: 'data', facoltativo: true },
  nota: { regola: 'testo', facoltativo: true },
  quando: { regola: 'testo', facoltativo: true },
}

// Dalla versione 3 la fonte ha un nome fisso.
const SCHEMA_PREZZO_V3: Schema = { ...SCHEMA_PREZZO, fonte: { regola: { scelta: FONTI_PREZZO } } }

const SCHEMA_CAMBIO: Schema = {
  valuta: { regola: 'testo' },
  data: { regola: 'data' },
  cambio: { regola: 'numero-positivo' },
  fonte: { regola: { scelta: FONTI_CAMBIO } },
  seduta: { regola: 'data', facoltativo: true },
  quando: { regola: 'testo', facoltativo: true },
}

const SCHEMA_RIFERIMENTO: Schema = {
  riferimento: { regola: { scelta: RIFERIMENTI } },
  data: { regola: 'data' },
  valore: { regola: 'numero-positivo' },
  valuta: { regola: 'testo' },
  cambio: { regola: 'numero-positivo', facoltativo: true },
  fonte: { regola: { scelta: FONTI_RIFERIMENTO } },
  seduta: { regola: 'data', facoltativo: true },
  nota: { regola: 'testo', facoltativo: true },
  quando: { regola: 'testo', facoltativo: true },
}

const SCHEMA_NIC: Schema = {
  data: { regola: 'data' },
  valore: { regola: 'numero-positivo' },
  base: { regola: { numeri: [2015, 2025] } },
  fonte: { regola: { scelta: FONTI_NIC } },
  nota: { regola: 'testo', facoltativo: true },
  quando: { regola: 'testo', facoltativo: true },
}

const NOMI_ELENCHI = {
  titoli: 'nell’elenco dei titoli',
  operazioni: 'nell’elenco delle operazioni',
  dividendi: 'nell’elenco dei dividendi',
  prezzi: 'nell’elenco dei prezzi di fine mese',
  cambi: 'nell’elenco dei cambi di fine mese',
  riferimenti: 'nell’elenco dei valori dei riferimenti',
  nic: 'nell’elenco dell’inflazione NIC',
} as const

function controllaForma(radice: unknown): Trovato[] {
  const trovati: Trovato[] = []
  const trova = (p: string, spiegazione: string, breve: string) => trovati.push({ percorso: p, spiegazione, breve })

  if (!eOggetto(radice) || radice.formato !== 'portafoglio') {
    trova(
      eOggetto(radice) ? percorso('formato') : '',
      'non è un file dei dati di Portafoglio titoli: all’inizio manca "formato": "portafoglio"',
      'qui manca "formato": "portafoglio"',
    )
    return trovati
  }
  const versione = radice.versione
  if (typeof versione !== 'number' || !(VERSIONI_CONOSCIUTE as readonly number[]).includes(versione)) {
    const piuNuova = typeof versione === 'number' && versione > Math.max(...VERSIONI_CONOSCIUTE)
    trova(
      percorso('versione'),
      piuNuova
        ? `il file è della versione ${versione}, più recente di questo programma: aggiornare il programma`
        : `la versione del file dovrebbe essere ${VERSIONI_CONOSCIUTE.join(' o ')}, invece c’è ${descrivi(versione)}`,
      'qui la versione non è valida',
    )
    return trovati
  }
  const creato = controllaCampo('creato', radice.creato, 'testo', false)
  if (creato) trova(percorso('creato'), creato.spiegazione, creato.breve)

  const elenchi: [keyof typeof NOMI_ELENCHI, Schema, string][] = [
    ['titoli', SCHEMA_TITOLO, 'il titolo'],
    ['operazioni', SCHEMA_OPERAZIONE, 'l’operazione'],
    ['dividendi', SCHEMA_DIVIDENDO, 'il dividendo'],
    ['prezzi', versione >= 3 ? SCHEMA_PREZZO_V3 : SCHEMA_PREZZO, 'il prezzo'],
    ['cambi', SCHEMA_CAMBIO, 'il cambio'],
    ['riferimenti', SCHEMA_RIFERIMENTO, 'il valore'],
    ['nic', SCHEMA_NIC, 'il NIC'],
  ]
  for (const [chiave, schema, nomeUno] of elenchi) {
    const elenco = radice[chiave]
    if (elenco === undefined) continue
    if (!Array.isArray(elenco)) {
      trova(percorso(chiave), `"${chiave}" dovrebbe essere una lista tra [ ], invece c’è ${descrivi(elenco)}`, `qui "${chiave}" non è una lista`)
      continue
    }
    elenco.forEach((voce, n) => {
      if (!eOggetto(voce)) {
        trova(percorso(chiave, n), `${NOMI_ELENCHI[chiave]} c’è ${descrivi(voce)} al posto di un gruppo di dati tra { }`, 'qui il dato non è valido')
        return
      }
      for (const [campo, { regola, facoltativo }] of Object.entries(schema)) {
        const p = controllaCampo(campo, voce[campo], regola, facoltativo ?? false)
        if (p) trova(percorso(chiave, n, campo), `${NOMI_ELENCHI[chiave]}, ${nomeUno} n. ${n + 1}: ${p.spiegazione}`, p.breve)
      }
    })
  }

  // I legami tra i dati: id unici, operazioni e prezzi di titoli che esistono.
  const titoli = Array.isArray(radice.titoli) ? radice.titoli.filter(eOggetto) : []
  const idTitoli = new Set(titoli.map((t) => t.id))
  for (const chiave of ['titoli', 'operazioni', 'dividendi'] as const) {
    const elenco = radice[chiave]
    if (!Array.isArray(elenco)) continue
    const visti = new Set<unknown>()
    elenco.forEach((voce, n) => {
      if (!eOggetto(voce) || typeof voce.id !== 'string') return
      if (visti.has(voce.id))
        trova(percorso(chiave, n, 'id'), `${NOMI_ELENCHI[chiave]} il codice "${voce.id}" compare due volte`, 'qui il codice è ripetuto')
      visti.add(voce.id)
    })
  }
  for (const chiave of ['operazioni', 'dividendi', 'prezzi'] as const) {
    const elenco = radice[chiave]
    if (!Array.isArray(elenco)) continue
    elenco.forEach((voce, n) => {
      if (eOggetto(voce) && typeof voce.titolo === 'string' && !idTitoli.has(voce.titolo))
        trova(
          percorso(chiave, n, 'titolo'),
          `${NOMI_ELENCHI[chiave]} c’è il titolo "${voce.titolo}", che non è nell’elenco dei titoli`,
          'qui il titolo non esiste',
        )
    })
  }
  if (Array.isArray(radice.prezzi)) {
    const visti = new Set<string>()
    radice.prezzi.forEach((voce, n) => {
      if (!eOggetto(voce) || typeof voce.titolo !== 'string' || typeof voce.data !== 'string') return
      const k = voce.titolo + '|' + voce.data
      if (visti.has(k))
        trova(percorso('prezzi', n), `ci sono due prezzi dello stesso titolo per lo stesso giorno (${voce.data})`, 'qui il prezzo è ripetuto')
      visti.add(k)
    })
  }
  // Il controllo di investing.com su un prezzo: { "prezzo": …, "seduta": … } oppure { "perche": "…" }.
  if (Array.isArray(radice.prezzi))
    radice.prezzi.forEach((voce, n) => {
      if (!eOggetto(voce) || voce.controllo === undefined) return
      const c = voce.controllo
      const va =
        eOggetto(c) &&
        (typeof c.perche === 'string' ||
          (typeof c.prezzo === 'number' && Number.isFinite(c.prezzo) && c.prezzo > 0 && typeof c.seduta === 'string' && dataValida(c.seduta)))
      if (!va)
        trova(
          percorso('prezzi', n, 'controllo'),
          `${NOMI_ELENCHI.prezzi}, il prezzo n. ${n + 1}: "controllo" dovrebbe avere "prezzo" e "seduta", oppure "perche"`,
          'qui il controllo non è valido',
        )
    })
  // Un movimento corretto a mano: "prima" è un gruppo con i campi cambiati, e c'è anche "quando".
  for (const [chiave, schema, nomeUno] of [
    ['operazioni', SCHEMA_PRIMA_OPERAZIONE, 'l’operazione'],
    ['dividendi', SCHEMA_PRIMA_DIVIDENDO, 'il dividendo'],
  ] as const) {
    const elenco = radice[chiave]
    if (!Array.isArray(elenco)) continue
    elenco.forEach((voce, n) => {
      if (!eOggetto(voce) || voce.prima === undefined) return
      const prima = voce.prima
      const dove = `${NOMI_ELENCHI[chiave]}, ${nomeUno} n. ${n + 1}`
      const campi = eOggetto(prima) ? Object.keys(prima) : []
      if (!eOggetto(prima) || campi.length === 0 || campi.some((c) => !(c in schema))) {
        trova(
          percorso(chiave, n, 'prima'),
          `${dove}: "prima" dovrebbe avere i campi corretti manualmente (${Object.keys(schema).map((c) => `"${c}"`).join(', ')}) con il valore di prima`,
          'qui "prima" non è valido',
        )
        return
      }
      for (const c of campi) {
        const p = controllaCampo(c, prima[c], schema[c].regola, false)
        if (p) trova(percorso(chiave, n, 'prima', c), `${dove}, nel valore di prima: ${p.spiegazione}`, p.breve)
      }
      if (voce.quando === undefined) trova(percorso(chiave, n, 'prima'), `${dove}: c’è "prima" ma manca "quando"`, 'qui manca "quando"')
    })
  }
  if (Array.isArray(radice.cambi)) {
    const visti = new Set<string>()
    radice.cambi.forEach((voce, n) => {
      if (!eOggetto(voce) || typeof voce.valuta !== 'string' || typeof voce.data !== 'string') return
      const k = voce.valuta + '|' + voce.data
      if (visti.has(k))
        trova(percorso('cambi', n), `ci sono due cambi della stessa valuta per lo stesso giorno (${voce.valuta}, ${voce.data})`, 'qui il cambio è ripetuto')
      visti.add(k)
    })
  }
  return trovati
}
