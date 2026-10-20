// I movimenti registrati da quando è aperta l'applicazione: in Movimenti portano l'etichetta "appena registrato".
// Restano in memoria e basta: alla prossima apertura sono movimenti come gli altri.
import { useSyncExternalStore } from 'react'

let appena: ReadonlySet<string> = new Set()
const chi = new Set<() => void>()

export function segnaAppena(id: string) {
  appena = new Set([...appena, id])
  for (const f of chi) f()
}

export function useAppena(): ReadonlySet<string> {
  return useSyncExternalStore(
    (f) => {
      chi.add(f)
      return () => void chi.delete(f)
    },
    () => appena,
  )
}
