// Il grafico a linea della Scheda del titolo (DESIGN.md, "Grafico a linea"): il valore a ogni fine mese
// in blu pieno con la sfumatura sotto, il costo d'acquisto in grigio tratteggiato. SVG disegnato a mano, alla
// larghezza vera del riquadro, così caratteri e spessori non si deformano.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { PuntoGrafico } from '../../../conti/scheda.ts'
import { euro, guadagnoEuro, mese, meseBreve, numero, segno } from '../../../formato.ts'
import { classeSegno, useSpiega } from '../../../pannello/spiega.ts'

const ALTO = 240
const SINISTRA = 52
const DESTRA = 12
const SOPRA = 16
const SOTTO = 28

/** Un passo "tondo" per la griglia: 1, 2, 2,5 o 5 per una potenza di 10. */
function passoTondo(grezzo: number): number {
  if (!(grezzo > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(grezzo))
  const f = grezzo / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

function griglia(valori: number[]): { min: number; max: number; linee: number[] } {
  let lo = Math.min(...valori)
  let hi = Math.max(...valori)
  if (hi - lo < 1e-9) {
    lo = lo * 0.95
    hi = hi * 1.05 || 1
  }
  const passo = passoTondo((hi - lo) / 4)
  const min = Math.max(0, Math.floor(lo / passo) * passo)
  const max = Math.ceil(hi / passo) * passo
  const linee: number[] = []
  for (let v = min; v <= max + passo / 2; v += passo) linee.push(v)
  return { min, max, linee }
}

function etichettaAsse(v: number, max: number): string {
  if (max >= 10_000) return `${numero(v / 1000, 0, 1)}k`
  return numero(v, 0, 2)
}

export function Grafico({ punti, nomePagato, descrizione }: { punti: PuntoGrafico[]; nomePagato: string; descrizione: string }) {
  const spiega = useSpiega()
  const scatola = useRef<HTMLDivElement>(null)
  const [largo, setLargo] = useState(0)
  const [sopra, setSopra] = useState<number | null>(null)
  const idSfumatura = `sfumatura-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  useEffect(() => {
    const el = scatola.current
    if (!el) return
    const misura = () => setLargo(el.clientWidth)
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { min, max, linee } = griglia(punti.flatMap((p) => [p.valore, p.pagato]))
  const x = (i: number) => SINISTRA + (punti.length > 1 ? (i * (largo - SINISTRA - DESTRA)) / (punti.length - 1) : 0)
  const y = (v: number) => SOPRA + (1 - (v - min) / (max - min || 1)) * (ALTO - SOPRA - SOTTO)
  const linea = (k: 'valore' | 'pagato') => punti.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('')
  const area = `${linea('valore')}L${x(punti.length - 1).toFixed(1)},${ALTO - SOTTO}L${x(0).toFixed(1)},${ALTO - SOTTO}Z`
  const tutti = punti.length <= 6
  const indice = (e: MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    const fx = e.clientX - r.left
    const passo = (largo - SINISTRA - DESTRA) / Math.max(1, punti.length - 1)
    return Math.max(0, Math.min(punti.length - 1, Math.round((fx - SINISTRA) / passo)))
  }
  // Con la tastiera: le frecce scorrono i mesi, Invio apre il conto (come il grafico della pagina Portafoglio).
  const tasti = (e: KeyboardEvent) => {
    const ora = sopra ?? punti.length - 1
    const passi: Record<string, number> = { ArrowLeft: ora - 1, ArrowRight: ora + 1, Home: 0, End: punti.length - 1 }
    if (e.key in passi) {
      e.preventDefault()
      setSopra(Math.max(0, Math.min(punti.length - 1, passi[e.key])))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      spiega(punti[ora].numero.perche)
    }
  }
  const p = sopra === null ? null : punti[sopra]

  return (
    <div className="grafico">
      <div ref={scatola}>
        {largo > 0 && (
          <svg
            width={largo}
            height={ALTO}
            role="img"
            tabIndex={0}
            aria-label={`${descrizione}. Frecce per scorrere i mesi, Invio per il dettaglio del calcolo.`}
            onKeyDown={tasti}
            onBlur={() => setSopra(null)}
            onMouseMove={(e) => setSopra(indice(e))}
            onMouseLeave={() => setSopra(null)}
            onClick={(e) => spiega(punti[indice(e)].numero.perche)}
          >
            <defs>
              <linearGradient id={idSfumatura} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--azione)" stopOpacity="0.16" />
                <stop offset="1" stopColor="var(--azione)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {linee.map((v) => (
              <g key={v}>
                <line x1={SINISTRA} x2={largo - DESTRA} y1={y(v)} y2={y(v)} stroke="var(--filo)" />
                <text x={SINISTRA - 8} y={y(v) + 4} fontSize="11" fill="var(--tenue)" textAnchor="end">
                  {etichettaAsse(v, max)}
                </text>
              </g>
            ))}
            {punti.map((q, i) =>
              tutti || i === 0 || q.mese.slice(5, 7) === '12' ? (
                <text
                  key={q.mese}
                  x={x(i)}
                  y={ALTO - 8}
                  fontSize="11"
                  fill="var(--tenue)"
                  textAnchor={punti.length === 1 ? 'middle' : i === 0 ? 'start' : i === punti.length - 1 ? 'end' : 'middle'}
                >
                  {meseBreve(q.mese)}
                </text>
              ) : null,
            )}
            {punti.length > 1 && <path d={area} fill={`url(#${idSfumatura})`} />}
            <path d={linea('pagato')} stroke="var(--tenue)" strokeDasharray="5 4" strokeWidth="1.5" fill="none" />
            <path d={linea('valore')} stroke="var(--azione)" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            {punti.length === 1 && <circle cx={x(0)} cy={y(punti[0].valore)} r="3.5" fill="var(--azione)" />}
            {p && sopra !== null && (
              <>
                <line x1={x(sopra)} x2={x(sopra)} y1={SOPRA} y2={ALTO - SOTTO} stroke="var(--filo-forte)" />
                <circle cx={x(sopra)} cy={y(p.valore)} r="3.5" fill="var(--azione)" stroke="var(--pannello)" strokeWidth="1.5" />
              </>
            )}
          </svg>
        )}
      </div>
      {p && sopra !== null && (
        <div className="fumetto" style={{ left: 18 + (x(sopra) + 14 + 180 > largo ? x(sopra) - 14 - 180 : x(sopra) + 14) }} aria-hidden="true">
          <b>{mese(p.mese)}</b>
          <span>Controvalore {euro(p.valore)}</span>
          <span>
            {nomePagato} {euro(p.pagato)}
          </span>
          <span className={classeSegno(segno(p.valore - p.pagato))}>{guadagnoEuro(p.valore - p.pagato)}</span>
        </div>
      )}
      <p className="solo-lettore" aria-live="polite">
        {p ? `${mese(p.mese)}: controvalore ${euro(p.valore)}, ${nomePagato.toLowerCase()} ${euro(p.pagato)}, ${p.valore - p.pagato < 0 ? 'minusvalenza' : 'plusvalenza'} ${guadagnoEuro(p.valore - p.pagato)}.` : ''}
      </p>
    </div>
  )
}
