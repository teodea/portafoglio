// Registrare, correggere e togliere un movimento nel ponte finto, per guardare le pagine in un browser qualsiasi:
// stessi passaggi del processo principale (versione 3, controllo, copia), ma sul testo in memoria.
import type { AccessoFinto } from '../aggiorna/ponte-finto.ts'
import { aVersione3 } from '../dati/aggiorna/versione3.ts'
import { controllaFile } from '../dati/controllo.ts'
import { applicaModifica, controllaModifica, percheDellaCopia, type PonteMovimenti } from '../dati/movimenti.ts'
import { comeTesto } from '../dati/portafoglio-inventato.ts'

export function movimentiFinti(accesso: AccessoFinto): PonteMovimenti {
  return {
    async modificaMovimento(m) {
      await new Promise((fatto) => setTimeout(fatto, 300))
      const testo = accesso.leggi()
      const esito = testo ? controllaFile(testo) : null
      if (!esito?.ok) return { esito: 'errore', perche: 'il file non si legge' }
      const v3 = aVersione3(esito.dati)
      const ok = controllaModifica(v3, m)
      if (!ok.ok) return { esito: 'errore', perche: ok.perche }
      const perche = percheDellaCopia(esito.dati, m)
      const fatto = applicaModifica(v3, m, new Date().toISOString())
      accesso.scrivi(comeTesto(fatto.dati), perche)
      const apertura = await accesso.apri()
      const copia = apertura.stato === 'pronto' ? (apertura.copie.find((x) => x.perche === perche)?.file ?? '') : ''
      return { esito: 'salvato', apertura, copia, id: fatto.id }
    },
  }
}
