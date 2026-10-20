// I sette fogli di "Scarica in Excel" (ticket 14, mappa 27, come l'esempio della bozza 27):
// Leggimi, Titoli, Operazioni, Dividendi, Prezzi di fine mese, Valore mese per mese, Inflazione e riferimenti.
// I numeri vengono dai conti che usano già le pagine (titoli, portafoglio, pagina Dati): qui non si rifà
// nessun conto, si mettono solo in righe. Numeri come numeri, date come date, niente formule.
// Modulo puro: il file lo scrive il processo principale (electron/excel.ts).
import { confronta } from '../dati/aggiorna/controllo-prezzo.ts'
import { eUfficiale, FONTE } from '../dati/aggiorna/fonti.ts'
import { DESCRIZIONE } from '../dati/aggiorna/riferimenti.ts'
import { aVersione3 } from '../dati/aggiorna/versione3.ts'
import type { Cella, Colonna, Foglio, FoglioLeggimi, FoglioTabella, LibroExcel, RigaLeggimi } from '../dati/excel.ts'
import { RIFERIMENTI, type FileDati, type PrezzoFineMese } from '../dati/tipi.ts'
import { data as dataTesto, MENO, mese as meseTesto, numero } from '../formato.ts'
import { fonteInParole } from './fonti.ts'
import { righeDati, senzaRiferimenti, valuteDeiTitoli, type CellaDato } from './pagina-dati.ts'
import { contiDelPortafoglio } from './portafoglio.ts'
import { fonteMovimento } from './scheda.ts'
import { contiDeiTitoli, plusMinus, type ContoTitolo } from './titoli.ts'

export const NOMI_FOGLI = [
  'Leggimi',
  'Titoli',
  'Operazioni',
  'Dividendi',
  'Prezzi di fine mese',
  'Valore mese per mese',
  'Inflazione e riferimenti',
] as const

const giorno = (d: string | null | undefined): Cella => (d ? { data: d } : null)
/** Le righe di una tabella seguono le colonne: la cella della colonna "x" sta allo stesso posto. */
const tabella = (nome: string, colonne: Colonna[], righe: Cella[][], grassetto?: number[]): FoglioTabella => ({
  tipo: 'tabella',
  nome,
  colonne,
  righe,
  ...(grassetto ? { grassetto } : {}),
})

/** Il nome della fonte di un prezzo, come sotto il prezzo nelle pagine; per una stima anche il perché. */
function fonteScritta(p: PrezzoFineMese): string {
  if (p.fonte === FONTE.stima) {
    const perche = (p.nota ?? '').replace(/^stima:?\s*/i, '')
    return perche ? `stima: ${perche}` : 'stima'
  }
  const f = fonteInParole(p.fonte)
  return f.dettaglio ? `${f.nome}: ${f.dettaglio}` : f.nome
}

/** Il controllo di investing.com in parole: "stesso prezzo", "differenza di +0,6%: investing.com 50,33", oppure perché non c'è. */
function controlloScritto(p: PrezzoFineMese): string {
  const c = confronta(p.prezzo, p.controllo)
  if (!c) return ''
  if (c.tipo === 'non-fatto') return `non eseguito: ${c.perche}`
  const altro = c.nota ? ` (${c.nota})` : ''
  if (c.tipo === 'uguale') return `stesso prezzo${altro}`
  const segno = c.differenza > 0 ? '+' : c.differenza < 0 ? MENO : ''
  return `differenza di ${segno}${numero(c.differenza, 1)}%: investing.com ${numero(c.controllo, 2, 4)}${altro}`
}

/** Perché la fonte non è la borsa ufficiale (o cosa dice la borsa), come sotto il prezzo nella pagina Dati. */
function notaDelPrezzo(p: PrezzoFineMese): string {
  const conNota: string[] = [FONTE.investing, FONTE.yahoo, FONTE.xetraAltraBorsa]
  if (!p.nota || !(eUfficiale(p.fonte) || conNota.includes(p.fonte))) return ''
  return p.nota[0].toUpperCase() + p.nota.slice(1)
}

// ---------- i fogli ----------

function leggimi(dati: FileDati, oggi: string, conti: ReturnType<typeof contiDelPortafoglio>): FoglioLeggimi {
  const r = (celle: Cella[], altro: Omit<RigaLeggimi, 'celle'> = {}): RigaLeggimi => ({ celle, ...altro })
  const fine = conti.fine
  const vuoto = senzaRiferimenti(dati)
  const righe: RigaLeggimi[] = [
    r(['Portafoglio titoli: esportazione dei dati'], { stile: 'titolo' }),
    r([`Esportato il ${dataTesto(oggi)}. ${fine ? `Prezzi fino al ${dataTesto(fine)}.` : 'Nel file non ci sono ancora prezzi di fine mese.'}`]),
    r(['Il file è solo un’esportazione: le modifiche fatte qui non tornano nell’applicazione.']),
    r(['Valori numerici, senza formule. Importi in euro al cambio BCE di fine mese, al lordo delle imposte.']),
    r([]),
    r(['Foglio', 'Contenuto'], { stile: 'grassetto' }),
    r(['Titoli', 'Un titolo per riga, compresi quelli venduti, con i valori di fine mese calcolati dall’applicazione.']),
    r(['Operazioni', 'Acquisti e vendite in ordine di data. La data è la data valuta. Il totale è negativo per gli acquisti (uscite) e positivo per le vendite (entrate).']),
    r(['Dividendi', 'Lordo, imposte e netto accreditato, in ordine di data. Comprende le cedole delle obbligazioni.']),
    r(['Prezzi di fine mese', 'Un prezzo per riga: fine mese, titolo, prezzo nella valuta del titolo, cambio, quote, controvalore in euro, fonte, controllo di investing.com e indicazione dei prezzi inseriti manualmente.']),
    r(['Valore mese per mese', 'Il controvalore in euro di ogni titolo a ogni fine mese: titoli per riga, mesi per colonna. In fondo il totale e il capitale investito.']),
    r([
      'Inflazione e riferimenti',
      'Un mese per riga: l’inflazione NIC di ISTAT (con la sua base), i cambi BCE e i sei riferimenti con i dividendi reinvestiti, ognuno nella sua valuta. Una cella vuota indica un dato mancante.' +
        (vuoto ? ' Per ora il foglio è vuoto: i dati arrivano con il primo aggiornamento.' : ''),
    ]),
    r([]),
    r([fine ? `Il portafoglio a fine ${meseTesto(fine)}` : 'Il portafoglio a fine mese'], { stile: 'grassetto' }),
    r(['Controvalore', conti.valore.n], { formato: 'euro' }),
    r(['Capitale investito', conti.investiti.n], { formato: 'euro' }),
    r([conti.guadagno.n !== null ? plusMinus(conti.guadagno.n) : 'Plusvalenza', conti.guadagno.n], { formato: 'euro' }),
    r(['Rendimento dall’inizio', conti.dallInizio.n], { formato: 'percentuale' }),
    r(['Rendimento annualizzato', conti.medioAnnuo.n], { formato: 'percentuale' }),
    r([conti.anno ? `Rendimento da inizio anno (${conti.anno})` : 'Rendimento da inizio anno', conti.annoInCorso.n], { formato: 'percentuale' }),
    r(['Dividendi netti', conti.dividendi.n], { formato: 'euro' }),
  ]
  return { tipo: 'leggimi', nome: 'Leggimi', righe, larghezze: [26, 100] }
}

function titoli(conti: ContoTitolo[]): FoglioTabella {
  const colonne: Colonna[] = [
    { titolo: 'Simbolo' },
    { titolo: 'Descrizione', larghezza: 34 },
    { titolo: 'Nome', larghezza: 40 },
    { titolo: 'ISIN', larghezza: 15 },
    { titolo: 'Borsa' },
    { titolo: 'Valuta' },
    { titolo: 'Quote', formato: 'quote' },
    { titolo: 'Primo acquisto', formato: 'data' },
    { titolo: 'Venduto' },
    { titolo: 'Prezzo a fine mese', formato: 'prezzo' },
    { titolo: 'Cambio', formato: 'cambio' },
    { titolo: 'Fonte del prezzo', larghezza: 20 },
    { titolo: 'Controvalore', formato: 'euro' },
    { titolo: 'Costo', formato: 'euro' },
    { titolo: 'Ricavo delle vendite', formato: 'euro' },
    { titolo: 'Dividendi netti', formato: 'euro' },
    { titolo: 'Plus/minus', formato: 'euro' },
    { titolo: 'Rendimento', formato: 'percentuale' },
    { titolo: 'Annualizzato', formato: 'percentuale' },
  ]
  const righe = conti.map((c): Cella[] => {
    // Per un titolo venduto non c'è un prezzo a fine mese, come nell'esempio della bozza.
    const p = c.stato === 'chiuso' ? null : c.ultimoPrezzo
    return [
      c.nomeCorto,
      c.paroleSemplici ?? '',
      c.titolo.nome,
      c.titolo.isin,
      c.titolo.nomeBorsa,
      c.valuta,
      c.quote,
      giorno(c.primoAcquisto),
      c.stato === 'chiuso' ? 'sì' : '',
      p?.prezzo ?? null,
      p && p.valuta !== 'EUR' ? (p.cambio ?? null) : null,
      p ? fonteScritta(p) : '',
      c.valore.n,
      c.pagato.n,
      c.incassato.n,
      c.dividendi.n,
      c.guadagno.n,
      c.dallAcquisto.n,
      c.medioAnnuo.n,
    ]
  })
  return tabella('Titoli', colonne, righe)
}

function operazioni(dati: FileDati, nomi: Map<string, ContoTitolo>): FoglioTabella {
  const colonne: Colonna[] = [
    { titolo: 'Data', formato: 'data' },
    { titolo: 'Tipo' },
    { titolo: 'Simbolo' },
    { titolo: 'ISIN', larghezza: 15 },
    { titolo: 'Borsa' },
    { titolo: 'Quote', formato: 'quote' },
    { titolo: 'Prezzo', formato: 'prezzo' },
    { titolo: 'Valuta' },
    { titolo: 'Cambio', formato: 'cambio' },
    { titolo: 'Commissioni', formato: 'euro' },
    { titolo: 'Totale in euro', formato: 'euro' },
    { titolo: 'Fonte', larghezza: 18 },
    { titolo: 'Nota', larghezza: 50 },
  ]
  // Dal più vecchio; lo stesso giorno prima gli acquisti, come nei conti.
  const ops = (dati.operazioni ?? [])
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === b.tipo ? 0 : a.tipo === 'acquisto' ? -1 : 1))
  const righe = ops.map((o): Cella[] => {
    const c = nomi.get(o.titolo)
    const nota = [o.prima ? `corretta manualmente${o.quando ? ` il ${dataTesto(o.quando.slice(0, 10))}` : ''}` : '', o.nota ?? ''].filter(Boolean).join('; ')
    return [
      { data: o.data },
      o.tipo,
      c?.nomeCorto ?? o.titolo,
      c?.titolo.isin ?? '',
      c?.titolo.nomeBorsa ?? '',
      o.quantita,
      o.prezzo,
      o.valuta,
      o.cambio,
      o.commissioni,
      o.tipo === 'vendita' ? o.totale : -o.totale,
      fonteMovimento(o.fonte),
      nota,
    ]
  })
  return tabella('Operazioni', colonne, righe)
}

function dividendi(dati: FileDati, nomi: Map<string, ContoTitolo>): FoglioTabella {
  const colonne: Colonna[] = [
    { titolo: 'Data', formato: 'data' },
    { titolo: 'Simbolo' },
    { titolo: 'ISIN', larghezza: 15 },
    { titolo: 'Lordo', formato: 'euro' },
    { titolo: 'Imposte', formato: 'euro' },
    { titolo: 'Netto', formato: 'euro' },
    { titolo: 'Fonte', larghezza: 18 },
    { titolo: 'Nota', larghezza: 30 },
  ]
  const divs = (dati.dividendi ?? []).slice().sort((a, b) => a.data.localeCompare(b.data))
  const righe = divs.map((d): Cella[] => {
    const c = nomi.get(d.titolo)
    const nota = [d.prima ? `corretto manualmente${d.quando ? ` il ${dataTesto(d.quando.slice(0, 10))}` : ''}` : '', d.nota ?? ''].filter(Boolean).join('; ')
    return [{ data: d.data }, c?.nomeCorto ?? d.titolo, c?.titolo.isin ?? '', d.lordo, d.imposte, d.netto, fonteMovimento(d.fonte), nota]
  })
  return tabella('Dividendi', colonne, righe)
}

function prezzi(v3: FileDati, conti: ContoTitolo[]): FoglioTabella {
  const colonne: Colonna[] = [
    { titolo: 'Fine mese', formato: 'data', larghezza: 13 },
    { titolo: 'Simbolo' },
    { titolo: 'ISIN', larghezza: 15 },
    { titolo: 'Borsa' },
    { titolo: 'Prezzo', formato: 'prezzo' },
    { titolo: 'Valuta' },
    { titolo: 'Cambio', formato: 'cambio' },
    { titolo: 'Quote', formato: 'quote' },
    { titolo: 'Controvalore', formato: 'euro' },
    { titolo: 'Fonte', larghezza: 22 },
    { titolo: 'Nota', larghezza: 30 },
    { titolo: 'Controllo investing.com', larghezza: 24 },
    { titolo: 'Manuale' },
    { titolo: 'Prezzo precedente', formato: 'prezzo' },
  ]
  const perId = new Map(conti.map((c) => [c.id, c]))
  const righe = (v3.prezzi ?? [])
    .map((p) => {
      const c = perId.get(p.titolo)
      // Quote e valore di quel fine mese, dai conti del titolo (ci sono solo se a fine mese avevi il titolo).
      const m = c?.mesi.find((x) => x.mese === p.data && x.prezzo?.data === p.data)
      const riga: Cella[] = [
        { data: p.data },
        c?.nomeCorto ?? p.titolo,
        c?.titolo.isin ?? '',
        c?.titolo.nomeBorsa ?? '',
        p.prezzo,
        p.valuta,
        p.valuta !== 'EUR' ? (p.cambio ?? null) : null,
        m ? m.quote : null,
        m ? m.valore.n : null,
        fonteScritta(p),
        notaDelPrezzo(p),
        controlloScritto(p),
        p.fonte === FONTE.aMano ? 'sì' : '',
        p.prima?.prezzo ?? null,
      ]
      return { chiave: `${p.data}|${c?.nomeCorto ?? p.titolo}`, riga }
    })
    .sort((a, b) => a.chiave.localeCompare(b.chiave, 'it'))
    .map((x) => x.riga)
  return tabella('Prezzi di fine mese', colonne, righe)
}

function valoreMesePerMese(conti: ContoTitolo[], portafoglio: ReturnType<typeof contiDelPortafoglio>): FoglioTabella {
  const serie = portafoglio.serie
  const colonne: Colonna[] = [
    { titolo: 'Simbolo' },
    { titolo: 'Descrizione', larghezza: 34 },
    ...serie.map((s): Colonna => ({ titolo: meseTesto(s.mese), data: s.mese, formato: 'euroTondo', larghezza: 11 })),
  ]
  const righe: Cella[][] = conti.map((c) => {
    const perMese = new Map(c.mesi.map((m) => [m.mese, m.valore.n]))
    return [c.nomeCorto, c.paroleSemplici ?? '', ...serie.map((s) => perMese.get(s.mese) ?? null)]
  })
  righe.push(['Totale', '', ...serie.map((s) => s.valore.n)])
  righe.push(['Capitale investito', '', ...serie.map((s) => s.investiti)])
  return tabella('Valore mese per mese', colonne, righe, [righe.length - 2, righe.length - 1])
}

function inflazioneERiferimenti(v3: FileDati): FoglioTabella {
  const valute = valuteDeiTitoli(v3)
  const colonne: Colonna[] = [
    { titolo: 'Fine mese', formato: 'data', larghezza: 13 },
    { titolo: 'Inflazione NIC', formato: 'nic', larghezza: 16 },
    { titolo: 'Base NIC', larghezza: 14 },
    ...valute.map((v): Colonna => ({ titolo: `Cambio ${v}`, formato: 'cambio', larghezza: 13 })),
    ...RIFERIMENTI.map((id): Colonna => ({ titolo: `${DESCRIZIONE[id].nome} (${DESCRIZIONE[id].valuta})`, formato: 'valore', larghezza: 16 })),
    { titolo: 'Inseriti manualmente', larghezza: 24 },
  ]
  const numeroDi = (c: CellaDato): number | null => (c.tipo === 'dato' ? c.numero : null)
  const nic = new Map((v3.nic ?? []).map((n) => [n.data, n]))
  // Dal mese più vecchio, come gli altri fogli.
  const righe = righeDati(v3)
    .slice()
    .reverse()
    .map((r): Cella[] => {
      const aMano: string[] = []
      if (r.nic.tipo === 'dato' && r.nic.aMano) aMano.push('Inflazione NIC')
      r.cambi.forEach((c, i) => c.tipo === 'dato' && c.aMano && aMano.push(`Cambio ${valute[i]}`))
      r.riferimenti.forEach((c, i) => c.tipo === 'dato' && c.aMano && aMano.push(DESCRIZIONE[RIFERIMENTI[i]].nome))
      const base = nic.get(r.data)?.base
      return [
        { data: r.data },
        numeroDi(r.nic),
        r.nic.tipo === 'dato' && base ? `${base} = 100` : '',
        ...r.cambi.map(numeroDi),
        ...r.riferimenti.map(numeroDi),
        aMano.join(', '),
      ]
    })
  return tabella('Inflazione e riferimenti', colonne, righe)
}

/**
 * Il libro intero, sui dati di adesso. "oggi" è il giorno in cui si scarica (AAAA-MM-GG): va nel Leggimi
 * e nel nome del file. Titoli, Leggimi e Valore mese per mese usano gli stessi conti della pagina Titoli e
 * della pagina Portafoglio; prezzi, inflazione e riferimenti si leggono come nella pagina Dati (versione 3).
 */
export function libroExcel(dati: FileDati, oggi: string): LibroExcel {
  const contiT = contiDeiTitoli(dati)
  const portafoglio = contiDelPortafoglio(dati, contiT)
  const v3 = aVersione3(dati)
  const nomi = new Map(contiT.titoli.map((c) => [c.id, c]))
  const fogli: Foglio[] = [
    leggimi(dati, oggi, portafoglio),
    titoli(contiT.titoli),
    operazioni(dati, nomi),
    dividendi(dati, nomi),
    prezzi(v3, contiT.titoli),
    valoreMesePerMese(contiT.titoli, portafoglio),
    inflazioneERiferimenti(v3),
  ]
  return { oggi, fogli }
}
