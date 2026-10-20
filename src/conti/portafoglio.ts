// I conti di tutto il portafoglio, per la pagina Portafoglio (mappa, ticket 28), con le regole
// di "Come si calcolano i rendimenti" (mappa, ticket 3):
// - soldi investiti = pagato per comprare − incassato vendendo;
// - guadagno = valore dei titoli + incassato vendendo + dividendi netti − pagato, compresi i titoli venduti;
// - % dall'inizio = guadagno ÷ soldi investiti;
// - medio annuo: conta quando è entrato e uscito ogni euro (XIRR su acquisti, vendite, dividendi e valore finale);
// - mese e anno in corso: i soldi messi o tolti nel periodo non sono guadagno (Modified Dietz).
// Tutto all'ultimo fine mese con i prezzi, come i conti dei titoli. Ogni numero esce con il suo
// "Da dove viene". Modulo puro: niente React, niente file.
import type { FileDati } from '../dati/tipi.ts'
import { data, euro as euroTesto, mese, nomeMese, numero, percentuale as pct } from '../formato.ts'
import { euro, guadagno, percentuale, riga, testo, type Numero, type RigaConto } from './spiegazione.ts'
import { ANNI_MINIMI_MEDIO, contiDeiTitoli, plusMinus, senzaSoldiNuovi, type ContiTitoli, type ContoTitolo } from './titoli.ts'
import { anniTra, xirr } from './xirr.ts'

const QUASI_ZERO = 1e-9
const somma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const fineDi = (m: string) => `fine ${mese(m)}`

/** Un punto del grafico "Come è cresciuto il valore": un fine mese. */
export type PuntoDelValore = {
  /** Il fine mese, AAAA-MM-GG. */
  mese: string
  /** Il valore di tutti i titoli a quel fine mese, con il suo conto. */
  valore: Numero
  /** I soldi investiti fino a quel giorno: pagato − incassato. */
  investiti: number
}

export type ContiPortafoglio = {
  /** L'ultimo fine mese con i prezzi, o null se nel file non ce n'è nessuno. */
  fine: string | null
  /** L'anno dell'ultimo fine mese, "2026". */
  anno: string | null
  /** Il valore dei titoli che hai a fine mese. */
  valore: Numero
  investiti: Numero
  guadagno: Numero
  dallInizio: Numero
  medioAnnuo: Numero
  /** L'ultimo mese, senza i soldi nuovi. */
  mese: Numero
  /** L'anno in corso, dal 31/12 dell'anno prima, senza i soldi nuovi. */
  annoInCorso: Numero
  /** I dividendi netti incassati fino all'ultimo fine mese. */
  dividendi: Numero
  serie: PuntoDelValore[]
  /** I conti dei titoli da cui vengono questi numeri. */
  titoli: ContiTitoli
}

const manca = (titolo: string, perche: string): Numero => ({
  n: null,
  perche: { titolo, grande: testo('—'), frase: perche, conto: [], note: [] },
})

/** "acquisti" / "1 acquisto" */
const quanti = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`

/** "A e B", "A, B e C" */
function elenco(nomi: string[]): string {
  return nomi.length <= 1 ? (nomi[0] ?? '') : `${nomi.slice(0, -1).join(', ')} e ${nomi.at(-1)}`
}

export function contiDelPortafoglio(dati: FileDati, titoli: ContiTitoli = contiDeiTitoli(dati)): ContiPortafoglio {
  const { fine } = titoli
  const nomi = new Map(titoli.titoli.map((t) => [t.id, t.nomeCorto]))
  const nomeDi = (id: string) => nomi.get(id) ?? id
  const fino = fine ?? ''
  // Solo i movimenti fino all'ultimo fine mese: quelli dopo entrano con il prossimo aggiornamento.
  const ops = (dati.operazioni ?? [])
    .filter((o) => nomi.has(o.titolo) && o.data <= fino)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
  const divs = (dati.dividendi ?? [])
    .filter((d) => nomi.has(d.titolo) && d.data <= fino)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
  const dopo = [...(dati.operazioni ?? []), ...(dati.dividendi ?? [])].filter((x) => fine && x.data > fine).length

  const acquisti = ops.filter((o) => o.tipo === 'acquisto')
  const vendite = ops.filter((o) => o.tipo === 'vendita')
  const pagatoN = somma(acquisti.map((o) => o.totale))
  const incassatoN = somma(vendite.map((o) => o.totale))
  const dividendiN = somma(divs.map((d) => d.netto))
  const investitiN = pagatoN - incassatoN
  const valoreN = titoli.aperti.valore.n ?? 0
  if (!fine) {
    const vuoto = (t: string) => manca(t, 'Nessun prezzo di fine mese disponibile: i valori saranno calcolati con il primo aggiornamento.')
    return {
      fine: null,
      anno: null,
      valore: vuoto('Controvalore dei titoli'),
      investiti: vuoto('Capitale investito'),
      guadagno: vuoto('Plusvalenza del portafoglio'),
      dallInizio: vuoto('Rendimento sul capitale investito'),
      medioAnnuo: vuoto('Rendimento annualizzato'),
      mese: vuoto('Rendimento del mese'),
      annoInCorso: vuoto('Rendimento da inizio anno'),
      dividendi: vuoto('Dividendi netti'),
      serie: [],
      titoli,
    }
  }

  const quandoFine = fineDi(fine)
  const notaDopo = dopo
    ? [
        dopo === 1
          ? `Un movimento successivo al ${data(fine)} sarà incluso con il prossimo aggiornamento di fine mese.`
          : `${dopo} movimenti successivi al ${data(fine)} saranno inclusi con il prossimo aggiornamento di fine mese.`,
      ]
    : []

  // ---------- capitale investito ----------
  const investiti: Numero = {
    n: investitiN,
    perche: {
      titolo: 'Capitale investito',
      grande: euro(investitiN),
      frase: "Il capitale proprio che resta nel portafoglio: costo d'acquisto di tutti i titoli, commissioni comprese, meno il ricavo delle vendite.",
      conto: [
        riga(`Costo d'acquisto (${quanti(acquisti.length, 'acquisto', 'acquisti')})`, euro(pagatoN)),
        ...(vendite.length ? [riga(`− ricavo delle vendite (${quanti(vendite.length, 'vendita', 'vendite')})`, euro(incassatoN))] : []),
        riga('Capitale investito', euro(investitiN)),
      ],
      note: ['I dividendi non rientrano nel capitale investito: fanno parte della plusvalenza.', ...notaDopo],
    },
  }

  // ---------- guadagno e % dall'inizio ----------
  const g = valoreN + incassatoN + dividendiN - pagatoN
  const chiusi = titoli.titoli.filter((t) => t.stato === 'chiuso').map((t) => t.nomeCorto)
  const dallInizio: Numero =
    investitiN > QUASI_ZERO
      ? {
          n: g / investitiN,
          perche: {
            titolo: 'Rendimento sul capitale investito',
            grande: percentuale(g / investitiN),
            frase: `${plusMinus(g)} del portafoglio divisa per il capitale investito.`,
            conto: [
              riga(plusMinus(g), guadagno(g)),
              riga("÷ capitale investito (costo d'acquisto − ricavo delle vendite)", euro(investitiN)),
              riga("Rendimento dall'inizio", percentuale(g / investitiN)),
            ],
            note: ['Con vendite rilevanti in plusvalenza questa percentuale aumenta, perché il capitale investito si riduce: il rendimento annualizzato non ne risente.'],
          },
        }
      : manca(
          'Rendimento sul capitale investito',
          "Capitale investito pari a zero o negativo: il ricavo delle vendite ha raggiunto il costo d'acquisto. Vale il risultato in euro.",
        )

  // ---------- rendimento annualizzato ----------
  const primo = acquisti[0]?.data ?? null
  const anni = primo ? anniTra(primo, fine) : null
  let medioAnnuo: Numero
  if (!primo || anni === null) medioAnnuo = manca('Rendimento annualizzato', 'Nessun acquisto prima dell’ultimo fine mese.')
  else if (anni < ANNI_MINIMI_MEDIO)
    medioAnnuo = manca(
      'Rendimento annualizzato',
      `Il primo acquisto è del ${data(primo)}: su meno di sei mesi il rendimento annualizzato non è significativo. Rendimento sul capitale investito${dallInizio.n === null ? ': non disponibile' : `: ${pct(dallInizio.n)}`}.`,
    )
  else {
    const flussi = [
      ...ops.map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? -o.totale : o.totale, cosa: `${o.tipo} di ${nomeDi(o.titolo)}` })),
      ...divs.map((d) => ({ data: d.data, importo: d.netto, cosa: `dividendo di ${nomeDi(d.titolo)}` })),
    ].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    const r = xirr([...flussi, { data: fine, importo: valoreN }])
    medioAnnuo =
      r === null
        ? manca('Rendimento annualizzato', 'Con questi movimenti il tasso non è calcolabile.')
        : {
            n: r,
            perche: {
              titolo: 'Rendimento annualizzato del portafoglio',
              grande: percentuale(r),
              dopo: "all'anno",
              frase:
                'Il tasso annuo composto che, ripetuto ogni anno, dà il risultato ottenuto, tenendo conto di quando sono entrati e usciti i capitali (tasso interno di rendimento, come nei rendiconti bancari). Comprende i dividendi.',
              conto: [
                ...flussi.map((f) => riga(`${data(f.data)}: ${f.cosa}`, euro(f.importo))),
                riga(`Controvalore dei titoli a ${quandoFine}`, euro(valoreN)),
                riga('Rendimento annualizzato', percentuale(r)),
              ],
              note: [
                `Dal primo acquisto (${data(primo)}) sono passati ${numero(anni, 1)} anni, ma i capitali sono entrati in date diverse: ogni importo pesa per il tempo in cui è rimasto investito.`,
                ...(dallInizio.n !== null
                  ? [
                      `Dividendo semplicemente il rendimento dall'inizio (${pct(dallInizio.n)}) per i ${numero(anni, 1)} anni si otterrebbe ${pct(dallInizio.n / anni)} all'anno: un valore ${dallInizio.n / anni < r ? 'più basso' : 'più alto'}, perché tratta tutto il capitale come investito fin dal primo acquisto.`,
                    ]
                  : []),
                'Gli acquisti sono negativi; vendite, dividendi e controvalore finale sono positivi.',
              ],
            },
          }
  }

  const guadagnoTot: Numero = {
    n: g,
    perche: {
      titolo: `${plusMinus(g)} del portafoglio`,
      grande: guadagno(g),
      frase:
        "Il risultato di tutti i titoli, compresi quelli venduti: controvalore a fine mese, più ricavo delle vendite e dividendi netti, meno costo d'acquisto.",
      conto: [
        riga(`Controvalore dei titoli a ${quandoFine}`, euro(valoreN)),
        ...(incassatoN ? [riga('+ ricavo delle vendite', euro(incassatoN))] : []),
        ...(dividendiN ? [riga('+ dividendi netti', euro(dividendiN))] : []),
        riga("− costo d'acquisto", euro(pagatoN)),
        riga(plusMinus(g), guadagno(g)),
      ],
      note: [
        ...(dallInizio.n !== null ? [`Sul capitale investito (${euroTesto(investitiN, 2)}) corrisponde a ${pct(dallInizio.n)} dall'inizio.`] : []),
        ...(medioAnnuo.n !== null
          ? [`Tenendo conto delle date dei movimenti corrisponde a ${pct(medioAnnuo.n)} all'anno: selezionare il numero per il calcolo.`]
          : []),
        chiusi.length ? `Comprende i titoli già venduti (${elenco(chiusi)}).` : 'Nessun titolo venduto.',
        "Comprende i dividendi netti. Al lordo delle imposte sulla vendita; le commissioni sono nel costo d'acquisto.",
        ...notaDopo,
      ],
    },
  }

  // ---------- l'anno in corso ----------
  const annoS = fine.slice(0, 4)
  const d0 = `${Number(annoS) - 1}-12-31`
  const titoloAnno = `Rendimento da inizio ${annoS}`
  let annoInCorso: Numero
  const v0Mese = titoli.totaliDelMese.get(d0)?.valore.n
  const primaDellAnno = ops.some((o) => o.data <= d0)
  if (v0Mese === undefined && primaDellAnno)
    annoInCorso = manca(titoloAnno, `Nel file manca il controvalore dei titoli al ${data(d0)}, da cui si misura l'anno.`)
  else {
    const v0 = v0Mese ?? 0
    const flussi = ops.filter((o) => o.data > d0).map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? o.totale : -o.totale, o }))
    const divAnno = somma(divs.filter((d) => d.data > d0).map((d) => d.netto))
    const { r, guadagno: gA, base, netti } = senzaSoldiNuovi(d0, fine, { v0, v1: valoreN, flussi, dividendi: divAnno })
    const lungo = anniTra(d0, fine)
    const conto: RigaConto[] = [riga(`Controvalore a ${quandoFine}`, euro(valoreN)), riga(`− controvalore al ${data(d0)}`, euro(v0))]
    if (netti > QUASI_ZERO) conto.push(riga(`− versamenti netti del ${annoS} (acquisti)`, euro(netti)))
    if (netti < -QUASI_ZERO) conto.push(riga(`+ prelievi netti del ${annoS} (vendite)`, euro(-netti)))
    if (divAnno > 0) conto.push(riga(`+ dividendi netti del ${annoS}`, euro(divAnno)))
    conto.push(riga("= risultato dell'anno", guadagno(gA)))
    conto.push(riga(flussi.length ? `÷ controvalore al ${data(d0)}, con i movimenti dell'anno ponderati per i giorni` : `÷ controvalore al ${data(d0)}`, euro(base)))
    if (r !== null) conto.push(riga(`Da inizio ${annoS}`, percentuale(r)))
    annoInCorso = {
      n: r,
      perche: {
        titolo: titoloAnno,
        grande: r === null ? testo('—') : percentuale(r),
        frase: `Rendimento del portafoglio dal ${data(d0)} a ${quandoFine}, al netto dei versamenti e dei prelievi dell'anno.`,
        conto,
        note: [
          ...flussi.map(
            (f) =>
              `${data(f.data)}: ${f.o.tipo} di ${nomeDi(f.o.titolo)} (${euroTesto(f.o.totale, 2)}). ${f.o.tipo === 'acquisto' ? 'Pesa dalla data dell’acquisto' : 'Esce dal calcolo da quella data'}: ${numero(lungo > 0 ? (anniTra(f.data, fine) / lungo) * 100 : 0, 0)}% del periodo.`,
          ),
          v0 === 0 ? `Il portafoglio è cominciato nel ${annoS}: si misura dal prezzo d'acquisto.` : "Un titolo acquistato nell'anno si misura dal prezzo d'acquisto.",
          'Gli acquisti e le vendite dell’anno non contano come rendimento.',
        ],
      },
    }
  }

  // ---------- dividendi ----------
  const conDividendi = titoli.titoli.filter((t) => (t.dividendi.n ?? 0) > 0).sort((a, b) => (b.dividendi.n ?? 0) - (a.dividendi.n ?? 0))
  const divDopo = (dati.dividendi ?? []).filter((d) => d.data > fine).length
  const dividendi: Numero = {
    n: dividendiN,
    perche: {
      titolo: 'Dividendi netti',
      grande: euro(dividendiN),
      frase: divs.length
        ? 'Dividendi netti di tutti i titoli, dal primo: importo accreditato, al netto delle imposte.'
        : 'Nessun dividendo incassato: i titoli ad accumulazione li reinvestono nel prezzo.',
      conto: divs.length ? [...conDividendi.map((t) => riga(t.nomeCorto, euro(t.dividendi.n ?? 0))), riga('Totale', euro(dividendiN))] : [],
      note: [
        ...(divs.length ? ['Entrano nella plusvalenza. Comprende le cedole delle obbligazioni.'] : []),
        ...(divDopo ? [`${divDopo === 1 ? 'Un dividendo accreditato' : `${divDopo} dividendi accreditati`} dopo il ${data(fine)} ${divDopo === 1 ? 'sarà incluso' : 'saranno inclusi'} con il prossimo aggiornamento.`] : []),
      ],
    },
  }

  // ---------- il valore mese per mese ----------
  const serie: PuntoDelValore[] = titoli.mesi.map((m) => ({
    mese: m,
    valore: titoli.totaliDelMese.get(m)!.valore,
    investiti: somma(ops.filter((o) => o.data <= m).map((o) => (o.tipo === 'acquisto' ? o.totale : -o.totale))),
  }))

  return {
    fine,
    anno: annoS,
    valore: titoli.aperti.valore,
    investiti,
    guadagno: guadagnoTot,
    dallInizio,
    medioAnnuo,
    mese: titoli.ultimoMese,
    annoInCorso,
    dividendi,
    serie,
    titoli,
  }
}

// ---------- i titoli che vanno meglio e peggio ----------

export type MisuraTitoli = 'acquisto' | 'mese'

export type MeglioPeggio = {
  meglio: { conto: ContoTitolo; numero: Numero }[]
  peggio: { conto: ContoTitolo; numero: Numero }[]
  /** I titoli che hai ma che non hanno ancora il numero (es. entrati nell'ultimo mese). */
  senzaNumero: ContoTitolo[]
}

/**
 * I migliori e i peggiori tra i titoli che hai, "dall'acquisto" o "sul mese".
 * Un titolo non sta mai in tutte e due le colonne: con pochi titoli le colonne si accorciano.
 */
export function meglioPeggio(titoli: ContoTitolo[], misura: MisuraTitoli, quanti = 3): MeglioPeggio {
  const aperti = titoli.filter((t) => t.stato === 'aperto')
  const conNumero = aperti
    .map((conto) => ({ conto, numero: misura === 'acquisto' ? conto.dallAcquisto : conto.ultimoMese }))
    .filter((x) => x.numero.n !== null)
    .sort((a, b) => b.numero.n! - a.numero.n! || a.conto.nomeCorto.localeCompare(b.conto.nomeCorto, 'it'))
  const k = Math.min(quanti, Math.ceil(conNumero.length / 2))
  const resto = conNumero.slice(k)
  return {
    meglio: conNumero.slice(0, k),
    peggio: resto.slice(-Math.min(quanti, resto.length)).reverse(),
    senzaNumero: aperti.filter((t) => !conNumero.some((x) => x.conto === t)),
  }
}

/** "A settembre": il nome del bottone dell'ultimo mese. */
export function nomeUltimoMese(fine: string): string {
  return `A ${nomeMese(fine)}`
}
