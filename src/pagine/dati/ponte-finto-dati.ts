// La pagina Dati nel ponte finto, per guardare le pagine in un browser qualsiasi (ticket 13):
// la correzione a mano di NIC, cambi e riferimenti, con gli stessi passaggi del processo principale
// (versione 3, controllo, copia) ma sul testo in memoria. Con ?prova=dati il portafoglio inventato ha anche
// inflazione e riferimenti inventati, con qualche "manca" (il NIC dell'ultimo mese e un riferimento).
import type { AccessoFinto } from '../../aggiorna/ponte-finto.ts'
import { fineMese, meseDopo } from '../../dati/aggiorna/calendario.ts'
import { DESCRIZIONE } from '../../dati/aggiorna/riferimenti.ts'
import { aVersione3 } from '../../dati/aggiorna/versione3.ts'
import { applicaCodici, controllaCodici, PERCHE_CODICI, type PonteCodici } from '../../dati/codici-riserve.ts'
import { controllaFile } from '../../dati/controllo.ts'
import { applicaCorrezioneDato, controllaCorrezioneDato, percheDellaCopiaDato, type PonteCorrezioneDato } from '../../dati/correzione-dati.ts'
import { comeTesto } from '../../dati/portafoglio-inventato.ts'
import { RIFERIMENTI, type FileDati, type NicDelMese, type ValoreRiferimento } from '../../dati/tipi.ts'

export function correzioneDatoFinta(accesso: AccessoFinto): PonteCorrezioneDato {
  return {
    async correggiDato(c) {
      await new Promise((fatto) => setTimeout(fatto, 300))
      const testo = accesso.leggi()
      const esito = testo ? controllaFile(testo) : null
      if (!esito?.ok) return { esito: 'errore', perche: 'il file dei dati non è leggibile' }
      const v3 = aVersione3(esito.dati)
      const ok = controllaCorrezioneDato(v3, c)
      if (!ok.ok) return { esito: 'errore', perche: ok.perche }
      const perche = percheDellaCopiaDato(v3, c)
      accesso.scrivi(comeTesto(applicaCorrezioneDato(v3, c, new Date().toISOString())), perche)
      const apertura = await accesso.apri()
      const copia = apertura.stato === 'pronto' ? (apertura.copie.find((x) => x.perche === perche)?.file ?? '') : ''
      return { esito: 'salvato', apertura, copia }
    },
  }
}

/** I codici investing.com cercati dalla scheda Prezzi dei titoli, scritti sul testo in memoria. */
export function codiciFinti(accesso: AccessoFinto): PonteCodici {
  return {
    async scriviCodici(s) {
      await new Promise((fatto) => setTimeout(fatto, 300))
      const testo = accesso.leggi()
      const esito = testo ? controllaFile(testo) : null
      if (!esito?.ok) return { esito: 'errore', perche: 'il file dei dati non è leggibile' }
      const ok = controllaCodici(esito.dati, s)
      if (!ok.ok) return { esito: 'errore', perche: ok.perche }
      accesso.scrivi(comeTesto(applicaCodici(esito.dati, s)), PERCHE_CODICI)
      const apertura = await accesso.apri()
      const copia = apertura.stato === 'pronto' ? (apertura.copie.find((x) => x.perche === PERCHE_CODICI)?.file ?? '') : ''
      return { esito: 'salvato', apertura, copia }
    },
  }
}

const BASE = { btp10: 140, ftsemib: 180, eurostoxx50: 170, nasdaq100: 21000, dowjones: 95000, sp500: 11000 } as const

/** Un numero inventato che cresce piano nel tempo. */
function inventato(base: number, i: number): number {
  return Math.round(base * (1 + i / 60 + Math.sin(i / 2) * 0.02) * 100) / 100
}

/**
 * Il portafoglio inventato con inflazione e riferimenti inventati da gennaio 2024 a settembre 2026:
 * manca il NIC di settembre 2026 (non ancora uscito) e il Nasdaq-100 di agosto 2026.
 */
export function conRiferimentiInventati(dati: FileDati): FileDati {
  const nic: NicDelMese[] = []
  const riferimenti: ValoreRiferimento[] = []
  let i = 0
  for (let m = '2024-01'; m <= '2026-09'; m = meseDopo(m), i++) {
    const data = fineMese(m)
    if (m < '2026-09') nic.push(m >= '2026-01' ? { data, valore: Math.round((100 + i / 10) * 10) / 10, base: 2025, fonte: 'ISTAT' } : { data, valore: Math.round((119 + i / 8) * 10) / 10, base: 2015, fonte: 'ISTAT' })
    if (m < '2024-02') continue
    for (const id of RIFERIMENTI) {
      if (id === 'nasdaq100' && m === '2026-08') continue
      const dollari = DESCRIZIONE[id].valuta === 'USD'
      riferimenti.push({
        riferimento: id,
        data,
        valore: inventato(BASE[id], i),
        valuta: DESCRIZIONE[id].valuta,
        ...(dollari ? { cambio: Math.round((1.08 + Math.sin(i) * 0.03) * 10000) / 10000 } : {}),
        fonte: 'investing.com',
        seduta: data,
      })
    }
  }
  // Come nel file vero: per riferimento, poi per data.
  riferimenti.sort((a, b) => RIFERIMENTI.indexOf(a.riferimento) - RIFERIMENTI.indexOf(b.riferimento) || a.data.localeCompare(b.data))
  return { ...aVersione3(dati), nic, riferimenti }
}
