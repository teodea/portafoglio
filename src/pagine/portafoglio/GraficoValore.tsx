// Il grafico "Come è cresciuto il valore" (DESIGN.md, "Grafico a linea"): il valore a ogni fine mese
// in blu, i soldi investiti tratteggiati in grigio. Al passaggio del mouse (o con le frecce) il mirino
// e il fumetto; il clic (o Invio) apre "Da dove viene" del valore di quel mese.
// SVG disegnato a mano alla larghezza vera, così testo e linee non si deformano.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { PuntoDelValore } from '../../conti/portafoglio.ts'
import { euro, guadagnoEuro, mese, meseBreve, segno } from '../../formato.ts'
import { classeSegno, useSpiega } from '../../pannello/spiega.ts'
import { corto, griglia } from './griglia.ts'

const ALTO = 240
const SINISTRA = 52
const DESTRA = 12
const SOPRA = 16
const SOTTO = 28

export function GraficoValore({ punti }: { punti: PuntoDelValore[] }) {
  const spiega = useSpiega()
  const scatola = useRef<HTMLDivElement>(null)
  const [largo, setLargo] = useState(0)
  const [sceltoGrezzo, setScelto] = useState<number | null>(null)
  const idSfumatura = useId()
  const ciSono = punti.length > 0
  // Passando a "Ultimi 12 mesi" i punti diminuiscono: un mese scelto che non c'è più non vale.
  const scelto = sceltoGrezzo !== null && sceltoGrezzo < punti.length ? sceltoGrezzo : null

  useEffect(() => {
    const el = scatola.current
    if (!el) return
    const misura = () => setLargo(el.clientWidth)
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ciSono])

  if (punti.length === 0) return <div className="vuoto">Il grafico arriva con il primo prezzo di fine mese.</div>

  const valori = punti.flatMap((p) => [p.valore.n ?? 0, p.investiti])
  const linee = griglia(Math.min(...valori) * 0.95, Math.max(...valori) * 1.03)
  const basso = linee[0]
  const alto = linee[4]
  const w = Math.max(largo, 200)
  const x = (i: number) => (punti.length === 1 ? (SINISTRA + w - DESTRA) / 2 : SINISTRA + (i * (w - SINISTRA - DESTRA)) / (punti.length - 1))
  const y = (v: number) => SOPRA + (1 - (v - basso) / (alto - basso || 1)) * (ALTO - SOPRA - SOTTO)
  const traccia = (f: (p: PuntoDelValore) => number) => punti.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(f(p)).toFixed(1)}`).join('')
  const valoreDi = (p: PuntoDelValore) => p.valore.n ?? 0
  const area = `${traccia(valoreDi)}L${x(punti.length - 1).toFixed(1)},${ALTO - SOTTO}L${x(0).toFixed(1)},${ALTO - SOTTO}Z`

  // I mesi sotto: il primo, ogni dicembre e l'ultimo, se non si toccano; tutti se c'è spazio.
  const spazio = punti.length > 1 ? (w - SINISTRA - DESTRA) / (punti.length - 1) : w
  const etichette: number[] = []
  punti.forEach((p, i) => {
    const vuole = spazio >= 52 || i === 0 || i === punti.length - 1 || p.mese.slice(5, 7) === '12'
    const ultima = etichette.at(-1)
    if (vuole && (ultima === undefined || x(i) - x(ultima) >= 52)) etichette.push(i)
    else if (vuole && i === punti.length - 1 && ultima !== 0) etichette[etichette.length - 1] = i
  })

  const indice = (e: MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    const fx = e.clientX - r.left
    if (punti.length === 1) return 0
    return Math.max(0, Math.min(punti.length - 1, Math.round((fx - SINISTRA) / spazio)))
  }
  const tasti = (e: KeyboardEvent) => {
    const ora = scelto ?? punti.length - 1
    const passi: Record<string, number> = { ArrowLeft: ora - 1, ArrowRight: ora + 1, Home: 0, End: punti.length - 1 }
    if (e.key in passi) {
      e.preventDefault()
      setScelto(Math.max(0, Math.min(punti.length - 1, passi[e.key])))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      spiega(punti[ora].valore.perche)
    }
  }

  const p = scelto === null ? null : punti[scelto]
  const diff = p ? valoreDi(p) - p.investiti : 0
  const primo = punti[0]
  const ultimo = punti[punti.length - 1]
  const descrizione = `Valore a ogni fine mese, da ${mese(primo.mese)} (${euro(valoreDi(primo))}) a ${mese(ultimo.mese)} (${euro(valoreDi(ultimo))}), con i soldi investiti. Frecce per scorrere i mesi, Invio per il conto.`

  return (
    <div className="grafico">
      <div
        className="tela"
        ref={scatola}
        role="img"
        tabIndex={0}
        aria-label={descrizione}
        onMouseMove={(e) => setScelto(indice(e))}
        onMouseLeave={() => setScelto(null)}
        onClick={(e) => spiega(punti[indice(e)].valore.perche)}
        onKeyDown={tasti}
        onBlur={() => setScelto(null)}
      >
        {largo > 0 && (
          <svg width={w} height={ALTO} viewBox={`0 0 ${w} ${ALTO}`} aria-hidden="true">
            <defs>
              <linearGradient id={idSfumatura} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--azione)" stopOpacity="0.16" />
                <stop offset="1" stopColor="var(--azione)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {linee.map((v) => (
              <g key={v}>
                <line x1={SINISTRA} x2={w - DESTRA} y1={y(v)} y2={y(v)} stroke="var(--filo)" />
                <text x={SINISTRA - 8} y={y(v) + 4} fontSize="11" fill="var(--tenue)" textAnchor="end">
                  {corto(v)}
                </text>
              </g>
            ))}
            {etichette.map((i) => (
              <text key={i} x={x(i)} y={ALTO - 8} fontSize="11" fill="var(--tenue)" textAnchor={punti.length === 1 ? 'middle' : i === 0 ? 'start' : i === punti.length - 1 ? 'end' : 'middle'}>
                {meseBreve(punti[i].mese)}
              </text>
            ))}
            {punti.length > 1 && <path d={area} fill={`url(#${idSfumatura})`} />}
            <path d={traccia((q) => q.investiti)} stroke="var(--tenue)" strokeDasharray="5 4" strokeWidth="1.5" fill="none" />
            <path d={traccia(valoreDi)} stroke="var(--azione)" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            {punti.length === 1 && <circle cx={x(0)} cy={y(valoreDi(primo))} r="3.5" fill="var(--azione)" />}
            {scelto !== null && (
              <>
                <line x1={x(scelto)} x2={x(scelto)} y1={SOPRA} y2={ALTO - SOTTO} stroke="var(--filo-forte)" />
                <circle cx={x(scelto)} cy={y(valoreDi(punti[scelto]))} r="3.5" fill="var(--pannello)" stroke="var(--azione)" strokeWidth="2" />
              </>
            )}
          </svg>
        )}
        {p && scelto !== null && (
          <div className="fumetto" style={{ left: Math.max(4, Math.min(x(scelto) + 14, w - 196)) }}>
            <b>{mese(p.mese)}</b>
            <span>Valore {euro(valoreDi(p))}</span>
            <span>Soldi investiti {euro(p.investiti)}</span>
            <span className={classeSegno(segno(diff))}>{guadagnoEuro(diff)}</span>
          </div>
        )}
      </div>
      <p className="solo-lettore" aria-live="polite">
        {p ? `${mese(p.mese)}: valore ${euro(valoreDi(p))}, soldi investiti ${euro(p.investiti)}, ${guadagnoEuro(diff)}.` : ''}
      </p>
      <div className="legenda" aria-hidden="true">
        <span>
          <i />
          Valore a fine mese
        </span>
        <span>
          <i className="investiti" />
          Soldi investiti
        </span>
        <span className="tenue">Clic su un mese per il conto</span>
      </div>
    </div>
  )
}
