// Riferimenti e inflazione nel ponte finto, per guardare le pagine in un browser qualsiasi: niente internet,
// valori inventati. Il Nasdaq-100 "non risponde" alla prima richiesta e arriva al "Riprova"; il NIC dell'ultimo
// mese chiesto non è "ancora uscito", come succede di solito a inizio mese.
import { fineMese } from '../dati/aggiorna/calendario.ts'
import { DESCRIZIONE, type EsitoNic, type EsitoRiferimento } from '../dati/aggiorna/riferimenti.ts'
import type { PonteRiferimenti } from '../dati/aggiorna/ponte-riferimenti.ts'

const pausa = (ms: number) => new Promise((fatto) => setTimeout(fatto, ms))
const BASE = { btp10: 140, ftsemib: 180, eurostoxx50: 170, nasdaq100: 21000, dowjones: 95000, sp500: 11000 } as const

/** Un numero inventato che cresce piano nel tempo: giorni dal 2024 → valore. */
function inventato(base: number, data: string): number {
  const giorni = (Date.parse(data) - Date.parse('2024-01-01')) / 86_400_000
  return Math.round(base * (1 + giorni / 2000 + Math.sin(giorni / 40) * 0.03) * 100) / 100
}

export function riferimentiFinti(): PonteRiferimenti {
  const tentativi = new Map<string, number>()
  return {
    async valoriRiferimento(id, date): Promise<EsitoRiferimento> {
      await pausa(300 + Math.random() * 500)
      const n = (tentativi.get(id) ?? 0) + 1
      tentativi.set(id, n)
      if (id === 'nasdaq100' && n === 1) return { ok: false, perche: 'investing.com non ha risposto (prova nel browser: riprova)' }
      const dollari = DESCRIZIONE[id].valuta === 'USD'
      return {
        ok: true,
        valori: date.map((data) => ({
          data,
          valore: inventato(BASE[id], data),
          seduta: data,
          ...(dollari ? { cambio: inventato(1.1, data) } : {}),
        })),
        mancano: [],
      }
    },
    async nicIstat(mesi): Promise<EsitoNic> {
      await pausa(900)
      const ordinati = [...mesi].sort()
      return {
        ok: true,
        valori: ordinati.slice(0, -1).map((m) => {
          const base = m >= '2026-01' ? 2025 : 2015
          return { data: fineMese(m), valore: Math.round(inventato(base === 2025 ? 100 : 120, m + '-15') * 10) / 10, base }
        }),
      }
    },
  }
}
