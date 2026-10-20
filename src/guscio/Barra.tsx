// La barra a sinistra: il nome, le quattro pagine, in fondo "Aggiorna fine mese" e la cartella dei dati.
import { NavLink } from 'react-router-dom'
import { Icona, type NomeIcona } from '../icone.tsx'
import { useStato } from '../stato.tsx'
import { TastoAggiorna } from '../aggiorna/Striscia.tsx'

const PAGINE: { percorso: string; nome: string; icona: NomeIcona }[] = [
  { percorso: '/', nome: 'Portafoglio', icona: 'casa' },
  { percorso: '/titoli', nome: 'Titoli', icona: 'lista' },
  { percorso: '/movimenti', nome: 'Movimenti', icona: 'frecce' },
  { percorso: '/dati', nome: 'Dati', icona: 'cartella' },
]

export function Barra() {
  const { apertura } = useStato()
  const cartella = apertura.stato === 'nessuna-cartella' ? null : apertura.cartella
  return (
    <nav className="barra" aria-label="Pagine">
      <div className="marchio">
        <i>
          <Icona nome="linea" piccola />
        </i>
        Portafoglio titoli
      </div>
      {PAGINE.map((p) => (
        <NavLink key={p.percorso} to={p.percorso} end={p.percorso === '/'} className="voce">
          <Icona nome={p.icona} />
          {p.nome}
        </NavLink>
      ))}
      <div className="piede">
        <TastoAggiorna />
        {cartella && (
          <NavLink to="/dati" className="cartella-barra" title={`Cartella dei dati: ${cartella.percorso}`}>
            <Icona nome="cartella" piccola />
            <span>{cartella.nome}</span>
          </NavLink>
        )}
      </div>
    </nav>
  )
}
