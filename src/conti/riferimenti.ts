// Gli andamenti della pagina Portafoglio (DESIGN.md, "Grafico degli andamenti"): mese per mese, quanto sono
// cambiati dall'inizio del periodo il portafoglio, i cinque indici di borsa e l'inflazione. Sono andamenti da
// guardare insieme, non un confronto: niente classifica e niente "stessi euro".
// - un indice: valore in punti a fine mese ÷ valore in punti a inizio periodo − 1, come lo pubblica la borsa
//   (gli indici in dollari restano in dollari);
// - l'inflazione: NIC del mese ÷ NIC del mese d'inizio − 1, con le basi 2015 e 2025 agganciate;
// - il portafoglio, dall'inizio: (controvalore + dividendi netti − capitale investito) ÷ capitale investito, come
//   nel riquadro della risposta; negli ultimi 12 mesi: il rendimento al netto dei versamenti e dei prelievi dal fine
//   mese d'inizio, come il rendimento da inizio anno.
// Ogni riga della tabella esce con il suo "Da dove viene". Modulo puro: niente React, niente file.
import { fineMese, meseDi, nomeMese as nomeDelMese } from '../dati/aggiorna/calendario.ts'
import { DESCRIZIONE, finoAl, FONTE_NIC, FONTE_RIFERIMENTO, nicAgganciato, quandoEsceNic, RACCORDO_2015_2025, riferimentiDelFile } from '../dati/aggiorna/riferimenti.ts'
import { CONFRONTI, type IdConfronto } from '../dati/correzione-riferimento.ts'
import type { FileDati, IdRiferimento, ValoreRiferimento } from '../dati/tipi.ts'
import { data as dataIt, numero } from '../formato.ts'
import { contiDelPortafoglio, type ContiPortafoglio } from './portafoglio.ts'
import { euro, percentuale, riga, testo, type RigaConto, type Spiegazione } from './spiegazione.ts'
import { senzaSoldiNuovi } from './titoli.ts'

/** Dall'inizio (dal primo fine mese con i prezzi) o negli ultimi 12 mesi (dal fine mese di un anno fa). */
export type PeriodoAndamenti = 'tutto' | '12'
export type IdAndamento = IdConfronto | 'portafoglio'

/** Una linea del grafico: la variazione dall'inizio del periodo a ogni fine mese; null dove manca un valore. */
export type LineaAndamento = { id: IdAndamento; nome: string; punti: (number | null)[] }

export type SerieAndamenti = {
  /** I fine mese, AAAA-MM-GG, dal più vecchio: gli stessi del grafico del controvalore. */
  mesi: string[]
  /** Il portafoglio, i cinque indici e l'inflazione. */
  linee: LineaAndamento[]
}

export type RigaAndamento = {
  id: IdAndamento
  /** "Portafoglio", "S&P 500", "Inflazione". */
  nome: string
  /** Il valore all'ultimo fine mese: punti per un indice, euro per il portafoglio, il NIC per l'inflazione. */
  valore: number | null
  unita: 'punti' | 'euro' | 'nic'
  /** Solo per un indice: la valuta dei punti. */
  valuta?: 'EUR' | 'USD'
  /** La variazione dall'inizio del periodo, come frazione (0,1 = +10,00%). */
  variazione: number | null
  /** "fino ad agosto" quando l'inflazione si ferma al mese prima; null altrimenti. */
  finoA: string | null
  /** Perché non ci sono i numeri, in una frase; null se ci sono. */
  manca: string | null
  /** Almeno un valore usato è scritto a mano: la riga porta la matita. */
  aMano: boolean
  perche: Spiegazione
}

export type Andamenti = {
  /** Il fine mese dei prezzi, l'ultimo del grafico. */
  fine: string
  /** Il fine mese d'inizio del periodo. */
  da: string
  serie: SerieAndamenti
  /** Il portafoglio, poi i cinque indici e l'inflazione, nell'ordine di sempre. */
  righe: RigaAndamento[]
}

const somma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const NOME_INFLAZIONE = 'Inflazione'
const fineDi = (d: string) => `fine ${nomeDelMese(meseDi(d))} ${d.slice(0, 4)}`

/** "51.371,98 punti", "50.906,05 punti in dollari" */
export function puntiTesto(n: number, valuta?: 'EUR' | 'USD'): string {
  return `${numero(n, 2)} punti${valuta === 'USD' ? ' in dollari' : ''}`
}

/** La variazione di una serie dal suo primo valore: il primo vale 0, poi valore ÷ primo − 1. */
function variazioni(valori: (number | null)[]): { punti: (number | null)[]; base: number | null; i: number } {
  const i = valori.findIndex((v) => v !== null && v > 0)
  const base = i < 0 ? null : valori[i]!
  return { punti: valori.map((v) => (base === null || v === null ? null : v / base - 1)), base, i }
}

export function andamenti(dati: FileDati, conti: ContiPortafoglio, periodo: PeriodoAndamenti): Andamenti | null {
  const fine = conti.fine
  if (!fine || !conti.serie.length) return null
  // "Ultimi 12 mesi": dal fine mese di un anno fa, così si vedono 12 mesi interi.
  const punti = periodo === '12' ? conti.serie.slice(-13) : conti.serie
  const mesi = punti.map((p) => p.mese)
  const da = mesi[0]
  const nomi = new Map(conti.titoli.titoli.map((t) => [t.id, t.nomeCorto]))
  const divs = (dati.dividendi ?? []).filter((x) => nomi.has(x.titolo))
  const ops = (dati.operazioni ?? []).filter((o) => nomi.has(o.titolo))
  const rifai = (id: IdAndamento) => (d: FileDati) => andamenti(d, contiDelPortafoglio(d), periodo)?.righe.find((r) => r.id === id)?.perche ?? null
  const dalTesto = periodo === '12' ? `da ${fineDi(da)}` : 'dall’inizio'

  // ---------- il portafoglio ----------
  const divFino = (d: string) => somma(divs.filter((x) => x.data <= d).map((x) => x.netto))
  let puntiTu: (number | null)[]
  if (periodo === 'tutto')
    puntiTu = punti.map((p) => (p.valore.n === null || p.investiti <= 1e-9 ? null : (p.valore.n + divFino(p.mese) - p.investiti) / p.investiti))
  else {
    const v0 = punti[0].valore.n
    puntiTu = punti.map((p, i) => {
      if (i === 0) return v0 === null ? null : 0
      if (v0 === null || p.valore.n === null) return null
      const flussi = ops.filter((o) => o.data > da && o.data <= p.mese).map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? o.totale : -o.totale }))
      const dividendi = somma(divs.filter((x) => x.data > da && x.data <= p.mese).map((x) => x.netto))
      return senzaSoldiNuovi(da, p.mese, { v0, v1: p.valore.n, flussi, dividendi }).r
    })
  }
  const ultimo = punti.at(-1)!
  const valoreTu = ultimo.valore.n === null ? null : ultimo.valore.n + divFino(fine)
  const varTu = puntiTu.at(-1) ?? null
  const contoTu: RigaConto[] =
    periodo === 'tutto'
      ? [
          riga(`Controvalore dei titoli a ${fineDi(fine)}`, euro(ultimo.valore.n ?? 0)),
          riga('+ dividendi netti incassati', euro(divFino(fine))),
          riga('= titoli e dividendi', euro(valoreTu ?? 0)),
          riga('Capitale investito (versamenti − prelievi)', euro(ultimo.investiti)),
          riga('Rendimento dall’inizio: (titoli e dividendi − capitale) ÷ capitale', varTu === null ? testo('—') : percentuale(varTu)),
        ]
      : [
          riga(`Controvalore a ${fineDi(da)}`, euro(punti[0].valore.n ?? 0)),
          riga(`Controvalore a ${fineDi(fine)}`, euro(ultimo.valore.n ?? 0)),
          riga('Rendimento al netto dei versamenti e dei prelievi', varTu === null ? testo('—') : percentuale(varTu)),
        ]
  const portafoglio: RigaAndamento = {
    id: 'portafoglio',
    nome: 'Portafoglio',
    valore: valoreTu,
    unita: 'euro',
    variazione: varTu,
    finoA: null,
    manca: varTu === null ? 'Il rendimento del portafoglio non è disponibile per questo periodo.' : null,
    aMano: false,
    perche: {
      titolo: `Portafoglio ${dalTesto}`,
      grande: varTu === null ? testo('—') : percentuale(varTu),
      frase:
        periodo === 'tutto'
          ? 'Rendimento del portafoglio dall’inizio: il guadagno di titoli e dividendi netti rispetto al capitale investito, lo stesso del riquadro della risposta.'
          : `Rendimento del portafoglio da ${fineDi(da)} a ${fineDi(fine)}, al netto dei versamenti e dei prelievi del periodo, come il rendimento da inizio anno.`,
      conto: contoTu,
      note: ['Gli indici di borsa sono in punti, senza dividendi: si guardano accanto al portafoglio per vedere come sono andati i mercati.'],
      rifai: rifai('portafoglio'),
    },
  }

  // ---------- i cinque indici ----------
  const tutti = riferimentiDelFile(dati)
  const indici = CONFRONTI.filter((id): id is IdRiferimento => id !== 'nic').map((id) => {
    const r = DESCRIZIONE[id]
    const perData = new Map<string, ValoreRiferimento>(tutti.filter((v) => v.riferimento === id).map((v) => [v.data, v]))
    const valori = mesi.map((m) => perData.get(m)?.valore ?? null)
    const { punti: linea, i } = variazioni(valori)
    const vFine = perData.get(fine)
    const vDa = i < 0 ? undefined : perData.get(mesi[i])
    const variazione = vFine && vDa ? vFine.valore / vDa.valore - 1 : null
    const aMano = vFine?.fonte === FONTE_RIFERIMENTO.aMano || vDa?.fonte === FONTE_RIFERIMENTO.aMano
    const vuoto = !tutti.some((v) => v.riferimento === id)
    const manca = vFine
      ? null
      : vuoto
        ? `I valori di ${r.nome} non sono ancora nel file: si scaricano con Aggiorna fine mese.`
        : `Nel file manca il valore di ${r.nome} di ${fineDi(fine)}.`
    const note: string[] = [`Fonte: investing.com, la chiusura dell’ultima seduta del mese${vFine?.seduta ? ` (a ${fineDi(fine)}: seduta del ${dataIt(vFine.seduta)})` : ''}.`]
    if (vFine && r.valuta === 'USD' && vFine.cambio)
      note.push(`In euro, al cambio BCE dello stesso giorno (${numero(vFine.cambio, 4, 5)} dollari per 1 euro), sarebbero ${numero(vFine.valore / vFine.cambio, 2)}: qui l’indice resta in punti, come lo pubblica la borsa.`)
    if (vDa && i > 0) note.push(`Il primo valore disponibile nel periodo è di ${fineDi(mesi[i])}: la linea parte da lì.`)
    if (aMano) note.push('Almeno uno dei due valori è inserito manualmente.')
    if (!vFine) note.push('“Scarica di nuovo” richiede a investing.com il valore mancante; in caso di mancata risposta, lo recupera il prossimo Aggiorna fine mese.')
    const conto: RigaConto[] =
      vFine && vDa
        ? [
            riga(`${r.nome} a ${fineDi(mesi[i])}`, testo(puntiTesto(vDa.valore, r.valuta))),
            riga(`${r.nome} a ${fineDi(fine)}`, testo(puntiTesto(vFine.valore, r.valuta))),
            riga('Variazione (valore finale ÷ valore iniziale − 1)', percentuale(variazione!)),
          ]
        : []
    const riga_: RigaAndamento = {
      id,
      nome: r.nome,
      valore: vFine?.valore ?? null,
      unita: 'punti',
      valuta: r.valuta,
      variazione,
      finoA: null,
      manca,
      aMano,
      perche: {
        titolo: `${r.nome} ${dalTesto}`,
        grande: vFine ? testo(puntiTesto(vFine.valore, r.valuta)) : testo('manca'),
        dopo: vFine ? `a ${fineDi(fine)}` : undefined,
        frase: manca ?? `${r.cosa.charAt(0).toUpperCase() + r.cosa.slice(1)}.`,
        conto,
        note,
        riferimento: { id, data: fine },
        rifai: rifai(id),
      },
    }
    return { riga: riga_, linea: { id, nome: r.nome, punti: linea } as LineaAndamento }
  })

  // ---------- l'inflazione ----------
  const nic = nicAgganciato(dati.nic ?? [])
  const nicAMano = new Set((dati.nic ?? []).filter((n) => n.fonte === FONTE_NIC.aMano).map((n) => meseDi(n.data)))
  const valoriNic = mesi.map((m) => nic.get(meseDi(m)) ?? null)
  const { punti: lineaNic, i: iNic } = variazioni(valoriNic)
  // L'inflazione arriva all'ultimo mese che ha il NIC, se quello di fine non c'è ancora.
  const ultimoNic = [...nic.keys()].filter((m) => m <= meseDi(fine)).sort().at(-1)
  const meseNic = ultimoNic && ultimoNic >= meseDi(da) ? ultimoNic : null
  const finoA = meseNic && meseNic < meseDi(fine) ? finoAl(meseNic) : null
  const nicDa = iNic < 0 ? null : valoriNic[iNic]
  const nicFine = meseNic ? nic.get(meseNic)! : null
  const varNic = nicDa !== null && nicFine !== null ? nicFine / nicDa - 1 : null
  const mancaNic = varNic !== null ? null : !(dati.nic ?? []).length ? 'I valori dell’inflazione non sono ancora nel file: si scaricano con Aggiorna fine mese.' : `Nel file manca il NIC di ${nomeDelMese(meseDi(da))} ${da.slice(0, 4)}.`
  const noteNic = [
    `Fonte: ISTAT, indice NIC generale, un valore per mese. I mesi fino a dicembre 2025 sono in base 2015 e si portano in base 2025 dividendo per ${numero(RACCORDO_2015_2025, 5)}.`,
  ]
  if (finoA) noteNic.unshift(`Il NIC di ${nomeDelMese(meseDi(fine))} non è ancora disponibile (ISTAT lo pubblica ${quandoEsceNic(meseDi(fine))}): l’inflazione arriva ${finoA}.`)
  const inflazione: RigaAndamento = {
    id: 'nic',
    nome: NOME_INFLAZIONE,
    valore: nicFine,
    unita: 'nic',
    variazione: varNic,
    finoA,
    manca: mancaNic,
    aMano: (meseNic !== null && nicAMano.has(meseNic)) || (iNic >= 0 && nicAMano.has(meseDi(mesi[iNic]))),
    perche: {
      titolo: `Inflazione ${dalTesto}`,
      grande: varNic === null ? testo('manca') : percentuale(varNic),
      dopo: meseNic ? `a ${nomeDelMese(meseNic)} ${meseNic.slice(0, 4)}` : undefined,
      frase: mancaNic ?? 'Quanto sono aumentati i prezzi al consumo (inflazione NIC di ISTAT) nel periodo.',
      conto:
        varNic !== null
          ? [
              riga(`NIC di ${nomeDelMese(meseDi(mesi[iNic]))} ${mesi[iNic].slice(0, 4)} (base 2025 = 100)`, testo(numero(nicDa!, 2))),
              riga(`NIC di ${nomeDelMese(meseNic!)} ${meseNic!.slice(0, 4)} (base 2025 = 100)`, testo(numero(nicFine!, 2))),
              riga('Variazione', percentuale(varNic)),
            ]
          : [],
      note: noteNic,
      riferimento: { id: 'nic', data: fineMese(meseNic ?? meseDi(fine)) },
      rifai: rifai('nic'),
    },
  }

  return {
    fine,
    da,
    serie: {
      mesi,
      linee: [{ id: 'portafoglio', nome: portafoglio.nome, punti: puntiTu }, ...indici.map((x) => x.linea), { id: 'nic', nome: NOME_INFLAZIONE, punti: lineaNic }],
    },
    righe: [portafoglio, ...indici.map((x) => x.riga), inflazione],
  }
}
