// La correzione a mano nel ponte finto, per guardare le pagine in un browser qualsiasi:
// stessi passaggi del processo principale (versione 3, controllo, copia), ma sul testo in memoria.
import type { AccessoFinto } from '../aggiorna/ponte-finto.ts'
import { aVersione3 } from '../dati/aggiorna/versione3.ts'
import { controllaFile } from '../dati/controllo.ts'
import { applicaCorrezione, controllaCorrezione, percheDellaCopia, type PonteCorrezione } from '../dati/correzione.ts'
import { comeTesto } from '../dati/portafoglio-inventato.ts'

export function correzioneFinta(accesso: AccessoFinto): PonteCorrezione {
  return {
    async correggiPrezzo(c) {
      await new Promise((fatto) => setTimeout(fatto, 300))
      const testo = accesso.leggi()
      const esito = testo ? controllaFile(testo) : null
      if (!esito?.ok) return { esito: 'errore', perche: 'il file dei dati non è leggibile' }
      const v3 = aVersione3(esito.dati)
      const ok = controllaCorrezione(v3, c)
      if (!ok.ok) return { esito: 'errore', perche: ok.perche }
      const perche = percheDellaCopia(esito.dati, c)
      accesso.scrivi(comeTesto(applicaCorrezione(v3, c, new Date().toISOString())), perche)
      const apertura = await accesso.apri()
      const copia = apertura.stato === 'pronto' ? (apertura.copie.find((x) => x.perche === perche)?.file ?? '') : ''
      return { esito: 'salvato', apertura, copia }
    },
  }
}
