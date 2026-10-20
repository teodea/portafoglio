// "Andamento dei mercati" (DESIGN.md, "Grafico degli andamenti"). Nella pagina un riquadro compatto, alto quanto
// quello della plusvalenza accanto: solo il grafico della variazione a ogni fine mese, dall'inizio o negli ultimi
// 12 mesi, del portafoglio, dei cinque indici di borsa in punti e dell'inflazione. "Ingrandisci" apre la finestra
// grande, quasi a tutto schermo: lo stesso grafico in grande e sotto la tabella con il valore all'ultimo fine mese e
// la variazione del periodo. Ogni riga è un bottone che apre "Da dove viene" con il conto, la fonte, "Scarica di
// nuovo" e la correzione a mano; passandoci sopra si accende la sua linea. I conti sono in conti/riferimenti.ts.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ContiPortafoglio } from '../../conti/portafoglio.ts'
import { andamenti, type Andamenti as DatiAndamenti, type IdAndamento, type PeriodoAndamenti, type RigaAndamento } from '../../conti/riferimenti.ts'
import type { FileDati } from '../../dati/tipi.ts'
import { data, euro, mese, numero, percentuale, segnoPercentuale } from '../../formato.ts'
import { Icona } from '../../icone.tsx'
import { MatitaAMano } from '../../pannello/AMano.tsx'
import { classeSegno, useSpiega } from '../../pannello/spiega.ts'
import { GraficoRiferimenti } from './GraficoRiferimenti.tsx'
import { coloreDi, tratteggiata } from './linee.ts'

const PERIODI: [PeriodoAndamenti, string][] = [
  ['tutto', 'Dall’inizio'],
  ['12', 'Ultimi 12 mesi'],
]

/** Il valore di fine mese come si legge in tabella: "51.371,98" punti, "422.209,76 €", il NIC "104,6". */
function valoreTesto(r: RigaAndamento): string {
  if (r.valore === null) return '—'
  if (r.unita === 'euro') return euro(r.valore)
  if (r.unita === 'nic') return numero(r.valore, 1, 2)
  return numero(r.valore, 2)
}

/** Sotto il nome: "in punti, in dollari", "titoli e dividendi", "prezzi al consumo". */
function sotto(r: RigaAndamento): string {
  if (r.unita === 'euro') return 'titoli e dividendi, in euro'
  if (r.unita === 'nic') return 'NIC di ISTAT, base 2025 = 100'
  return r.valuta === 'USD' ? 'in punti, in dollari' : 'in punti'
}

function Periodi({ periodo, scegli }: { periodo: PeriodoAndamenti; scegli: (p: PeriodoAndamenti) => void }) {
  return (
    <div className="segmenti" role="group" aria-label="Periodo">
      {PERIODI.map(([p, nome]) => (
        <button key={p} type="button" aria-pressed={periodo === p} onClick={() => scegli(p)}>
          {nome}
        </button>
      ))}
    </div>
  )
}

export function Andamenti({ dati, conti }: { dati: FileDati; conti: ContiPortafoglio }) {
  // Le scelte non si ricordano alla riapertura (DESIGN.md, "Bottoni della misura"); il periodo è lo stesso nel
  // riquadro e nella finestra grande.
  const [periodo, setPeriodo] = useState<PeriodoAndamenti>('tutto')
  const [grande, setGrande] = useState(false)
  const ingrandisci = useRef<HTMLButtonElement>(null)
  const a = useMemo(() => andamenti(dati, conti, periodo), [dati, conti, periodo])
  const chiudi = useCallback(() => {
    setGrande(false)
    ingrandisci.current?.focus()
  }, [])
  if (!a) return null

  return (
    <>
      <div className="riquadro classifica-rif andamenti-compatto">
        <div className="testa">
          <h2>Andamento dei mercati</h2>
          <div className="testa-destra">
            <Periodi periodo={periodo} scegli={setPeriodo} />
            <button
              ref={ingrandisci}
              type="button"
              className="btn solo-icona"
              title="Ingrandisci"
              aria-label="Ingrandisci: il grafico in grande con i valori di fine mese"
              aria-haspopup="dialog"
              onClick={() => setGrande(true)}
            >
              <Icona nome="ingrandisci" piccola />
            </button>
          </div>
        </div>
        <GraficoRiferimenti serie={a.serie} acceso={null} />
      </div>
      {grande && (
        <FinestraGrande
          a={a}
          periodo={periodo}
          scegli={setPeriodo}
          chiudi={chiudi}
        />
      )}
    </>
  )
}

/** Gli elementi che prendono il focus con Tab, per tenerlo dentro la finestra. */
const FOCUSABILI = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function FinestraGrande({ a, periodo, scegli, chiudi }: { a: DatiAndamenti; periodo: PeriodoAndamenti; scegli: (p: PeriodoAndamenti) => void; chiudi: () => void }) {
  const [acceso, setAcceso] = useState<IdAndamento | null>(null)
  const spiega = useSpiega()
  const idTitolo = useId()
  const finestra = useRef<HTMLDivElement>(null)
  const chiudiBtn = useRef<HTMLButtonElement>(null)
  const dal = periodo === '12' ? `da fine ${mese(a.da)}` : 'dall’inizio'

  useEffect(() => {
    chiudiBtn.current?.focus()
    // Esc chiude la finestra, ma non quando sopra c'è il pannello "Da dove viene": quello si chiude per primo.
    const tasto = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.cassetto.aperto')) chiudi()
    }
    document.addEventListener('keydown', tasto)
    return () => document.removeEventListener('keydown', tasto)
  }, [chiudi])

  // Tab gira dentro la finestra, come nel pannello.
  const trattieni = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !finestra.current) return
    const tutti = [...finestra.current.querySelectorAll<HTMLElement>(FOCUSABILI)]
    if (!tutti.length) return
    const primo = tutti[0]
    const ultimo = tutti[tutti.length - 1]
    if (e.shiftKey && document.activeElement === primo) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primo.focus()
    }
  }

  return (
    <>
      <div className="andamenti-velo" onClick={chiudi} aria-hidden="true" />
      <div ref={finestra} className="riquadro classifica-rif andamenti-grande" role="dialog" aria-modal="true" aria-labelledby={idTitolo} onKeyDown={trattieni}>
        <div className="testa">
          <h2 id={idTitolo}>Andamento dei mercati</h2>
          <div className="testa-destra">
            <Periodi periodo={periodo} scegli={scegli} />
            <button ref={chiudiBtn} type="button" className="btn solo-icona" aria-label="Chiudi" onClick={chiudi}>
              <Icona nome="x" piccola />
            </button>
          </div>
        </div>
        <div className="attrezzi">
          <span>
            Variazione {dal} a ogni fine mese del portafoglio, dei cinque indici di borsa in punti (senza dividendi) e dell’inflazione.
            {a.righe.filter((r) => r.unita === 'punti').every((r) => r.valore === null) ? ' I valori degli indici si ottengono con Aggiorna fine mese.' : ''}{' '}
            Selezionare una riga per il valore e la fonte.
          </span>
        </div>
        <div className="andamenti-corpo">
          <GraficoRiferimenti serie={a.serie} acceso={acceso} />
          <ul className="tabella-rif" aria-label="Andamento del portafoglio, degli indici e dell’inflazione">
            <li className="intestazione" aria-hidden="true">
              <span />
              <span>Al {data(a.fine)}</span>
              <span>Variazione</span>
            </li>
            {a.righe.map((r) => (
              <li key={r.id} className={r.id === 'portafoglio' ? 'tu' : undefined}>
                <button
                  type="button"
                  className="num"
                  aria-haspopup="dialog"
                  aria-label={
                    r.manca && r.variazione === null
                      ? `${r.nome}: valori mancanti. Dettaglio`
                      : `${r.nome}${r.finoA ? ` (${r.finoA})` : ''}: ${valoreTesto(r)}, variazione ${r.variazione === null ? 'non disponibile' : percentuale(r.variazione)}. Dettaglio`
                  }
                  onClick={() => spiega(r.perche)}
                  onMouseEnter={() => setAcceso(r.id)}
                  onMouseLeave={() => setAcceso(null)}
                  onFocus={() => setAcceso(r.id)}
                  onBlur={() => setAcceso(null)}
                >
                  <span className="nome">
                    <i className={tratteggiata(r.id) ? 'tratto rotto' : 'tratto'} style={{ borderTopColor: coloreDi(r.id) }} />
                    {r.nome}
                    {r.aMano && (
                      <>
                        {' '}
                        <MatitaAMano titolo="Valore inserito manualmente" />
                      </>
                    )}
                    {r.finoA && <span className="tenue fino"> ({r.finoA})</span>}
                    <span className="tenue sotto">{sotto(r)}</span>
                  </span>
                  {r.manca && r.variazione === null ? (
                    <span className="val tenue mancante">mancante</span>
                  ) : (
                    <>
                      <span className="val">{valoreTesto(r)}</span>
                      <span className={`val ${r.variazione === null ? 'tenue' : classeSegno(segnoPercentuale(r.variazione))}`}>
                        {r.variazione === null ? '—' : percentuale(r.variazione)}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
