// I numeri della Scheda del titolo che i conti dei titoli (titoli.ts) non hanno già:
// il grafico mese per mese con la linea del pagato, le righe delle operazioni e dei dividendi
// con il loro "Da dove viene", la vendita parziale spiegata in parole
// e i paragrafi di "Da dove vengono i numeri". Modulo puro: niente React, niente file.
import type { CambioFineMese, Dividendo, FileDati, Operazione } from '../dati/tipi.ts'
import {
  cambio as cambioTesto,
  data,
  euro as euroTesto,
  guadagnoEuro,
  mese,
  numero,
  percentuale as pct,
  prezzo as prezzoTesto,
  quote as quoteTesto,
} from '../formato.ts'
import { fonteInParole, NOME_FILE_EXCEL } from './fonti.ts'
import { cambio, euro, prezzo, prezzoEsatto, quote, riga, type Numero, type RigaConto } from './spiegazione.ts'
import { plusMinus, type ContoTitolo, type MeseDelTitolo, type VenditaSpiegata } from './titoli.ts'

const QUASI_ZERO = 1e-9
const somma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

function nomeValuta(v: string): string {
  return ({ GBP: 'sterline', USD: 'dollari', CHF: 'franchi svizzeri', EUR: 'euro' } as Record<string, string>)[v] ?? v
}

/** Da dove viene un movimento: il PDF della banca o il file Excel del carico iniziale. */
export function fonteMovimento(fonte: string): string {
  const f = fonte.trim()
  if (/^file\b/i.test(f)) return 'file Excel iniziale'
  if (/\.pdf$/i.test(f)) {
    // Un ordine eseguito in due pezzi ha due PDF, "a" e "b", uniti da " + ".
    const quanti = f.split(' + ').length
    return quanti > 1 ? `${quanti} PDF della banca` : 'PDF della banca'
  }
  if (f === 'a mano') return 'inserito manualmente'
  return f || '—'
}

// ---------- il grafico ----------

export type PuntoGrafico = {
  mese: string
  valore: number
  /** Quanto sono costate le quote che avevi a quel fine mese (al costo medio, commissioni comprese). */
  pagato: number
  /** Il valore con il suo "Da dove viene", per il clic sul grafico. */
  numero: Numero
}

/**
 * Il costo delle quote che avevi a un certo giorno: la somma degli acquisti, meno le quote vendute
 * al costo medio. Senza vendite è semplicemente quello che hai pagato.
 */
function costoQuoteAl(ops: Operazione[], giorno: string): number {
  let q = 0
  let costo = 0
  for (const o of ops) {
    if (o.data > giorno) break
    if (o.tipo === 'acquisto') {
      q += o.quantita
      costo += o.totale
    } else {
      const cm = q > QUASI_ZERO ? costo / q : 0
      q -= o.quantita
      costo -= cm * o.quantita
      if (q < QUASI_ZERO) {
        q = 0
        costo = 0
      }
    }
  }
  return costo
}

function ordinaOperazioni(ops: Operazione[]): Operazione[] {
  return ops.slice().sort((a, b) => (a.data === b.data ? (a.tipo === b.tipo ? 0 : a.tipo === 'acquisto' ? -1 : 1) : a.data < b.data ? -1 : 1))
}

// ---------- le righe delle schede ----------

export type RigaMese = {
  mese: MeseDelTitolo
  /** Il prezzo nella valuta del titolo, con il conto del valore. */
  prezzo: Numero
  /** Il cambio BCE, solo per i titoli in valuta. */
  cambio: Numero | null
  fonte: string
  /** true se viene dalla borsa ufficiale (puntino verde). */
  borsa: boolean
  /** Se il prezzo di quel fine mese manca, la data dell'ultimo prezzo usato al suo posto. */
  prezzoDel: string | null
  /** Prezzo scritto a mano: chip "a mano" e, se ha sostituito un altro prezzo, quello di prima barrato. */
  aMano: boolean
  prima: number | null
  /** Perché la fonte non è la borsa ufficiale ("Borsa Italiana non ha risposto"). */
  perche: string | null
}

export type CosaOperazione = 'Acquisto' | 'Vendita' | 'Vendita parziale' | 'Rimborso'

export type RigaOperazione = {
  operazione: Operazione
  cosa: CosaOperazione
  /** Pagato (acquisto) o incassato (vendita), in euro, con il conto. */
  soldi: Numero
  /** Solo per le vendite: costo medio e guadagno incassato. */
  vendita: VenditaSpiegata | null
  fonte: string
}

export type RigaDividendo = { dividendo: Dividendo; netto: Numero; fonte: string }

/** Un pezzo di frase: testo normale o in grassetto, eventualmente del colore del segno. */
export type Pezzo = string | { b: string; segno?: number }
export type Paragrafo = { nome: string; pezzi: Pezzo[] }

export type SchedaDelTitolo = {
  punti: PuntoGrafico[]
  /** true se il titolo ha avuto vendite: la linea del pagato è il costo delle quote rimaste. */
  conVendite: boolean
  /** Dal fine mese più recente. */
  mesi: RigaMese[]
  /** Dalla più recente. */
  operazioni: RigaOperazione[]
  /** Dal più recente. */
  dividendi: RigaDividendo[]
  paragrafi: Paragrafo[]
}

export function spiegaOperazione(nome: string, o: Operazione, v: VenditaSpiegata | null, cosa: CosaOperazione): Numero {
  const inValuta = o.valuta !== 'EUR'
  const lordoValuta = o.quantita * o.prezzo
  const lordoEuro = inValuta ? (o.cambio ? lordoValuta / o.cambio : lordoValuta) : lordoValuta
  const conto: RigaConto[] = [riga('Quote', quote(o.quantita)), riga('× prezzo', prezzoEsatto(o.prezzo, o.valuta))]
  if (inValuta) {
    conto.push(riga(`= in ${nomeValuta(o.valuta)}`, prezzo(lordoValuta, o.valuta)))
    conto.push(riga('÷ cambio del giorno', cambio(o.cambio)))
  }
  const acquisto = o.tipo === 'acquisto'
  conto.push(riga('= controvalore', euro(lordoEuro)))
  if (o.commissioni > 0) conto.push(riga(acquisto ? '+ commissioni' : '− commissioni', euro(o.commissioni)))
  const atteso = acquisto ? lordoEuro + o.commissioni : lordoEuro - o.commissioni
  const resto = o.totale - atteso
  if (Math.abs(resto) >= 0.01) conto.push(riga(resto > 0 ? '+ altre voci (nelle note)' : '− altre voci (nelle note)', euro(Math.abs(resto))))
  conto.push(riga(acquisto ? "Costo d'acquisto" : 'Ricavo della vendita', euro(o.totale)))
  const note: string[] = []
  if (o.nota) note.push(o.nota)
  else if (Math.abs(resto) >= 0.01) note.push('La differenza risulta dal documento della banca (per esempio rateo o ritenute).')
  note.push(`Fonte: ${fonteMovimento(o.fonte)}.`)
  if (v) {
    const g = v.guadagnoIncassato.n ?? 0
    note.push(
      `${plusMinus(g)} realizzata: ${guadagnoEuro(g, 2)} (ricavo ${euroTesto(o.totale, 2)} − prezzo medio di carico ${prezzoTesto(v.costoMedio, 'EUR')} × ${quoteTesto(o.quantita)} quote).`,
    )
  }
  return {
    n: o.totale,
    perche: {
      titolo: `${cosa} di ${nome} del ${data(o.data)}`,
      grande: euro(o.totale),
      frase: acquisto ? 'Importo addebitato per questo acquisto, commissioni comprese.' : 'Importo accreditato per questa vendita, commissioni già dedotte.',
      conto,
      note,
      movimento: o.id,
    },
  }
}

function spiegaDividendo(nome: string, d: Dividendo): Numero {
  return {
    n: d.netto,
    perche: {
      titolo: `${d.nota && /cedola/i.test(d.nota) ? 'Cedola' : 'Dividendo'} di ${nome} del ${data(d.data)}`,
      grande: euro(d.netto),
      frase: 'Importo accreditato: lordo meno imposte.',
      conto: [riga('Lordo', euro(d.lordo)), riga('− imposte', euro(d.imposte)), riga('Netto', euro(d.netto))],
      note: [...(d.nota ? [d.nota] : []), `Fonte: ${fonteMovimento(d.fonte)}.`, 'Il netto entra nella plusvalenza del titolo.'],
      movimento: d.id,
    },
  }
}

function rigaMese(nome: string, m: MeseDelTitolo, cambi: CambioFineMese[]): RigaMese | null {
  const p = m.prezzo
  if (!p) return null
  const f = fonteInParole(p.fonte === 'stima' && p.nota ? p.nota : p.fonte)
  const aMano = p.fonte === 'a mano'
  // La nota dice perché la fonte non è la prima scelta; per i mesi del file Excel dice solo da quale foglio venivano.
  const notaDaMostrare = f.nome !== NOME_FILE_EXCEL && p.fonte !== 'stima'
  const notePrezzo: string[] = []
  // Il prezzo di quel fine mese si corregge nel pannello, che mostra già "a mano", la data e il prezzo di prima
  // (ticket 8): la nota in parole serve solo per un prezzo a mano preso da un mese prima.
  const aManoDaPrima = aMano && p.data !== m.mese
  if (aManoDaPrima && p.prima)
    notePrezzo.push(
      `Inserito manualmente${p.quando ? ` il ${data(p.quando)}` : ''}; valore precedente ${prezzoTesto(p.prima.prezzo, p.valuta)} (${fonteInParole(p.prima.fonte).nome}).`,
    )
  else if (aManoDaPrima) notePrezzo.push(`Inserito manualmente${p.quando ? ` il ${data(p.quando)}` : ''}.`)
  if (p.nota && notaDaMostrare) notePrezzo.push(p.nota)
  const prezzoN: Numero = {
    n: p.prezzo,
    perche: {
      ...m.valore.perche,
      titolo: `Prezzo di ${nome} a fine ${mese(m.mese)}`,
      grande: prezzo(p.prezzo, p.valuta),
      frase: `Prezzo di chiusura dell’ultimo giorno di borsa del mese${p.seduta && p.seduta !== p.data ? ` (${data(p.seduta)})` : ''}. Moltiplicato per le quote in portafoglio dà il controvalore:`,
      note: [...notePrezzo, ...m.valore.perche.note],
    },
  }
  // Dalla versione 3 i cambi stanno a parte, con la loro fonte (BCE, file Excel o a mano).
  const c = p.valuta !== 'EUR' ? cambi.find((x) => x.valuta === p.valuta && x.data === p.data) : undefined
  const fonteCambio = c ? (c.fonte === 'BCE' ? 'BCE' : c.fonte) : f.nome
  const cambioN: Numero | null =
    p.valuta !== 'EUR' && p.cambio
      ? {
          n: p.cambio,
          perche: {
            titolo: `Cambio a fine ${mese(m.mese)}`,
            grande: cambio(p.cambio),
            frase: `Cambio di fine mese: ${nomeValuta(p.valuta)} per 1 euro. Il prezzo in ${nomeValuta(p.valuta)} diviso per il cambio dà il prezzo in euro:`,
            conto: [
              riga('Prezzo', prezzo(p.prezzo, p.valuta)),
              riga('÷ cambio', cambio(p.cambio)),
              riga('Prezzo in euro', euro(p.prezzo / p.cambio, 4)),
            ],
            note: [
              c ? `Fonte del cambio: ${fonteCambio}.` : `Il cambio viene con il prezzo: ${f.nome}.`,
              ...(c?.prima ? [`Valore precedente: ${cambioTesto(c.prima.cambio)} (${c.prima.fonte}).`] : []),
            ],
          },
        }
      : null
  return {
    mese: m,
    prezzo: prezzoN,
    cambio: cambioN,
    fonte: f.nome,
    borsa: f.borsa,
    aMano,
    prima: aMano && p.prima ? p.prima.prezzo : null,
    perche: p.nota && notaDaMostrare && !aMano ? p.nota : null,
    prezzoDel: p.data < m.mese ? p.data : null,
  }
}

// ---------- la vendita parziale in parole ----------

/** La vendita spiegata in frasi, come nella bozza approvata. */
export function venditaInParole(v: VenditaSpiegata): Pezzo[] {
  const o = v.operazione
  const rimaste = v.quotePrima - o.quantita
  const g = v.guadagnoIncassato.n ?? 0
  const pezzi: Pezzo[] = [
    'Il ',
    { b: data(o.data) },
    ' sono state vendute ',
    { b: `${quoteTesto(o.quantita)} quote su ${quoteTesto(v.quotePrima)}` },
    ` a ${prezzoTesto(o.prezzo, o.valuta)}${o.valuta !== 'EUR' ? ` (cambio ${cambioTesto(o.cambio)})` : ''}`,
    ', per un ricavo di ',
    { b: euroTesto(o.totale, 2) },
    o.commissioni > 0 ? ` (commissione di ${euroTesto(o.commissioni, 2)} già dedotta). ` : '. ',
    `Al prezzo medio di carico di ${prezzoTesto(v.costoMedio, 'EUR')}, quelle ${quoteTesto(o.quantita)} quote erano costate ${euroTesto(v.costoQuote, 2)}. `,
    { b: `${plusMinus(g)} realizzata: ${guadagnoEuro(g, 2)}`, segno: g },
    ` (${numero(o.totale, 2)} − ${numero(v.costoQuote, 2)}), al lordo delle imposte. `,
  ]
  if (rimaste > QUASI_ZERO)
    pezzi.push(
      `Le ${quoteTesto(rimaste)} quote rimaste mantengono il prezzo medio di carico di ${prezzoTesto(v.costoMedio, 'EUR')}; il ricavo resta nel calcolo della plusvalenza del titolo.`,
    )
  else pezzi.push('Vendute tutte le quote: il titolo è tra i Venduti.')
  return pezzi
}

// ---------- "Da dove vengono i numeri" ----------

function paragrafi(c: ContoTitolo, ops: Operazione[], divs: Dividendo[]): Paragrafo[] {
  const out: Paragrafo[] = []
  const acquisti = ops.filter((o) => o.tipo === 'acquisto')
  const vendite = ops.filter((o) => o.tipo === 'vendita')
  const p = c.ultimoPrezzo
  const g = c.guadagno.n

  if (c.stato === 'aperto' && p && c.valore.n !== null) {
    const inValuta = p.valuta !== 'EUR'
    out.push({
      nome: 'Controvalore',
      pezzi: [
        `${quoteTesto(c.quote)} quote × ${prezzoTesto(p.prezzo, p.valuta)}`,
        inValuta
          ? ` = ${prezzoTesto(c.quote * p.prezzo, p.valuta)}, diviso il cambio BCE del ${data(p.data)} (${cambioTesto(p.cambio ?? 0)} ${p.valuta} per 1 €)`
          : '',
        ' = ',
        { b: euroTesto(c.valore.n, 2) },
        '.',
      ],
    })
    const f = fonteInParole(p.fonte)
    out.push({
      nome: 'Prezzo',
      pezzi: [
        `Prezzo di chiusura dell’ultimo giorno di borsa di ${mese(p.data)}, ${f.nome === NOME_FILE_EXCEL ? 'dal file Excel iniziale' : p.fonte === 'a mano' ? 'inserito manualmente' : `da ${f.nome}`}. `,
        f.borsa
          ? 'È la borsa di quotazione del titolo.'
          : f.nome === NOME_FILE_EXCEL
            ? `Dal prossimo aggiornamento di fine mese verrà da ${c.titolo.nomeBorsa}, la borsa di quotazione.`
            : `La borsa di quotazione è ${c.titolo.nomeBorsa}: questo mese il prezzo viene da un’altra fonte.`,
        inValuta ? ` Il prezzo è in ${nomeValuta(p.valuta)}: tutti i calcoli sono in euro, al cambio BCE di fine mese.` : '',
      ],
    })
  } else if (c.stato === 'nuovo') {
    out.push({
      nome: 'Controvalore',
      pezzi: ['Acquistato dopo l’ultimo fine mese con i prezzi: controvalore e plusvalenza saranno disponibili con il prossimo aggiornamento di fine mese.'],
    })
  }

  const commissioni = somma(acquisti.map((o) => o.commissioni))
  out.push({
    nome: "Costo d'acquisto",
    pezzi: [
      { b: euroTesto(c.pagato.n ?? 0, 2) },
      acquisti.length > 1 ? `: la somma dei ${acquisti.length} acquisti` : ' per l’acquisto',
      commissioni > 0 ? `, commissioni comprese (in tutto ${euroTesto(commissioni, 2)}).` : ', commissioni comprese.',
    ],
  })
  if (c.stato === 'aperto' && c.costoMedio.n !== null)
    out.push({
      nome: 'Prezzo medio di carico',
      pezzi: [
        { b: prezzoTesto(c.costoMedio.n, 'EUR') },
        ` per quota: il costo medio di ciascuna delle ${quoteTesto(c.quote)} quote in portafoglio, commissioni comprese.`,
        vendite.length ? ' Con una vendita parziale le quote rimaste mantengono il prezzo medio di carico.' : '',
      ],
    })
  if (vendite.length)
    out.push({
      nome: 'Ricavo delle vendite',
      pezzi: [
        { b: euroTesto(c.incassato.n ?? 0, 2) },
        vendite.length > 1 ? ` da ${vendite.length} vendite` : ' dalla vendita',
        ', commissioni già dedotte. La plusvalenza realizzata di ogni vendita è nella scheda Operazioni.',
      ],
    })
  out.push({
    nome: 'Dividendi',
    pezzi: divs.length
      ? [
          { b: euroTesto(c.dividendiTutti.n ?? 0, 2) },
          ` netti in ${divs.length} ${divs.length === 1 ? 'pagamento' : 'pagamenti'}: importo accreditato, cioè lordo meno imposte. Entrano nella plusvalenza.`,
        ]
      : [`${c.nomeCorto} non ha pagato dividendi: se è ad accumulazione, li reinveste nel prezzo.`],
  })
  if (g !== null) {
    const parti = [
      c.stato === 'aperto' ? 'controvalore' : null,
      vendite.length ? 'ricavo delle vendite' : null,
      divs.length ? 'dividendi netti' : null,
    ].filter(Boolean)
    out.push({
      nome: plusMinus(g),
      pezzi: [
        `${parti.join(' + ').replace(/^./, (x) => x.toUpperCase())} − costo d’acquisto = `,
        { b: guadagnoEuro(g, 2), segno: g },
        c.dallAcquisto.n !== null ? `, cioè ${pct(c.dallAcquisto.n)} sul costo. ` : '. ',
        'Al lordo delle imposte sulla vendita.',
      ],
    })
  }
  out.push({
    nome: 'Rendimento annualizzato',
    pezzi:
      c.medioAnnuo.n !== null
        ? [
            { b: `${pct(c.medioAnnuo.n)} all’anno` },
            `: il tasso annuo composto che, ripetuto per ${numero(c.anni ?? 0, 1)} anni, dà il risultato ottenuto, tenendo conto di quando sono entrati e usciti i capitali (dividendi compresi).`,
          ]
        : [c.medioAnnuo.perche.frase ?? '—'],
  })
  return out
}

// ---------- tutto insieme ----------

export function schedaDelTitolo(dati: FileDati, c: ContoTitolo): SchedaDelTitolo {
  const nome = c.nomeCorto
  const ops = ordinaOperazioni((dati.operazioni ?? []).filter((o) => o.titolo === c.id))
  const divs = (dati.dividendi ?? []).filter((d) => d.titolo === c.id).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))

  const punti: PuntoGrafico[] = c.mesi
    .filter((m) => m.valore.n !== null)
    .map((m) => ({ mese: m.mese, valore: m.valore.n!, pagato: costoQuoteAl(ops, m.mese), numero: m.valore }))

  const mesi = c.mesi
    .map((m) => rigaMese(nome, m, dati.cambi ?? []))
    .filter((r): r is RigaMese => r !== null)
    .reverse()

  // Le vendite spiegate dai conti, per id; l'ultima vendita che chiude tutto non è "parziale".
  const perId = new Map(c.vendite.map((v) => [v.operazione.id, v]))
  const operazioni: RigaOperazione[] = ops
    .map((o) => {
      const v = perId.get(o.id) ?? null
      const cosa: CosaOperazione =
        o.tipo === 'acquisto'
          ? 'Acquisto'
          : /rimborso/i.test(`${o.nota ?? ''} ${o.fonte}`)
            ? 'Rimborso'
            : v?.parziale
              ? 'Vendita parziale'
              : 'Vendita'
      return { operazione: o, cosa, soldi: spiegaOperazione(nome, o, v, cosa), vendita: v, fonte: fonteMovimento(o.fonte) }
    })
    .reverse()

  const dividendi = divs.map((d) => ({ dividendo: d, netto: spiegaDividendo(nome, d), fonte: fonteMovimento(d.fonte) })).reverse()

  return {
    punti,
    conVendite: ops.some((o) => o.tipo === 'vendita'),
    mesi,
    operazioni,
    dividendi,
    paragrafi: paragrafi(c, ops, divs),
  }
}
