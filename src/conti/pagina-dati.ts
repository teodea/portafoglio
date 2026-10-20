// I numeri della pagina Dati (ticket 13, mappa 27): da dove viene ogni prezzo di un fine mese, il conto
// delle fonti, e l'inflazione, i cambi e i riferimenti mese per mese con "manca" dove non ci sono.
// Ogni dato porta la sua spiegazione per il pannello "Da dove viene", con la correzione a mano.
// Modulo puro: niente React, niente file. Si usa sul file già passato alla versione 3 (aVersioneAttuale), così
// le fonti hanno il loro nome fisso e i cambi sono nel loro elenco anche per un file ancora alla versione 2.
import { confronta, controlloInParole, type Confronto } from '../dati/aggiorna/controllo-prezzo.ts'
import { fineMese, meseDi, meseDopo, nomeMese } from '../dati/aggiorna/calendario.ts'
import { eUfficiale, FONTE } from '../dati/aggiorna/fonti.ts'
import { nomeValuta, quoteAFineMese, ultimoMeseSalvato } from '../dati/aggiorna/mesi.ts'
import { aVersioneAttuale } from '../dati/aggiorna/versione3.ts'
import { DESCRIZIONE, nicAgganciato, primoMese, quandoEsceNic } from '../dati/aggiorna/riferimenti.ts'
import { baseNic, primaDelDato, trovaDato, valoreDelDato, type RifDato } from '../dati/correzione-dati.ts'
import type { RifPrezzo } from '../dati/correzione.ts'
import { RIFERIMENTI, type FileDati, type PrezzoFineMese } from '../dati/tipi.ts'
import { cambio as cambioTesto, data as dataTesto, mese as meseTesto, numero, percentuale } from '../formato.ts'
import { fonteInParole, NOME_FILE_EXCEL, type FonteInParole } from './fonti.ts'
import { cambio, euro, prezzo, riga, testo, type RigaConto, type Spiegazione } from './spiegazione.ts'

// ---------- prezzi dei titoli ----------

/** Le fonti di riserva: sotto il prezzo si dice perché (la nota), come nella pagina Titoli. */
const DA_RISERVA: string[] = [FONTE.investing, FONTE.yahoo, FONTE.xetraAltraBorsa]

export type RigaPrezzo = {
  titolo: string
  /** Il simbolo, o il nome se non c'è. */
  nome: string
  /** Le parole semplici, o il nome lungo. */
  sotto: string | null
  /** La borsa di quotazione, in parole: "Borsa Italiana". */
  borsa: string
  prezzo: PrezzoFineMese
  fonte: FonteInParole
  /** Perché la fonte non è la borsa ufficiale ("Borsa Italiana non ha risposto"), se c'è. */
  perche: string | null
  /** Il controllo di investing.com, null se non c'è (i mesi del file Excel). */
  controllo: Confronto | null
  codiceInvesting: number | null
  aMano: boolean
}

/** I fine mese che hanno prezzi, dal più recente: ["2026-09-30", "2026-08-31", …]. */
export function mesiConPrezzi(dati: FileDati): string[] {
  return [...new Set((dati.prezzi ?? []).map((p) => p.data))].sort().reverse()
}

/** Il nome della fonte di un prezzo; per una stima, quello che dice la nota. */
function fonteDelPrezzo(p: PrezzoFineMese): FonteInParole {
  return fonteInParole(p.fonte === FONTE.stima && p.nota ? p.nota : p.fonte)
}

/** Il perché sotto la fonte: solo per i prezzi presi dalla borsa o da una riserva (la nota del file Excel dice solo il foglio). */
function perche(p: PrezzoFineMese): string | null {
  if (!p.nota || !(eUfficiale(p.fonte) || DA_RISERVA.includes(p.fonte))) return null
  return p.nota[0].toUpperCase() + p.nota.slice(1)
}

/** Una riga per ogni prezzo di quel fine mese, in ordine di nome. */
export function righePrezzi(dati: FileDati, data: string): RigaPrezzo[] {
  const titoli = new Map((dati.titoli ?? []).map((t) => [t.id, t]))
  return (dati.prezzi ?? [])
    .filter((p) => p.data === data)
    .map((p): RigaPrezzo => {
      const t = titoli.get(p.titolo)
      return {
        titolo: p.titolo,
        nome: t ? (t.simbolo ?? t.nome) : p.titolo,
        sotto: t ? (t.paroleSemplici ?? (t.simbolo ? t.nome : null)) : null,
        borsa: t?.nomeBorsa ?? '—',
        prezzo: p,
        fonte: fonteDelPrezzo(p),
        perche: perche(p),
        controllo: confronta(p.prezzo, p.controllo),
        codiceInvesting: t?.codiceInvesting ?? null,
        aMano: p.fonte === FONTE.aMano,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
}

/** Quanti prezzi vengono da ogni fonte, dalla più usata: [{ nome: "Borsa Italiana", quanti: 9 }, …]. */
export function contaFonti(righe: RigaPrezzo[]): { nome: string; quanti: number }[] {
  const conta = new Map<string, number>()
  for (const r of righe) {
    const nome = r.aMano ? FONTE.aMano : r.fonte.nome
    conta.set(nome, (conta.get(nome) ?? 0) + 1)
  }
  return [...conta].map(([nome, quanti]) => ({ nome, quanti })).sort((a, b) => b.quanti - a.quanti || a.nome.localeCompare(b.nome, 'it'))
}

/** "12 da Borsa Italiana · 1 da investing.com (riserva) · 1 inserito manualmente · 2 dal file Excel iniziale" */
export function fraseFonti(conto: { nome: string; quanti: number }[]): string {
  return conto
    .map(({ nome, quanti }) =>
      nome === FONTE.aMano
        ? `${quanti} ${quanti === 1 ? 'inserito' : 'inseriti'} manualmente`
        : nome === NOME_FILE_EXCEL
          ? `${quanti} dal ${nome}`
          : nome.startsWith('dal ') || nome.startsWith('prezzo') || nome === 'stima' ? `${quanti} ${nome}` : `${quanti} da ${nome}`,
    )
    .join(' · ')
}

/** Il "Da dove viene" di un prezzo nella pagina Dati: il prezzo, la fonte, il perché, il controllo, la correzione. */
export function spiegaPrezzo(grezzi: FileDati, rif: RifPrezzo): Spiegazione | null {
  const dati = aVersioneAttuale(grezzi)
  const p = (dati.prezzi ?? []).find((x) => x.titolo === rif.titolo && x.data === rif.data)
  if (!p) return null
  const t = (dati.titoli ?? []).find((x) => x.id === rif.titolo)
  const nome = t ? (t.simbolo ?? t.nome) : rif.titolo
  const f = fonteDelPrezzo(p)
  const conto: RigaConto[] = []
  if (p.valuta !== 'EUR' && p.cambio) {
    conto.push(riga(`Prezzo in ${nomeValuta(p.valuta).toLowerCase()}`, prezzo(p.prezzo, p.valuta)))
    conto.push(riga('÷ cambio BCE', cambio(p.cambio)))
    conto.push(riga('Prezzo in euro', euro(p.prezzo / p.cambio, 4)))
  }
  const note: string[] = []
  const seduta = p.seduta ? `, chiusura del ${dataTesto(p.seduta)}` : ''
  if (p.fonte !== FONTE.aMano) note.push(`Fonte: ${f.nome}${f.dettaglio ? ` (${f.dettaglio})` : ''}${seduta}.`)
  if (t) note.push(`Borsa di quotazione: ${t.nomeBorsa}.`)
  const pp = perche(p)
  if (pp) note.push(pp + '.')
  if (f.nome === NOME_FILE_EXCEL && p.nota) note.push(`Posizione nel file Excel iniziale: ${p.nota.replace(/^file\s*/i, '')}.`)
  const controllo = controlloInParole(p.prezzo, p.valuta, p.controllo)
  if (controllo) note.push(controllo)
  else if (f.nome === NOME_FILE_EXCEL) note.push('Il controllo con investing.com si esegue solo sui prezzi scaricati dall’applicazione.')
  return {
    titolo: `Prezzo di ${nome} a fine ${meseTesto(p.data)}`,
    grande: prezzo(p.prezzo, p.valuta),
    frase: `Prezzo di chiusura dell’ultimo giorno di borsa di ${nomeMese(meseDi(p.data))}${t?.paroleSemplici ? `, per ${t.paroleSemplici.toLowerCase()}` : ''}.`,
    conto,
    note,
    correggi: { titolo: p.titolo, data: p.data },
    rifai: (d) => spiegaPrezzo(d, rif),
  }
}

// ---------- inflazione, cambi e riferimenti ----------

/** Una cella della tabella: il dato, "manca" (con il perché) o "non serve" (quel mese non c'entra). */
export type CellaDato =
  | { tipo: 'dato'; dato: RifDato; numero: number; fonte: string; aMano: boolean; prima: number | null }
  | { tipo: 'manca'; dato: RifDato; perche: string }
  | { tipo: 'non-serve' }

export type RigaDati = {
  /** Il fine mese, "2026-09-30". */
  data: string
  nic: CellaDato
  /** Una per valuta di valuteDeiTitoli, nello stesso ordine. */
  cambi: CellaDato[]
  /** Una per riferimento, nell'ordine di RIFERIMENTI. */
  riferimenti: CellaDato[]
}

/** Le valute dei titoli che non sono in euro, es. ["GBP"]: ognuna ha la sua colonna di cambi. */
export function valuteDeiTitoli(dati: FileDati): string[] {
  const v = new Set<string>()
  for (const p of dati.prezzi ?? []) if (p.valuta !== 'EUR') v.add(p.valuta)
  for (const c of dati.cambi ?? []) v.add(c.valuta)
  return [...v].sort()
}

/** L'ultimo mese con il NIC, "AAAA-MM", o null. */
export function ultimoNic(dati: FileDati): string | null {
  let u: string | null = null
  for (const n of dati.nic ?? []) if (!u || n.data > u) u = n.data
  return u ? meseDi(u) : null
}

/** L'ultimo mese con i valori dei riferimenti a fine mese, "AAAA-MM", o null. */
function ultimoRiferimento(dati: FileDati): string | null {
  let u: string | null = null
  for (const v of dati.riferimenti ?? []) if (v.data === fineMese(meseDi(v.data)) && (!u || v.data > u)) u = v.data
  return u ? meseDi(u) : null
}

/** Nel file non ci sono ancora né riferimenti né inflazione: arrivano con il prossimo Aggiorna fine mese. */
export function senzaRiferimenti(dati: FileDati): boolean {
  return !(dati.riferimenti ?? []).length && !(dati.nic ?? []).length
}

function perchéManca(dati: FileDati, d: RifDato, ultimo: string): string {
  const mese = meseDi(d.data)
  const prossimo = 'Viene recuperato al prossimo aggiornamento; in alternativa si può scaricare di nuovo ora o inserire manualmente.'
  if (d.tipo === 'nic') {
    if (mese === ultimo) return `ISTAT di solito pubblica il NIC di ${nomeMese(mese)} ${quandoEsceNic(mese)}. ${prossimo}`
    return `Il NIC di ${nomeMese(mese)} non è nel file. ${prossimo}`
  }
  if (d.tipo === 'cambio')
    return `Il cambio BCE di fine ${nomeMese(mese)} non è nel file: per il controvalore in euro dei titoli in ${d.valuta} si usa il cambio indicato sul prezzo.`
  if (senzaRiferimenti(dati))
    return 'I riferimenti non sono ancora nel file: saranno scaricati con il prossimo Aggiorna fine mese, che la prima volta recupera l’intera serie storica.'
  return `investing.com non ha fornito il valore di fine ${nomeMese(mese)}. ${prossimo}`
}

function cella(dati: FileDati, d: RifDato, serve: boolean, ultimo: string): CellaDato {
  const x = trovaDato(dati, d)
  if (x) return { tipo: 'dato', dato: d, numero: valoreDelDato(x), fonte: x.fonte, aMano: x.fonte === FONTE.aMano, prima: primaDelDato(x)?.numero ?? null }
  if (!serve) return { tipo: 'non-serve' }
  return { tipo: 'manca', dato: d, perche: perchéManca(dati, d, ultimo) }
}

/** Un titolo in quella valuta c'era a fine mese (allora serve il cambio). */
function serveIlCambio(dati: FileDati, valuta: string, mese: string): boolean {
  const data = fineMese(mese)
  if ((dati.prezzi ?? []).some((p) => p.valuta === valuta && p.data === data)) return true
  return (dati.titoli ?? []).some((t) => (t.valuta ?? 'EUR') === valuta && quoteAFineMese(dati, t.id, mese) > 0)
}

/**
 * Un mese per riga, dal più recente: dal mese prima del primo movimento (la base del NIC del primo acquisto),
 * se il suo NIC c'è, fino all'ultimo mese con prezzi, NIC o riferimenti.
 * "manca" solo dove il dato serve: i riferimenti dal mese del primo movimento, il NIC anche dal mese prima,
 * il cambio quando c'era un titolo in quella valuta.
 */
export function righeDati(dati: FileDati): RigaDati[] {
  const primo = primoMese(dati)
  if (!primo) return []
  const ultimo = [ultimoMeseSalvato(dati), ultimoNic(dati), ultimoRiferimento(dati)].filter((m): m is string => !!m).sort().at(-1)
  if (!ultimo) return []
  const primaDelPrimo = meseDopo(primo, -1)
  const da = (dati.nic ?? []).some((n) => meseDi(n.data) === primaDelPrimo) ? primaDelPrimo : primo
  const valute = valuteDeiTitoli(dati)
  const righe: RigaDati[] = []
  for (let m = ultimo; m >= da; m = meseDopo(m, -1)) {
    const data = fineMese(m)
    righe.push({
      data,
      nic: cella(dati, { tipo: 'nic', data }, true, ultimo),
      cambi: valute.map((valuta) => cella(dati, { tipo: 'cambio', valuta, data }, serveIlCambio(dati, valuta, m), ultimo)),
      riferimenti: RIFERIMENTI.map((riferimento) => cella(dati, { tipo: 'riferimento', riferimento, data }, m >= primo, ultimo)),
    })
  }
  return righe
}

// ---------- i numeri scritti ----------

/** Il NIC con un decimale (104,6), il cambio con quattro o cinque (0,8546), i riferimenti con due (14.123,45). */
export function datoInCifre(d: RifDato, n: number): string {
  if (d.tipo === 'nic') return numero(n, 1, 3)
  if (d.tipo === 'cambio') return cambioTesto(n)
  return numero(n, 2)
}

/** Il nome della colonna o del dato: "Inflazione NIC", "Sterlina", "S&P 500". */
export function nomeColonna(d: RifDato): string {
  if (d.tipo === 'nic') return 'Inflazione NIC'
  if (d.tipo === 'cambio') return nomeValuta(d.valuta)
  return DESCRIZIONE[d.riferimento].nome
}

/** La valuta in cui si scrive il dato, per il campo della correzione: "USD", "EUR", o null (NIC e cambi). */
export function valutaDelDato(d: RifDato): string | null {
  return d.tipo === 'riferimento' ? DESCRIZIONE[d.riferimento].valuta : null
}

function titoloDelDato(d: RifDato): string {
  const quando = `a fine ${meseTesto(d.data)}`
  if (d.tipo === 'nic') return `Inflazione NIC ${quando}`
  if (d.tipo === 'cambio') return `Cambio ${d.valuta} ${quando}`
  return `${DESCRIZIONE[d.riferimento].nome} ${quando}`
}

const BASE = (b: 2015 | 2025) => `base ${b} = 100`

/** Il "Da dove viene" di un NIC, un cambio o un riferimento, anche quando manca. */
export function spiegaDato(grezzi: FileDati, d: RifDato): Spiegazione {
  const dati = aVersioneAttuale(grezzi)
  const x = trovaDato(dati, d)
  // Un dato a mano: lo dicono il chip, la data e il valore di prima, sotto nel pannello (CorreggiDato).
  const aMano = x?.fonte === FONTE.aMano
  const mese = meseDi(d.data)
  const conto: RigaConto[] = []
  const note: string[] = []
  let frase: string
  if (d.tipo === 'nic') {
    frase = 'Indice dei prezzi al consumo per l’intera collettività (NIC) di ISTAT, indice generale: misura la variazione dei prezzi al consumo.'
    const prima = trovaDato(dati, { tipo: 'nic', data: fineMese(meseDopo(mese, -1)) }) as { valore: number; base: 2015 | 2025 } | undefined
    if (x && prima) {
      const n = x as { valore: number; base: 2015 | 2025 }
      const agganciato = nicAgganciato(dati.nic ?? [])
      const a = agganciato.get(mese)
      const b = agganciato.get(meseDopo(mese, -1))
      conto.push(riga(`NIC di ${nomeMese(mese)}`, testo(`${datoInCifre(d, n.valore)} (${BASE(n.base)})`)))
      conto.push(riga(`NIC di ${nomeMese(meseDopo(mese, -1))}`, testo(`${datoInCifre(d, prima.valore)} (${BASE(prima.base)})`)))
      if (a !== undefined && b !== undefined) conto.push(riga('Inflazione del mese', testo(percentuale(a / b - 1))))
      if (n.base !== prima.base) note.push('ISTAT ha cambiato base a gennaio 2026: per il conto i due numeri sono portati sulla stessa base (2025 = 100).')
    }
    const base = BASE((x as { base?: 2015 | 2025 } | undefined)?.base ?? baseNic(d.data))
    note.push(aMano ? `Indice in ${base}.` : `Fonte: ${x ? x.fonte : 'ISTAT'}, ${base}.`)
  } else if (d.tipo === 'cambio') {
    const quante = d.valuta === 'GBP' ? 'sterline' : d.valuta === 'USD' ? 'dollari' : d.valuta
    frase = `Cambio BCE di fine mese: ${quante} per 1 euro. Il prezzo in ${quante} diviso per il cambio dà il prezzo in euro.`
    const c = x as { seduta?: string } | undefined
    if (!aMano) note.push(`Fonte: ${x ? x.fonte : 'BCE'}${c?.seduta ? `, cambio di riferimento del ${dataTesto(c.seduta)}` : ''}.`)
    if (x) note.push('Una correzione del cambio si applica anche ai prezzi di fine mese dei titoli in questa valuta.')
  } else {
    const r = DESCRIZIONE[d.riferimento]
    frase = `${r.cosa[0].toUpperCase() + r.cosa.slice(1)}: il valore di chiusura a fine mese.`
    const v = x as { valore: number; cambio?: number; seduta?: string; nota?: string } | undefined
    if (v && r.valuta !== 'EUR' && v.cambio) {
      conto.push(riga('Punti, in dollari', testo(datoInCifre(d, v.valore))))
      conto.push(riga('÷ cambio BCE del dollaro', cambio(v.cambio)))
      conto.push(riga('Equivalente in euro', euro(v.valore / v.cambio)))
    }
    if (!aMano) note.push(`Fonte: ${x ? x.fonte : 'investing.com'}${v?.seduta ? `, chiusura del ${dataTesto(v.seduta)}` : ''}.`)
    if (v?.nota) note.push(v.nota[0].toUpperCase() + v.nota.slice(1) + '.')
  }
  const nota = d.tipo === 'nic' ? (x as { nota?: string } | undefined)?.nota : undefined
  if (nota) note.push(nota[0].toUpperCase() + nota.slice(1) + '.')
  const ultimo = [ultimoMeseSalvato(dati), ultimoNic(dati), ultimoRiferimento(dati)].filter((m): m is string => !!m).sort().at(-1) ?? mese
  return {
    titolo: titoloDelDato(d),
    grande: testo(x ? datoInCifre(d, valoreDelDato(x)) + (valutaDelDato(d) === 'USD' ? ' USD' : '') : 'manca'),
    frase: x ? frase : `${perchéManca(dati, d, ultimo)}`,
    conto,
    note: x ? note : [frase],
    correggiDato: d,
    rifai: (nuovi) => spiegaDato(nuovi, d),
  }
}
