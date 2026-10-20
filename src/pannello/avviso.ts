// Il messaggio in basso dopo una scrittura nel file (ticket 11): chiunque lo mostra con mostraAvviso(),
// e lo disegna <Avviso /> (Avviso.tsx), dentro il pannello che avvolge tutta l'applicazione.
import { useSyncExternalStore } from 'react'

export type AvvisoAperto = { testo: string; volta: number }

let attuale: AvvisoAperto | null = null
const chi = new Set<() => void>()
const avvisa = () => chi.forEach((f) => f())

export function mostraAvviso(testo: string) {
  attuale = { testo, volta: (attuale?.volta ?? 0) + 1 }
  avvisa()
}

export function chiudiAvviso() {
  attuale = null
  avvisa()
}

export function useAvviso(): AvvisoAperto | null {
  return useSyncExternalStore(
    (f) => {
      chi.add(f)
      return () => void chi.delete(f)
    },
    () => attuale,
  )
}
