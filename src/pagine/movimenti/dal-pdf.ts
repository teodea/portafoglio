// Dal PDF della banca alla bozza della schermata Registra (ticket 12). Modulo puro, provato con Vitest.
//
// Letto il PDF (dati/pdf-fineco.ts), la bozza ha i testi dei campi come li scriverebbe una persona,
// e in "dalPdf" gli stessi testi: un campo uguale al PDF si segna "dal PDF", uno cambiato "manuale".
// Se il titolo non c'è ancora nel file, la bozza ha "nuovo": il riquadro "Titolo nuovo" (ISIN, simbolo e borsa
// dal PDF, le parole semplici da scrivere, i codici delle riserve da cercare). Nel campo del titolo c'è allora NUOVO.
import { giaRegistrato, leggiCampi, titoloDelPdf, unisciPdf, type Letto, type LettoUnito, type PdfAperto } from '../../dati/pdf-fineco.ts'
import { mancaNelTitoloNuovo, conTitoloNuovo, titoloNuovo, type CodiciTrovati, type DatiTitoloNuovo } from '../../dati/titolo-nuovo.ts'
import type { Borsa, FileDati, Titolo } from '../../dati/tipi.ts'
import { leggiBozza, numeroNellaCasella, dataNellaCasella, type Bozza, type CampoBozza, type Letta } from './bozza.ts'

/** Nel campo del titolo: il titolo nuovo del riquadro. */
export const NUOVO = 'nuovo'

/** Le cose della bozza che vengono solo dal PDF. */
export type DalPdf = {
  /** Dove stanno i PDF, per "Apri il PDF" (null nel browser, durante lo sviluppo). */
  percorsi: (string | null)[]
  /** I pezzi dello stesso ordine sommati, se erano più di uno. */
  pezzi: { nome: string; quantita: number; prezzo: number; valuta: string; totale: number }[] | null
  /** Il numero d'ordine della banca, per la frase dei pezzi. */
  ordine: string | null
  /** Per un dividendo: le quote scritte nel PDF. */
  quotePdf: number | null
  /** Cose da guardare, in parole. */
  avvisi: string[]
  /** Il movimento già registrato con questo PDF: non si registra due volte ("Apri il movimento"). */
  doppio: string | null
  /** Il riquadro "Titolo nuovo", se il titolo non è nel file. */
  nuovo: TitoloNuovoDelPdf | null
}

export type BozzaPdf = Bozza & { dalPdfInfo?: DalPdf }

export type DaiPdf =
  | { ok: true; bozza: BozzaPdf }
  | { ok: false; perche: string }

/** Dai PDF aperti dal processo principale alla bozza; se non va, perché, in parole. */
export function bozzaDaiPdf(dati: FileDati, aperti: PdfAperto[]): DaiPdf {
  if (aperti.length === 0) return { ok: false, perche: 'Nessun PDF da leggere.' }
  const letti: Letto[] = []
  for (const a of aperti) {
    if (!/\.pdf$/i.test(a.nome)) return { ok: false, perche: `${a.nome} non è un PDF. Trascinare qui il PDF della banca.` }
    if ('perche' in a) return { ok: false, perche: `Impossibile leggere ${a.nome}: ${a.perche}.` }
    const l = leggiCampi(a.nome, a.percorso, a.campi)
    if (!l.ok) return { ok: false, perche: maiuscola(l.perche) + '.' }
    letti.push(l.letto)
  }
  const u = unisciPdf(letti)
  if (!u.ok) return { ok: false, perche: u.perche + '.' }
  const l = u.letto
  const titolo = titoloDelPdf(dati, l)
  if (titolo.quale === 'non-hai') return { ok: false, perche: `Il PDF non può essere registrato: ${titolo.perche}.` }
  const bozza =
    titolo.quale === 'trovato' ? bozzaDalLetto(l, titolo.id, titolo.altraBorsa, null) : bozzaDalLetto(l, NUOVO, undefined, titolo.borsa)
  bozza.dalPdfInfo!.doppio = giaRegistrato(dati, l)
  return { ok: true, bozza }
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function bozzaDalLetto(l: LettoUnito, titolo: string, altraBorsa: string | undefined, borsaNuovo: Borsa | null): BozzaPdf {
  const avvisi = [...l.avvisi]
  if (altraBorsa) avvisi.push(`Il PDF indica una vendita su ${altraBorsa}: viene registrata sul titolo in portafoglio con lo stesso ISIN.`)
  const num = (n: number) => numeroNellaCasella(n)
  const testi: Record<CampoBozza, string> = {
    titolo,
    data: dataNellaCasella(l.data),
    quantita: '',
    prezzo: '',
    cambio: '',
    commissioni: '0',
    totale: '',
    lordo: '',
    imposte: '',
  }
  if (l.tipo === 'dividendo') {
    testi.lordo = num(l.lordo)
    testi.imposte = num(l.imposte)
  } else {
    testi.quantita = num(l.quantita)
    testi.prezzo = num(l.prezzo)
    testi.cambio = num(l.cambio)
    testi.commissioni = num(l.commissioni)
    testi.totale = num(l.totale)
  }
  const nota = l.tipo === 'dividendo' ? (l.cedola ? 'Cedola dell’obbligazione' : undefined) : l.nota
  const info: DalPdf = {
    percorsi: l.percorsi,
    pezzi: l.pezzi ? l.pezzi.map((p) => ({ nome: p.nome, quantita: p.quantita, prezzo: p.prezzo, valuta: p.valuta, totale: p.totale })) : null,
    ordine: l.tipo === 'dividendo' ? null : l.rifOrdine,
    quotePdf: l.tipo === 'dividendo' ? l.quantita : null,
    avvisi,
    doppio: null,
    nuovo:
      titolo === NUOVO && l.tipo !== 'dividendo'
        ? {
            isin: l.isin,
            borsa: borsaNuovo,
            simbolo: l.simbolo,
            parole: '',
            descrizioneBanca: l.descrizione,
            valuta: l.valuta,
            fuoriMercato: l.fuoriMercato,
            mercato: l.mercato,
          }
        : null,
  }
  return {
    tipo: l.tipo,
    origine: 'pdf',
    testi,
    dalPdf: { ...testi },
    pdf: l.pdf,
    ...(l.tipo === 'dividendo' ? {} : { rifOrdine: l.rifOrdine, ...(l.esecuzione ? { esecuzione: l.esecuzione } : {}) }),
    ...(nota ? { nota } : {}),
    totaleScritto: true,
    dalPdfInfo: info,
  }
}

// ---------- la bozza con il titolo nuovo ----------

export type Vista = {
  /** Il file come sarebbe con il titolo nuovo (per le frasi e i controlli); se no, il file. */
  dati: FileDati
  /** La bozza con il codice vero del titolo nuovo al posto di NUOVO. */
  bozza: Bozza
  /** Il titolo nuovo da aggiungere, se c'è e ha la borsa. */
  titoloNuovo: Titolo | null
  /** Cosa manca nel riquadro "Titolo nuovo". */
  mancaNuovo: string[]
}

/** La bozza vista con il titolo nuovo dentro il file: così frase, riquadri e controlli funzionano come per gli altri. */
export function vistaDellaBozza(dati: FileDati, b: BozzaPdf): Vista {
  const n = b.dalPdfInfo?.nuovo
  if (!n || b.testi.titolo !== NUOVO) return { dati, bozza: b, titoloNuovo: null, mancaNuovo: [] }
  const t = titoloNuovo(dati, n)
  const mancaNuovo = mancaNelTitoloNuovo(n)
  if (!t) return { dati, bozza: { ...b, testi: { ...b.testi, titolo: '' } }, titoloNuovo: null, mancaNuovo }
  // Il titolo si aggiunge com'è anche se manca qualcosa: la frase si vede subito, "Sì, registra" aspetta il riquadro.
  return { dati: conTitoloNuovo(dati, t), bozza: { ...b, testi: { ...b.testi, titolo: t.id }, dalPdf: { ...b.dalPdf, titolo: t.id } }, titoloNuovo: t, mancaNuovo }
}

/** Legge la bozza (come bozza.ts), con il titolo nuovo e quello che manca nel suo riquadro. */
export function leggiBozzaPdf(dati: FileDati, b: BozzaPdf): Letta & { vista: Vista } {
  const vista = vistaDellaBozza(dati, b)
  const letta = leggiBozza(vista.dati, vista.bozza)
  const mancano = vista.mancaNuovo.length > 0 ? [...letta.mancano.filter((x) => x !== 'il titolo'), ...vista.mancaNuovo] : letta.mancano
  return { ...letta, mancano, vista }
}

/** Il riquadro "Titolo nuovo": i dati del titolo, più la ricerca dei codici (fatta una volta per ISIN e borsa). */
export type TitoloNuovoDelPdf = DatiTitoloNuovo & {
  fuoriMercato: boolean
  mercato: string
  ricerca?: { chiave: string; trovati: CodiciTrovati | null; indice: number }
}
