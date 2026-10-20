// I riferimenti e l'inflazione (ticket 9): cosa sono i sei riferimenti di borsa, quali date e quali mesi
// servono al confronto "gli stessi euro, nelle stesse date", la parte della lista di Aggiorna che li scarica
// (nel gruppo che può aspettare) e come si scrivono nel file. Le fonti sono in electron/fonti/riferimenti.ts
// (investing.com e BCE) ed electron/fonti/istat.ts (NIC).
// Modulo puro: lo usano le pagine e il processo principale. Ogni funzione restituisce un oggetto nuovo.
import { RIFERIMENTI, type FileDati, type IdRiferimento, type NicDelMese, type ValoreRiferimento } from '../tipi.ts'
import { fineMese, meseDi, meseDopo, meseEAnno, nomeMese } from './calendario.ts'

export const FONTE_RIFERIMENTO = { investing: 'investing.com', aMano: 'a mano' } as const
export const FONTI_RIFERIMENTO: readonly string[] = Object.values(FONTE_RIFERIMENTO)
export const FONTE_NIC = { istat: 'ISTAT', aMano: 'a mano' } as const
export const FONTI_NIC: readonly string[] = Object.values(FONTE_NIC)

export type Riferimento = {
  id: IdRiferimento
  /** Il nome nelle tabelle: "S&P 500". */
  nome: string
  /** Cosa si scarica davvero, in parole: "l'indice con i dividendi reinvestiti, in dollari". */
  cosa: string
  /** In breve, sotto il nome: "indice con i dividendi, in dollari". */
  breve: string
  valuta: 'EUR' | 'USD'
  /** La linea su investing.com (pairId): sono codici pubblici dei riferimenti, non dei titoli dell'utente. */
  codiceInvesting: number
}

/**
 * I sei riferimenti di borsa, tutti con i dividendi reinvestiti (decisione 05 della mappa). Dove l'indice
 * con i dividendi non è gratuito (FTSE MIB, Euro Stoxx 50) si usa un ETF ad accumulazione che lo segue;
 * il BTP 10 anni è l'ETF Amundi BTP 10 anni, che reinveste le cedole. I codici sono quelli provati nella
 * ricerca 18 della mappa (stesso valore del sito ufficiale per Nasdaq-100 e di Yahoo per l'S&P 500).
 */
export const DESCRIZIONE: Record<IdRiferimento, Riferimento> = {
  btp10: {
    id: 'btp10',
    breve: 'ETF BTP10, con le cedole',
    nome: 'BTP 10 anni',
    cosa: 'ETF Amundi BTP 10 anni (BTP10, Borsa Italiana), con le cedole reinvestite',
    valuta: 'EUR',
    codiceInvesting: 1052106,
  },
  ftsemib: {
    id: 'ftsemib',
    breve: 'ETF ad accumulazione, con i dividendi',
    nome: 'FTSE MIB',
    cosa: 'ETF iShares FTSE MIB ad accumulazione (CSMIB, Borsa Italiana), con i dividendi reinvestiti',
    valuta: 'EUR',
    codiceInvesting: 46888,
  },
  eurostoxx50: {
    id: 'eurostoxx50',
    breve: 'ETF ad accumulazione, con i dividendi',
    nome: 'Euro Stoxx 50',
    cosa: 'ETF iShares Core Euro Stoxx 50 ad accumulazione (CSSX5E, Borsa Italiana), con i dividendi reinvestiti',
    valuta: 'EUR',
    codiceInvesting: 46895,
  },
  nasdaq100: {
    id: 'nasdaq100',
    breve: 'indice con i dividendi, in dollari',
    nome: 'Nasdaq-100',
    cosa: 'indice Nasdaq-100 con i dividendi reinvestiti (XNDX), in dollari',
    valuta: 'USD',
    codiceInvesting: 943722,
  },
  dowjones: {
    id: 'dowjones',
    breve: 'indice con i dividendi, in dollari',
    nome: 'Dow Jones',
    cosa: 'indice Dow Jones con i dividendi reinvestiti, in dollari',
    valuta: 'USD',
    codiceInvesting: 998997,
  },
  sp500: {
    id: 'sp500',
    breve: 'indice con i dividendi, in dollari',
    nome: 'S&P 500',
    cosa: 'indice S&P 500 con i dividendi reinvestiti, in dollari',
    valuta: 'USD',
    codiceInvesting: 951245,
  },
}

export const NOME_NIC = 'Inflazione NIC'

// ---------- quali date e quali mesi servono ----------

/** Il mese del primo movimento, "AAAA-MM": la storia comincia da lì (es. febbraio 2024). */
export function primoMese(dati: FileDati): string | null {
  let primo: string | null = null
  for (const o of dati.operazioni ?? []) if (!primo || o.data < primo) primo = o.data
  return primo ? meseDi(primo) : null
}

/**
 * Le date che servono per un riferimento fino al mese indicato: la fine di ogni mese dal primo movimento,
 * e la data di ogni movimento (acquisti e vendite, data di regolamento come nei conti del portafoglio).
 * Esempio: primo acquisto il 23/02/2024, mese ottobre 2026 → 2024-02-23, 2024-02-29, 2024-03-31, … 2026-10-31.
 */
export function dateNecessarie(dati: FileDati, mese: string): string[] {
  const primo = primoMese(dati)
  if (!primo) return []
  const fine = fineMese(mese)
  const date = new Set<string>()
  for (let m = primo; m <= mese; m = meseDopo(m)) date.add(fineMese(m))
  for (const o of dati.operazioni ?? []) if (o.data <= fine) date.add(o.data)
  return [...date].sort()
}

/** I mesi del NIC che servono: dal mese prima del primo movimento (la base del primo acquisto) fino al mese. */
export function mesiNicNecessari(dati: FileDati, mese: string): string[] {
  const primo = primoMese(dati)
  if (!primo) return []
  const mesi: string[] = []
  for (let m = meseDopo(primo, -1); m <= mese; m = meseDopo(m)) mesi.push(m)
  return mesi
}

/** I valori del riferimento nel file, per data. */
function valoriNelFile(dati: FileDati, id: IdRiferimento): Map<string, ValoreRiferimento> {
  return new Map((dati.riferimenti ?? []).filter((v) => v.riferimento === id).map((v) => [v.data, v]))
}

function nicNelFile(dati: FileDati): Map<string, NicDelMese> {
  return new Map((dati.nic ?? []).map((n) => [meseDi(n.data), n]))
}

/**
 * Le date da chiedere per un riferimento: quelle che mancano nel file. Con "Rifai" anche la fine del mese,
 * per vedere prima e dopo. Un valore scritto a mano non si richiede mai: resta com'è.
 */
export function dateDaChiedere(dati: FileDati, id: IdRiferimento, mese: string, rifai: boolean): string[] {
  const nelFile = valoriNelFile(dati, id)
  const fine = fineMese(mese)
  return dateNecessarie(dati, mese).filter((d) => {
    const c = nelFile.get(d)
    if (!c) return true
    return rifai && d === fine && c.fonte !== FONTE_RIFERIMENTO.aMano
  })
}

/** I mesi del NIC da chiedere: quelli che mancano (anche quelli che all'aggiornamento scorso non erano usciti). */
export function mesiNicDaChiedere(dati: FileDati, mese: string, rifai: boolean): string[] {
  const nelFile = nicNelFile(dati)
  return mesiNicNecessari(dati, mese).filter((m) => {
    const c = nelFile.get(m)
    if (!c) return true
    return rifai && m === mese && c.fonte !== FONTE_NIC.aMano
  })
}

// ---------- quello che arriva dalle fonti ----------

/** Un valore arrivato: la chiusura della seduta, e per i riferimenti in dollari il cambio BCE dello stesso giorno. */
export type ValoreArrivato = { data: string; valore: number; seduta: string; cambio?: number; nota?: string }

export type EsitoRiferimento =
  | { ok: true; valori: ValoreArrivato[]; /** Le date chieste che la fonte non ha. */ mancano: string[] }
  | { ok: false; perche: string }

export type NicArrivato = { data: string; valore: number; base: 2015 | 2025; nota?: string }

export type EsitoNic = { ok: true; valori: NicArrivato[] } | { ok: false; perche: string }

// ---------- la parte della lista di Aggiorna ----------

type StatoDi<A> = { tipo: 'attesa' } | { tipo: 'scarica' } | { tipo: 'arrivato'; esito: A } | { tipo: 'manca'; perche: string }

export type RigaRiferimento = {
  id: IdRiferimento
  /** Le date da chiedere; vuoto se nel file c'è già tutto (per esempio il valore del mese è a mano). */
  date: string[]
  /** Il valore della fine del mese prima, per "sul mese", se è nel file. */
  precedente?: ValoreRiferimento
  /** Il valore del mese che c'è già nel file ("Rifai", o scritto a mano). */
  prima?: ValoreRiferimento
  stato: StatoDi<Extract<EsitoRiferimento, { ok: true }>>
}

export type ParteNic = {
  /** I mesi da chiedere, dal più vecchio. */
  mesi: string[]
  /** L'ultimo mese che ha il NIC nel file, prima di questo aggiornamento. */
  ultimoNelFile: string | null
  /** I NIC del file, per "sul mese" e per il prima e dopo. */
  nelFile: NicDelMese[]
  stato: StatoDi<Extract<EsitoNic, { ok: true }>>
}

export type ParteRiferimenti = {
  mese: string
  /** Nel file non c'è ancora niente: questo aggiornamento scarica anche la storia. */
  primaVolta: boolean
  /** Il primo mese della storia (quello del primo movimento). */
  dal: string | null
  righe: RigaRiferimento[]
  nic: ParteNic
}

export function creaRiferimenti(dati: FileDati, mese: string, rifai: boolean): ParteRiferimenti {
  const fine = fineMese(mese)
  const finePrima = fineMese(meseDopo(mese, -1))
  const righe = RIFERIMENTI.map((id): RigaRiferimento => {
    const nelFile = valoriNelFile(dati, id)
    const date = dateDaChiedere(dati, id, mese, rifai)
    const prima = nelFile.get(fine)
    const precedente = nelFile.get(finePrima)
    return {
      id,
      date,
      ...(precedente ? { precedente } : {}),
      ...(prima ? { prima } : {}),
      stato: date.length ? { tipo: 'attesa' } : { tipo: 'arrivato', esito: { ok: true, valori: [], mancano: [] } },
    }
  })
  const mesi = mesiNicDaChiedere(dati, mese, rifai)
  const nelFile = [...(dati.nic ?? [])].sort((a, b) => a.data.localeCompare(b.data))
  return {
    mese,
    primaVolta: !(dati.riferimenti ?? []).length && !(dati.nic ?? []).length,
    dal: primoMese(dati),
    righe,
    nic: {
      mesi,
      ultimoNelFile: nelFile.length ? meseDi(nelFile.at(-1)!.data) : null,
      nelFile,
      stato: mesi.length ? { tipo: 'attesa' } : { tipo: 'arrivato', esito: { ok: true, valori: [] } },
    },
  }
}

export function conRiga(p: ParteRiferimenti, id: IdRiferimento, cambia: (r: RigaRiferimento) => RigaRiferimento): ParteRiferimenti {
  return { ...p, righe: p.righe.map((r) => (r.id === id ? cambia(r) : r)) }
}

export function conNic(p: ParteRiferimenti, cambia: (n: ParteNic) => ParteNic): ParteRiferimenti {
  return { ...p, nic: cambia(p.nic) }
}

export function statoDaRiferimento(e: EsitoRiferimento): RigaRiferimento['stato'] {
  return e.ok ? { tipo: 'arrivato', esito: e } : { tipo: 'manca', perche: e.perche }
}

export function statoDaNic(e: EsitoNic): ParteNic['stato'] {
  return e.ok ? { tipo: 'arrivato', esito: e } : { tipo: 'manca', perche: e.perche }
}

/** Il valore del riferimento a fine mese: arrivato adesso, o già nel file (a mano, o "Rifai" non riuscito). */
export function valoreDelMese(p: ParteRiferimenti, r: RigaRiferimento): { valore: number; cambio?: number; seduta?: string; fonte: string; nota?: string } | null {
  const fine = fineMese(p.mese)
  if (r.stato.tipo === 'arrivato') {
    const v = r.stato.esito.valori.find((x) => x.data === fine)
    if (v) return { valore: v.valore, cambio: v.cambio, seduta: v.seduta, fonte: FONTE_RIFERIMENTO.investing, nota: v.nota }
  }
  // Un valore a mano (che non si richiede), o un "Rifai" che non è riuscito a riscaricare: resta quello di prima.
  if (r.prima && (!r.date.includes(fine) || r.stato.tipo === 'manca'))
    return { valore: r.prima.valore, cambio: r.prima.cambio, seduta: r.prima.seduta, fonte: r.prima.fonte, nota: r.prima.nota }
  return null
}

/** Il valore della fine del mese prima: dal file, o arrivato adesso con la storia. */
export function valorePrecedente(p: ParteRiferimenti, r: RigaRiferimento): { valore: number; cambio?: number } | null {
  if (r.precedente) return r.precedente
  const fine = fineMese(meseDopo(p.mese, -1))
  const v = r.stato.tipo === 'arrivato' ? r.stato.esito.valori.find((x) => x.data === fine) : undefined
  return v ?? null
}

/** In euro: i riferimenti in dollari si dividono per il cambio BCE dello stesso giorno. */
export function inEuro(v: { valore: number; cambio?: number }, valuta: string): number | null {
  if (valuta === 'EUR') return v.valore
  return v.cambio ? v.valore / v.cambio : null
}

/** Quanto è cambiato sul mese, in % e in euro (come lo vedi da qui). */
export function sulMeseRiferimento(p: ParteRiferimenti, r: RigaRiferimento): number | null {
  const ora = valoreDelMese(p, r)
  const prima = valorePrecedente(p, r)
  const valuta = DESCRIZIONE[r.id].valuta
  if (!ora || !prima) return null
  const a = inEuro(ora, valuta)
  const b = inEuro(prima, valuta)
  return a !== null && b !== null ? (a / b - 1) * 100 : null
}

/** Quante date della storia (oltre alla fine del mese) arrivano con questa riga. */
export function storiaDellaRiga(p: ParteRiferimenti, r: RigaRiferimento): { arrivate: number; mancano: string[] } {
  const fine = fineMese(p.mese)
  if (r.stato.tipo !== 'arrivato') return { arrivate: 0, mancano: [] }
  return {
    arrivate: r.stato.esito.valori.filter((v) => v.data !== fine).length,
    mancano: r.stato.esito.mancano.filter((d) => d !== fine),
  }
}

/** Le righe ancora in attesa o in arrivo. */
export function riferimentiInCorso(p: ParteRiferimenti | undefined): boolean {
  if (!p) return false
  const occupato = (s: { tipo: string }) => s.tipo === 'attesa' || s.tipo === 'scarica'
  return p.righe.some((r) => occupato(r.stato)) || occupato(p.nic.stato)
}

/** La frase della barra in basso quando riferimenti o inflazione sono ancora in arrivo. */
export function fraseBarraRiferimenti(p: ParteRiferimenti | undefined): string {
  return riferimentiInCorso(p) ? ' Riferimenti e inflazione ancora in arrivo non sono necessari: salvando adesso, si acquisiscono al prossimo aggiornamento.' : ''
}

/** Quanti riferimenti hanno il valore di fine mese. */
export function riferimentiPronti(p: ParteRiferimenti): number {
  return p.righe.filter((r) => valoreDelMese(p, r) !== null).length
}

/** Il NIC di un mese: arrivato adesso o già nel file. */
export function nicDelMese(n: ParteNic, mese: string): { valore: number; base: 2015 | 2025; fonte: string; nota?: string } | null {
  const data = fineMese(mese)
  if (n.stato.tipo === 'arrivato') {
    const v = n.stato.esito.valori.find((x) => x.data === data)
    if (v) return { valore: v.valore, base: v.base, fonte: FONTE_NIC.istat, nota: v.nota }
  }
  return n.nelFile.find((x) => x.data === data) ?? null
}

/** Il NIC che c'era nel file per quel mese ("Rifai"). */
export function nicPrima(n: ParteNic, mese: string): NicDelMese | undefined {
  return n.nelFile.find((x) => x.data === fineMese(mese))
}

/** L'ultimo mese che ha il NIC, contando quelli arrivati adesso. */
export function nicFinoA(n: ParteNic): string | null {
  let ultimo = n.ultimoNelFile
  if (n.stato.tipo === 'arrivato') for (const v of n.stato.esito.valori) if (!ultimo || meseDi(v.data) > ultimo) ultimo = meseDi(v.data)
  return ultimo
}

/** I mesi chiesti che ISTAT non ha ancora pubblicato (di solito il mese appena finito). */
export function nicNonAncora(n: ParteNic): string[] {
  if (n.stato.tipo !== 'arrivato') return []
  const arrivati = new Set(n.stato.esito.valori.map((v) => meseDi(v.data)))
  return n.mesi.filter((m) => !arrivati.has(m))
}

/** "fino ad agosto", "fino a settembre". */
export function finoAl(mese: string): string {
  const nome = nomeMese(mese)
  return `fino ${nome.startsWith('a') ? 'ad' : 'a'} ${nome}`
}

/** "verso metà novembre": quando ISTAT pubblica il dato definitivo del mese. */
export function quandoEsceNic(mese: string): string {
  return `verso metà ${nomeMese(meseDopo(mese))}`
}

/**
 * Le righe del NIC nella lista. Se si scarica la storia (più di 4 mesi), una riga per il mese e una per la
 * storia; altrimenti una riga per mese, e quelli prima del mese "mancavano dall'aggiornamento scorso".
 */
export type RigaNic = { tipo: 'mese'; mese: string; mancava: boolean } | { tipo: 'storia'; da: string; a: string; mesi: number }

export function righeNic(p: ParteRiferimenti): RigaNic[] {
  const { mesi } = p.nic
  const mese = p.mese
  const altri = mesi.filter((m) => m !== mese)
  const righe: RigaNic[] = []
  if (altri.length > 4) righe.push({ tipo: 'storia', da: altri[0], a: altri.at(-1)!, mesi: altri.length })
  else for (const m of altri) righe.push({ tipo: 'mese', mese: m, mancava: p.nic.ultimoNelFile !== null })
  righe.push({ tipo: 'mese', mese, mancava: false })
  return righe
}

// ---------- dalla lista al file ----------

/** Quello che si aggiunge al mese da salvare: tutti i valori arrivati, storia compresa. */
export type RiferimentiDaSalvare = { riferimenti: ValoreRiferimento[]; nic: NicDelMese[] }

export function riferimentiDaSalvare(p: ParteRiferimenti | undefined): RiferimentiDaSalvare {
  if (!p) return { riferimenti: [], nic: [] }
  const riferimenti: ValoreRiferimento[] = []
  for (const r of p.righe) {
    if (r.stato.tipo !== 'arrivato') continue
    const valuta = DESCRIZIONE[r.id].valuta
    for (const v of r.stato.esito.valori)
      riferimenti.push({
        riferimento: r.id,
        data: v.data,
        valore: v.valore,
        valuta,
        ...(v.cambio !== undefined ? { cambio: v.cambio } : {}),
        fonte: FONTE_RIFERIMENTO.investing,
        seduta: v.seduta,
        ...(v.nota ? { nota: v.nota } : {}),
      })
  }
  const nic: NicDelMese[] =
    p.nic.stato.tipo === 'arrivato'
      ? p.nic.stato.esito.valori.map((v) => ({ data: v.data, valore: v.valore, base: v.base, fonte: FONTE_NIC.istat, ...(v.nota ? { nota: v.nota } : {}) }))
      : []
  return { riferimenti, nic }
}

const DATA = /^\d{4}-\d{2}-\d{2}$/
const positivo = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0

/** Controlla i riferimenti e i NIC mandati dalla schermata, prima di toccare il file. */
export function controllaRiferimenti(m: Partial<RiferimentiDaSalvare>): { ok: true } | { ok: false; perche: string } {
  for (const v of m.riferimenti ?? []) {
    if (!(RIFERIMENTI as readonly string[]).includes(v.riferimento)) return { ok: false, perche: `il riferimento "${v.riferimento}" non esiste` }
    if (!DATA.test(v.data) || !positivo(v.valore)) return { ok: false, perche: `il valore di ${DESCRIZIONE[v.riferimento].nome} del ${v.data} non è valido` }
    if (DESCRIZIONE[v.riferimento].valuta !== 'EUR' && !positivo(v.cambio))
      return { ok: false, perche: `manca il cambio del dollaro per ${DESCRIZIONE[v.riferimento].nome} del ${v.data}` }
    if (!FONTI_RIFERIMENTO.includes(v.fonte)) return { ok: false, perche: `la fonte "${v.fonte}" di un riferimento non è valida` }
  }
  for (const n of m.nic ?? []) {
    if (!DATA.test(n.data) || !positivo(n.valore) || (n.base !== 2015 && n.base !== 2025))
      return { ok: false, perche: `il NIC del ${n.data} non è valido` }
    if (!FONTI_NIC.includes(n.fonte)) return { ok: false, perche: `la fonte "${n.fonte}" del NIC non è valida` }
  }
  return { ok: true }
}

/**
 * Scrive nel file i valori arrivati: sostituisce quelli con la stessa data, tranne quelli scritti a mano
 * (che restano). Gli altri dati non si toccano.
 */
export function scriviRiferimenti(dati: FileDati, m: Partial<RiferimentiDaSalvare>): FileDati {
  const nuoviRif = m.riferimenti ?? []
  const nuoviNic = m.nic ?? []
  if (!nuoviRif.length && !nuoviNic.length) return dati
  const chiave = (v: { riferimento: string; data: string }) => v.riferimento + '|' + v.data
  const aMano = new Set((dati.riferimenti ?? []).filter((v) => v.fonte === FONTE_RIFERIMENTO.aMano).map(chiave))
  const daScrivere = nuoviRif.filter((v) => !aMano.has(chiave(v)))
  const sostituiti = new Set(daScrivere.map(chiave))
  const ordine = new Map(RIFERIMENTI.map((id, i) => [id as string, i]))
  const riferimenti = [...(dati.riferimenti ?? []).filter((v) => !sostituiti.has(chiave(v))), ...daScrivere].sort(
    (a, b) => (ordine.get(a.riferimento) ?? 99) - (ordine.get(b.riferimento) ?? 99) || a.data.localeCompare(b.data),
  )
  const nicAMano = new Set((dati.nic ?? []).filter((n) => n.fonte === FONTE_NIC.aMano).map((n) => n.data))
  const nicDaScrivere = nuoviNic.filter((n) => !nicAMano.has(n.data))
  const nicSostituiti = new Set(nicDaScrivere.map((n) => n.data))
  const nic = [...(dati.nic ?? []).filter((n) => !nicSostituiti.has(n.data)), ...nicDaScrivere].sort((a, b) => a.data.localeCompare(b.data))
  return { ...dati, riferimenti, nic }
}

// ---------- leggere i dati del file ----------

/**
 * Il coefficiente per agganciare la base 2015 alla base 2025: la media del NIC 2025 in base 2015
 * (dati ISTAT: da 121,9 di gennaio a 122,6 di dicembre, media 122,633) diviso 100.
 * Un NIC in base 2015 diviso per questo numero è in base 2025.
 */
export const RACCORDO_2015_2025 = 1.22633

/** Il NIC di ogni mese in base 2025 = 100, con le due basi agganciate: Map "AAAA-MM" → valore. */
export function nicAgganciato(nic: readonly NicDelMese[]): Map<string, number> {
  return new Map(nic.map((n) => [meseDi(n.data), n.base === 2015 ? n.valore / RACCORDO_2015_2025 : n.valore]))
}

/**
 * Cosa manca alla storia fino al mese: per ogni riferimento le date senza valore e i mesi senza NIC.
 * Esempio: { riferimenti: { nasdaq100: ['2026-10-31'] }, nic: ['2026-10'] }.
 */
export function storiaMancante(dati: FileDati, mese: string): { riferimenti: Partial<Record<IdRiferimento, string[]>>; nic: string[] } {
  const riferimenti: Partial<Record<IdRiferimento, string[]>> = {}
  for (const id of RIFERIMENTI) {
    const c = dateDaChiedere(dati, id, mese, false)
    if (c.length) riferimenti[id] = c
  }
  return { riferimenti, nic: mesiNicDaChiedere(dati, mese, false) }
}

/** Le frasi del riquadro "Aggiornamento di <mese> salvato" per riferimenti e inflazione, dal file appena scritto. */
export function frasiDopoIlSalvataggio(dati: FileDati, mese: string, primaVolta: boolean): string[] {
  const manca = storiaMancante(dati, mese)
  const frasi: string[] = []
  const fine = fineMese(mese)
  const senzaMese = RIFERIMENTI.filter((id) => manca.riferimenti[id]?.includes(fine)).map((id) => DESCRIZIONE[id].nome)
  const senzaStoria = RIFERIMENTI.filter((id) => manca.riferimenti[id]?.some((d) => d !== fine)).map((id) => DESCRIZIONE[id].nome)
  const dal = primoMese(dati)
  if (!senzaMese.length) frasi.push(`I 6 riferimenti di borsa hanno il valore di fine ${nomeMese(mese)}.`)
  else
    frasi.push(
      `${senzaMese.length === 1 ? 'Il riferimento' : 'I riferimenti'} ${elenco(senzaMese)} ${senzaMese.length === 1 ? 'è mancante' : 'sono mancanti'}: si richiede di nuovo al prossimo aggiornamento.`,
    )
  if (dal && primaVolta && !senzaStoria.length) frasi.push(`Lo storico dei riferimenti da ${meseEAnno(dal)} è completo, con il valore alle date dei movimenti.`)
  else if (senzaStoria.length) frasi.push(`Allo storico di ${elenco(senzaStoria)} mancano ancora alcune date: si completano al prossimo aggiornamento.`)
  const nonAncora = manca.nic
  if (!nonAncora.length) frasi.push(`L’inflazione è disponibile ${finoAl(mese)}.`)
  else if (nonAncora.length === 1 && nonAncora[0] === mese) {
    const prima = meseDopo(mese, -1)
    frasi.push(`L’inflazione è disponibile ${finoAl(prima)}: il dato di ${nomeMese(mese)} esce ${quandoEsceNic(mese)} e si acquisisce al prossimo aggiornamento.`)
  } else frasi.push(`Mancano ancora ${nonAncora.length} mesi dell’inflazione: si acquisiscono al prossimo aggiornamento.`)
  return frasi
}

export function elenco(parole: string[]): string {
  return parole.length < 2 ? parole.join('') : parole.slice(0, -1).join(', ') + ' e ' + parole.at(-1)
}
