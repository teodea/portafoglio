// I conti dei titoli e l'apertura della Scheda del titolo, per le schede della pagina Titoli.
import { useMemo, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { contiDeiTitoli, type ContiTitoli } from '../../conti/titoli.ts'
import { useFile } from '../../stato.tsx'

/** I conti dei titoli, rifatti solo quando cambia il file. */
export function useConti(): ContiTitoli {
  const { dati } = useFile()
  return useMemo(() => contiDeiTitoli(dati), [dati])
}

export const indirizzoScheda = (id: string) => `/titoli/${encodeURIComponent(id)}`

/** Il clic su una riga apre la Scheda del titolo; la scheda sa a quale scheda di Titoli tornare. */
export function useApriScheda() {
  const navigate = useNavigate()
  const { search } = useLocation()
  return (id: string) => navigate(indirizzoScheda(id), { state: { indietro: `/titoli${search}` } })
}

/** Le proprietà di una riga che apre la scheda: clic ovunque tranne che sui numeri. */
export function rigaCheApre(apri: (id: string) => void, id: string) {
  return {
    className: 'riga',
    onClick: (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, a')) return
      apri(id)
    },
  }
}
