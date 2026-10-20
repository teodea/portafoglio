// La pagina Movimenti (mappa, ticket 26): il tasto "Registra", quattro riquadri (anche per l'anno scelto),
// le schede Tutti, Acquisti e vendite, Dividendi, i bottoni degli anni e la tabella dal più recente,
// con una riga grigia a ogni cambio d'anno. Il clic su un movimento apre "Da dove viene", dove si corregge o si toglie.
// Scheda e anno stanno nell'indirizzo (?scheda=…&anno=…), così tornando da Registra si ritrovano.
import { useMemo, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { anniDeiMovimenti, elencoMovimenti, riquadriMovimenti, totaleDividendi, type RigaMovimento } from '../conti/movimenti.ts'
import type { Numero } from '../conti/spiegazione.ts'
import { cambio, data, euro, MENO, numero, prezzo, quote } from '../formato.ts'
import { Icona } from '../icone.tsx'
import { ChipAMano } from '../pannello/AMano.tsx'
import { Num } from '../pannello/Pannello.tsx'
import { useSpiega } from '../pannello/spiega.ts'
import { useFile } from '../stato.tsx'
import { useAppena } from './movimenti/appena.ts'
import { consegnaPdf, pdfTrascinati, portaFile } from './movimenti/trascina.ts'
import './movimenti/movimenti.css'

const SCHEDE = ['tutti', 'cv', 'div'] as const
type Scheda = (typeof SCHEDE)[number]

export const PERCORSO_REGISTRA = '/movimenti/registra'

export function Movimenti() {
  const { dati } = useFile()
  const appena = useAppena()
  const [cerca, setCerca] = useSearchParams()
  const bottoni = useRef<(HTMLButtonElement | null)[]>([])
  const navigate = useNavigate()

  const tutte = useMemo(() => elencoMovimenti(dati), [dati])
  const anni = anniDeiMovimenti(tutte)
  const annoScelto = cerca.get('anno')
  const anno = annoScelto && anni.includes(annoScelto) ? annoScelto : null
  const sceltaScheda = cerca.get('scheda')
  const scheda: Scheda = (SCHEDE as readonly string[]).includes(sceltaScheda ?? '') ? (sceltaScheda as Scheda) : 'tutti'
  const q = riquadriMovimenti(tutte, anno)

  const vai = (s: Scheda, a: string | null) => {
    const p: Record<string, string> = {}
    if (s !== 'tutti') p.scheda = s
    if (a) p.anno = a
    setCerca(p, { replace: true })
  }
  const frecce = (e: KeyboardEvent, i: number) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!passo) return
    const j = (i + passo + SCHEDE.length) % SCHEDE.length
    vai(SCHEDE[j], anno)
    bottoni.current[j]?.focus()
  }

  const dellAnno = anno ? tutte.filter((r) => r.anno === anno) : tutte
  const cv = dellAnno.filter((r) => r.tipo !== 'dividendo')
  const div = dellAnno.filter((r) => r.tipo === 'dividendo')
  const righe = scheda === 'tutti' ? dellAnno : scheda === 'cv' ? cv : div
  const nomi: Record<Scheda, string> = {
    tutti: `Tutti (${dellAnno.length})`,
    cv: `Acquisti e vendite (${cv.length})`,
    div: `Dividendi (${div.length})`,
  }
  const nel = anno ? ` nel ${anno}` : ''

  // Un PDF della banca trascinato sulla pagina apre Registra e si legge lì (ticket 12).
  return (
    <section
      onDragOver={(e) => {
        if (!portaFile(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        const file = pdfTrascinati(e)
        e.preventDefault()
        if (file.length === 0) return
        consegnaPdf(file)
        navigate(PERCORSO_REGISTRA, { state: { indietro: `/movimenti${cerca.size ? `?${cerca}` : ''}` } })
      }}
    >
      <div className="testata">
        <h1>Movimenti</h1>
        <Link className="btn primario" to={PERCORSO_REGISTRA} state={{ indietro: `/movimenti${cerca.size ? `?${cerca}` : ''}` }}>
          <Icona nome="piu" piccola />
          Registra
        </Link>
      </div>

      <div className="numeri">
        <Riquadro numero={q.investiti} nome={anno ? `Investimento netto${nel}` : 'Capitale investito'} sotto="costo degli acquisti meno ricavo delle vendite" segno={!!anno} />
        <Riquadro numero={q.comprato} nome={`Acquisti${nel}`} sotto={`${quanti(q.acquisti, 'acquisto', 'acquisti')}, commissioni comprese`} />
        <Riquadro numero={q.venduto} nome={`Ricavo delle vendite${nel}`} sotto={`${quanti(q.vendite, 'vendita', 'vendite')}, al netto delle commissioni`} />
        <Riquadro numero={q.dividendi} nome={`Dividendi netti${nel}`} sotto={quanti(q.pagamenti, 'accredito', 'accrediti')} />
      </div>

      <div className="riquadro">
        <div className="schede" role="tablist" aria-label="Tipo di movimento">
          {SCHEDE.map((s, i) => (
            <button
              key={s}
              ref={(el) => {
                bottoni.current[i] = el
              }}
              type="button"
              role="tab"
              id={`movimenti-${s}`}
              aria-selected={scheda === s}
              aria-controls="pannello-movimenti"
              tabIndex={scheda === s ? 0 : -1}
              onClick={() => vai(s, anno)}
              onKeyDown={(e) => frecce(e, i)}
            >
              {nomi[s]}
            </button>
          ))}
        </div>
        <div className="attrezzi">
          <span>Ordinati dal più recente. Selezionare un movimento per la provenienza e l’eventuale correzione.</span>
          {anni.length > 0 && (
            <div className="segmenti" role="group" aria-label="Anno">
              {[null, ...anni].map((a) => (
                <button key={a ?? 'tutti'} type="button" aria-pressed={anno === a} onClick={() => vai(scheda, a)}>
                  {a ?? 'Tutti gli anni'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div role="tabpanel" id="pannello-movimenti" aria-labelledby={`movimenti-${scheda}`}>
          {tutte.length === 0 ? (
            <div className="vuoto">Nessun movimento registrato: selezionare “Registra” per inserire il primo acquisto.</div>
          ) : righe.length === 0 ? (
            <div className="vuoto">{scheda === 'div' ? `Nessun dividendo${nel}.` : `Nessun movimento${nel}.`}</div>
          ) : scheda === 'div' ? (
            <TabellaDividendi righe={righe} appena={appena} />
          ) : (
            <TabellaMovimenti righe={righe} appena={appena} />
          )}
        </div>
      </div>
    </section>
  )

}

function Riquadro({ numero: n, nome, sotto, segno = false }: { numero: Numero; nome: string; sotto: string; segno?: boolean }) {
  const spiega = useSpiega()
  const v = n.n ?? 0
  return (
    <button type="button" className="numero" aria-haspopup="dialog" onClick={() => spiega(n.perche)}>
      <small>{nome}</small>
      <b>{segno && v < 0 ? `${MENO}${euro(-v)}` : euro(v)}</b>
      <span>{sotto}</span>
    </button>
  )
}

const quanti = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`

/** Le righe, con una riga grigia a ogni cambio d'anno. */
function perAnno(righe: RigaMovimento[], colonne: number, riga: (r: RigaMovimento) => ReactNode): ReactNode[] {
  const out: ReactNode[] = []
  let anno = ''
  for (const r of righe) {
    if (r.anno !== anno) {
      anno = r.anno
      out.push(
        <tr key={`anno-${anno}`} className="anno">
          <td colSpan={colonne}>{anno}</td>
        </tr>,
      )
    }
    out.push(riga(r))
  }
  return out
}

/** Il clic su tutta la riga apre "Da dove viene" (come il clic sull'importo). */
function useRiga() {
  const spiega = useSpiega()
  return (r: RigaMovimento) => ({
    className: 'riga',
    onClick: (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, a')) return
      spiega(r.soldi.perche)
    },
  })
}

function NomeTitolo({ r }: { r: RigaMovimento }) {
  return (
    <div className="tit">
      <b>{r.nome}</b>
      {r.sottoNome && <span>{r.sottoNome}</span>}
    </div>
  )
}

function Fonte({ r }: { r: RigaMovimento }) {
  return (
    <>
      <span className="fonte">
        <span className="punto" />
        {r.fonte}
      </span>
      {r.aMano && (
        <span className="sotto">
          <ChipAMano />
        </span>
      )}
    </>
  )
}

function Appena({ r, appena }: { r: RigaMovimento; appena: ReadonlySet<string> }) {
  return appena.has(r.id) ? <span className="etichetta nuova">registrato ora</span> : null
}

function TabellaMovimenti({ righe, appena }: { righe: RigaMovimento[]; appena: ReadonlySet<string> }) {
  const props = useRiga()
  return (
    <div className="scorre">
      <table className="movimenti">
        <thead>
          <tr>
            <th>Data</th>
            <th>Operazione</th>
            <th>Titolo</th>
            <th className="n">Quote</th>
            <th className="n">Prezzo</th>
            <th className="n">
              Commissioni
              <br />o imposte
            </th>
            <th className="n">Importo</th>
            <th>Fonte</th>
          </tr>
        </thead>
        <tbody>
          {perAnno(righe, 8, (r) => {
            const d = r.tipo === 'dividendo'
            return (
              <tr key={r.id} {...props(r)} data-nuovo={appena.has(r.id) || undefined}>
                <td>{data(r.data)}</td>
                <td>
                  <div className="cosa">
                    <span>
                      {r.cosa} <Appena r={r} appena={appena} />
                    </span>
                    {r.sotto && <span className="sotto">{r.sotto}</span>}
                  </div>
                </td>
                <td>
                  <NomeTitolo r={r} />
                </td>
                <td className="n">{r.quote === null ? <span className="tenue">—</span> : quote(r.quote)}</td>
                <td className="n">
                  {d ? (
                    r.perQuota === null ? (
                      <span className="tenue">—</span>
                    ) : (
                      <>
                        {prezzo(r.perQuota, 'EUR')}
                        <span className="sotto">lordo per quota</span>
                      </>
                    )
                  ) : (
                    <>
                      {prezzo(r.prezzo!.n, r.prezzo!.valuta)}
                      {r.prezzo!.cambio !== null && <span className="sotto">cambio {cambio(r.prezzo!.cambio)}</span>}
                    </>
                  )}
                </td>
                <td className="n">
                  {d ? (
                    <>
                      {euro(r.imposte ?? 0, 2)}
                      <span className="sotto">imposte</span>
                    </>
                  ) : r.commissioni ? (
                    euro(r.commissioni, 2)
                  ) : (
                    <span className="tenue">—</span>
                  )}
                </td>
                <td className="n">
                  <Num numero={r.soldi}>
                    <b>
                      {r.verso < 0 ? MENO : '+'}
                      {euro(r.soldi.n ?? 0, 2)}
                    </b>
                  </Num>
                  <span className="sotto">{r.verso < 0 ? 'addebito' : 'accredito'}</span>
                </td>
                <td>
                  <Fonte r={r} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabellaDividendi({ righe, appena }: { righe: RigaMovimento[]; appena: ReadonlySet<string> }) {
  const props = useRiga()
  const tot = totaleDividendi(righe)
  return (
    <div className="scorre">
      <table className="movimenti">
        <thead>
          <tr>
            <th>Data</th>
            <th>Titolo</th>
            <th className="n">Quote</th>
            <th className="n">Per quota</th>
            <th className="n">Lordo</th>
            <th className="n">Imposte</th>
            <th className="n">Netto</th>
            <th>Fonte</th>
          </tr>
        </thead>
        <tbody>
          {perAnno(righe, 8, (r) => (
            <tr key={r.id} {...props(r)} data-nuovo={appena.has(r.id) || undefined}>
              <td>
                {data(r.data)} <Appena r={r} appena={appena} />
              </td>
              <td>
                <NomeTitolo r={r} />
                {r.sotto && <span className="sotto">{r.sotto}</span>}
              </td>
              <td className="n">{r.quote === null ? <span className="tenue">—</span> : quote(r.quote)}</td>
              <td className="n">{r.perQuota === null ? <span className="tenue">—</span> : prezzo(r.perQuota, 'EUR')}</td>
              <td className="n">{euro(r.lordo ?? 0, 2)}</td>
              <td className="n">
                {(r.imposte ?? 0) > 0 ? MENO : ''}
                {euro(r.imposte ?? 0, 2)}
                {r.impostePct !== null && <span className="sotto">{numero(r.impostePct * 100, 1)}%</span>}
              </td>
              <td className="n">
                <Num numero={r.soldi}>
                  <b>{euro(r.soldi.n ?? 0, 2)}</b>
                </Num>
              </td>
              <td>
                <Fonte r={r} />
              </td>
            </tr>
          ))}
          <tr className="totale">
            <td colSpan={4}>Totale</td>
            <td className="n">{euro(tot.lordo, 2)}</td>
            <td className="n">
              {tot.imposte > 0 ? MENO : ''}
              {euro(tot.imposte, 2)}
            </td>
            <td className="n">{euro(tot.netto, 2)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
