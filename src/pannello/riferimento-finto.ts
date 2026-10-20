// Il valore di un riferimento o il NIC dal pannello della classifica (ticket 10) nel ponte finto, per guardare
// le pagine in un browser qualsiasi: stessi passaggi del processo principale (versione 3, controllo, copia), ma sul
// testo in memoria. Con ?prova=riferimenti il portafoglio inventato ha già i valori INVENTATI dei sei riferimenti
// e il NIC fino al mese prima dell'ultimo, così si vede "(fino ad agosto)".
import type { AccessoFinto } from '../aggiorna/ponte-finto.ts'
import { fineMese, meseDi } from '../dati/aggiorna/calendario.ts'
import { dateNecessarie, DESCRIZIONE, FONTE_NIC, FONTE_RIFERIMENTO, mesiNicNecessari } from '../dati/aggiorna/riferimenti.ts'
import { aVersioneAttuale } from '../dati/aggiorna/versione3.ts'
import { controllaFile } from '../dati/controllo.ts'
import { applicaScrittura, baseDelNic, controllaScrittura, percheDellaCopiaRiferimento, type PonteRiferimentoAMano } from '../dati/correzione-riferimento.ts'
import { comeTesto } from '../dati/portafoglio-inventato.ts'
import { RIFERIMENTI, type FileDati } from '../dati/tipi.ts'

export function riferimentoAManoFinto(accesso: AccessoFinto): PonteRiferimentoAMano {
  return {
    async scriviRiferimento(s) {
      await new Promise((fatto) => setTimeout(fatto, 300))
      const testo = accesso.leggi()
      const esito = testo ? controllaFile(testo) : null
      if (!esito?.ok) return { esito: 'errore', perche: 'il file dei dati non è leggibile' }
      const v3 = aVersioneAttuale(esito.dati)
      const ok = controllaScrittura(v3, s)
      if (!ok.ok) return { esito: 'errore', perche: ok.perche }
      const perche = percheDellaCopiaRiferimento(s)
      accesso.scrivi(comeTesto(applicaScrittura(v3, s, new Date().toISOString())), perche)
      const apertura = await accesso.apri()
      const copia = apertura.stato === 'pronto' ? (apertura.copie.find((x) => x.perche === perche)?.file ?? '') : ''
      return { esito: 'salvato', apertura, copia }
    },
  }
}

const BASE = { ftsemib: 33000, eurostoxx50: 4900, nasdaq100: 18000, dowjones: 39000, sp500: 5100 } as const
const CRESCITA = { ftsemib: 0.2, eurostoxx50: 0.12, nasdaq100: 0.18, dowjones: 0.09, sp500: 0.14 } as const

/** Un valore INVENTATO che cresce del tasso all'anno, con un'onda. */
function inventato(base: number, tasso: number, data: string): number {
  const anni = (Date.parse(data) - Date.parse('2024-01-01')) / 86_400_000 / 365.25
  return Math.round(base * (1 + tasso) ** anni * (1 + Math.sin(anni * 9) * 0.02) * 100) / 100
}

/** Il portafoglio inventato con i valori INVENTATI dei riferimenti alle date che servono, e il NIC tranne l'ultimo mese. */
export function conRiferimentiInventati(dati: FileDati): FileDati {
  const fine = (dati.prezzi ?? []).reduce((m, p) => (p.data > m ? p.data : m), '')
  if (!fine) return dati
  const mese = meseDi(fine)
  const date = dateNecessarie(dati, mese)
  const riferimenti = RIFERIMENTI.flatMap((id) =>
    date.map((data) => ({
      riferimento: id,
      data,
      valore: inventato(BASE[id], CRESCITA[id], data),
      valuta: DESCRIZIONE[id].valuta,
      ...(DESCRIZIONE[id].valuta === 'USD' ? { cambio: inventato(1.08, 0.02, data) } : {}),
      fonte: FONTE_RIFERIMENTO.investing,
      seduta: data,
    })),
  )
  const nic = mesiNicNecessari(dati, mese)
    .slice(0, -1)
    .map((m) => {
      const data = fineMese(m)
      const base = baseDelNic(data)
      return { data, valore: Math.round(inventato(base === 2025 ? 99 : 119, 0.018, data) * 10) / 10, base, fonte: FONTE_NIC.istat }
    })
  return { ...aVersioneAttuale(dati), riferimenti, nic }
}
