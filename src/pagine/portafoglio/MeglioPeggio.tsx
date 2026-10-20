// "I titoli che vanno meglio e peggio" (mappa, ticket 28): 3 migliori e 3 peggiori in due colonne,
// "Dall'acquisto" o sull'ultimo mese. Il clic su una riga apre la Scheda del titolo; il clic sulla
// percentuale apre "Da dove viene". In fondo il link a tutti i titoli.
import type { KeyboardEvent, MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { meglioPeggio, nomeUltimoMese, type MeglioPeggio as Colonne, type MisuraTitoli } from '../../conti/portafoglio.ts'
import { eAMano } from '../../conti/prezzo-a-mano.ts'
import type { ContiTitoli, ContoTitolo } from '../../conti/titoli.ts'
import { nomeMese } from '../../formato.ts'
import { ChipAMano } from '../../pannello/AMano.tsx'
import { Pill } from '../titoli/comuni.tsx'
import { indirizzoScheda } from '../titoli/usa.ts'

/** Dalla Scheda del titolo si torna qui. */
const DA_QUI = { indietro: '/', nomeIndietro: 'Portafoglio' }

/** Sotto il simbolo: cosa è il titolo in parole semplici o, finché non ci sono, il nome lungo. */
const sotto = (c: ContoTitolo) => c.paroleSemplici ?? (c.titolo.simbolo ? c.titolo.nome : null)

function Colonna({ titolo, righe }: { titolo: string; righe: Colonne['meglio'] }) {
  const vai = useNavigate()
  const apri = (id: string) => (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    vai(indirizzoScheda(id), { state: DA_QUI })
  }
  return (
    <div>
      <h3>{titolo}</h3>
      {righe.length === 0 ? (
        <p className="tenue piccolo">Servono almeno due titoli per confrontarli.</p>
      ) : (
        <ul className="classifica">
          {righe.map(({ conto, numero }) => (
            <li key={conto.id} className="riga" onClick={apri(conto.id)}>
              <div className="tit">
                <Link
                  to={indirizzoScheda(conto.id)}
                  state={DA_QUI}
                  onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
                  title={`Apri la scheda di ${conto.nomeCorto}`}
                >
                  {conto.nomeCorto}
                </Link>
                {sotto(conto) && <span>{sotto(conto)}</span>}
              </div>
              {/* Il numero viene dal prezzo dell'ultimo fine mese: se è scritto a mano, si vede anche qui. */}
              {eAMano(conto.ultimoPrezzo) && <ChipAMano />}
              <Pill numero={numero} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MeglioPeggio({ titoli, misura, scegli }: { titoli: ContiTitoli; misura: MisuraTitoli; scegli: (m: MisuraTitoli) => void }) {
  const { meglio, peggio, senzaNumero } = meglioPeggio(titoli.titoli, misura)
  const fine = titoli.fine!
  const misure: [MisuraTitoli, string][] = [
    ['acquisto', 'Dall’acquisto'],
    ['mese', nomeUltimoMese(fine)],
  ]
  return (
    <div className="riquadro blocco meglio-peggio">
      <div className="testa">
        <h2>I titoli che vanno meglio e peggio</h2>
        <div className="segmenti" role="group" aria-label="Come misurarli">
          {misure.map(([k, nome]) => (
            <button key={k} type="button" aria-pressed={misura === k} onClick={() => scegli(k)}>
              {nome}
            </button>
          ))}
        </div>
      </div>
      <div className="duecol">
        {/* "Vanno peggio" suonava come una perdita anche per titoli in guadagno (collaudo del 19/10): sono solo gli ultimi. */}
        <Colonna titolo="In cima alla classifica" righe={meglio} />
        <Colonna titolo="In fondo alla classifica" righe={peggio} />
      </div>
      <div className="piede">
        <span className="tenue">
          {misura === 'mese' && senzaNumero.length > 0
            ? `${senzaNumero.map((t) => t.nomeCorto).join(', ')} ${senzaNumero.length === 1 ? 'è entrato' : 'sono entrati'} a ${nomeMese(fine)}: ${senzaNumero.length === 1 ? 'il suo mese si conta' : 'il loro mese si conta'} dal prossimo.`
            : 'Clic su un titolo per aprirne la scheda; clic sulla percentuale per sapere da dove viene.'}
        </span>
        <Link to="/titoli" className="link">
          Tutti i {titoli.aperti.quanti} titoli →
        </Link>
      </div>
    </div>
  )
}
