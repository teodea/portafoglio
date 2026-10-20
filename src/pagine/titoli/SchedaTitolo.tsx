// La Scheda del titolo (mappa, ticket 25): si apre con un clic su un titolo nella pagina Titoli.
// Testata con nome, parole semplici ed etichette; i riquadri valore, pagato, guadagno, medio annuo;
// il grafico del valore con la linea del pagato; le schede Mese per mese, Operazioni, Dividendi e
// Da dove vengono i numeri. La scheda scelta sta nell'indirizzo (?scheda=…).
import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { eAMano } from '../../conti/prezzo-a-mano.ts'
import { schedaDelTitolo } from '../../conti/scheda.ts'
import type { Numero } from '../../conti/spiegazione.ts'
import { ANNI_MINIMI_MEDIO, type ContoTitolo } from '../../conti/titoli.ts'
import { cambio, data, euro, guadagnoEuro, numero, percentuale, prezzo, quote, segno, segnoPercentuale } from '../../formato.ts'
import { Icona } from '../../icone.tsx'
import { ChipAMano } from '../../pannello/AMano.tsx'
import { classeSegno, useSpiega } from '../../pannello/spiega.ts'
import { useFile } from '../../stato.tsx'
import { Grafico } from './scheda/Grafico.tsx'
import { DaDoveVengono, DividendiDelTitolo, MesiDelTitolo, Operazioni } from './scheda/Schede.tsx'
import './scheda/scheda.css'
import { useConti } from './usa.ts'

const VALUTE: Record<string, string> = { GBP: 'sterline', USD: 'dollari', CHF: 'franchi svizzeri' }
const SCHEDE = ['mesi', 'operazioni', 'dividendi', 'fonti'] as const
type Scheda = (typeof SCHEDE)[number]

export function SchedaTitolo() {
  const { id } = useParams()
  const { state } = useLocation()
  const { dati } = useFile()
  const conti = useConti()
  const [cerca, setCerca] = useSearchParams()
  const bottoni = useRef<(HTMLButtonElement | null)[]>([])
  const t = conti.titoli.find((x) => x.id === id)
  const scheda = useMemo(() => (t ? schedaDelTitolo(dati, t) : null), [dati, t])
  if (!t || !scheda) return <Navigate to="/titoli" replace />
  const indietro = typeof state?.indietro === 'string' ? state.indietro : '/titoli'

  const scelta = cerca.get('scheda')
  const attiva: Scheda = (SCHEDE as readonly string[]).includes(scelta ?? '') ? (scelta as Scheda) : 'mesi'
  const scegli = (s: Scheda) => setCerca(s === 'mesi' ? {} : { scheda: s }, { replace: true, state })
  const frecce = (e: KeyboardEvent, i: number) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!passo) return
    const j = (i + passo + SCHEDE.length) % SCHEDE.length
    scegli(SCHEDE[j])
    bottoni.current[j]?.focus()
  }
  const nomi: Record<Scheda, string> = {
    mesi: 'Mese per mese',
    operazioni: `Operazioni (${scheda.operazioni.length})`,
    dividendi: `Dividendi (${scheda.dividendi.length})`,
    fonti: 'Da dove vengono i numeri',
  }

  return (
    <section className="scheda-titolo">
      <div className="indietro">
        <Link to={indietro} className="link">
          <Icona nome="indietro" piccola /> Titoli
        </Link>
      </div>
      <div className="capo-titolo">
        <h1>
          {t.nomeCorto}
          {t.titolo.simbolo && <span>{t.titolo.nome}</span>}
        </h1>
        <div className="etichette">
          {t.paroleSemplici && <span className="etichetta">{t.paroleSemplici}</span>}
          <span className="etichetta">{t.titolo.isin}</span>
          <span className="etichetta">{t.titolo.nomeBorsa}</span>
          {t.valuta !== 'EUR' && <span className="etichetta">quotato in {VALUTE[t.valuta] ?? t.valuta}</span>}
          <span className="etichetta">
            {t.stato === 'chiuso'
              ? `venduto${t.ultimaVendita ? ` il ${data(t.ultimaVendita)}` : ''}`
              : t.stato === 'nuovo'
                ? `comprato${t.primoAcquisto ? ` il ${data(t.primoAcquisto)}` : ''}`
                : `${quote(t.quote)} quote${t.primoAcquisto ? ` dal ${data(t.primoAcquisto)}` : ''}`}
          </span>
        </div>
      </div>

      <Riquadri t={t} />

      {scheda.punti.length > 1 && (
        <div className="riquadro riquadro-grafico">
          <Grafico
            punti={scheda.punti}
            nomePagato={scheda.conVendite ? 'Costo delle quote' : 'Pagato'}
            descrizione={`Valore di ${t.nomeCorto} a ogni fine mese e quanto hai pagato`}
          />
          <div className="legenda">
            <span>
              <i aria-hidden="true" />
              Valore a fine mese
            </span>
            <span>
              <i className="pagato" aria-hidden="true" />
              {scheda.conVendite ? 'Costo delle quote che avevi (al costo medio)' : 'Pagato'}
            </span>
            <span className="tenue">Clic sul grafico per il conto di quel mese</span>
          </div>
        </div>
      )}

      <div className="riquadro">
        <div className="schede" role="tablist" aria-label={`Come vedere ${t.nomeCorto}`}>
          {SCHEDE.map((s, i) => (
            <button
              key={s}
              ref={(el) => {
                bottoni.current[i] = el
              }}
              type="button"
              role="tab"
              id={`scheda-titolo-${s}`}
              aria-selected={attiva === s}
              aria-controls="pannello-scheda-titolo"
              tabIndex={attiva === s ? 0 : -1}
              onClick={() => scegli(s)}
              onKeyDown={(e) => frecce(e, i)}
            >
              {nomi[s]}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="pannello-scheda-titolo" aria-labelledby={`scheda-titolo-${attiva}`}>
          {attiva === 'mesi' && <MesiDelTitolo conto={t} righe={scheda.mesi} />}
          {attiva === 'operazioni' && <Operazioni scheda={scheda} />}
          {attiva === 'dividendi' && <DividendiDelTitolo conto={t} scheda={scheda} />}
          {attiva === 'fonti' && <DaDoveVengono paragrafi={scheda.paragrafi} />}
        </div>
      </div>
    </section>
  )
}

/** Un riquadro dei numeri che si spiega con un clic. */
function Riquadro({ numero: n, etichetta, children, sotto }: { numero: Numero; etichetta: string; children: ReactNode; sotto: ReactNode }) {
  const spiega = useSpiega()
  return (
    <button type="button" className="numero" aria-haspopup="dialog" onClick={() => spiega(n.perche)}>
      <small>{etichetta}</small>
      {children}
      <span>{sotto}</span>
    </button>
  )
}

function Riquadri({ t }: { t: ContoTitolo }) {
  const p = t.ultimoPrezzo
  const g = t.guadagno.n
  const pct = t.dallAcquisto.n
  return (
    <div className="numeri">
      {t.stato === 'chiuso' ? (
        <Riquadro numero={t.incassato} etichetta="Incassato vendendo" sotto={t.ultimaVendita ? `venduto il ${data(t.ultimaVendita)}` : 'venduto'}>
          <b>{euro(t.incassato.n ?? 0)}</b>
        </Riquadro>
      ) : t.stato === 'nuovo' || t.valore.n === null || !p ? (
        <Riquadro numero={t.valore} etichetta="Valore" sotto="arriva con il prossimo aggiornamento">
          <b className="tenue">—</b>
        </Riquadro>
      ) : (
        <Riquadro
          numero={t.valore}
          etichetta={`Valore al ${data(p.data)}`}
          sotto={
            <>
              {t.valoreInValuta !== null && p.cambio
                ? `${prezzo(t.valoreInValuta, p.valuta)} al cambio ${cambio(p.cambio)}`
                : `${quote(t.quote)} × ${prezzo(p.prezzo, p.valuta)}`}
              {eAMano(p) && (
                <>
                  {' '}
                  <ChipAMano />
                </>
              )}
            </>
          }
        >
          <b>{euro(t.valore.n)}</b>
        </Riquadro>
      )}
      <Riquadro
        numero={t.pagato}
        etichetta="Pagato"
        sotto={t.costoMedio.n !== null ? `costo medio ${euro(t.costoMedio.n, 2)} a quota` : 'commissioni comprese'}
      >
        <b>{euro(t.pagato.n ?? 0)}</b>
      </Riquadro>
      <Riquadro
        numero={t.guadagno}
        etichetta="Guadagno"
        sotto={
          pct === null ? (
            'arriva con il prossimo aggiornamento'
          ) : (
            <span className={classeSegno(segnoPercentuale(pct))}>{percentuale(pct)} dall’acquisto</span>
          )
        }
      >
        <b className={g === null ? 'tenue' : classeSegno(segno(g))}>{g === null ? '—' : guadagnoEuro(g)}</b>
      </Riquadro>
      <Riquadro
        numero={t.medioAnnuo}
        etichetta="Medio annuo"
        sotto={
          t.medioAnnuo.n !== null && t.anni !== null
            ? `in ${numero(t.anni, 1)} anni`
            : t.stato === 'chiuso'
              ? 'per i venduti conta il guadagno'
              : t.anni !== null && t.anni < ANNI_MINIMI_MEDIO
                ? 'da meno di sei mesi: clic per sapere perché'
                : 'clic per sapere perché'
        }
      >
        <b className={t.medioAnnuo.n === null ? 'tenue' : undefined}>{t.medioAnnuo.n === null ? '—' : percentuale(t.medioAnnuo.n)}</b>
      </Riquadro>
    </div>
  )
}
