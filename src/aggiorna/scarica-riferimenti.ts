// Lo scarico dei riferimenti e dell'inflazione dentro Aggiorna fine mese (ticket 9). Lo usa contesto.tsx:
// stessa regola dei prezzi, ogni aggiornamento ha il suo numero e le risposte di uno annullato non toccano
// quello nuovo. I riferimenti si chiedono uno alla volta (investing.com li mette comunque in fila), il NIC
// con una sola richiesta (ISTAT accetta poche richieste al minuto).
import { useCallback, useMemo } from 'react'
import type { Aggiornamento } from '../dati/aggiorna/lista.ts'
import { conNic, conRiga, statoDaNic, statoDaRiferimento } from '../dati/aggiorna/riferimenti.ts'
import type { IdRiferimento } from '../dati/tipi.ts'
import { ponte } from '../ponte.ts'

type Cambia = (f: (a: Aggiornamento) => Aggiornamento, numero: number) => void

const conRif = (f: (p: NonNullable<Aggiornamento['rif']>) => NonNullable<Aggiornamento['rif']>) => (a: Aggiornamento) =>
  a.rif ? { ...a, rif: f(a.rif) } : a

const problema = { tipo: 'manca' as const, perche: 'si è verificato un errore: riprovare' }

/** attivo(numero): l'aggiornamento con quel numero è ancora quello in corso (non annullato né salvato). */
export function useScaricaRiferimenti(cambia: Cambia, attivo: (numero: number) => boolean) {
  const chiediRiferimento = useCallback(
    async (id: IdRiferimento, date: string[], numero: number) => {
      if (!date.length) return
      cambia(conRif((p) => conRiga(p, id, (r) => ({ ...r, stato: { tipo: 'scarica' } }))), numero)
      let stato
      try {
        stato = statoDaRiferimento(await ponte.valoriRiferimento(id, date))
      } catch {
        stato = problema
      }
      cambia(conRif((p) => conRiga(p, id, (r) => ({ ...r, stato }))), numero)
    },
    [cambia],
  )

  const chiediNic = useCallback(
    async (mesi: string[], numero: number) => {
      if (!mesi.length) return
      cambia(conRif((p) => conNic(p, (n) => ({ ...n, stato: { tipo: 'scarica' } }))), numero)
      let stato
      try {
        stato = statoDaNic(await ponte.nicIstat(mesi))
      } catch {
        stato = problema
      }
      cambia(conRif((p) => conNic(p, (n) => ({ ...n, stato }))), numero)
    },
    [cambia],
  )

  /** Parte con lo scarico di tutto quello che manca: i sei riferimenti (storia compresa) e il NIC. */
  const parti = useCallback(
    (a: Aggiornamento, numero: number) => {
      const p = a.rif
      if (!p) return
      void chiediNic(p.nic.mesi, numero)
      void (async () => {
        for (const r of p.righe) {
          if (!attivo(numero)) return
          await chiediRiferimento(r.id, r.date, numero)
        }
      })()
    },
    [chiediNic, chiediRiferimento, attivo],
  )

  return useMemo(() => ({ parti, chiediRiferimento, chiediNic }), [parti, chiediRiferimento, chiediNic])
}
