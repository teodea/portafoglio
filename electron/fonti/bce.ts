// BCE: i cambi di riferimento giornalieri (unità di valuta per 1 euro). Si prende l'ultimo del mese.
import { fineMese, inizioMese, meseFinito, NomeMese, oggiLocale } from '../../src/dati/aggiorna/calendario.ts'
import { FONTE_CAMBIO, type EsitoCambio } from '../../src/dati/aggiorna/fonti.ts'
import { NonVa, scaricaTesto, type Scarica } from './comune.ts'

const INDIRIZZO = 'https://data-api.ecb.europa.eu/service/data/EXR/'

/** Legge il CSV della BCE: colonne TIME_PERIOD e OBS_VALUE. */
export function leggiBce(testo: string): { data: string; cambio: number }[] {
  const righe = testo.trim().split(/\r?\n/)
  if (!righe.length) return []
  const colonne = righe[0].split(',')
  const iData = colonne.indexOf('TIME_PERIOD')
  const iValore = colonne.indexOf('OBS_VALUE')
  if (iData < 0 || iValore < 0) return []
  const cambi: { data: string; cambio: number }[] = []
  for (const r of righe.slice(1)) {
    const c = r.split(',')
    const cambio = Number(c[iValore])
    if (/^\d{4}-\d{2}-\d{2}$/.test(c[iData] ?? '') && c[iValore] && Number.isFinite(cambio) && cambio > 0)
      cambi.push({ data: c[iData], cambio })
  }
  return cambi
}

/** Il cambio dell'ultimo giorno del mese che la BCE ha pubblicato (il 31/12 per esempio non pubblica). */
export async function cambioBce(valuta: string, mese: string, scarica: Scarica = fetch, oggi = oggiLocale()): Promise<EsitoCambio> {
  if (!meseFinito(mese, oggi)) return { ok: false, perche: `${NomeMese(mese)} non è ancora finito` }
  if (!/^[A-Z]{3}$/.test(valuta)) return { ok: false, perche: `la valuta "${valuta}" non è valida` }
  const url = `${INDIRIZZO}D.${valuta}.EUR.SP00.A?startPeriod=${inizioMese(mese)}&endPeriod=${fineMese(mese)}&format=csvdata`
  let testo: string
  try {
    testo = await scaricaTesto(url, {}, scarica)
  } catch (e) {
    return { ok: false, perche: `la BCE ${e instanceof NonVa ? e.message : 'non ha risposto'}` }
  }
  const ultimo = leggiBce(testo)
    .sort((a, b) => a.data.localeCompare(b.data))
    .at(-1)
  if (!ultimo) return { ok: false, perche: 'la BCE non ha ancora il cambio di quel mese' }
  return { ok: true, cambio: ultimo.cambio, seduta: ultimo.data, fonte: FONTE_CAMBIO.bce }
}
