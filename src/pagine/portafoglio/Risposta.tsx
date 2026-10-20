// Il riquadro della risposta, "Quanto stai guadagnando" (DESIGN.md, "Riquadro della risposta"):
// il guadagno in grande, sotto la % dall'inizio e il medio annuo, poi l'elenco con valore, soldi
// investiti, il mese, l'anno e i dividendi. Ogni cifra si clicca da sola e apre il suo "Da dove viene".
import type { ReactNode } from 'react'
import type { ContiPortafoglio } from '../../conti/portafoglio.ts'
import type { Numero } from '../../conti/spiegazione.ts'
import { euro, guadagnoEuro, NomeMese, percentuale, segno, segnoPercentuale } from '../../formato.ts'
import { Num } from '../../pannello/Pannello.tsx'
import { classeSegno } from '../../pannello/spiega.ts'

/** Una percentuale con segno e colore, o il trattino che spiega perché manca. */
function Pct({ numero }: { numero: Numero }) {
  if (numero.n === null)
    return (
      <Num numero={numero} className="tenue">
        —
      </Num>
    )
  return (
    <Num numero={numero} className={classeSegno(segnoPercentuale(numero.n))}>
      {percentuale(numero.n)}
    </Num>
  )
}

function Riga({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div>
      <dt>{etichetta}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function Risposta({ conti }: { conti: ContiPortafoglio }) {
  const g = conti.guadagno.n ?? 0
  return (
    <div className="riquadro risposta">
      <div className="dentro">
        <div className="capo">
          <h2>Quanto stai guadagnando</h2>
          <Num numero={conti.guadagno} className={`enorme ${classeSegno(segno(g))}`}>
            {guadagnoEuro(g)}
          </Num>
          <p className="sotto-enorme">
            <Pct numero={conti.dallInizio} /> dall’inizio · <Pct numero={conti.medioAnnuo} /> all’anno in media
          </p>
        </div>
        <dl className="righe">
          <Riga etichetta="Valore dei titoli oggi">
            <Num numero={conti.valore}>{euro(conti.valore.n ?? 0)}</Num>
          </Riga>
          <Riga etichetta="Soldi investiti">
            <Num numero={conti.investiti}>{euro(conti.investiti.n ?? 0)}</Num>
          </Riga>
          <Riga etichetta={conti.fine ? NomeMese(conti.fine) : 'L’ultimo mese'}>
            <Pct numero={conti.mese} />
          </Riga>
          <Riga etichetta={`Anno ${conti.anno}`}>
            <Pct numero={conti.annoInCorso} />
          </Riga>
          <Riga etichetta="Dividendi incassati">
            <Num numero={conti.dividendi}>{euro(conti.dividendi.n ?? 0)}</Num>
          </Riga>
        </dl>
      </div>
    </div>
  )
}
