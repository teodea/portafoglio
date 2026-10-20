// La striscia in alto su ogni pagina, quando un mese è finito e non è aggiornato:
// "Ottobre è finito: aggiorna i prezzi di fine mese", con il tasto. E il tasto nella barra a sinistra.
import { NavLink, useLocation } from 'react-router-dom'
import { NomeMese } from '../dati/aggiorna/calendario.ts'
import { Icona } from '../icone.tsx'
import { useStato } from '../stato.tsx'
import { useAggiorna } from './contesto.tsx'

export const PERCORSO_AGGIORNA = '/aggiorna'

export function StrisciaFineMese() {
  const { agg, mesiDaFare } = useAggiorna()
  const { pathname } = useLocation()
  if (pathname === PERCORSO_AGGIORNA) return null
  if (agg)
    return (
      <div className="striscia" role="status">
        <span>
          <Icona nome="info" />
          <span>
            <b>
              {agg.rifai
                ? `Stai rifacendo ${NomeMese(agg.mese).toLowerCase()}`
                : `L’aggiornamento di ${NomeMese(agg.mese).toLowerCase()} è aperto`}
              :
            </b>{' '}
            niente è ancora salvato.
          </span>
        </span>
        <NavLink to={PERCORSO_AGGIORNA} className="btn primario">
          <Icona nome="aggiorna" piccola /> Torna all’aggiornamento
        </NavLink>
      </div>
    )
  if (!mesiDaFare.length) return null
  const nomi = mesiDaFare.map(NomeMese)
  const frase = nomi.length === 1 ? `${nomi[0]} è finito` : `${nomi.slice(0, -1).join(', ')} e ${nomi.at(-1)!.toLowerCase()} sono finiti`
  return (
    <div className="striscia" role="status">
      <span>
        <Icona nome="info" />
        <span>
          <b>{frase}:</b> aggiorna i prezzi di fine mese.
        </span>
      </span>
      <NavLink to={PERCORSO_AGGIORNA} className="btn primario">
        <Icona nome="aggiorna" piccola /> Aggiorna fine mese
      </NavLink>
    </div>
  )
}

/** Il tasto "Aggiorna fine mese" della barra a sinistra. Con il file rotto (o senza file) è spento. */
export function TastoAggiorna() {
  const { apertura } = useStato()
  if (apertura.stato !== 'pronto')
    return (
      <button
        type="button"
        className="btn primario"
        disabled
        title={apertura.stato === 'rotto' ? 'Prima bisogna rimettere a posto il file dei dati' : 'Prima scegli la cartella dei dati'}
      >
        <Icona nome="aggiorna" piccola /> Aggiorna fine mese
      </button>
    )
  return (
    <NavLink to={PERCORSO_AGGIORNA} className="btn primario">
      <Icona nome="aggiorna" piccola /> Aggiorna fine mese
    </NavLink>
  )
}
