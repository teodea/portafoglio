// Il controllo di investing.com nella lista di Aggiorna (ticket 27 della mappa):
// "uguale" con la spunta grigia, "50,33: diverso di +0,6%" in grassetto (il clic apre il dettaglio),
// oppure perché non si è potuto fare. Nel dettaglio della riga, la frase "di solito vale la borsa".
import { confrontoDellaRiga, senzaCodice, type Confronto } from '../dati/aggiorna/controllo-prezzo.ts'
import type { RigaTitolo } from '../dati/aggiorna/lista.ts'
import { Icona } from '../icone.tsx'
import { differenza, prezzo, simboloValuta } from './numeri.ts'

const maiuscola = (t: string) => t[0].toUpperCase() + t.slice(1)

/** Il contenuto della colonna "Controllo investing.com". */
export function ColonnaControllo({ r, aperta, apri }: { r: RigaTitolo; aperta: boolean; apri: () => void }) {
  if (r.aMano !== undefined) return <span className="tenue">—</span>
  const c = confrontoDellaRiga(r)
  if (!c) return <span className="tenue">—</span>
  // Senza il codice investing.com il perché è lo stesso per tutti: lo dice una volta sola l'avviso sopra la lista.
  if (senzaCodice(c)) return <span className="tenue piccolo agg-senza-codice">— manca il codice</span>
  if (c.tipo === 'non-fatto') return <span className="agg-sotto">non fatto: {c.perche}</span>
  const nota = c.nota ? <span className="agg-sotto">{maiuscola(c.nota)}</span> : null
  if (c.tipo === 'uguale')
    return (
      <span>
        <span className="agg-uguale">
          <Icona nome="ok" piccola /> uguale
        </span>
        {nota}
      </span>
    )
  return (
    <span>
      <button type="button" className="agg-num agg-diverso" aria-expanded={aperta} onClick={apri}>
        <Icona nome="info" piccola /> {prezzo(c.controllo)}: diverso di {differenza(c.differenza)}
      </button>
      {nota}
    </span>
  )
}

function frase(c: Confronto, r: RigaTitolo, fonte: string) {
  const v = simboloValuta(r.valuta)
  if (c.tipo === 'non-fatto') return <p className="tenue">Controllo di investing.com non fatto: {c.perche}.</p>
  const altro = c.nota ? ` (${c.nota})` : ''
  if (c.tipo === 'uguale')
    return (
      <p className="tenue">
        Controllo: investing.com dà lo stesso prezzo{altro}.
      </p>
    )
  return (
    <div className="agg-controllo-diverso">
      <b>Controllo:</b> investing.com dice{' '}
      <b>
        {prezzo(c.controllo)} {v}
      </b>
      {altro}, {differenza(c.differenza)} rispetto a {fonte}. Di solito vale la borsa: se pensi che
      sia giusto l’altro, scrivilo qui sotto.
    </div>
  )
}

/** Il controllo nel dettaglio della riga (il pannello del prezzo nella schermata Aggiorna). */
export function ControlloNelDettaglio({ r }: { r: RigaTitolo }) {
  const c = confrontoDellaRiga(r)
  if (!c || r.stato.tipo !== 'arrivato') return null
  return frase(c, r, r.tieni ? 'il prezzo di prima' : r.stato.esito.fonte)
}
