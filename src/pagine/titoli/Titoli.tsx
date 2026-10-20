// La pagina Titoli (mappa, ticket 25): tre riquadri, poi le schede "Al <data dei prezzi>", Mese per mese, Dividendi e Venduti.
// La scheda scelta sta nell'indirizzo (?scheda=…), così tornando dalla Scheda del titolo si ritrova.
// I riquadri contano solo i titoli che hai oggi, senza i venduti (collaudo del 20/10: la riga col numero del Portafoglio
// confondeva e l'utente l'ha tolta, come la frase sui soldi nuovi: le spiega il clic sul numero).
import { useRef, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { data, euro, guadagnoEuro, nomeMese, percentuale, segno, segnoPercentuale } from '../../formato.ts'
import { classeSegno, useSpiega } from '../../pannello/spiega.ts'
import { Dividendi } from './Dividendi.tsx'
import { MesePerMese } from './MesePerMese.tsx'
import { Oggi } from './Oggi.tsx'
import { useConti } from './usa.ts'
import { Venduti } from './Venduti.tsx'

const SCHEDE = ['oggi', 'mesi', 'dividendi', 'venduti'] as const
type Scheda = (typeof SCHEDE)[number]

export function Titoli() {
  const conti = useConti()
  const spiega = useSpiega()
  const [cerca, setCerca] = useSearchParams()
  const scelta = cerca.get('scheda')
  const scheda: Scheda = (SCHEDE as readonly string[]).includes(scelta ?? '') ? (scelta as Scheda) : 'oggi'
  const bottoni = useRef<(HTMLButtonElement | null)[]>([])

  const { fine, aperti, ultimoMese } = conti
  const chiusi = conti.titoli.filter((t) => t.stato === 'chiuso').length
  const nomi: Record<Scheda, string> = {
    oggi: fine ? `Al ${data(fine)}` : 'Oggi',
    mesi: 'Mese per mese',
    dividendi: 'Dividendi',
    venduti: `Venduti (${chiusi})`,
  }

  const scegli = (s: Scheda) => setCerca(s === 'oggi' ? {} : { scheda: s }, { replace: true })
  const frecce = (e: KeyboardEvent, i: number) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!passo) return
    const j = (i + passo + SCHEDE.length) % SCHEDE.length
    scegli(SCHEDE[j])
    bottoni.current[j]?.focus()
  }

  if (conti.titoli.length === 0)
    return (
      <section>
        <div className="testata">
          <h1>Titoli</h1>
        </div>
        <div className="riquadro vuoto">Nel file dei dati non sono ancora presenti titoli: compaiono con la registrazione del primo acquisto.</div>
      </section>
    )

  const g = aperti.guadagno.n ?? 0
  const pct = aperti.dallAcquisto.n
  return (
    <section>
      <div className="testata">
        <h1>Titoli</h1>
        {fine && <span className="tenue">Prezzi al {data(fine)}</span>}
      </div>

      <div className="numeri">
        <button type="button" className="numero capo" aria-haspopup="dialog" onClick={() => spiega(aperti.valore.perche)}>
          <small>
            Controvalore ({aperti.quanti} {aperti.quanti === 1 ? 'titolo' : 'titoli'})
          </small>
          <b>{euro(aperti.valore.n ?? 0)}</b>
          <span>Costo d’acquisto {euro(aperti.pagato.n ?? 0)}</span>
        </button>
        <button type="button" className="numero capo" aria-haspopup="dialog" onClick={() => spiega(aperti.guadagno.perche)}>
          <small>{g < 0 ? 'Minusvalenza' : 'Plusvalenza'} dei titoli in portafoglio</small>
          <b className={classeSegno(segno(g))}>{guadagnoEuro(g)}</b>
          <span className={pct === null ? '' : classeSegno(segnoPercentuale(pct))}>{pct === null ? '—' : `${percentuale(pct)} sul costo`}</span>
        </button>
        <button type="button" className="numero capo" aria-haspopup="dialog" onClick={() => spiega(ultimoMese.perche)}>
          <small>{fine ? `Rendimento di ${nomeMese(fine)}` : 'Rendimento dell’ultimo mese'}</small>
          <b className={ultimoMese.n === null ? 'tenue' : classeSegno(segnoPercentuale(ultimoMese.n))}>
            {ultimoMese.n === null ? '—' : percentuale(ultimoMese.n)}
          </b>
        </button>
      </div>

      <div className="riquadro">
        <div className="schede" role="tablist" aria-label="Viste dei titoli">
          {SCHEDE.map((s, i) => (
            <button
              key={s}
              ref={(el) => {
                bottoni.current[i] = el
              }}
              type="button"
              role="tab"
              id={`scheda-${s}`}
              aria-selected={scheda === s}
              aria-controls="pannello-scheda"
              tabIndex={scheda === s ? 0 : -1}
              onClick={() => scegli(s)}
              onKeyDown={(e) => frecce(e, i)}
            >
              {nomi[s]}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="pannello-scheda" aria-labelledby={`scheda-${scheda}`}>
          {scheda === 'oggi' && <Oggi conti={conti} />}
          {scheda === 'mesi' && (
            <MesePerMese conti={conti} vista={cerca.get('vista')} scegliVista={(v) => setCerca({ scheda: 'mesi', vista: v }, { replace: true })} />
          )}
          {scheda === 'dividendi' && <Dividendi conti={conti} />}
          {scheda === 'venduti' && <Venduti conti={conti} />}
        </div>
      </div>
    </section>
  )
}
