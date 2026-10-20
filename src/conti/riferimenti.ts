// Il confronto con i riferimenti, per la classifica "Fai meglio dei riferimenti?" della pagina Portafoglio
// (ticket 10; mappa 05, 03 e 28):
// - gli stessi euro, nelle stesse date: ogni acquisto diventa un acquisto del riferimento quel giorno, ogni vendita
//   una vendita. Il valore di un riferimento in un giorno è quello del file (ticket 9), alla data di regolamento
//   del movimento; i riferimenti in dollari si portano in euro con il cambio BCE dello stesso giorno;
// - l'inflazione: gli stessi euro fatti crescere con il NIC di ISTAT, dal mese del movimento al mese del confronto;
//   se il NIC dell'ultimo mese non c'è ancora, il confronto arriva al mese prima e lo dice ("fino ad agosto");
// - il portafoglio nel confronto vale i titoli più i dividendi incassati, perché i riferimenti hanno i dividendi reinvestiti;
// - per ognuno: valore di oggi, anno in corso (senza i soldi nuovi), dall'inizio (÷ soldi investiti), medio annuo (XIRR).
// Ogni riga esce con il suo "Da dove viene". Modulo puro: niente React, niente file.
import { fineMese, meseDi, meseDopo, nomeMese as nomeDelMese } from '../dati/aggiorna/calendario.ts'
import { DESCRIZIONE, finoAl, FONTE_NIC, FONTE_RIFERIMENTO, nicAgganciato, quandoEsceNic, RACCORDO_2015_2025 } from '../dati/aggiorna/riferimenti.ts'
import { CONFRONTI, type IdConfronto } from '../dati/correzione-riferimento.ts'
import type { FileDati, ValoreRiferimento } from '../dati/tipi.ts'
import { data as dataIt, euro as euroTesto, numero, percentuale as pct } from '../formato.ts'
import { contiDelPortafoglio, type ContiPortafoglio } from './portafoglio.ts'
import { euro, percentuale, riga, testo, type Cifra, type RigaConto, type Spiegazione } from './spiegazione.ts'
import { ANNI_MINIMI_MEDIO, senzaSoldiNuovi } from './titoli.ts'
import { anniTra, xirr } from './xirr.ts'

export type MisuraConfronto = 'medio' | 'anno' | 'inizio'

export type RigaConfronto = {
  id: IdConfronto | 'portafoglio'
  /** Il nome nella classifica: "S&P 500", "Inflazione", "Il tuo portafoglio". */
  nome: string
  /** Il giorno a cui arriva il confronto: il fine mese, o prima per l'inflazione senza l'ultimo NIC. */
  fino: string | null
  /** "fino ad agosto" quando l'inflazione si ferma al mese prima; null altrimenti. */
  finoA: string | null
  /** Valore di oggi in euro (per il portafoglio: titoli più dividendi incassati). */
  valore: number | null
  /** Anno in corso, dall'inizio e medio annuo, come frazioni (0,1 = +10,0%). */
  anno: number | null
  inizio: number | null
  medio: number | null
  /** Perché non ci sono i numeri, in una frase (es. mancano dei valori nel file); null se ci sono. */
  manca: string | null
  /** Almeno un valore usato nel conto è scritto a mano: la riga porta la matita. */
  aMano: boolean
  /** Il "Da dove viene" della riga. */
  perche: Spiegazione
}

export type Confronto = {
  /** Il fine mese del confronto, quello dei prezzi dei titoli. */
  fine: string
  /** L'anno in corso, "2026". */
  anno: string
  portafoglio: RigaConfronto
  /** I sette riferimenti, nell'ordine di sempre (BTP 10 anni … S&P 500, inflazione). */
  riferimenti: RigaConfronto[]
}

const somma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const NOME_INFLAZIONE = 'Inflazione'

/** Il valore di un riferimento in un giorno: in euro, e come si scrive nel conto. */
type Quotazione = { euro: number; cifra: Cifra; dettaglio?: string; nota?: string; aMano: boolean }

/** Un movimento del portafoglio visto dal riferimento: + soldi messi (acquisto), − soldi tolti (vendita). */
type Movimento = { data: string; importo: number; tipo: 'acquisto' | 'vendita'; quale: string }

/** 146,10 €, oppure 15.112,64 € con il dettaglio "17.160,41 USD ÷ 1,1355" */
function scriviValore(v: ValoreRiferimento): Quotazione {
  const aMano = v.fonte === FONTE_RIFERIMENTO.aMano
  if (v.valuta === 'EUR') return { euro: v.valore, cifra: euro(v.valore), nota: v.nota, aMano }
  const e = v.valore / (v.cambio ?? NaN)
  return { euro: e, cifra: euro(e), dettaglio: `${numero(v.valore, 2)} ${v.valuta} ÷ ${numero(v.cambio ?? 0, 4, 5)}`, nota: v.nota, aMano }
}

/** Come leggere il riferimento in un giorno, e cosa manca. */
type Lettore = {
  leggi: (data: string) => Quotazione | null
  /** Come si dice che manca il valore di quel giorno: "del 24/12/2024", "di settembre 2026". */
  mancaDi: (data: string) => string
  /** La chiave di cosa manca, per non ripeterla: il giorno, o il mese per il NIC. */
  chiave: (data: string) => string
  /** La prima riga del conto: "S&P 500 a fine settembre 2026", "NIC di settembre 2026 (base 2025 = 100)". */
  allaFine: (data: string) => string
}

function lettoreRiferimento(dati: FileDati, id: Exclude<IdConfronto, 'nic'>): Lettore {
  const valori = new Map((dati.riferimenti ?? []).filter((v) => v.riferimento === id).map((v) => [v.data, v]))
  return {
    leggi: (d) => {
      const v = valori.get(d)
      if (!v) return null
      const q = scriviValore(v)
      return Number.isFinite(q.euro) && q.euro > 0 ? q : null
    },
    mancaDi: (d) => (d === fineMese(meseDi(d)) ? `di fine ${nomeDelMese(meseDi(d))} ${d.slice(0, 4)}` : `del ${dataIt(d)}`),
    chiave: (d) => d,
    allaFine: (d) => `${DESCRIZIONE[id].nome} a fine ${nomeDelMese(meseDi(d))} ${d.slice(0, 4)}`,
  }
}

function lettoreNic(dati: FileDati): Lettore {
  const nic = nicAgganciato(dati.nic ?? [])
  const aMano = new Set((dati.nic ?? []).filter((n) => n.fonte === FONTE_NIC.aMano).map((n) => meseDi(n.data)))
  return {
    leggi: (d) => {
      const v = nic.get(meseDi(d))
      return v === undefined ? null : { euro: v, cifra: testo(numero(v, 2)), aMano: aMano.has(meseDi(d)) }
    },
    mancaDi: (d) => `di ${nomeDelMese(meseDi(d))} ${d.slice(0, 4)}`,
    chiave: (d) => meseDi(d),
    allaFine: (d) => `NIC di ${nomeDelMese(meseDi(d))} ${d.slice(0, 4)} (base 2025 = 100)`,
  }
}

type Esito =
  | { ok: true; valore: number; investiti: number; anno: number | null; inizio: number | null; medio: number | null; motivi: string[]; passi: RigaConto[]; note: string[]; aMano: boolean }
  | { ok: false; mancano: string[] }

/**
 * Gli stessi euro sul riferimento: ogni movimento cresce (o cala) quanto il riferimento dal suo giorno a "fino".
 * valore = Σ soldi messi × valore a fine ÷ valore di quel giorno (le vendite tolgono nello stesso modo).
 */
function stessiEuro(mov: Movimento[], fino: string, d0: string, l: Lettore): Esito {
  const qui = mov.filter((m) => m.data <= fino)
  const servono = [...qui.map((m) => m.data), fino]
  const mancano = [...new Map(servono.filter((d) => !l.leggi(d)).map((d) => [l.chiave(d), l.mancaDi(d)])).values()]
  if (mancano.length || !qui.length) return { ok: false, mancano }
  const pf = l.leggi(fino)!
  const passi: RigaConto[] = []
  const note = new Set<string>()
  let valore = 0
  for (const m of qui) {
    const q = l.leggi(m.data)!
    const v = (m.importo * pf.euro) / q.euro
    valore += v
    passi.push(riga(`${dataIt(m.data)}: ${m.quale} ${euroTesto(Math.abs(m.importo), 2)} × ${numero(pf.euro, 2)} ÷ ${numero(q.euro, 2)}`, euro(v)))
    if (q.nota) note.add(q.nota.charAt(0).toUpperCase() + q.nota.slice(1) + '.')
    if (q.aMano) note.add(`Il valore del ${dataIt(m.data)} è scritto a mano.`)
  }
  const investiti = somma(qui.map((m) => m.importo))
  const motivi: string[] = []

  // dall'inizio
  const inizio = investiti > 1e-9 ? (valore - investiti) / investiti : null
  if (inizio === null) motivi.push("Dall'inizio non c'è: i soldi tolti sono almeno quanti quelli messi.")

  // medio annuo
  const primo = qui.find((m) => m.tipo === 'acquisto')?.data ?? qui[0].data
  let medio: number | null = null
  if (anniTra(primo, fino) < ANNI_MINIMI_MEDIO) motivi.push('Il medio annuo non c’è: su meno di sei mesi direbbe poco.')
  else {
    medio = xirr([...qui.map((m) => ({ data: m.data, importo: -m.importo })), { data: fino, importo: valore }])
    if (medio === null) motivi.push('Il medio annuo non c’è: con questi movimenti non si trova un tasso che torni.')
  }

  // anno in corso: dal 31/12 dell'anno prima, senza i soldi nuovi
  let anno: number | null = null
  const prima = qui.filter((m) => m.data <= d0)
  const p0 = prima.length ? l.leggi(d0) : null
  if (fino <= d0) motivi.push("L'anno non c'è ancora.")
  else if (prima.length && !p0) motivi.push(`L'anno non c'è: manca il valore ${l.mancaDi(d0)}.`)
  else {
    const v0 = p0 ? somma(prima.map((m) => (m.importo * p0.euro) / l.leggi(m.data)!.euro)) : 0
    const flussi = qui.filter((m) => m.data > d0).map((m) => ({ data: m.data, importo: m.importo }))
    anno = senzaSoldiNuovi(d0, fino, { v0, v1: valore, flussi, dividendi: 0 }).r
  }

  const righe: RigaConto[] = [riga(`${l.allaFine(fino)}${pf.dettaglio ? `: ${pf.dettaglio}` : ''}`, pf.cifra), ...passi]
  righe.push(riga(`Valore a fine ${nomeDelMese(meseDi(fino))}`, euro(valore)))
  if (pf.aMano) note.add(`Il valore di fine ${nomeDelMese(meseDi(fino))} è scritto a mano.`)
  const aMano = pf.aMano || qui.some((m) => l.leggi(m.data)!.aMano) || (p0?.aMano ?? false)
  return { ok: true, valore, investiti, anno, inizio, medio, motivi, passi: righe, note: [...note], aMano }
}

const cifraPct = (n: number | null) => (n === null ? testo('—') : percentuale(n))

/** Le cinque righe dei numeri: soldi investiti, valore, anno, dall'inizio, medio annuo. */
function quattroNumeri(anno: string, fino: string, investiti: number, valore: number, a: number | null, i: number | null, m: number | null, valoreNome = `Valore a fine ${nomeDelMese(meseDi(fino))}`): RigaConto[] {
  return [
    riga('Soldi investiti (messi − tolti)', euro(investiti)),
    riga(valoreNome, euro(valore)),
    riga(`Anno ${anno}`, cifraPct(a)),
    riga("Dall'inizio", cifraPct(i)),
    riga('Medio annuo', cifraPct(m)),
  ]
}

export function confrontoConIRiferimenti(dati: FileDati, conti: ContiPortafoglio): Confronto | null {
  const fine = conti.fine
  if (!fine || !conti.anno) return null
  const annoS = conti.anno
  const d0 = `${Number(annoS) - 1}-12-31`
  const meseFine = nomeDelMese(meseDi(fine))
  const nomi = new Map(conti.titoli.titoli.map((t) => [t.id, t.nomeCorto]))
  // Gli stessi movimenti dei conti del portafoglio: acquisti e vendite fino all'ultimo fine mese.
  const mov: Movimento[] = (dati.operazioni ?? [])
    .filter((o) => nomi.has(o.titolo) && o.data <= fine)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    .map((o) => ({ data: o.data, importo: o.tipo === 'acquisto' ? o.totale : -o.totale, tipo: o.tipo, quale: o.tipo === 'acquisto' ? `messi (${nomi.get(o.titolo)})` : `tolti (${nomi.get(o.titolo)})` }))

  // ---------- il portafoglio ----------
  const valoreTu = (conti.valore.n ?? 0) + (conti.dividendi.n ?? 0)
  const investitiTu = conti.investiti.n ?? 0
  const portafoglio: RigaConfronto = {
    id: 'portafoglio',
    nome: 'Il tuo portafoglio',
    fino: fine,
    finoA: null,
    valore: valoreTu,
    anno: conti.annoInCorso.n,
    inizio: conti.dallInizio.n,
    medio: conti.medioAnnuo.n,
    manca: null,
    aMano: false,
    perche: {
      titolo: 'Il tuo portafoglio nel confronto',
      grande: euro(valoreTu),
      dopo: `a fine ${meseFine}`,
      frase:
        'Nel confronto il portafoglio vale i titoli più i dividendi incassati, perché i riferimenti hanno i dividendi reinvestiti: così il confronto è alla pari.',
      conto: quattroNumeri(annoS, fine, investitiTu, valoreTu, conti.annoInCorso.n, conti.dallInizio.n, conti.medioAnnuo.n, 'Valore nel confronto'),
      passi: {
        titolo: 'Il valore nel confronto',
        righe: [
          riga(`Valore dei titoli a fine ${meseFine}`, euro(conti.valore.n ?? 0)),
          riga('+ dividendi netti incassati', euro(conti.dividendi.n ?? 0)),
          riga('Valore nel confronto', euro(valoreTu)),
        ],
      },
      note: [
        'Anno, dall’inizio e medio annuo sono quelli del riquadro “Quanto stai guadagnando”: lì ogni numero ha il suo conto.',
        'I riferimenti partono dagli stessi soldi, negli stessi giorni.',
      ],
    },
  }
  const fraseTu = `Il tuo portafoglio, con gli stessi soldi: ${euroTesto(valoreTu)} (titoli più dividendi)${conti.medioAnnuo.n !== null ? `, ${pct(conti.medioAnnuo.n)} all’anno` : ''}.`

  // ---------- i sette riferimenti ----------
  const riferimenti = CONFRONTI.map((id): RigaConfronto => {
    const nic = id === 'nic'
    const nome = nic ? NOME_INFLAZIONE : DESCRIZIONE[id].nome
    const lettore = nic ? lettoreNic(dati) : lettoreRiferimento(dati, id)
    // L'inflazione arriva all'ultimo mese che ha il NIC, se quello del confronto non c'è ancora.
    let fino = fine
    let finoA: string | null = null
    const noteFino: string[] = []
    if (nic) {
      const mesi = [...nicAgganciato(dati.nic ?? []).keys()].filter((m) => m <= meseDi(fine)).sort()
      const ultimo = mesi.at(-1)
      if (ultimo && ultimo < meseDi(fine)) {
        fino = fineMese(ultimo)
        finoA = finoAl(ultimo)
        const mancanti = []
        for (let m = meseDopo(ultimo); m <= meseDi(fine); m = meseDopo(m)) mancanti.push(nomeDelMese(m))
        noteFino.push(
          `Il NIC di ${mancanti.join(' e ')} non c’è ancora${mancanti.length === 1 ? ` (ISTAT lo pubblica ${quandoEsceNic(meseDi(fine))})` : ''}: il confronto con l’inflazione arriva ${finoA} e si completa al prossimo aggiornamento.`,
        )
        const dopo = mov.filter((m) => m.data > fino).length
        if (dopo) noteFino.push(`${dopo === 1 ? 'Il movimento' : `I ${dopo} movimenti`} dopo il ${dataIt(fino)} ${dopo === 1 ? 'entra' : 'entrano'} quando arriva il NIC.`)
      }
    }
    const meseFino = nomeDelMese(meseDi(fino))
    const rif = { id, data: fine }
    const titolo = `${nome}: gli stessi euro`
    const esito = stessiEuro(mov, fino, d0, lettore)

    if (!esito.ok) {
      const vuoto = nic ? !(dati.nic ?? []).length : !(dati.riferimenti ?? []).some((v) => v.riferimento === id)
      const manca = !esito.mancano.length
        ? `Non ci sono ancora acquisti da confrontare${nic && finoA ? ` ${finoA}` : ''}.`
        : vuoto
          ? `Nel file non ci sono ancora i valori ${nic ? 'del NIC' : `di ${nome}`}: arrivano con Aggiorna fine mese.`
          : `Nel file manca ${esito.mancano.length === 1 ? 'il valore' : 'qualche valore'} ${nic ? 'del NIC' : `di ${nome}`}: ${esito.mancano.slice(0, 4).join(', ')}${esito.mancano.length > 4 ? '…' : ''}.`
      return {
        id,
        nome,
        fino,
        finoA,
        valore: null,
        anno: null,
        inizio: null,
        medio: null,
        manca,
        aMano: false,
        perche: {
          titolo,
          grande: testo('manca'),
          frase: manca,
          conto: [],
          note: esito.mancano.length
            ? [
                `“Scarica di nuovo” chiede ${nic ? 'a ISTAT' : 'a investing.com'} i valori che mancano; se non risponde, il prossimo Aggiorna fine mese li riprende da solo.`,
              ]
            : [],
          riferimento: rif,
        },
      }
    }

    const cosa = nic ? '' : DESCRIZIONE[id].cosa
    const fonte = nic
      ? `Fonte: ISTAT, indice NIC generale, un valore per mese: ogni movimento usa il NIC del suo mese. I mesi fino a dicembre 2025 sono in base 2015 e si portano in base 2025 dividendo per ${numero(RACCORDO_2015_2025, 5)}.`
      : `Fonte: investing.com, ${cosa}: la chiusura del giorno del movimento (la data di regolamento, come nei conti del portafoglio) e quella di fine mese${DESCRIZIONE[id].valuta === 'USD' ? ', in euro con il cambio BCE dello stesso giorno' : ''}.`
    return {
      id,
      nome,
      fino,
      finoA,
      valore: esito.valore,
      anno: esito.anno,
      inizio: esito.inizio,
      medio: esito.medio,
      manca: null,
      aMano: esito.aMano,
      perche: {
        titolo,
        grande: euro(esito.valore),
        dopo: `a fine ${meseFino}`,
        frase: nic
          ? `Se i soldi che hai messo e tolto tu, negli stessi giorni, fossero cresciuti solo quanto i prezzi (inflazione NIC di ISTAT), a fine ${meseFino} varrebbero così: è quanto dovrebbero valere per non perdere potere d’acquisto.`
          : `Se i soldi che hai messo e tolto tu, negli stessi giorni, fossero andati su ${nome} (${cosa}${DESCRIZIONE[id].valuta === 'USD' ? ', portato in euro' : ''}), a fine ${meseFino} varrebbero così.`,
        conto: quattroNumeri(annoS, fino, esito.investiti, esito.valore, esito.anno, esito.inizio, esito.medio),
        passi: {
          titolo: 'Il conto, movimento per movimento',
          righe: esito.passi,
        },
        note: [
          nic
            ? `Ogni movimento cresce quanto i prezzi dal suo mese ${finoAl(meseDi(fino)).replace(/^fino /, '')}: soldi × NIC di ${meseFino} ÷ NIC del mese del movimento. Le vendite tolgono soldi nello stesso modo.`
            : `Ogni movimento cresce (o cala) quanto ${nome} dal suo giorno a fine ${meseFino}: soldi × valore a fine mese ÷ valore di quel giorno. Le vendite tolgono soldi nello stesso modo.`,
          ...noteFino,
          ...esito.motivi,
          fonte,
          ...esito.note,
          fraseTu,
        ],
        riferimento: rif,
      },
    }
  })

  return { fine, anno: annoS, portafoglio, riferimenti }
}

// ---------- la classifica ----------

const numeroDi = (r: RigaConfronto, m: MisuraConfronto) => (m === 'medio' ? r.medio : m === 'anno' ? r.anno : r.inizio)

export type Classifica = {
  /** Il portafoglio e i riferimenti, dal migliore al peggiore; in fondo quelli senza il numero. */
  righe: { riga: RigaConfronto; n: number | null }[]
  /** Quanti riferimenti fai meglio, o null se il numero del portafoglio non c'è. */
  batti: number | null
  /** Su quanti riferimenti che hanno il numero. */
  su: number
  /** I nomi dei riferimenti senza il numero. */
  senza: string[]
  /** Il valore più alto, per la lunghezza delle barre (almeno un po' più di zero). */
  massimo: number
}

export function classifica(c: Confronto, misura: MisuraConfronto): Classifica {
  const tutte = [c.portafoglio, ...c.riferimenti].map((riga) => ({ riga, n: numeroDi(riga, misura) }))
  const con = tutte.filter((x) => x.n !== null).sort((a, b) => b.n! - a.n! || (a.riga.id === 'portafoglio' ? -1 : b.riga.id === 'portafoglio' ? 1 : 0))
  const senza = tutte.filter((x) => x.n === null)
  const tu = numeroDi(c.portafoglio, misura)
  const rif = c.riferimenti.map((r) => numeroDi(r, misura))
  return {
    righe: [...con, ...senza],
    batti: tu === null ? null : rif.filter((n) => n !== null && tu > n).length,
    su: rif.filter((n) => n !== null).length,
    senza: senza.filter((x) => x.riga.id !== 'portafoglio').map((x) => x.riga.nome),
    massimo: Math.max(1e-9, ...con.map((x) => x.n!)),
  }
}

/** La lunghezza della barra, in % del binario: parte sempre da zero, e un valore zero o negativo ha solo un segno minimo. */
export function lunghezzaBarra(n: number | null, massimo: number): number {
  if (n === null || n <= 0) return 1
  return Math.max(1, Math.min(100, (n / massimo) * 100))
}

/** Il nome del bottone della misura: "All'anno in media", "Anno 2026", "Dall'inizio". */
export function nomeMisura(m: MisuraConfronto, anno: string): string {
  return m === 'medio' ? 'All’anno in media' : m === 'anno' ? `Anno ${anno}` : 'Dall’inizio'
}

/** Rifà il "Da dove viene" di una riga sui dati di adesso (dopo una correzione o "Scarica di nuovo"). */
export function rigaDelConfronto(c: Confronto | null, id: IdConfronto | 'portafoglio'): RigaConfronto | null {
  if (!c) return null
  return id === 'portafoglio' ? c.portafoglio : (c.riferimenti.find((r) => r.id === id) ?? null)
}

/**
 * Il "Da dove viene" di una riga del confronto rifatto sui dati di adesso: serve al pannello dopo una correzione
 * o "Scarica di nuovo", per mostrare subito i numeri nuovi. null se non si può rifare.
 */
export function spiegazioneDelConfronto(dati: FileDati, s: Spiegazione): Spiegazione | null {
  if (!s.riferimento) return null
  const c = confrontoConIRiferimenti(dati, contiDelPortafoglio(dati))
  return rigaDelConfronto(c, s.riferimento.id)?.perche ?? null
}
