// I codici delle riserve di un titolo nuovo (ticket 12), cercati dall'ISIN: poche richieste, distanziate.
// - investing.com: la ricerca del sito (la stessa del motore dell'archivio) dà le linee di quotazione dell'ISIN;
//   si tengono quelle della borsa del titolo, la più probabile per prima ("Non è lui" passa alla dopo).
//   Per le prime linee si chiede l'ultima chiusura, da far vedere ("prezzo di ieri").
//   Se incolli l'indirizzo della pagina di investing.com, vale quello: il codice è nel "cid" o nella pagina della ricerca.
// - Yahoo: la ricerca per ISIN, oppure simbolo + suffisso della borsa ("VWCE.DE"), controllato con il grafico.
// Escono dal PC solo l'ISIN e i codici. Solo Node: le prove usano una rete finta.
import { BORSA_INVESTING, SUFFISSO_YAHOO, type CodiciTrovati, type LineaInvesting, type RichiestaCodici } from '../../src/dati/titolo-nuovo.ts'
import { NonVa, scaricaTesto, type Scarica } from './comune.ts'
import { INDIRIZZO, INTESTAZIONI, inFila, leggiInvesting, PAUSA } from './investing.ts'
import { arrotonda, graficoYahoo } from './yahoo.ts'

const CERCA = 'https://it.investing.com/search/service/SearchInnerPage'
const CERCA_YAHOO = 'https://query2.finance.yahoo.com/v1/finance/search'
/** Le altre valute che investing.com mette in fondo al simbolo di una linea (ABCUSD invece di ABC). */
const VALUTE = ['USD', 'EUR', 'CHF', 'GBP', 'JPY', 'SEK', 'NOK', 'DKK']
/** Per quante linee si chiede il prezzo: quella trovata e un paio da mostrare dopo "Non è lui". */
const CON_PREZZO = 3

export type ReteCodici = { investing: Scarica; yahoo: Scarica }

type Quota = { pairId?: unknown; name?: unknown; symbol?: unknown; exchange?: unknown; exchangeID?: unknown; link?: unknown }

/** Le linee di quotazione dell'ISIN, come le dà la ricerca del sito. */
export function leggiRicerca(testo: string): Quota[] {
  try {
    const q = (JSON.parse(testo) as { quotes?: unknown }).quotes
    return Array.isArray(q) ? (q as Quota[]) : []
  } catch {
    throw new NonVa('ha risposto con dati non leggibili')
  }
}

/** Il percorso e il "cid" di un indirizzo di investing.com: "https://it.investing.com/etfs/xyz?cid=123" → ["/etfs/xyz", 123]. */
export function leggiIndirizzo(indirizzo: string): { percorso: string; cid: number | null } | null {
  let u: URL
  try {
    u = new URL(indirizzo.trim())
  } catch {
    return null
  }
  if (!/(^|\.)investing\.com$/.test(u.hostname)) return null
  const cid = Number(u.searchParams.get('cid'))
  return { percorso: u.pathname.replace(/\/+$/, ''), cid: Number.isInteger(cid) && cid > 0 ? cid : null }
}

/** Le linee sulla borsa del titolo, in ordine: prima quella con lo stesso simbolo, poi quelle senza un'altra valuta in fondo. */
export function scegliLinee(quote: Quota[], r: RichiestaCodici): Quota[] {
  const borsa = BORSA_INVESTING[r.borsa]
  const simbolo = r.simbolo.trim().toUpperCase()
  const altre = VALUTE.filter((v) => v !== r.valuta)
  const punti = (q: Quota) => {
    const s = String(q.symbol ?? '').toUpperCase()
    return (s === simbolo ? 0 : 2) + (altre.some((v) => s.endsWith(v) && s !== v) ? 1 : 0)
  }
  return quote
    .filter((q) => Number(q.exchangeID) === borsa && Number.isInteger(Number(q.pairId)))
    .map((q, i) => ({ q, i }))
    .sort((a, b) => punti(a.q) - punti(b.q) || a.i - b.i)
    .map((x) => x.q)
}

const linea = (q: Quota): LineaInvesting => ({
  codice: Number(q.pairId),
  nome: String(q.name ?? ''),
  simbolo: String(q.symbol ?? ''),
  borsa: String(q.exchange ?? ''),
  prezzo: null,
  seduta: null,
})

/** L'ultima chiusura degli ultimi dieci giorni (nella valuta di investing.com), o null. */
async function ultimaChiusura(codice: number, rete: ReteCodici, adesso: number, pausa: number): Promise<{ prezzo: number; seduta: string } | null> {
  const giorno = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  const parametri = new URLSearchParams({
    'start-date': giorno(adesso - 10 * 86_400_000),
    'end-date': giorno(adesso),
    'time-frame': 'Daily',
    'add-missing-rows': 'false',
  })
  try {
    const testo = await inFila(() => scaricaTesto(`${INDIRIZZO}${codice}?${parametri}`, { headers: INTESTAZIONI }, rete.investing), pausa)
    const c = leggiInvesting(testo).sort((a, b) => (a.data < b.data ? 1 : -1))[0]
    return c ? { prezzo: c.prezzo, seduta: c.data } : null
  } catch {
    return null
  }
}

/** Il codice Yahoo: dalla ricerca per ISIN sulla borsa del titolo, o simbolo + suffisso; solo se Yahoo lo conosce. */
async function codiceYahoo(r: RichiestaCodici, rete: ReteCodici, adesso: number): Promise<{ codice: string; divisore: number } | null> {
  const suffisso = SUFFISSO_YAHOO[r.borsa]
  const candidati: string[] = []
  try {
    const testo = await scaricaTesto(`${CERCA_YAHOO}?${new URLSearchParams({ q: r.isin, quotesCount: '10', newsCount: '0' })}`, {}, rete.yahoo)
    const quote = (JSON.parse(testo) as { quotes?: { symbol?: unknown }[] }).quotes ?? []
    for (const q of quote) if (typeof q.symbol === 'string' && q.symbol.toUpperCase().endsWith(suffisso.toUpperCase())) candidati.push(q.symbol.toUpperCase())
  } catch {
    // La ricerca di Yahoo non ha risposto: si prova con il simbolo.
  }
  const dalSimbolo = r.simbolo.trim().toUpperCase()
  if (/^[A-Z0-9]{1,12}$/.test(dalSimbolo)) candidati.push(dalSimbolo + suffisso)
  for (const codice of [...new Set(candidati)].slice(0, 2)) {
    try {
      const g = await graficoYahoo(codice, new Date(adesso - 10 * 86_400_000).toISOString().slice(0, 10), rete.yahoo, adesso)
      if (g.chiusure.length > 0 && g.valuta === r.valuta) return { codice, divisore: g.divisore }
    } catch {
      // Yahoo non conosce questo codice: si prova il prossimo.
    }
  }
  return null
}

/** Cerca i codici di investing.com e Yahoo di un titolo nuovo. Non lancia errori: quello che non trova lo dice. */
export async function cercaCodici(r: RichiestaCodici, rete: ReteCodici, adesso = Date.now(), pausa = PAUSA): Promise<CodiciTrovati> {
  let linee: LineaInvesting[] = []
  let perche: string | undefined
  const indirizzo = r.indirizzo?.trim() ? leggiIndirizzo(r.indirizzo) : null
  if (r.indirizzo?.trim() && !indirizzo) perche = 'l’indirizzo incollato non è una pagina di investing.com'
  else {
    try {
      const testo = await inFila(
        () =>
          scaricaTesto(
            CERCA,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                Origin: 'https://it.investing.com',
                Referer: `https://it.investing.com/search/?q=${encodeURIComponent(r.isin)}`,
              },
              body: new URLSearchParams({ search_text: r.isin, tab: 'quotes', isFilter: 'false', limit: '270', offset: '0' }).toString(),
            },
            rete.investing,
          ),
        pausa,
      )
      const quote = leggiRicerca(testo)
      if (indirizzo) {
        const percorso = (q: Quota) => String(q.link ?? '').split('?')[0].replace(/\/+$/, '')
        const cid = (q: Quota) => Number(/[?&]cid=(\d+)/.exec(String(q.link ?? ''))?.[1] ?? NaN)
        const scelta =
          (indirizzo.cid && quote.find((q) => Number(q.pairId) === indirizzo.cid)) ||
          quote.find((q) => percorso(q) === indirizzo.percorso && !/cid=/.test(String(q.link ?? ''))) ||
          quote.find((q) => percorso(q) === indirizzo.percorso && cid(q) === indirizzo.cid)
        if (scelta) linee = [linea(scelta)]
        else if (indirizzo.cid) linee = [{ codice: indirizzo.cid, nome: '', simbolo: '', borsa: '', prezzo: null, seduta: null }]
        else perche = 'nell’indirizzo incollato manca il codice della linea: aprire la pagina del titolo sulla sua borsa e copiare l’indirizzo da lì'
      } else {
        linee = scegliLinee(quote, r).map(linea)
        if (linee.length === 0)
          perche = quote.length === 0 ? `investing.com non conosce l’ISIN ${r.isin}` : 'investing.com ha il titolo, ma non sulla sua borsa'
      }
    } catch (e) {
      perche = `investing.com ${e instanceof NonVa ? e.message : 'non ha risposto'}`
    }
  }

  const yahoo = await codiceYahoo(r, rete, adesso)
  // Il prezzo di ieri delle prime linee; da Londra investing.com lo dà come Yahoo (pence o sterline): si usa il divisore di Yahoo.
  for (const l of linee.slice(0, CON_PREZZO)) {
    const c = await ultimaChiusura(l.codice, rete, adesso, pausa)
    if (c) {
      l.prezzo = arrotonda(c.prezzo / (yahoo?.divisore ?? 1))
      l.seduta = c.seduta
    }
  }
  return { investing: linee, ...(perche ? { perche } : {}), yahoo: yahoo?.codice ?? null }
}
