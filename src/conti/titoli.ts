// I conti dei titoli, con le regole di "Come si calcolano i rendimenti" (mappa, ticket 3):
// - costo medio: commissioni comprese; con una vendita le quote rimaste tengono il costo medio;
// - guadagno = valore a fine mese + dividendi netti + incassato vendendo − pagato (prima delle tasse);
// - % dall'acquisto = guadagno ÷ pagato;
// - medio annuo: composto, attento a quando è entrato e uscito ogni euro (XIRR);
// - il mese: Modified Dietz, i soldi messi o tolti nel mese non sono guadagno;
// - vendita: guadagno incassato = incassato − costo medio × quote vendute (commissione già tolta);
// - titoli in valuta: tutto in euro al cambio BCE di fine mese (prezzo ÷ cambio).
// Tutto si conta all'ultimo fine mese con i prezzi: il valore cambia una volta al mese.
// Ogni numero esce con il suo "Da dove viene". Modulo puro: niente React, niente file.
import type { Dividendo, FileDati, Operazione, PrezzoFineMese, Titolo } from '../dati/tipi.ts'
import {
  data,
  guadagnoEuro,
  mese,
  nomeMese,
  numero,
  percentuale as pct,
  prezzo as prezzoTesto,
  quote as quoteTesto,
  cambio as cambioTesto,
  euro as euroTesto,
  segno,
} from '../formato.ts'
import { controlloInParole } from '../dati/aggiorna/controllo-prezzo.ts'
import { eUfficiale, FONTE } from '../dati/aggiorna/fonti.ts'
import { fonteInParole } from './fonti.ts'
import { cambio, euro, guadagno, percentuale, prezzo, prezzoEsatto, quote, riga, testo, type Numero, type RigaConto, type Spiegazione } from './spiegazione.ts'
import { anniTra, xirr, type Flusso } from './xirr.ts'

/** Sotto questo tempo il medio annuo non si mostra: su pochi mesi direbbe poco. */
export const ANNI_MINIMI_MEDIO = 0.5
const QUASI_ZERO = 1e-9

export type MeseDelTitolo = {
  /** Il fine mese, AAAA-MM-GG. */
  mese: string
  quote: number
  /** Il prezzo usato: quello di quel fine mese o, se manca, l'ultimo prima. */
  prezzo: PrezzoFineMese | null
  valore: Numero
  sulMese: Numero
  dallAcquisto: Numero
}

export type VenditaSpiegata = {
  operazione: Operazione
  quotePrima: number
  costoMedio: number
  costoQuote: number
  parziale: boolean
  guadagnoIncassato: Numero
}

export type StatoTitolo =
  /** lo hai a fine mese */
  | 'aperto'
  /** venduto del tutto o rimborsato */
  | 'chiuso'
  /** comprato dopo l'ultimo fine mese: valore e guadagno arrivano con l'aggiornamento */
  | 'nuovo'

export type ContoTitolo = {
  id: string
  titolo: Titolo
  /** Il simbolo (es. "MOND"); se il titolo non ne ha uno, il nome. */
  nomeCorto: string
  /** Cosa è il titolo in parole semplici, dal file dei dati; null se non c'è. */
  paroleSemplici: string | null
  valuta: string
  stato: StatoTitolo
  /** Le quote a fine mese. */
  quote: number
  primoAcquisto: string | null
  ultimaVendita: string | null
  /** Anni dal primo acquisto all'ultimo fine mese. */
  anni: number | null
  pagato: Numero
  costoMedio: Numero
  incassato: Numero
  dividendi: Numero
  valore: Numero
  /** Il valore nella valuta del titolo (solo se non è l'euro). */
  valoreInValuta: number | null
  prezzo: Numero
  ultimoPrezzo: PrezzoFineMese | null
  guadagno: Numero
  dallAcquisto: Numero
  medioAnnuo: Numero
  ultimoMese: Numero
  mesi: MeseDelTitolo[]
  vendite: VenditaSpiegata[]
  /** I dividendi netti per anno e in tutto: tutti quelli nel file, anche dopo l'ultimo fine mese. */
  dividendiPerAnno: Map<string, Numero>
  dividendiTutti: Numero
}

export type ContiTitoli = {
  /** L'ultimo fine mese con i prezzi, o null se nel file non ce n'è nessuno. */
  fine: string | null
  /** Tutti i fine mese con almeno un prezzo, dal più vecchio. */
  mesi: string[]
  titoli: ContoTitolo[]
  /** I titoli che hai a fine mese, sommati. */
  aperti: { quanti: number; valore: Numero; pagato: Numero; guadagno: Numero; dallAcquisto: Numero }
  /** Il guadagno di tutto il portafoglio, compresi i titoli venduti. */
  guadagnoTotale: number
  /** L'ultimo mese di tutto il portafoglio, senza i soldi nuovi. */
  ultimoMese: Numero
  /** Per ogni fine mese: il valore di tutti i titoli e il mese senza i soldi nuovi. */
  totaliDelMese: Map<string, { valore: Numero; sulMese: Numero }>
  /** I dividendi netti per anno e in tutto (tutti quelli nel file). */
  dividendi: { anni: string[]; perAnno: Map<string, Numero>; totale: Numero }
}

// ---------- piccoli aiuti ----------

const somma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const fineDi = (m: string) => `fine ${mese(m)}`

/** "Plusvalenza" o "Minusvalenza", secondo il segno con cui il numero è scritto (due decimali). */
export const plusMinus = (n: number): 'Plusvalenza' | 'Minusvalenza' => (segno(n, 2) < 0 ? 'Minusvalenza' : 'Plusvalenza')

function ordinaOperazioni(ops: Operazione[]): Operazione[] {
  // A parità di data, prima gli acquisti: così una vendita lo stesso giorno trova le quote.
  return ops.slice().sort((a, b) => (a.data === b.data ? (a.tipo === b.tipo ? 0 : a.tipo === 'acquisto' ? -1 : 1) : a.data < b.data ? -1 : 1))
}

/** Il prezzo in euro: prezzo ÷ cambio per i titoli in valuta. null se manca il cambio. */
function inEuro(p: PrezzoFineMese): number | null {
  if (p.valuta === 'EUR') return p.prezzo
  return p.cambio ? p.prezzo / p.cambio : null
}

function nomeValuta(v: string): string {
  return ({ GBP: 'sterline', USD: 'dollari', CHF: 'franchi svizzeri', EUR: 'euro' } as Record<string, string>)[v] ?? v
}

const manca = (titolo: string, perche: string): Numero => ({
  n: null,
  perche: { titolo, grande: testo('—'), frase: perche, conto: [], note: [] },
})

// ---------- i dati di un titolo, indicizzati ----------

type Indice = {
  ops: Operazione[]
  divs: Dividendo[]
  prezzi: PrezzoFineMese[] // dal più vecchio
}

function quoteAl(ix: Indice, giorno: string): number {
  let q = 0
  for (const o of ix.ops) if (o.data <= giorno) q += o.tipo === 'acquisto' ? o.quantita : -o.quantita
  return Math.abs(q) < QUASI_ZERO ? 0 : q
}

function prezzoAl(ix: Indice, giorno: string): PrezzoFineMese | null {
  let p: PrezzoFineMese | null = null
  for (const x of ix.prezzi) if (x.data <= giorno) p = x
  return p
}

type ValoreAl = { valore: number | null; quote: number; prezzo: PrezzoFineMese | null }

function valoreAl(ix: Indice, giorno: string): ValoreAl {
  const q = quoteAl(ix, giorno)
  if (q === 0) return { valore: 0, quote: 0, prezzo: null }
  const p = prezzoAl(ix, giorno)
  const e = p ? inEuro(p) : null
  return { valore: e === null ? null : q * e, quote: q, prezzo: p }
}

// ---------- le spiegazioni che si ripetono ----------

/** Le fonti di riserva: sotto il prezzo si dice perché (la nota). */
const DA_RISERVA: string[] = [FONTE.investing, FONTE.yahoo, FONTE.xetraAltraBorsa]

function spiegaValore(nome: string, giorno: string, v: ValoreAl, borsa: string): Spiegazione {
  const p = v.prezzo
  const conto: RigaConto[] = []
  const note: string[] = []
  if (p && v.valore !== null) {
    conto.push(riga('Quote', quote(v.quote)))
    conto.push(riga(`× prezzo del ${data(p.data)}`, prezzoEsatto(p.prezzo, p.valuta)))
    if (p.valuta !== 'EUR' && p.cambio) {
      conto.push(riga(`= in ${nomeValuta(p.valuta)}`, prezzo(v.quote * p.prezzo, p.valuta)))
      conto.push(riga('÷ cambio BCE', cambio(p.cambio)))
    }
    conto.push(riga('Controvalore in euro', euro(v.valore)))
    // Dalla versione 3 la fonte è un nome fisso e il testo del file Excel (es. il perché di una stima) sta in "nota".
    const f = fonteInParole(p.fonte === 'stima' && p.nota ? p.nota : p.fonte)
    note.push(`Prezzo di fine mese: ${f.nome}${f.dettaglio ? ` (${f.dettaglio})` : ''}. Borsa di quotazione: ${borsa}.`)
    // Ticket 7: perché il prezzo viene da una riserva, e il controllo di investing.com.
    if (p.nota && (eUfficiale(p.fonte) || DA_RISERVA.includes(p.fonte))) note.push(p.nota[0].toUpperCase() + p.nota.slice(1) + '.')
    const controllo = controlloInParole(p.prezzo, p.valuta, p.controllo)
    if (controllo) note.push(controllo)
    if (p.valuta !== 'EUR') note.push(`Cambio BCE di fine mese: ${nomeValuta(p.valuta)} per 1 euro.`)
    if (p.data < giorno) note.push(`Manca il prezzo di ${fineDi(giorno)}: si usa l'ultimo disponibile, del ${data(p.data)}.`)
  }
  return {
    titolo: `Controvalore di ${nome} a ${fineDi(giorno)}`,
    grande: v.valore === null ? testo('—') : euro(v.valore),
    frase: v.valore === null ? (p ? `Manca il cambio BCE per ${p.valuta}.` : 'Manca il prezzo di fine mese di questo titolo.') : undefined,
    conto,
    note,
    // Il prezzo di quel fine mese si può correggere a mano; uno preso da un mese prima no.
    ...(p && p.data === giorno ? { correggi: { titolo: p.titolo, data: p.data } } : {}),
  }
}

export type Periodo = {
  v0: number
  v1: number
  /** Soldi messi (+) e tolti (−) nel periodo, con la data. */
  flussi: { data: string; importo: number }[]
  dividendi: number
}

/**
 * Il guadagno del periodo senza contare i soldi nuovi (Modified Dietz):
 * (valore finale − valore iniziale − soldi messi + soldi tolti + dividendi) ÷ (valore iniziale + soldi messi pesati per i giorni).
 */
export function senzaSoldiNuovi(inizio: string, fine: string, p: Periodo): { r: number | null; guadagno: number; base: number; netti: number } {
  const giorni = anniTra(inizio, fine)
  const netti = somma(p.flussi.map((f) => f.importo))
  const pesati = somma(p.flussi.map((f) => f.importo * (giorni > 0 ? anniTra(f.data, fine) / giorni : 0)))
  const g = p.v1 - p.v0 - netti + p.dividendi
  const base = p.v0 + pesati
  return { r: base > QUASI_ZERO ? g / base : null, guadagno: g, base, netti }
}

function spiegaMese(titolo: string, chi: string, inizio: string, fine: string, p: Periodo, extra: string[]): Numero {
  const { r, guadagno: g, base, netti } = senzaSoldiNuovi(inizio, fine, p)
  const conto: RigaConto[] = [riga(`Controvalore a ${fineDi(fine)}`, euro(p.v1)), riga(`− controvalore a ${fineDi(inizio)}`, euro(p.v0))]
  if (netti > QUASI_ZERO) conto.push(riga('− versamenti netti del mese (acquisti)', euro(netti)))
  if (netti < -QUASI_ZERO) conto.push(riga('+ prelievi netti del mese (vendite)', euro(-netti)))
  if (p.dividendi > 0) conto.push(riga('+ dividendi netti del mese', euro(p.dividendi)))
  conto.push(riga('= risultato del mese', guadagno(g)))
  conto.push(riga(Math.abs(netti) > QUASI_ZERO ? '÷ controvalore iniziale, con i movimenti del mese ponderati per i giorni' : `÷ controvalore a ${fineDi(inizio)}`, euro(base)))
  if (r !== null) conto.push(riga(`Rendimento di ${nomeMese(fine)}`, percentuale(r)))
  return {
    n: r,
    perche: {
      titolo,
      grande: r === null ? testo('—') : percentuale(r),
      frase: `Rendimento ${chi} da ${fineDi(inizio)} a ${fineDi(fine)}, al netto dei versamenti e dei prelievi del mese.`,
      conto,
      note: extra,
    },
  }
}

// ---------- i conti di un titolo ----------

function contaTitolo(t: Titolo, ix: Indice, mesi: string[], fine: string | null): ContoTitolo {
  const nome = t.simbolo ?? t.nome
  const parole = t.paroleSemplici?.trim() ? t.paroleSemplici.trim() : null
  const fino = fine ?? '9999-12-31'
  const ops = ix.ops.filter((o) => o.data <= fino)
  const divs = ix.divs.filter((d) => d.data <= fino)
  const acquisti = ops.filter((o) => o.tipo === 'acquisto')
  const venditeOps = ops.filter((o) => o.tipo === 'vendita')
  const valuta = ix.prezzi.at(-1)?.valuta ?? ix.ops[0]?.valuta ?? 'EUR'
  const quoteTotali = quoteAl(ix, '9999-12-31')
  const stato: StatoTitolo =
    fine === null || acquisti.length === 0 ? (quoteTotali > 0 ? 'nuovo' : 'chiuso') : quoteAl(ix, fine) > 0 ? 'aperto' : quoteTotali > 0 ? 'nuovo' : 'chiuso'
  const primoAcquisto = (acquisti[0] ?? ix.ops.find((o) => o.tipo === 'acquisto'))?.data ?? null
  const ultimaVendita = venditeOps.at(-1)?.data ?? null

  // Pagato, costo medio e vendite, nell'ordine delle operazioni.
  let quoteOra = 0
  let costoQuoteOra = 0
  const vendite: VenditaSpiegata[] = []
  const contoCosto: RigaConto[] = []
  for (const o of ops) {
    if (o.tipo === 'acquisto') {
      quoteOra += o.quantita
      costoQuoteOra += o.totale
      contoCosto.push(riga(`Acquisto del ${data(o.data)}: ${quoteTesto(o.quantita)} quote`, euro(o.totale)))
      continue
    }
    const cm = quoteOra > QUASI_ZERO ? costoQuoteOra / quoteOra : 0
    const costoQuote = cm * o.quantita
    const parziale = quoteOra - o.quantita > QUASI_ZERO
    const g = o.totale - costoQuote
    const prezzoVendita = prezzoTesto(o.prezzo, o.valuta)
    vendite.push({
      operazione: o,
      quotePrima: quoteOra,
      costoMedio: cm,
      costoQuote,
      parziale,
      guadagnoIncassato: {
        n: g,
        perche: {
          titolo: `Vendita di ${nome} del ${data(o.data)}`,
          grande: guadagno(g),
          frase: `Il ${data(o.data)} sono state vendute ${quoteTesto(o.quantita)} quote su ${quoteTesto(quoteOra)} a ${prezzoVendita}, per un ricavo di ${euroTesto(o.totale, 2)}${o.commissioni > 0 ? ` (commissione di ${euroTesto(o.commissioni, 2)} già dedotta)` : ''}.`,
          conto: [
            riga('Ricavo della vendita', euro(o.totale)),
            riga(`− prezzo medio di carico × quote vendute (${prezzoTesto(cm, 'EUR')} × ${quoteTesto(o.quantita)})`, euro(costoQuote)),
            riga(`${plusMinus(g)} realizzata`, guadagno(g)),
          ],
          note: [
            parziale
              ? `Le ${quoteTesto(quoteOra - o.quantita)} quote rimaste mantengono il prezzo medio di carico di ${prezzoTesto(cm, 'EUR')}.`
              : 'Vendute tutte le quote: il titolo è tra i Venduti.',
            'Importo al lordo delle imposte sulla vendita.',
          ],
        },
      },
    })
    contoCosto.push(riga(`Vendita del ${data(o.data)}: ${quoteTesto(o.quantita)} quote al prezzo medio di carico`, euro(-costoQuote)))
    quoteOra -= o.quantita
    costoQuoteOra -= costoQuote
    if (quoteOra < QUASI_ZERO) {
      quoteOra = 0
      costoQuoteOra = 0
    }
  }

  const pagatoN = somma(acquisti.map((o) => o.totale))
  const commissioni = somma(acquisti.map((o) => o.commissioni))
  const incassatoN = somma(venditeOps.map((o) => o.totale))
  const dividendiN = somma(divs.map((d) => d.netto))

  const pagato: Numero =
    stato === 'nuovo'
      ? {
          n: somma(ix.ops.filter((o) => o.tipo === 'acquisto').map((o) => o.totale)),
          perche: {
            titolo: `Costo d'acquisto di ${nome}`,
            grande: euro(somma(ix.ops.filter((o) => o.tipo === 'acquisto').map((o) => o.totale))),
            frase: `Acquistato dopo l'ultimo fine mese con i prezzi${fine ? ` (${data(fine)})` : ''}: controvalore e plusvalenza saranno disponibili con il prossimo aggiornamento di fine mese.`,
            conto: [],
            note: ['Commissioni comprese.'],
          },
        }
      : {
          n: pagatoN,
          perche: {
            titolo: `Costo d'acquisto di ${nome}`,
            grande: euro(pagatoN),
            frase:
              acquisti.length > 1
                ? `Costo dei ${acquisti.length} acquisti, commissioni comprese.`
                : "Costo d'acquisto, commissioni comprese.",
            conto: [
              ...acquisti.map((o) =>
                riga(`Acquisto del ${data(o.data)}: ${quoteTesto(o.quantita)} quote a ${prezzoTesto(o.prezzo, o.valuta)}`, euro(o.totale)),
              ),
              riga("Costo d'acquisto", euro(pagatoN)),
            ],
            note: [
              commissioni > 0 ? `Commissioni comprese (in tutto ${euroTesto(commissioni, 2)}).` : 'Nessuna commissione.',
              ...(stato === 'aperto' && quoteOra > 0
                ? [`Prezzo medio di carico: ${prezzoTesto(costoQuoteOra / quoteOra, 'EUR')} per quota (${euroTesto(costoQuoteOra, 2)} ÷ ${quoteTesto(quoteOra)} quote).`]
                : []),
              ...(venditeOps.length ? ["Le quote vendute restano nel costo d'acquisto; il ricavo delle vendite entra nel calcolo della plusvalenza."] : []),
            ],
          },
        }

  const costoMedio: Numero =
    stato === 'aperto' && quoteOra > 0
      ? {
          n: costoQuoteOra / quoteOra,
          perche: {
            titolo: `Prezzo medio di carico di ${nome}`,
            grande: prezzo(costoQuoteOra / quoteOra, 'EUR'),
            frase: 'Costo medio di una quota, commissioni comprese.',
            conto: [
              ...contoCosto,
              riga('Costo delle quote in portafoglio', euro(costoQuoteOra)),
              riga('÷ quote', quote(quoteOra)),
              riga('Prezzo medio di carico', prezzo(costoQuoteOra / quoteOra, 'EUR')),
            ],
            note: ['Con una vendita parziale le quote rimaste mantengono il prezzo medio di carico.'],
          },
        }
      : manca(`Prezzo medio di carico di ${nome}`, stato === 'chiuso' ? 'Il titolo non è più in portafoglio.' : 'Il titolo non è ancora nei conti di fine mese.')

  const incassato: Numero = {
    n: incassatoN,
    perche: {
      titolo: `Ricavo delle vendite di ${nome}`,
      grande: euro(incassatoN),
      frase: venditeOps.length ? 'Importo accreditato dalle vendite, commissioni già dedotte.' : 'Nessuna vendita di questo titolo.',
      conto: venditeOps.length
        ? [...venditeOps.map((o) => riga(`Vendita del ${data(o.data)}: ${quoteTesto(o.quantita)} quote`, euro(o.totale))), riga('Ricavo delle vendite', euro(incassatoN))]
        : [],
      note: [],
    },
  }

  const dividendi: Numero = {
    n: dividendiN,
    perche: spiegaDividendi(`Dividendi di ${nome}`, divs, nome),
  }

  // Valore e prezzo all'ultimo fine mese.
  const vFine: ValoreAl = fine && stato === 'aperto' ? valoreAl(ix, fine) : { valore: 0, quote: 0, prezzo: null }
  const ultimoPrezzo = fine ? prezzoAl(ix, fine) : null
  const valore: Numero =
    stato === 'nuovo'
      ? manca(
          `Controvalore di ${nome}`,
          `Acquistato dopo l'ultimo fine mese con i prezzi${fine ? ` (${data(fine)})` : ''}: il controvalore sarà disponibile con il prossimo aggiornamento di fine mese.`,
        )
      : stato === 'chiuso'
        ? {
            n: 0,
            perche: {
              titolo: `Controvalore di ${nome}`,
              grande: euro(0),
              frase: `Il titolo non è più in portafoglio${ultimaVendita ? `: ultima vendita il ${data(ultimaVendita)}` : ''}.`,
              conto: [],
              note: [],
            },
          }
        : { n: vFine.valore, perche: spiegaValore(nome, fine!, vFine, t.nomeBorsa) }
  const valoreInValuta = vFine.prezzo && vFine.prezzo.valuta !== 'EUR' ? vFine.quote * vFine.prezzo.prezzo : null

  const prezzoN: Numero = ultimoPrezzo
    ? {
        n: ultimoPrezzo.prezzo,
        perche: {
          ...spiegaValore(nome, fine!, { valore: vFine.valore, quote: vFine.quote, prezzo: ultimoPrezzo }, t.nomeBorsa),
          titolo: `Prezzo di ${nome} a ${fineDi(ultimoPrezzo.data)}`,
          grande: prezzo(ultimoPrezzo.prezzo, ultimoPrezzo.valuta),
          frase: stato === 'aperto' ? 'Prezzo di chiusura dell’ultimo giorno di borsa del mese. Moltiplicato per le quote dà il controvalore:' : undefined,
          conto: stato === 'aperto' ? spiegaValore(nome, fine!, vFine, t.nomeBorsa).conto : [],
        },
      }
    : manca(`Prezzo di ${nome}`, 'Nessun prezzo di fine mese disponibile per questo titolo.')

  // Plusvalenza, rendimento sul costo, rendimento annualizzato.
  const valoreN = valore.n
  const g = stato === 'nuovo' || valoreN === null ? null : valoreN + incassatoN + dividendiN - pagatoN
  const guadagnoN: Numero =
    g === null
      ? manca(
          `Plusvalenza di ${nome}`,
          stato === 'nuovo' ? 'Disponibile con il prossimo aggiornamento di fine mese.' : 'Manca il controvalore di fine mese.',
        )
      : {
          n: g,
          perche: {
            titolo: `${plusMinus(g)} di ${nome}`,
            grande: guadagno(g),
            frase:
              stato === 'chiuso'
                ? `Titolo venduto del tutto${ultimaVendita ? ` il ${data(ultimaVendita)}` : ''}: il risultato resta compreso in quello del portafoglio.`
                : "Controvalore, più dividendi netti e ricavo delle vendite, meno costo d'acquisto.",
            conto: [
              ...(stato === 'aperto' ? [riga(`Controvalore a ${fineDi(fine!)}`, euro(valoreN!))] : []),
              ...(incassatoN ? [riga('+ ricavo delle vendite', euro(incassatoN))] : []),
              ...(dividendiN ? [riga('+ dividendi netti', euro(dividendiN))] : []),
              riga("− costo d'acquisto", euro(pagatoN)),
              riga(plusMinus(g), guadagno(g)),
            ],
            note: ["Comprende i dividendi netti. Al lordo delle imposte sulla vendita; le commissioni sono nel costo d'acquisto."],
          },
        }
  const dallAcquisto: Numero =
    g === null || pagatoN <= 0
      ? manca(`Rendimento di ${nome}`, guadagnoN.perche.frase ?? '')
      : {
          n: g / pagatoN,
          perche: {
            titolo: `Rendimento di ${nome}`,
            grande: percentuale(g / pagatoN),
            dopo: 'sul costo',
            frase: `${plusMinus(g)} divisa per il costo d'acquisto.`,
            conto: [riga(plusMinus(g), guadagno(g)), riga("÷ costo d'acquisto", euro(pagatoN)), riga('Rendimento sul costo', percentuale(g / pagatoN))],
            note: [],
          },
        }

  const anni = fine && primoAcquisto && stato !== 'nuovo' ? anniTra(primoAcquisto, fine) : null
  let medioAnnuo: Numero
  const titoloMedio = `Rendimento annualizzato di ${nome}`
  if (stato === 'chiuso')
    medioAnnuo = manca(titoloMedio, 'Il rendimento annualizzato si calcola per i titoli in portafoglio; per i titoli venduti vale il risultato in euro.')
  else if (g === null || anni === null) medioAnnuo = manca(titoloMedio, guadagnoN.perche.frase ?? '')
  else if (anni < ANNI_MINIMI_MEDIO)
    medioAnnuo = manca(
      titoloMedio,
      `Titolo in portafoglio da meno di sei mesi (dal ${data(primoAcquisto!)}): su un periodo così breve il rendimento annualizzato non è significativo. Rendimento sul costo: ${pct(dallAcquisto.n ?? 0)}.`,
    )
  else {
    const flussi: (Flusso & { cosa: string })[] = [
      ...ops.map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? -o.totale : o.totale, cosa: o.tipo === 'acquisto' ? 'acquisto' : 'vendita' })),
      ...divs.map((d) => ({ data: d.data, importo: d.netto, cosa: 'dividendo' })),
      { data: fine!, importo: valoreN!, cosa: `controvalore a ${fineDi(fine!)}` },
    ].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    const r = xirr(flussi)
    medioAnnuo =
      r === null
        ? manca(titoloMedio, 'Con questi movimenti il tasso non è calcolabile.')
        : {
            n: r,
            perche: {
              titolo: titoloMedio,
              grande: percentuale(r),
              dopo: "all'anno",
              frase:
                'Il tasso annuo composto che, ripetuto ogni anno, dà il risultato ottenuto, tenendo conto di quando sono entrati e usciti i capitali (tasso interno di rendimento). Comprende i dividendi.',
              conto: [
                ...flussi.map((f) =>
                  riga(f.cosa.startsWith('controvalore') ? `${f.cosa.charAt(0).toUpperCase()}${f.cosa.slice(1)}` : `${data(f.data)}: ${f.cosa}`, euro(f.importo)),
                ),
                riga('Rendimento annualizzato', percentuale(r)),
              ],
              note: [
                `${pct(g / pagatoN)} sul costo in ${numero(anni, 1)} anni equivale a circa ${pct(r)} all'anno.`,
                'Gli acquisti sono negativi; vendite, dividendi e controvalore finale sono positivi. Ogni importo pesa per il tempo in cui è rimasto investito.',
              ],
            },
          }
  }

  // Mese per mese.
  const mesiT: MeseDelTitolo[] = []
  for (let i = 0; i < mesi.length; i++) {
    const m = mesi[i]
    if (stato === 'nuovo') break
    const v = valoreAl(ix, m)
    if (v.quote <= 0) continue
    const valoreM: Numero = { n: v.valore, perche: spiegaValore(nome, m, v, t.nomeBorsa) }
    const prima = i > 0 ? mesi[i - 1] : null
    let sulMese: Numero
    const titoloMese = `${nome}: rendimento di ${mese(m)}`
    if (!prima) sulMese = manca(titoloMese, 'Primo fine mese disponibile: manca il mese precedente per il confronto.')
    else {
      const v0 = valoreAl(ix, prima)
      if (v0.valore === 0 || v0.quote === 0)
        sulMese = manca(
          titoloMese,
          `Il titolo è entrato in portafoglio a ${mese(m)}: il rendimento del mese si calcola dal mese successivo. Nel frattempo vale il rendimento sul costo.`,
        )
      else if (v0.valore === null || v.valore === null) sulMese = manca(titoloMese, 'Manca un prezzo di fine mese.')
      else {
        const extra: string[] = []
        if (v0.prezzo && v.prezzo && v.prezzo.valuta !== 'EUR' && v0.prezzo.valuta === v.prezzo.valuta) {
          extra.push(
            `In ${nomeValuta(v.prezzo.valuta)} il prezzo è passato da ${prezzoTesto(v0.prezzo.prezzo, v0.prezzo.valuta)} a ${prezzoTesto(v.prezzo.prezzo, v.prezzo.valuta)} (${pct(v.prezzo.prezzo / v0.prezzo.prezzo - 1)}); in euro conta anche il cambio BCE, passato da ${cambioTesto(v0.prezzo.cambio ?? 0)} a ${cambioTesto(v.prezzo.cambio ?? 0)}.`,
          )
        }
        sulMese = spiegaMese(
          titoloMese,
          `di ${nome}`,
          prima,
          m,
          {
            v0: v0.valore,
            v1: v.valore,
            flussi: ix.ops.filter((o) => o.data > prima && o.data <= m).map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? o.totale : -o.totale })),
            dividendi: somma(ix.divs.filter((d) => d.data > prima && d.data <= m).map((d) => d.netto)),
          },
          extra,
        )
      }
    }
    const pagM = somma(ix.ops.filter((o) => o.tipo === 'acquisto' && o.data <= m).map((o) => o.totale))
    const incM = somma(ix.ops.filter((o) => o.tipo === 'vendita' && o.data <= m).map((o) => o.totale))
    const divM = somma(ix.divs.filter((d) => d.data <= m).map((d) => d.netto))
    const titoloAcq = `${nome}: rendimento sul costo a ${fineDi(m)}`
    const dallAcqM: Numero =
      v.valore === null || pagM <= 0
        ? manca(titoloAcq, 'Manca il controvalore di fine mese.')
        : (() => {
            const gm = v.valore + incM + divM - pagM
            return {
              n: gm / pagM,
              perche: {
                titolo: titoloAcq,
                grande: percentuale(gm / pagM),
                dopo: 'sul costo',
                frase: `Il risultato dal primo acquisto a ${fineDi(m)} diviso per il costo d'acquisto. Comprende i dividendi.`,
                conto: [
                  riga(`Controvalore a ${fineDi(m)}`, euro(v.valore)),
                  ...(incM ? [riga('+ ricavo delle vendite', euro(incM))] : []),
                  ...(divM ? [riga('+ dividendi netti fino a quella data', euro(divM))] : []),
                  riga("− costo d'acquisto", euro(pagM)),
                  riga(`= ${plusMinus(gm).toLowerCase()}`, guadagno(gm)),
                  riga("÷ costo d'acquisto", euro(pagM)),
                  riga('Rendimento sul costo', percentuale(gm / pagM)),
                ],
                note: [],
              },
            }
          })()
    mesiT.push({ mese: m, quote: v.quote, prezzo: v.prezzo, valore: valoreM, sulMese, dallAcquisto: dallAcqM })
  }

  const ultimo = mesiT.at(-1)
  const ultimoMese: Numero =
    stato === 'aperto' && ultimo && ultimo.mese === fine
      ? ultimo.sulMese
      : manca(
          `${nome}: rendimento dell'ultimo mese`,
          stato === 'chiuso' ? 'Il titolo non è più in portafoglio.' : 'Disponibile con il prossimo aggiornamento di fine mese.',
        )

  // Dividendi per anno: tutti quelli nel file.
  const dividendiPerAnno = new Map<string, Numero>()
  const anniDiv = [...new Set(ix.divs.map((d) => d.data.slice(0, 4)))].sort()
  for (const a of anniDiv) {
    const ds = ix.divs.filter((d) => d.data.startsWith(a))
    dividendiPerAnno.set(a, { n: somma(ds.map((d) => d.netto)), perche: spiegaDividendi(`Dividendi di ${nome} nel ${a}`, ds, nome) })
  }

  return {
    id: t.id,
    titolo: t,
    nomeCorto: nome,
    paroleSemplici: parole,
    valuta,
    stato,
    quote: vFine.quote,
    primoAcquisto,
    ultimaVendita,
    anni,
    pagato,
    costoMedio,
    incassato,
    dividendi,
    valore,
    valoreInValuta,
    prezzo: prezzoN,
    ultimoPrezzo,
    guadagno: guadagnoN,
    dallAcquisto,
    medioAnnuo,
    ultimoMese,
    mesi: mesiT,
    vendite,
    dividendiPerAnno,
    dividendiTutti: { n: somma(ix.divs.map((d) => d.netto)), perche: spiegaDividendi(`Dividendi di ${nome}`, ix.divs, nome) },
  }
}

function spiegaDividendi(titolo: string, ds: Dividendo[], nome: string): Spiegazione {
  const tot = somma(ds.map((d) => d.netto))
  return {
    titolo,
    grande: euro(tot),
    frase: ds.length
      ? 'Dividendi netti: importo accreditato, cioè lordo meno imposte.'
      : `${nome} non ha pagato dividendi: se è ad accumulazione, li reinveste nel prezzo.`,
    conto: ds.length
      ? [
          ...ds.map((d) =>
            riga(`${data(d.data)}${d.nota ? ` (${d.nota.toLowerCase()})` : ''}: ${euroTesto(d.lordo, 2)} − imposte ${euroTesto(d.imposte, 2)}`, euro(d.netto)),
          ),
          riga('Totale netto', euro(tot)),
        ]
      : [],
    note: ds.length ? ['I dividendi netti entrano nella plusvalenza del titolo.'] : [],
  }
}

// ---------- tutti i titoli ----------

export function contiDeiTitoli(dati: FileDati): ContiTitoli {
  const titoli = dati.titoli ?? []
  const ops = ordinaOperazioni(dati.operazioni ?? [])
  const divs = (dati.dividendi ?? []).slice().sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
  const prezzi = (dati.prezzi ?? []).slice().sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
  const mesi = [...new Set(prezzi.map((p) => p.data))].sort()
  const fine = mesi.at(-1) ?? null

  const indici = new Map<string, Indice>()
  for (const t of titoli) indici.set(t.id, { ops: [], divs: [], prezzi: [] })
  for (const o of ops) indici.get(o.titolo)?.ops.push(o)
  for (const d of divs) indici.get(d.titolo)?.divs.push(d)
  for (const p of prezzi) indici.get(p.titolo)?.prezzi.push(p)

  // Dal titolo che guadagna di più in percentuale, come nella bozza approvata; quelli senza numero in fondo.
  const conti = titoli
    .map((t) => contaTitolo(t, indici.get(t.id)!, mesi, fine))
    .sort((a, b) => (b.dallAcquisto.n ?? -Infinity) - (a.dallAcquisto.n ?? -Infinity) || a.nomeCorto.localeCompare(b.nomeCorto, 'it'))
  const aperti = conti.filter((c) => c.stato === 'aperto')

  // I titoli in portafoglio, sommati.
  const valoreAperti = somma(aperti.map((c) => c.valore.n ?? 0))
  const pagatoAperti = somma(aperti.map((c) => c.pagato.n ?? 0))
  const guadagnoAperti = somma(aperti.map((c) => c.guadagno.n ?? 0))
  const guadagnoTotale = somma(conti.map((c) => c.guadagno.n ?? 0))
  const chiusi = conti.filter((c) => c.stato === 'chiuso')
  const perValore = aperti.slice().sort((a, b) => (b.valore.n ?? 0) - (a.valore.n ?? 0))
  const perGuadagno = aperti.slice().sort((a, b) => (b.guadagno.n ?? 0) - (a.guadagno.n ?? 0))
  const quandoFine = fine ? `ai prezzi di ${fineDi(fine)}` : ''
  const apertiSommati: ContiTitoli['aperti'] = {
    quanti: aperti.length,
    valore: {
      n: valoreAperti,
      perche: {
        titolo: 'Controvalore dei titoli in portafoglio',
        grande: euro(valoreAperti),
        frase: `Somma dei ${aperti.length} titoli in portafoglio, ${quandoFine}.`,
        conto: [...perValore.map((c) => riga(c.nomeCorto, euro(c.valore.n ?? 0))), riga('Controvalore dei titoli', euro(valoreAperti))],
        note: ['Il controvalore di ogni titolo è quote × prezzo di fine mese, in euro: selezionarlo nella tabella per il calcolo.'],
      },
    },
    pagato: {
      n: pagatoAperti,
      perche: {
        titolo: "Costo d'acquisto dei titoli in portafoglio",
        grande: euro(pagatoAperti),
        frase: `Costo d'acquisto dei ${aperti.length} titoli in portafoglio, commissioni comprese.`,
        conto: [...perValore.map((c) => riga(c.nomeCorto, euro(c.pagato.n ?? 0))), riga("Costo d'acquisto", euro(pagatoAperti))],
        note: [
          "Non coincide con il capitale investito della pagina Portafoglio: quello è il costo d'acquisto meno il ricavo delle vendite, per tutti i titoli, compresi quelli venduti.",
        ],
      },
    },
    guadagno: {
      n: guadagnoAperti,
      perche: {
        titolo: `${plusMinus(guadagnoAperti)} dei titoli in portafoglio`,
        grande: guadagno(guadagnoAperti),
        frase: `Somma dei risultati dei ${aperti.length} titoli in portafoglio: controvalore + dividendi netti + ricavo delle vendite − costo d'acquisto.`,
        conto: [...perGuadagno.map((c) => riga(c.nomeCorto, guadagno(c.guadagno.n ?? 0))), riga(plusMinus(guadagnoAperti), guadagno(guadagnoAperti))],
        note: [
          chiusi.length
            ? `Compresi i titoli venduti (${chiusi.length}), il risultato dell'intero portafoglio è ${guadagnoEuro(guadagnoTotale, 2)}.`
            : "Nessun titolo venduto: coincide con il risultato dell'intero portafoglio.",
          'Comprende i dividendi netti. Al lordo delle imposte sulla vendita.',
        ],
      },
    },
    dallAcquisto:
      pagatoAperti > 0
        ? {
            n: guadagnoAperti / pagatoAperti,
            perche: {
              titolo: 'Rendimento sul costo',
              grande: percentuale(guadagnoAperti / pagatoAperti),
              dopo: 'sul costo',
              frase: `${plusMinus(guadagnoAperti)} dei titoli divisa per il costo d'acquisto.`,
              conto: [
                riga(plusMinus(guadagnoAperti), guadagno(guadagnoAperti)),
                riga("÷ costo d'acquisto", euro(pagatoAperti)),
                riga('Rendimento sul costo', percentuale(guadagnoAperti / pagatoAperti)),
              ],
              note: [],
            },
          }
        : manca('Rendimento sul costo', 'Nessun titolo in portafoglio a fine mese.'),
  }

  // Il portafoglio mese per mese: controvalore e rendimento del mese al netto di versamenti e prelievi.
  const valoreTutti = (m: string) => {
    const parti = titoli.map((t) => ({ c: conti.find((x) => x.id === t.id)!, v: valoreAl(indici.get(t.id)!, m) }))
    return { parti, valore: somma(parti.map((p) => p.v.valore ?? 0)) }
  }
  const totaliDelMese = new Map<string, { valore: Numero; sulMese: Numero }>()
  for (let i = 0; i < mesi.length; i++) {
    const m = mesi[i]
    const vt = valoreTutti(m)
    const conValore = vt.parti.filter((p) => p.v.quote > 0).sort((a, b) => (b.v.valore ?? 0) - (a.v.valore ?? 0))
    const valore: Numero = {
      n: vt.valore,
      perche: {
        titolo: `Controvalore del portafoglio a ${fineDi(m)}`,
        grande: euro(vt.valore),
        frase: `Somma dei titoli in portafoglio a ${fineDi(m)}.`,
        conto: [...conValore.map((p) => riga(p.c.nomeCorto, euro(p.v.valore ?? 0))), riga('Totale', euro(vt.valore))],
        note: [],
      },
    }
    const prima = i > 0 ? mesi[i - 1] : null
    const titoloMese = `Rendimento di ${mese(m)}`
    const sulMese: Numero = !prima
      ? manca(titoloMese, 'Primo fine mese disponibile: manca il mese precedente per il confronto.')
      : spiegaMese(
          titoloMese,
          'del portafoglio',
          prima,
          m,
          {
            v0: valoreTutti(prima).valore,
            v1: vt.valore,
            flussi: ops.filter((o) => o.data > prima && o.data <= m).map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? o.totale : -o.totale })),
            dividendi: somma(divs.filter((d) => d.data > prima && d.data <= m).map((d) => d.netto)),
          },
          ['Gli acquisti e le vendite del mese non contano come rendimento: un acquisto aumenta il controvalore, ma non è un rendimento.'],
        )
    totaliDelMese.set(m, { valore, sulMese })
  }
  const ultimoMese = fine ? totaliDelMese.get(fine)!.sulMese : manca('Rendimento del mese', 'Nessun prezzo di fine mese disponibile.')

  // Dividendi di tutti i titoli, per anno.
  const anni = [...new Set(divs.map((d) => d.data.slice(0, 4)))].sort()
  const perAnno = new Map<string, Numero>()
  for (const a of anni) {
    const ds = divs.filter((d) => d.data.startsWith(a))
    const tot = somma(ds.map((d) => d.netto))
    perAnno.set(a, {
      n: tot,
      perche: {
        titolo: `Dividendi del ${a}`,
        grande: euro(tot),
        frase: 'Dividendi netti di tutti i titoli: importo accreditato, al netto delle imposte.',
        conto: [
          ...conti.filter((c) => c.dividendiPerAnno.has(a)).map((c) => riga(c.nomeCorto, euro(c.dividendiPerAnno.get(a)!.n ?? 0))),
          riga('Totale', euro(tot)),
        ],
        note: [],
      },
    })
  }
  const totDiv = somma(divs.map((d) => d.netto))
  const totale: Numero = {
    n: totDiv,
    perche: {
      titolo: 'Dividendi netti totali',
      grande: euro(totDiv),
      frase: 'Dividendi netti di tutti i titoli, dal primo.',
      conto: [...anni.map((a) => riga(`Nel ${a}`, euro(perAnno.get(a)!.n ?? 0))), riga('Totale', euro(totDiv))],
      note: ['Comprende le cedole delle obbligazioni.'],
    },
  }

  return {
    fine,
    mesi,
    titoli: conti,
    aperti: apertiSommati,
    guadagnoTotale,
    ultimoMese,
    totaliDelMese,
    dividendi: { anni, perAnno, totale },
  }
}
