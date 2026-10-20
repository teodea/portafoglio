// Pezzi in comune tra le schede della pagina Titoli e la Scheda del titolo.
import type { KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fonteInParole } from '../../conti/fonti.ts'
import { eAMano } from '../../conti/prezzo-a-mano.ts'
import type { Numero } from '../../conti/spiegazione.ts'
import type { ContoTitolo } from '../../conti/titoli.ts'
import { cambio, percentuale, prezzo, segnoPercentuale } from '../../formato.ts'
import { ChipAMano } from '../../pannello/AMano.tsx'
import { Num } from '../../pannello/Pannello.tsx'
import { classeSegno } from '../../pannello/spiega.ts'
import { indirizzoScheda } from './usa.ts'

/** La prima colonna: simbolo in grassetto (un link, per la tastiera) e sotto le parole semplici. */
export function NomeTitolo({ conto, senzaParole = false }: { conto: ContoTitolo; senzaParole?: boolean }) {
  const { search } = useLocation()
  const sotto = conto.paroleSemplici ?? (conto.titolo.simbolo ? conto.titolo.nome : null)
  return (
    <div className="tit">
      <Link
        to={indirizzoScheda(conto.id)}
        state={{ indietro: `/titoli${search}` }}
        onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
        title={`Apri la scheda di ${conto.nomeCorto}`}
      >
        {conto.nomeCorto}
      </Link>
      {!senzaParole && sotto && <span>{sotto}</span>}
    </div>
  )
}

/** Un numero o il trattino lungo, sempre cliccabile: anche il "—" spiega perché manca. */
export function Cella({ numero, scrivi, segno }: { numero: Numero; scrivi: (n: number) => string; segno?: (n: number) => number }) {
  if (numero.n === null)
    return (
      <Num numero={numero} className="tenue">
        —
      </Num>
    )
  return (
    <Num numero={numero} className={segno ? classeSegno(segno(numero.n)) : undefined}>
      {scrivi(numero.n)}
    </Num>
  )
}

/** La percentuale principale della riga, nella pill verde o rossa. */
export function Pill({ numero }: { numero: Numero }) {
  if (numero.n === null)
    return (
      <Num numero={numero} className="tenue">
        —
      </Num>
    )
  return (
    <Num numero={numero} className={`pill ${classeSegno(segnoPercentuale(numero.n))}`}>
      {percentuale(numero.n)}
    </Num>
  )
}

/** Il prezzo con sotto, per un titolo in valuta, il cambio e poi la fonte, oppure il chip "a mano". */
export function PrezzoConFonte({ conto }: { conto: ContoTitolo }) {
  const p = conto.ultimoPrezzo
  if (!p || conto.stato !== 'aperto') return <Cella numero={conto.prezzo} scrivi={() => '—'} />
  const f = fonteInParole(p.fonte)
  return (
    <>
      <Num numero={conto.prezzo}>{prezzo(p.prezzo, p.valuta)}</Num>
      {p.valuta !== 'EUR' && p.cambio && <span className="sotto">cambio {cambio(p.cambio)}</span>}
      <span className="sotto">{eAMano(p) ? <ChipAMano /> : f.nome}</span>
    </>
  )
}
