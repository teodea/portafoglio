// London Stock Exchange: le chiusure dell'ultimo anno, dal grafico della pagina pubblica del titolo.
// I dati del grafico arrivano da un servizio che risponde solo alla pagina (chiede un permesso che la pagina
// prende da sola): si apre la pagina in una finestra nascosta e si legge la risposta che riceve il grafico.
// I prezzi sono in pence (GBX): si dividono per 100 per avere le sterline, come nel file (es. 5413,5 → 54,135).
import type { RichiestaPrezzo } from '../../src/dati/aggiorna/fonti.ts'
import { NonVa, scaricaTesto, type Chiusura, type Scarica } from './comune.ts'
import { conFinestraNascosta } from './finestra-nascosta.ts'

const SCHEDA = 'https://api.londonstockexchange.com/api/gw/lse/instruments/alldata/'
const PAGINA = 'https://www.londonstockexchange.com/stock/{simbolo}/x/company-page'

/** Dalla scheda del titolo: l'ISIN (per controllare che sia lui) e la valuta in cui sono i prezzi. */
export function leggiSchedaLse(testo: string): { isin: string; valuta: string } {
  try {
    const v = JSON.parse(testo) as { isin?: unknown; currency?: unknown }
    if (typeof v.isin === 'string' && typeof v.currency === 'string') return { isin: v.isin, valuta: v.currency }
  } catch {
    // sotto
  }
  throw new NonVa('ha risposto con dati non leggibili')
}

/** Legge la risposta del grafico: { data: [{ _DATE_END: "2026-10-30", CLOSE_PRC: "5413.5" }, …] }. */
export function leggiStoricoLse(testo: string, divisore: number): Chiusura[] {
  let v: { data?: unknown }
  try {
    v = JSON.parse(testo) as { data?: unknown }
  } catch {
    throw new NonVa('ha risposto con dati non leggibili')
  }
  if (!Array.isArray(v.data)) throw new NonVa('ha risposto con dati non leggibili')
  const chiusure: Chiusura[] = []
  for (const r of v.data as Record<string, unknown>[]) {
    const data = typeof r._DATE_END === 'string' ? r._DATE_END.slice(0, 10) : ''
    const prezzo = Number(r.CLOSE_PRC)
    if (/^\d{4}-\d{2}-\d{2}$/.test(data) && Number.isFinite(prezzo) && prezzo > 0)
      chiusure.push({ data, prezzo: Math.round((prezzo / divisore) * 1e6) / 1e6 })
  }
  return chiusure
}

/** Quanto dividere i prezzi di Londra per averli nella valuta del titolo; errore se non tornano. */
export function divisoreLse(valutaLondra: string, valutaTitolo: string): number {
  if (valutaLondra === 'GBX' && valutaTitolo === 'GBP') return 100
  if (valutaLondra === valutaTitolo) return 1
  throw new NonVa(`a Londra il titolo è in ${valutaLondra === 'GBX' ? 'pence' : valutaLondra}, nel file in ${valutaTitolo}`)
}

export async function chiusureLse(t: RichiestaPrezzo, scarica: Scarica = fetch): Promise<Chiusura[]> {
  if (!t.simbolo) throw new NonVa('nel file manca il simbolo del titolo, necessario per richiedere il prezzo')
  const simbolo = t.simbolo.toUpperCase()
  if (!/^[A-Z0-9.]{1,8}$/.test(simbolo)) throw new NonVa(`il simbolo "${t.simbolo}" non è valido`)
  const scheda = leggiSchedaLse(
    await scaricaTesto(
      SCHEDA + simbolo,
      { headers: { Origin: 'https://www.londonstockexchange.com', Referer: 'https://www.londonstockexchange.com/' } },
      scarica,
    ),
  )
  if (scheda.isin !== t.isin) throw new NonVa(`con il simbolo ${simbolo} c'è un altro titolo (${scheda.isin})`)
  const divisore = divisoreLse(scheda.valuta, t.valuta)

  let risposta: (testo: string) => void = () => {}
  const arrivata = new Promise<string>((fatto) => (risposta = fatto))
  const testo = await conFinestraNascosta(
    PAGINA.replace('{simbolo}', simbolo),
    async () => await arrivata,
    (wc) => {
      // Si ascoltano le risposte che riceve la pagina, come gli strumenti per sviluppatori del browser.
      const richieste = new Set<string>()
      wc.debugger.attach('1.3')
      wc.debugger.on('message', (_e, metodo, p: { requestId?: string; response?: { url?: string } }) => {
        if (
          metodo === 'Network.responseReceived' &&
          p.response?.url?.includes('/timeseries/historical') &&
          p.response.url.includes(`ric=${simbolo}.L`)
        )
          richieste.add(p.requestId!)
        if (metodo === 'Network.loadingFinished' && p.requestId && richieste.has(p.requestId))
          void wc.debugger
            .sendCommand('Network.getResponseBody', { requestId: p.requestId })
            .then((r: { body: string }) => risposta(r.body))
            .catch(() => undefined)
      })
      void wc.debugger.sendCommand('Network.enable')
    },
    60,
  )
  return leggiStoricoLse(testo, divisore)
}
