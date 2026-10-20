// Euronext: lo storico ufficiale, prezzi non rettificati, per Parigi (circa 2 anni) e Milano (solo le
// ultime sedute: basta se si aggiorna entro una settimana dalla fine del mese).
// Si usa "Close", la chiusura pubblicata dalla borsa. L'ISIN è scritto in testa al file: si controlla.
import type { RichiestaPrezzo } from '../../src/dati/aggiorna/fonti.ts'
import { fineMese, inizioMese } from '../../src/dati/aggiorna/calendario.ts'
import { NonVa, scaricaTesto, type Chiusura, type Scarica } from './comune.ts'

const INDIRIZZO = 'https://live.euronext.com/en/ajax/AwlHistoricalPrice/getFullDownloadAjax/'

/** I codici di mercato Euronext: Parigi, e per Milano prima gli ETF poi le azioni. */
export const MERCATI_EURONEXT = { parigi: ['XPAR'], milano: ['ETFP', 'MTAA'] } as const

/** Legge il CSV di Euronext (separatore ";", date "GG/MM/AAAA"). Null se il file è di un altro titolo. */
export function leggiEuronext(testo: string, isin: string): Chiusura[] | null {
  const righe = testo.replace(/^﻿/, '').split(/\r?\n/)
  const intestazione = righe.findIndex((r) => r.startsWith('Date;'))
  if (intestazione < 0) return []
  if (!righe.slice(0, intestazione).join('\n').includes(isin)) return null
  const colonne = righe[intestazione].split(';').map((c) => c.replace(/"/g, ''))
  const iData = colonne.indexOf('Date')
  const iChiusura = colonne.indexOf('Close')
  if (iData < 0 || iChiusura < 0) return []
  const chiusure: Chiusura[] = []
  for (const r of righe.slice(intestazione + 1)) {
    const c = r.split(';')
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(c[iData] ?? '')
    const prezzo = Number(c[iChiusura])
    if (!m || !c[iChiusura] || !Number.isFinite(prezzo)) continue
    chiusure.push({ data: `${m[3]}-${m[2]}-${m[1]}`, prezzo })
  }
  return chiusure
}

export async function chiusureEuronext(
  t: RichiestaPrezzo,
  mese: string,
  mercati: readonly string[],
  scarica: Scarica = fetch,
): Promise<Chiusura[]> {
  const parametri = new URLSearchParams({
    format: 'csv',
    decimal_separator: '.',
    date_form: 'd/m/Y',
    startdate: inizioMese(mese),
    enddate: fineMese(mese),
    adjusted: 'N',
  })
  let altroTitolo = false
  for (const mic of mercati) {
    const testo = await scaricaTesto(`${INDIRIZZO}${t.isin}-${mic}?${parametri}`, {}, scarica)
    const chiusure = leggiEuronext(testo, t.isin)
    if (chiusure === null) altroTitolo = true
    else if (chiusure.length) return chiusure
  }
  throw new NonVa(altroTitolo ? 'ha risposto con i dati di un altro titolo' : 'non ha prezzi del titolo in quel mese')
}
