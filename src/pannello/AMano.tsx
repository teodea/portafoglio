// Il segno "manuale" (DESIGN.md, "Correzione a mano"): una sola etichetta gialla per ogni prezzo scritto a mano,
// nell'aggiornamento o corretto dopo. Nelle tabelle mese per mese, dove non c'è spazio, solo la matita.
import './correzione.css'

function Matita() {
  return (
    <svg className="ic p" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}

/** Il chip crema con testo ambra: "manuale" nelle tabelle strette, "corretto manualmente" dove c'è spazio. */
export function ChipAMano({ lungo = false }: { lungo?: boolean }) {
  return (
    <span className="chip-mano">
      <Matita />
      {lungo ? 'corretto manualmente' : 'manuale'}
    </span>
  )
}

/** Solo la matita ambra, accanto a un valore fatto con un prezzo (o un valore di riferimento) scritto a mano. */
export function MatitaAMano({ titolo = 'Prezzo inserito manualmente' }: { titolo?: string }) {
  return (
    <span className="matita-mano" title={titolo} role="img" aria-label={titolo.toLowerCase()}>
      <Matita />
    </span>
  )
}
