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
import { ANNI_MINIMI_MEDIO, contiDeiTitoli, senzaSoldiNuovi, type ContiTitoli, type ContoTitolo } from './titoli.ts'
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
    const vuoto = (t: string) => manca(t, 'Nel file non ci sono ancora prezzi di fine mese: i numeri arrivano con il primo aggiornamento.')
    return {
      fine: null,
      anno: null,
      valore: vuoto('Valore dei titoli'),
      investiti: vuoto('Soldi investiti'),
      guadagno: vuoto('Quanto stai guadagnando'),
      dallInizio: vuoto("Guadagno dall'inizio"),
      medioAnnuo: vuoto('Medio annuo'),
      mese: vuoto('Il mese'),
      annoInCorso: vuoto("L'anno"),
      dividendi: vuoto('Dividendi incassati'),
      serie: [],
      titoli,
    }
  }

  const quandoFine = fineDi(fine)
  const notaDopo = dopo
    ? [
        dopo === 1
          ? `Un movimento dopo il ${data(fine)} entra nei conti con il prossimo aggiornamento di fine mese.`
          : `${dopo} movimenti dopo il ${data(fine)} entrano nei conti con il prossimo aggiornamento di fine mese.`,
      ]
    : []

  // ---------- soldi investiti ----------
  const investiti: Numero = {
    n: investitiN,
    perche: {
      titolo: 'Soldi investiti',
      grande: euro(investitiN),
      frase: 'I soldi tuoi che restano dentro il portafoglio: quello che hai pagato per comprare, commissioni comprese, meno quello che hai incassato vendendo.',
      conto: [
        riga(`Pagato per comprare (${quanti(acquisti.length, 'acquisto', 'acquisti')})`, euro(pagatoN)),
        ...(vendite.length ? [riga(`− incassato vendendo (${quanti(vendite.length, 'vendita', 'vendite')})`, euro(incassatoN))] : []),
        riga('Soldi investiti', euro(investitiN)),
      ],
      note: ['I dividendi non entrano qui: sono guadagno.', ...notaDopo],
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
            titolo: "Guadagno dall'inizio",
            grande: percentuale(g / investitiN),
            frase: 'Il guadagno diviso i soldi investiti.',
            conto: [riga('Guadagno', guadagno(g)), riga('÷ soldi investiti (pagato − incassato)', euro(investitiN)), riga("Dall'inizio", percentuale(g / investitiN))],
            note: ['Con grandi vendite in guadagno questa percentuale si gonfia, perché i soldi investiti scendono: il medio annuo resta giusto.'],
          },
        }
      : manca("Guadagno dall'inizio", 'I soldi investiti non sono più di zero: hai incassato vendendo almeno quanto avevi pagato. Guarda il guadagno in euro.')

  // ---------- medio annuo ----------
  const primo = acquisti[0]?.data ?? null
  const anni = primo ? anniTra(primo, fine) : null
  let medioAnnuo: Numero
  if (!primo || anni === null) medioAnnuo = manca('Medio annuo', 'Non ci sono ancora acquisti prima dell’ultimo fine mese.')
  else if (anni < ANNI_MINIMI_MEDIO)
    medioAnnuo = manca(
      'Medio annuo',
      `Il primo acquisto è del ${data(primo)}: su meno di sei mesi un medio annuo direbbe poco. Guarda il guadagno dall'inizio${dallInizio.n === null ? '' : `: ${pct(dallInizio.n)}`}.`,
    )
  else {
    const flussi = [
      ...ops.map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? -o.totale : o.totale, cosa: `${o.tipo} di ${nomeDi(o.titolo)}` })),
      ...divs.map((d) => ({ data: d.data, importo: d.netto, cosa: `dividendo di ${nomeDi(d.titolo)}` })),
    ].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    const r = xirr([...flussi, { data: fine, importo: valoreN }])
    medioAnnuo =
      r === null
        ? manca('Medio annuo', 'Con questi movimenti non si trova un tasso che torni.')
        : {
            n: r,
            perche: {
              titolo: 'Medio annuo del portafoglio',
              grande: percentuale(r),
              dopo: "all'anno",
              frase:
                'La percentuale che, ripetuta ogni anno, dà il tuo guadagno, tenendo conto di quando è entrato e uscito ogni euro: come nei rendiconti delle banche.',
              conto: [
                ...flussi.map((f) => riga(`${data(f.data)}: ${f.cosa}`, euro(f.importo))),
                riga(`Valore dei titoli a ${quandoFine}`, euro(valoreN)),
                riga('Medio annuo', percentuale(r)),
              ],
              note: [
                `Dal primo acquisto (${data(primo)}) sono passati ${numero(anni, 1)} anni, ma non tutti i soldi sono entrati quel giorno: ogni euro conta per il tempo in cui è rimasto investito.`,
                'I soldi messi sono negativi; quelli ricevuti (vendite e dividendi) e il valore di oggi sono positivi.',
              ],
            },
          }
  }

  const guadagnoTot: Numero = {
    n: g,
    perche: {
      titolo: 'Quanto stai guadagnando',
      grande: guadagno(g),
      frase: 'Il guadagno di tutti i titoli, compresi quelli già venduti: il valore di oggi, più quello che hai incassato vendendo e i dividendi, meno quello che hai pagato.',
      conto: [
        riga(`Valore dei titoli a ${quandoFine}`, euro(valoreN)),
        ...(incassatoN ? [riga('+ incassato vendendo', euro(incassatoN))] : []),
        ...(dividendiN ? [riga('+ dividendi netti', euro(dividendiN))] : []),
        riga('− pagato per comprare', euro(pagatoN)),
        riga('Guadagno', guadagno(g)),
      ],
      note: [
        ...(dallInizio.n !== null ? [`Diviso i soldi investiti (${euroTesto(investitiN, 2)}) fa ${pct(dallInizio.n)} dall'inizio.`] : []),
        ...(medioAnnuo.n !== null
          ? [`Tenendo conto di quando è entrato ogni euro è ${pct(medioAnnuo.n)} all'anno in media: clic sul numero per il conto.`]
          : []),
        chiusi.length ? `Comprende i titoli già venduti (${elenco(chiusi)}).` : 'Non hai titoli venduti.',
        'È prima delle tasse sulla vendita. Le commissioni sono nel pagato.',
        ...notaDopo,
      ],
    },
  }

  // ---------- l'anno in corso ----------
  const annoS = fine.slice(0, 4)
  const d0 = `${Number(annoS) - 1}-12-31`
  const titoloAnno = `L'anno ${annoS}`
  let annoInCorso: Numero
  const v0Mese = titoli.totaliDelMese.get(d0)?.valore.n
  const primaDellAnno = ops.some((o) => o.data <= d0)
  if (v0Mese === undefined && primaDellAnno)
    annoInCorso = manca(titoloAnno, `Nel file manca il valore dei titoli al ${data(d0)}, da cui si misura l'anno.`)
  else {
    const v0 = v0Mese ?? 0
    const flussi = ops.filter((o) => o.data > d0).map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? o.totale : -o.totale, o }))
    const divAnno = somma(divs.filter((d) => d.data > d0).map((d) => d.netto))
    const { r, guadagno: gA, base, netti } = senzaSoldiNuovi(d0, fine, { v0, v1: valoreN, flussi, dividendi: divAnno })
    const lungo = anniTra(d0, fine)
    const conto: RigaConto[] = [riga(`Valore a ${quandoFine}`, euro(valoreN)), riga(`− valore al ${data(d0)}`, euro(v0))]
    if (netti > QUASI_ZERO) conto.push(riga(`− soldi messi nel ${annoS}`, euro(netti)))
    if (netti < -QUASI_ZERO) conto.push(riga(`+ soldi tolti nel ${annoS} (vendite)`, euro(-netti)))
    if (divAnno > 0) conto.push(riga(`+ dividendi netti del ${annoS}`, euro(divAnno)))
    conto.push(riga("= guadagno dell'anno", guadagno(gA)))
    conto.push(riga(flussi.length ? `÷ valore al ${data(d0)}, con i soldi dell'anno pesati per i giorni` : `÷ valore al ${data(d0)}`, euro(base)))
    if (r !== null) conto.push(riga(`Anno ${annoS}`, percentuale(r)))
    annoInCorso = {
      n: r,
      perche: {
        titolo: titoloAnno,
        grande: r === null ? testo('—') : percentuale(r),
        frase: `Di quanto è cresciuto il valore dal ${data(d0)} a ${quandoFine}, senza contare come guadagno i soldi messi o tolti nell'anno.`,
        conto,
        note: [
          ...flussi.map(
            (f) =>
              `${data(f.data)}: ${f.o.tipo} di ${nomeDi(f.o.titolo)} (${euroTesto(f.o.totale, 2)}). ${f.o.tipo === 'acquisto' ? 'Conta solo da quando è entrato' : 'Esce dal conto da quel giorno'}: ${numero(lungo > 0 ? (anniTra(f.data, fine) / lungo) * 100 : 0, 0)}% del periodo.`,
          ),
          v0 === 0 ? `Il portafoglio è cominciato nel ${annoS}: si misura dal prezzo d'acquisto.` : "Un titolo comprato nell'anno si misura dal prezzo d'acquisto.",
          'I soldi messi durante l’anno non sono guadagno.',
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
      titolo: 'Dividendi incassati',
      grande: euro(dividendiN),
      frase: divs.length
        ? 'I dividendi netti di tutti i titoli, dal primo: quello che è arrivato sul conto dopo le imposte.'
        : 'Non hai ancora incassato dividendi: i titoli ad accumulazione li reinvestono nel prezzo.',
      conto: divs.length ? [...conDividendi.map((t) => riga(t.nomeCorto, euro(t.dividendi.n ?? 0))), riga('Totale', euro(dividendiN))] : [],
      note: [
        ...(divs.length ? ['Entrano nel guadagno. Le cedole delle obbligazioni sono contate qui.'] : []),
        ...(divDopo ? [`${divDopo === 1 ? 'Un dividendo arrivato' : `${divDopo} dividendi arrivati`} dopo il ${data(fine)} ${divDopo === 1 ? 'entra' : 'entrano'} con il prossimo aggiornamento.`] : []),
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
