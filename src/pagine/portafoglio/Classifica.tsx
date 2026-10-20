// "Fai meglio dei riferimenti?" (mappa 28, DESIGN.md "Classifica a barre dei riferimenti"): il portafoglio in blu
// e i sette riferimenti, dal migliore al peggiore secondo la misura scelta con i bottoni in alto. Ogni riga è un
// bottone che apre "Da dove viene" con il valore di oggi, i quattro numeri, la fonte, "Scarica di nuovo" e la
// correzione a mano. I conti sono in conti/riferimenti.ts.
import { useState } from 'react'
import { classifica, lunghezzaBarra, nomeMisura, type Confronto, type MisuraConfronto } from '../../conti/riferimenti.ts'
import { percentuale, segnoPercentuale } from '../../formato.ts'
import { MatitaAMano } from '../../pannello/AMano.tsx'
import { classeSegno, useSpiega } from '../../pannello/spiega.ts'

const MISURE: MisuraConfronto[] = ['medio', 'anno', 'inizio']

/** "A e B", "A, B e C" */
const elenco = (nomi: string[]) => (nomi.length < 2 ? nomi.join('') : `${nomi.slice(0, -1).join(', ')} e ${nomi.at(-1)}`)

export function Classifica({ confronto }: { confronto: Confronto }) {
  // La scelta non si ricorda alla riapertura (DESIGN.md, "Bottoni della misura").
  const [misura, setMisura] = useState<MisuraConfronto>('medio')
  const spiega = useSpiega()
  const k = classifica(confronto, misura)
  const totale = confronto.riferimenti.length

  let frase
  if (k.batti === null)
    frase = <>Il tuo numero non c’è ancora: clic sulla riga del portafoglio per sapere perché.</>
  else if (k.su === 0) frase = <>I numeri dei riferimenti non ci sono ancora: arrivano con Aggiorna fine mese.</>
  else
    frase = (
      <>
        Fai meglio di{' '}
        <b>
          {k.batti} {k.batti === 1 ? 'riferimento' : 'riferimenti'} su {k.su}
        </b>
        {k.su < totale ? `; per ${elenco(k.senza)} i numeri non ci sono ancora` : ''}.
      </>
    )

  return (
    <div className="riquadro classifica-rif">
      <div className="testa">
        <h2>Fai meglio dei riferimenti?</h2>
        <div className="segmenti" role="group" aria-label="Come misurare">
          {MISURE.map((m) => (
            <button key={m} type="button" aria-pressed={misura === m} onClick={() => setMisura(m)}>
              {nomeMisura(m, confronto.anno)}
            </button>
          ))}
        </div>
      </div>
      <div className="attrezzi">
        <span>
          Gli stessi euro che hai messo tu, nelle stesse date. {frase} Clic su una riga per il valore di oggi e il conto.
        </span>
      </div>
      <ul className="barre" aria-label={`Classifica: ${nomeMisura(misura, confronto.anno).toLowerCase()}`}>
        {k.righe.map(({ riga, n }) => (
          <li key={riga.id} className={riga.id === 'portafoglio' ? 'tu' : undefined}>
            <button type="button" className="num" aria-haspopup="dialog" onClick={() => spiega(riga.perche)}>
              <span className="nome">
                {riga.nome}
                {riga.aMano && (
                  <>
                    {' '}
                    <MatitaAMano titolo="Un valore scritto a mano" />
                  </>
                )}
                {riga.finoA && <span className="tenue fino"> ({riga.finoA})</span>}
              </span>
              <span className="binario" aria-hidden="true">
                {n !== null && <i style={{ width: `${lunghezzaBarra(n, k.massimo)}%` }} />}
              </span>
              <span className={`val ${n === null ? 'tenue' : classeSegno(segnoPercentuale(n))}`}>
                {riga.manca ? 'manca' : n === null ? '—' : percentuale(n)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
