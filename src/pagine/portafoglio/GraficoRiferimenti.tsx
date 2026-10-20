// Il grafico dell'"Andamento dei mercati" (DESIGN.md, "Grafico degli andamenti"): la variazione dall'inizio del
// periodo a ogni fine mese, il portafoglio in blu e ogni indice con il suo colore, lo zero con il filo forte.
// Al passaggio del mouse (o con le frecce) il mirino e il fumetto con i valori di quel mese, dal migliore.
// Passando su una riga della tabella sotto, la sua linea si accende e le altre si fanno da parte.
// SVG disegnato a mano alla larghezza e all'altezza vere della tela: l'altezza la decide il riquadro (compatto
// nella pagina, grande nella finestra "Ingrandisci").
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { SerieAndamenti } from '../../conti/riferimenti.ts'
import { MENO, mese, meseBreve, numero, percentuale } from '../../formato.ts'
import { griglia } from './griglia.ts'
import { coloreDi, tratteggiata } from './linee.ts'

/** L'altezza finché la tela non è misurata. */
const ALTO = 260
const SINISTRA = 52
const DESTRA = 12
const SOPRA = 16
const SOTTO = 28
const FUMETTO = 216

type Linea = SerieAndamenti['linee'][number]

/** Le cifre a sinistra: "+20%", "0%", "−12,5%". */
function pctAsse(v: number): string {
  const n = Math.round(v * 1000) / 10
  return `${n > 0 ? '+' : n < 0 ? MENO : ''}${numero(Math.abs(n), 0, 1)}%`
}

export function GraficoRiferimenti({ serie, acceso }: { serie: SerieAndamenti; acceso: Linea['id'] | null }) {
  const scatola = useRef<HTMLDivElement>(null)
  const [largo, setLargo] = useState(0)
  const [altoMisurato, setAlto] = useState(0)
  const [sceltoGrezzo, setScelto] = useState<number | null>(null)
  const { mesi, linee } = serie
  const valori = linee.flatMap((l) => l.punti.filter((n): n is number => n !== null))
  const ciSono = valori.length > 0
  // Passando a "Ultimi 12 mesi" i mesi diminuiscono: un mese scelto che non c'è più non vale.
  const scelto = sceltoGrezzo !== null && sceltoGrezzo < mesi.length ? sceltoGrezzo : null

  useEffect(() => {
    const el = scatola.current
    if (!el) return
    const misura = () => {
      setLargo(el.clientWidth)
      setAlto(el.clientHeight)
    }
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ciSono])

  if (!ciSono) return <div className="vuoto">Il grafico compare con i valori degli indici, scaricati con Aggiorna fine mese.</div>

  // Lo zero sta sempre dentro: sopra si guadagna, sotto si perde.
  const linee5 = griglia(Math.min(0, ...valori), Math.max(0, ...valori) + 0.01)
  const basso = linee5[0]
  const cima = linee5[4]
  const w = Math.max(largo, 200)
  const alto = Math.max(altoMisurato || ALTO, 160)
  const x = (i: number) => (mesi.length === 1 ? (SINISTRA + w - DESTRA) / 2 : SINISTRA + (i * (w - SINISTRA - DESTRA)) / (mesi.length - 1))
  const y = (v: number) => SOPRA + (1 - (v - basso) / (cima - basso || 1)) * (alto - SOPRA - SOTTO)
  // Spezzata dove manca un valore, così un buco non diventa una linea dritta.
  const traccia = (punti: (number | null)[]) =>
    punti.map((n, i) => (n === null ? '' : `${i && punti[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(n).toFixed(1)}`)).join('')

  // I mesi sotto: il primo, ogni dicembre e l'ultimo, se non si toccano; tutti se c'è spazio.
  const spazio = mesi.length > 1 ? (w - SINISTRA - DESTRA) / (mesi.length - 1) : w
  const etichette: number[] = []
  mesi.forEach((m, i) => {
    const vuole = spazio >= 52 || i === 0 || i === mesi.length - 1 || m.slice(5, 7) === '12'
    const ultima = etichette.at(-1)
    if (vuole && (ultima === undefined || x(i) - x(ultima) >= 52)) etichette.push(i)
    else if (vuole && i === mesi.length - 1 && ultima !== 0) etichette[etichette.length - 1] = i
  })

  const indice = (e: MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (mesi.length === 1) return 0
    return Math.max(0, Math.min(mesi.length - 1, Math.round((e.clientX - r.left - SINISTRA) / spazio)))
  }
  const tasti = (e: KeyboardEvent) => {
    const ora = scelto ?? mesi.length - 1
    const passi: Record<string, number> = { ArrowLeft: ora - 1, ArrowRight: ora + 1, Home: 0, End: mesi.length - 1 }
    if (e.key in passi) {
      e.preventDefault()
      setScelto(Math.max(0, Math.min(mesi.length - 1, passi[e.key])))
    }
  }

  // Il portafoglio sopra gli indici; la linea accesa sopra tutte.
  const ordine = [...linee.filter((l) => l.id !== 'portafoglio' && l.id !== acceso), ...linee.filter((l) => l.id === 'portafoglio' && l.id !== acceso), ...linee.filter((l) => l.id === acceso)]
  const delMese = (i: number) =>
    linee
      .map((l) => ({ l, n: l.punti[i] }))
      .filter((v): v is { l: Linea; n: number } => v.n !== null)
      .sort((a, b) => b.n - a.n)
  const scelti = scelto === null ? [] : delMese(scelto)
  const tu = linee.find((l) => l.id === 'portafoglio')
  const ultimoTu = tu?.punti.at(-1)
  const descrizione = `Variazione a ogni fine mese del portafoglio, degli indici di borsa e dell'inflazione, da ${mese(mesi[0])} a ${mese(mesi[mesi.length - 1])}${ultimoTu != null ? `; il portafoglio è a ${percentuale(ultimoTu)}` : ''}. Frecce per scorrere i mesi.`
  const xf = scelto === null ? 0 : x(scelto) + 14 + FUMETTO > w ? x(scelto) - 14 - FUMETTO : x(scelto) + 14

  return (
    <div className="grafico grafico-rif">
      <div
        className="tela"
        ref={scatola}
        role="img"
        tabIndex={0}
        aria-label={descrizione}
        onMouseMove={(e) => setScelto(indice(e))}
        onMouseLeave={() => setScelto(null)}
        onKeyDown={tasti}
        onBlur={() => setScelto(null)}
      >
        {largo > 0 && (
          <svg width={w} height={alto} viewBox={`0 0 ${w} ${alto}`} aria-hidden="true">
            {linee5.map((v) => (
              <g key={v}>
                <line x1={SINISTRA} x2={w - DESTRA} y1={y(v)} y2={y(v)} stroke={Math.abs(v) < 1e-9 ? 'var(--filo-forte)' : 'var(--filo)'} />
                <text x={SINISTRA - 8} y={y(v) + 4} fontSize="11" fill="var(--tenue)" textAnchor="end">
                  {pctAsse(v)}
                </text>
              </g>
            ))}
            {etichette.map((i) => (
              <text key={i} x={x(i)} y={alto - 8} fontSize="11" fill="var(--tenue)" textAnchor={mesi.length === 1 ? 'middle' : i === 0 ? 'start' : i === mesi.length - 1 ? 'end' : 'middle'}>
                {meseBreve(mesi[i])}
              </text>
            ))}
            {ordine.map((l) => {
              const tuo = l.id === 'portafoglio'
              const spento = acceso !== null && acceso !== l.id
              return (
                <g key={l.id} opacity={spento ? (tuo ? 0.45 : 0.18) : 1}>
                  <path
                    d={traccia(l.punti)}
                    stroke={coloreDi(l.id)}
                    strokeWidth={tuo || acceso === l.id ? 2.4 : 1.6}
                    strokeDasharray={tratteggiata(l.id) ? '5 4' : undefined}
                    fill="none"
                    strokeLinejoin="round"
                  />
                  {/* Un mese solo, o un valore isolato tra due buchi: un punto, se no non si vedrebbe. */}
                  {l.punti.map((n, i) =>
                    n !== null && (l.punti[i - 1] ?? null) === null && (l.punti[i + 1] ?? null) === null ? <circle key={i} cx={x(i)} cy={y(n)} r="3" fill={coloreDi(l.id)} /> : null,
                  )}
                </g>
              )
            })}
            {scelto !== null && (
              <>
                <line x1={x(scelto)} x2={x(scelto)} y1={SOPRA} y2={alto - SOTTO} stroke="var(--filo-forte)" />
                {scelti.map(({ l, n }) => (
                  <circle key={l.id} cx={x(scelto)} cy={y(n)} r={l.id === 'portafoglio' ? 3.5 : 2.5} fill="var(--pannello)" stroke={coloreDi(l.id)} strokeWidth="2" />
                ))}
              </>
            )}
          </svg>
        )}
        {scelto !== null && (
          <div className="fumetto" style={{ left: Math.max(4, xf), width: FUMETTO }}>
            <b>{mese(mesi[scelto])}</b>
            {scelti.map(({ l, n }) => (
              <span key={l.id} className={`voce${l.id === 'portafoglio' ? ' tu' : ''}`}>
                <i className={tratteggiata(l.id) ? 'tratto rotto' : 'tratto'} style={{ borderTopColor: coloreDi(l.id) }} />
                <span className="nome">{l.nome}</span>
                <span>{percentuale(n)}</span>
              </span>
            ))}
            {scelti.length === 0 && <span className="tenue">Valori non disponibili</span>}
          </div>
        )}
      </div>
      <p className="solo-lettore" aria-live="polite">
        {scelto !== null ? `${mese(mesi[scelto])}: ${scelti.map(({ l, n }) => `${l.nome} ${percentuale(n)}`).join(', ')}.` : ''}
      </p>
    </div>
  )
}
