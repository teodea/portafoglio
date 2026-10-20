// I conti della pagina Movimenti (mappa, ticket 26): l'elenco di acquisti, vendite e dividendi dal più recente,
// i quattro riquadri (anche per un anno) e il "Da dove viene" di ogni movimento.
// A differenza dei conti dei titoli, qui contano tutti i movimenti nel file, anche quelli dopo l'ultimo
// fine mese: un acquisto del 5 novembre si vede subito, anche prima dell'aggiornamento di ottobre.
// Modulo puro: niente React, niente file.
import { valutaDelTitolo } from '../dati/aggiorna/mesi.ts'
import { inOrdine, quoteAlGiorno, type NuovaOperazione, type TipoMovimento } from '../dati/movimenti.ts'
import type { Dividendo, FileDati, Operazione, Titolo } from '../dati/tipi.ts'
import { data, euro as euroTesto, numero, prezzo as prezzoTesto, prezzoEsatto as prezzoEsattoTesto, quote as quoteTesto } from '../formato.ts'
import { fonteMovimento, spiegaOperazione, type CosaOperazione } from './scheda.ts'
import { euro, guadagno, prezzoEsatto, quote, riga, type Numero, type RigaConto, type Spiegazione } from './spiegazione.ts'
import { plusMinus, type VenditaSpiegata } from './titoli.ts'

const QUASI_ZERO = 1e-9
const somma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export type RigaMovimento = {
  id: string
  tipo: TipoMovimento
  data: string
  /** "2026" */
  anno: string
  titolo: Titolo
  /** Il simbolo, o il nome se il titolo non ha un simbolo. */
  nome: string
  /** Le parole semplici del titolo, o il nome della banca se non ci sono. */
  sottoNome: string | null
  /** "Acquisto", "Vendita", "Dividendo". */
  cosa: 'Acquisto' | 'Vendita' | 'Dividendo'
  /** Sotto "Cosa": "vendita parziale", "rimborso a scadenza", "cedola dell'obbligazione". */
  sotto: string | null
  /** Le quote comprate o vendute; per un dividendo quelle che avevi quel giorno (null se non si sa). */
  quote: number | null
  /** Acquisti e vendite: il prezzo per quota nella valuta del titolo, e il cambio se non è l'euro. */
  prezzo: { n: number; valuta: string; cambio: number | null } | null
  /** Dividendi: il lordo per quota, in euro. */
  perQuota: number | null
  commissioni: number | null
  lordo: number | null
  imposte: number | null
  /** Le imposte come frazione del lordo: 0,26 → 26%. */
  impostePct: number | null
  /** Gli euro pagati (acquisto) o incassati (vendita, dividendo netto), sempre positivi, con il loro conto. */
  soldi: Numero
  /** −1 per i soldi usciti dal conto, +1 per quelli entrati. */
  verso: 1 | -1
  /** La fonte in parole: "PDF della banca", "file Excel iniziale", "inserito manualmente". */
  fonte: string
  /** Corretto a mano: chip "a mano" in tutte le tabelle. */
  aMano: boolean
  /** Solo per le vendite: il costo medio e il guadagno incassato. */
  vendita: VenditaSpiegata | null
  /** La posizione nel file, per tenere l'ordine a parità di data. */
  ordine: number
}

// ---------- le vendite spiegate ----------

/**
 * Il costo medio e il guadagno incassato di ogni vendita del titolo, con le stesse regole dei conti dei titoli:
 * commissioni nel costo, le quote rimaste tengono il costo medio, guadagno incassato = incassato − costo medio × quote vendute.
 */
export function venditeSpiegate(ops: Operazione[], nome: string): Map<string, VenditaSpiegata> {
  const r = new Map<string, VenditaSpiegata>()
  let quoteOra = 0
  let costoOra = 0
  for (const o of inOrdine(ops)) {
    if (o.tipo === 'acquisto') {
      quoteOra += o.quantita
      costoOra += o.totale
      continue
    }
    const cm = quoteOra > QUASI_ZERO ? costoOra / quoteOra : 0
    const costoQuote = cm * o.quantita
    const parziale = quoteOra - o.quantita > QUASI_ZERO
    const g = o.totale - costoQuote
    r.set(o.id, {
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
          frase: `Il ${data(o.data)} sono state vendute ${quoteTesto(o.quantita)} quote su ${quoteTesto(quoteOra)} a ${prezzoTesto(o.prezzo, o.valuta)}, per un ricavo di ${euroTesto(o.totale, 2)}${o.commissioni > 0 ? ` (commissione di ${euroTesto(o.commissioni, 2)} già dedotta)` : ''}.`,
          conto: [
            riga('Ricavo della vendita', euro(o.totale)),
            riga(`− prezzo medio di carico × quote vendute (${prezzoEsattoTesto(cm, 'EUR')} × ${quoteTesto(o.quantita)})`, euro(costoQuote)),
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
    quoteOra -= o.quantita
    costoOra -= costoQuote
    if (quoteOra < QUASI_ZERO) {
      quoteOra = 0
      costoOra = 0
    }
  }
  return r
}

/** Come andrebbe una vendita prima di registrarla: quote che avevi, costo medio, guadagno incassato. null se non è una vendita. */
export function anteprimaVendita(dati: FileDati, n: NuovaOperazione): VenditaSpiegata | null {
  if (n.tipo !== 'vendita') return null
  const t = (dati.titoli ?? []).find((x) => x.id === n.titolo)
  if (!t) return null
  const finta: Operazione = {
    id: '(nuova)',
    titolo: n.titolo,
    tipo: 'vendita',
    data: n.data,
    esecuzione: n.data,
    quantita: n.quantita,
    prezzo: n.prezzo,
    valuta: valutaDelTitolo(dati, t),
    cambio: n.cambio,
    commissioni: n.commissioni,
    totale: n.totale,
    rifOrdine: null,
    fonte: '',
  }
  const ops = [...(dati.operazioni ?? []).filter((o) => o.titolo === n.titolo), finta]
  return venditeSpiegate(ops, t.simbolo ?? t.nome).get(finta.id) ?? null
}

// ---------- l'elenco ----------

const eCedola = (d: Dividendo) => /cedola/i.test(d.nota ?? '')
const eRimborso = (o: Operazione) => /rimborso/i.test(`${o.nota ?? ''} ${o.fonte}`)

function cosaDellOperazione(o: Operazione, v: VenditaSpiegata | null): CosaOperazione {
  return o.tipo === 'acquisto' ? 'Acquisto' : eRimborso(o) ? 'Rimborso' : v?.parziale ? 'Vendita parziale' : 'Vendita'
}

/** Il "Da dove viene" di un dividendo: quote × lordo per quota = lordo − imposte = netto. */
function spiegaDividendo(nome: string, d: Dividendo, quoteQuelGiorno: number): Spiegazione {
  const conto: RigaConto[] = []
  if (quoteQuelGiorno > 0) {
    conto.push(riga('Quote in portafoglio', quote(quoteQuelGiorno)))
    conto.push(riga('× lordo per quota', prezzoEsatto(d.lordo / quoteQuelGiorno, 'EUR')))
    conto.push(riga('= lordo', euro(d.lordo)))
  } else conto.push(riga('Lordo', euro(d.lordo)))
  conto.push(riga(d.lordo > 0 ? `− imposte (${numero((d.imposte / d.lordo) * 100, 2)}%)` : '− imposte', euro(d.imposte)))
  conto.push(riga('Netto accreditato', euro(d.netto)))
  const note: string[] = []
  if (d.nota) note.push(d.nota)
  if (Math.abs(d.lordo - d.imposte - d.netto) >= 0.01) note.push('Il netto è quello indicato nel documento della banca.')
  note.push(`Fonte: ${fonteMovimento(d.fonte)}.`)
  note.push('Il netto entra nella plusvalenza del titolo.')
  return {
    titolo: `${eCedola(d) ? 'Cedola' : 'Dividendo'} di ${nome} del ${data(d.data)}`,
    grande: euro(d.netto),
    frase: `Importo accreditato il ${data(d.data)}: lordo meno imposte trattenute.`,
    conto,
    note,
    movimento: d.id,
  }
}

/** Tutti i movimenti del file, dal più recente; a parità di data, prima quello scritto dopo nel file. */
export function elencoMovimenti(dati: FileDati): RigaMovimento[] {
  const titoli = new Map((dati.titoli ?? []).map((t) => [t.id, t]))
  const ops = dati.operazioni ?? []
  const perTitolo = new Map<string, Operazione[]>()
  for (const o of ops) perTitolo.set(o.titolo, [...(perTitolo.get(o.titolo) ?? []), o])
  const vendite = new Map<string, VenditaSpiegata>()
  for (const [id, lista] of perTitolo) {
    const t = titoli.get(id)
    for (const [k, v] of venditeSpiegate(lista, t ? (t.simbolo ?? t.nome) : id)) vendite.set(k, v)
  }

  const righe: RigaMovimento[] = []
  ops.forEach((o, i) => {
    const t = titoli.get(o.titolo)
    if (!t) return
    const nome = t.simbolo ?? t.nome
    const v = vendite.get(o.id) ?? null
    const cosa = cosaDellOperazione(o, v)
    const soldi = spiegaOperazione(nome, o, v, cosa)
    righe.push({
      id: o.id,
      tipo: o.tipo,
      data: o.data,
      anno: o.data.slice(0, 4),
      titolo: t,
      nome,
      sottoNome: sottoNome(t),
      cosa: o.tipo === 'acquisto' ? 'Acquisto' : 'Vendita',
      sotto: cosa === 'Rimborso' ? 'rimborso a scadenza' : cosa === 'Vendita parziale' ? 'vendita parziale' : null,
      quote: o.quantita,
      prezzo: { n: o.prezzo, valuta: o.valuta, cambio: o.valuta !== 'EUR' ? o.cambio : null },
      perQuota: null,
      commissioni: o.commissioni,
      lordo: null,
      imposte: null,
      impostePct: null,
      soldi: { n: o.totale, perche: { ...soldi.perche, movimento: o.id } },
      verso: o.tipo === 'acquisto' ? -1 : 1,
      fonte: fonteMovimento(o.fonte),
      aMano: !!o.prima,
      vendita: v,
      ordine: i,
    })
  })
  ;(dati.dividendi ?? []).forEach((d, i) => {
    const t = titoli.get(d.titolo)
    if (!t) return
    const nome = t.simbolo ?? t.nome
    const q = quoteAlGiorno(dati, d.titolo, d.data)
    righe.push({
      id: d.id,
      tipo: 'dividendo',
      data: d.data,
      anno: d.data.slice(0, 4),
      titolo: t,
      nome,
      sottoNome: sottoNome(t),
      cosa: 'Dividendo',
      sotto: eCedola(d) ? 'cedola dell’obbligazione' : null,
      quote: q > 0 ? q : null,
      prezzo: null,
      perQuota: q > 0 ? d.lordo / q : null,
      commissioni: null,
      lordo: d.lordo,
      imposte: d.imposte,
      impostePct: d.lordo > 0 ? d.imposte / d.lordo : null,
      soldi: { n: d.netto, perche: spiegaDividendo(nome, d, q) },
      verso: 1,
      fonte: fonteMovimento(d.fonte),
      aMano: !!d.prima,
      vendita: null,
      ordine: ops.length + i,
    })
  })
  return righe.sort((a, b) => (a.data === b.data ? b.ordine - a.ordine : a.data < b.data ? 1 : -1))
}

function sottoNome(t: Titolo): string | null {
  if (t.paroleSemplici?.trim()) return t.paroleSemplici.trim()
  return t.simbolo ? t.nome : null
}

/** Il "Da dove viene" di un movimento, rifatto sui dati di adesso (per il pannello dopo una correzione). null se non c'è più. */
export function spiegazioneDelMovimento(dati: FileDati, id: string): Spiegazione | null {
  return elencoMovimenti(dati).find((r) => r.id === id)?.soldi.perche ?? null
}

/** Gli anni con almeno un movimento, dal più recente. */
export function anniDeiMovimenti(righe: RigaMovimento[]): string[] {
  return [...new Set(righe.map((r) => r.anno))].sort().reverse()
}

// ---------- i quattro riquadri ----------

export type Riquadri = {
  /** Comprato meno venduto (in un anno: i soldi messi quell'anno). */
  investiti: Numero
  comprato: Numero
  venduto: Numero
  dividendi: Numero
  acquisti: number
  vendite: number
  pagamenti: number
}

const quanti = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`

/** Le righe del conto di una somma: per anno se sono tutti gli anni, se no un movimento per riga. */
function contoDellaSomma(righe: RigaMovimento[], anno: string | null, cosa: (r: RigaMovimento) => string): RigaConto[] {
  if (anno) return righe.slice().reverse().map((r) => riga(`${cosa(r)} del ${data(r.data)}`, euro(r.soldi.n ?? 0)))
  const anni = [...new Set(righe.map((r) => r.anno))].sort()
  return anni.map((a) => {
    const quelle = righe.filter((r) => r.anno === a)
    return riga(`Nel ${a} (${quelle.length})`, euro(somma(quelle.map((r) => r.soldi.n ?? 0))))
  })
}

/** I quattro riquadri di tutti gli anni (anno null) o di un anno. */
export function riquadriMovimenti(tutte: RigaMovimento[], anno: string | null): Riquadri {
  const righe = anno ? tutte.filter((r) => r.anno === anno) : tutte
  const acq = righe.filter((r) => r.tipo === 'acquisto')
  const ven = righe.filter((r) => r.tipo === 'vendita')
  const div = righe.filter((r) => r.tipo === 'dividendo')
  const comprato = somma(acq.map((r) => r.soldi.n ?? 0))
  const venduto = somma(ven.map((r) => r.soldi.n ?? 0))
  const netti = somma(div.map((r) => r.soldi.n ?? 0))
  const nel = anno ? ` nel ${anno}` : ''
  const nomeDi = (r: RigaMovimento) => `${r.cosa} di ${r.nome}`
  const investiti = comprato - venduto
  return {
    acquisti: acq.length,
    vendite: ven.length,
    pagamenti: div.length,
    investiti: {
      n: investiti,
      perche: {
        titolo: anno ? `Investimento netto del ${anno}` : 'Capitale investito',
        grande: anno ? guadagno(investiti) : euro(investiti),
        frase: anno
          ? `Acquisti del ${anno} meno ricavo delle vendite dello stesso anno.`
          : "Costo d'acquisto di tutti i titoli, commissioni comprese, meno il ricavo delle vendite.",
        conto: [
          riga(`Costo ${anno ? 'degli acquisti' : 'di tutti gli acquisti'}${nel} (${acq.length})`, euro(comprato)),
          riga(`− ricavo ${anno ? 'delle vendite' : 'di tutte le vendite'}${nel} (${ven.length})`, euro(venduto)),
          riga(anno ? `Investimento netto del ${anno}` : 'Capitale investito', anno ? guadagno(investiti) : euro(investiti)),
        ],
        note: [
          anno
            ? `Un valore negativo indica che nel ${anno} i prelievi dal portafoglio hanno superato i versamenti.`
            : 'È il capitale proprio che resta nel portafoglio.',
          'I dividendi non rientrano qui: fanno parte della plusvalenza.',
        ],
      },
    },
    comprato: {
      n: comprato,
      perche: {
        titolo: `Acquisti${nel}`,
        grande: euro(comprato),
        frase: `${quanti(acq.length, 'acquisto', 'acquisti')}${nel}, commissioni comprese: importo addebitato.`,
        conto: [...contoDellaSomma(acq, anno, nomeDi), riga('Totale acquisti', euro(comprato))],
        note: ['Selezionare un movimento nella tabella per il suo calcolo.'],
      },
    },
    venduto: {
      n: venduto,
      perche: {
        titolo: `Ricavo delle vendite${nel}`,
        grande: euro(venduto),
        frase:
          ven.length === 0
            ? `Nessuna vendita${nel}.`
            : `${quanti(ven.length, 'vendita', 'vendite')}${nel}, commissioni dedotte: importo accreditato. I rimborsi a scadenza delle obbligazioni contano come vendite.`,
        conto: ven.length ? [...contoDellaSomma(ven, anno, nomeDi), riga('Ricavo delle vendite', euro(venduto))] : [],
        note: [],
      },
    },
    dividendi: {
      n: netti,
      perche: {
        titolo: `Dividendi netti${nel}`,
        grande: euro(netti),
        frase:
          div.length === 0
            ? `Nessun dividendo${nel}.`
            : `${quanti(div.length, 'pagamento', 'pagamenti')}${nel}: importo accreditato, al netto delle imposte. Comprende le cedole delle obbligazioni.`,
        conto: div.length ? [...contoDellaSomma(div, anno, nomeDi), riga('Totale netto', euro(netti))] : [],
        note: [],
      },
    },
  }
}

/** Il totale della scheda Dividendi: lordo, imposte e netto delle righe mostrate. */
export function totaleDividendi(righe: RigaMovimento[]): { lordo: number; imposte: number; netto: number } {
  const div = righe.filter((r) => r.tipo === 'dividendo')
  return {
    lordo: somma(div.map((r) => r.lordo ?? 0)),
    imposte: somma(div.map((r) => r.imposte ?? 0)),
    netto: somma(div.map((r) => r.soldi.n ?? 0)),
  }
}
