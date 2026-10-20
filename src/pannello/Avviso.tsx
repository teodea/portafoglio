// Il messaggio in basso dopo una scrittura nel file: "Registrato: … Prima di scrivere ho fatto una copia…".
// Si chiude con la X o da solo dopo un po'.
import { useEffect } from 'react'
import { Icona } from '../icone.tsx'
import { chiudiAvviso, useAvviso } from './avviso.ts'

/** Quanto resta: abbastanza per leggere il nome della copia. */
const DURATA = 15000

export function Avviso() {
  const a = useAvviso()
  useEffect(() => {
    if (!a) return
    const t = setTimeout(chiudiAvviso, DURATA)
    return () => clearTimeout(t)
  }, [a])
  if (!a) return null
  return (
    <div className="messaggio" role="status">
      <Icona nome="ok" />
      <span>{a.testo}</span>
      <button type="button" className="btn solo-icona" aria-label="Chiudi il messaggio" onClick={chiudiAvviso}>
        <Icona nome="x" piccola />
      </button>
    </div>
  )
}
