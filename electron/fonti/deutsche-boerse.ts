// Deutsche Börse (Xetra e Francoforte): la tabella "Historical prices" della pagina pubblica del titolo,
// aperta in una finestra nascosta perché il servizio dietro la pagina vuole le firme calcolate dalla pagina.
// Come faceva il motore dell'archivio: si sceglie la sede, si mettono le date del mese, si tolgono
// tutte le rettifiche (frazionamenti, dividendi, diritti) e si legge la colonna "Close".
import { fineMese, inizioMese } from '../../src/dati/aggiorna/calendario.ts'
import type { RichiestaPrezzo } from '../../src/dati/aggiorna/fonti.ts'
import { NonVa, numeroInglese, type Chiusura } from './comune.ts'
import { aspettaNellaPagina, conFinestraNascosta } from './finestra-nascosta.ts'

const PAGINA = 'https://live.deutsche-boerse.com/en/{tipo}/{isin}/price-history/historical-prices-and-volumes'
const TIPI = ['etf', 'etp', 'equity', 'fund', 'bond'] as const

export type Sede = 'Xetra' | 'Frankfurt'

/** "30/09/26" → "2026-09-30" */
function dataTabella(testo: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(testo.trim())
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : null
}

/** Le righe della tabella (testo delle celle) diventano chiusure. */
export function leggiTabellaDeutscheBoerse(intestazioni: string[], righe: string[][]): Chiusura[] {
  const iData = intestazioni.indexOf('Date')
  const iChiusura = intestazioni.indexOf('Close')
  if (iData < 0 || iChiusura < 0) return []
  const chiusure: Chiusura[] = []
  for (const r of righe) {
    const data = dataTabella(r[iData] ?? '')
    const prezzo = numeroInglese(r[iChiusura] ?? '')
    if (data && Number.isFinite(prezzo)) chiusure.push({ data, prezzo })
  }
  return chiusure
}

// ---------- il codice che gira nella pagina ----------

const ppp = (s: string) => JSON.stringify(s)

/** "pronta" quando la pagina mostra l'ISIN e il calendario; "controllo" se chiede di dimostrare di essere umani. */
const statoPagina = (isin: string) => `(() => {
  const testo = document.body ? document.body.innerText : ''
  if (/access denied|verify you are human|captcha/i.test(testo)) return 'controllo'
  if (testo.includes(${ppp(isin)}) && document.querySelector('app-datepicker input') && document.querySelector('select')) return 'pronta'
  return null
})()`

const rifiutaCookie = `(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Decline')
  if (b && b.offsetParent !== null) b.click()
  return true
})()`

const cerca = (sede: Sede, da: string, a: string) => `(() => {
  const imposta = (campo, valore) => {
    const scrivi = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    campo.focus()
    scrivi.call(campo, valore)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
    campo.dispatchEvent(new Event('change', { bubbles: true }))
    campo.blur()
    campo.dispatchEvent(new Event('blur', { bubbles: true }))
  }
  const sceltaSede = document.querySelector('select')
  const voce = [...sceltaSede.options].find((o) => o.textContent.trim() === ${ppp(sede)})
  if (!voce) return 'senza-sede'
  sceltaSede.value = voce.value
  sceltaSede.dispatchEvent(new Event('change', { bubbles: true }))
  const campi = document.querySelectorAll('app-datepicker input')
  imposta(campi[0], ${ppp(da)})
  imposta(campi[1], ${ppp(a)})
  for (const id of ['input-clean-splits', 'input-clean-dividends', 'input-clean-subscription-rights']) {
    const c = document.getElementById(id)
    if (c && c.checked) c.click()
  }
  const bottone = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Search')
  if (!bottone) return 'senza-bottone'
  bottone.click()
  return 'ok'
})()`

/** La tabella, quando mostra solo date dentro l'intervallo; "vuota" se dice che non ci sono dati. */
const leggiTabella = (da: string, a: string) => `(() => {
  const intestazioni = [...document.querySelectorAll('table thead th')].map((h) => h.innerText.trim().split('\\n')[0])
  const righe = [...document.querySelectorAll('table tbody tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.innerText.trim()))
  if (!intestazioni.includes('Date') || !intestazioni.includes('Close')) return null
  const i = intestazioni.indexOf('Date')
  const giorno = (t) => { const m = /^(\\d{2})\\/(\\d{2})\\/(\\d{2})$/.exec(t || ''); return m ? '20' + m[3] + '-' + m[2] + '-' + m[1] : null }
  const date = righe.map((r) => giorno(r[i])).filter(Boolean)
  if (date.length && date.every((d) => d >= ${ppp(da)} && d <= ${ppp(a)})) return { intestazioni, righe }
  if (!date.length && /no data/i.test(document.body.innerText)) return 'vuota'
  return null
})()`

function dataPagina(iso: string): string {
  return iso.split('-').reverse().join('/')
}

export async function chiusureDeutscheBoerse(t: RichiestaPrezzo, mese: string, sede: Sede): Promise<Chiusura[]> {
  const da = inizioMese(mese)
  const a = fineMese(mese)
  let controllo = false
  for (const tipo of TIPI) {
    const indirizzo = PAGINA.replace('{tipo}', tipo).replace('{isin}', t.isin)
    const risultato = await conFinestraNascosta(indirizzo, async (wc) => {
      const stato = await aspettaNellaPagina<string>(wc, statoPagina(t.isin), 25)
      if (stato === 'controllo') return 'controllo' as const
      if (stato !== 'pronta') return 'non-qui' as const
      await wc.executeJavaScript(rifiutaCookie, true)
      const esito = (await wc.executeJavaScript(cerca(sede, dataPagina(da), dataPagina(a)), true)) as string
      if (esito === 'senza-sede') return 'senza-sede' as const
      if (esito !== 'ok') throw new NonVa('la pagina è cambiata e non si legge più')
      const tabella = await aspettaNellaPagina<{ intestazioni: string[]; righe: string[][] } | 'vuota'>(wc, leggiTabella(da, a), 30, 1000)
      if (tabella === null) throw new NonVa('la tabella dei prezzi non è arrivata')
      if (tabella === 'vuota') return []
      return leggiTabellaDeutscheBoerse(tabella.intestazioni, tabella.righe)
    })
    if (risultato === 'controllo') controllo = true
    else if (risultato === 'senza-sede') throw new NonVa(`il titolo non è quotato a ${sede === 'Xetra' ? 'Xetra' : 'Francoforte'}`)
    else if (risultato !== 'non-qui') {
      if (!risultato.length) throw new NonVa('non ha prezzi del titolo in quel mese')
      return risultato
    }
  }
  throw new NonVa(controllo ? 'ha chiesto un controllo di sicurezza: riprova più tardi' : 'non trova il titolo')
}
