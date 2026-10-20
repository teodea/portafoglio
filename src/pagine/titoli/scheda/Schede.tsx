// Le quattro schede della Scheda del titolo: Mese per mese, Operazioni, Dividendi, Provenienza.
import type { Pezzo, Paragrafo, RigaMese, SchedaDelTitolo } from '../../../conti/scheda.ts'
import type { ContoTitolo, VenditaSpiegata } from '../../../conti/titoli.ts'
import { venditaInParole } from '../../../conti/scheda.ts'
import { cambio, data, euro, guadagnoEuro, mese, numero, percentuale, prezzo, quote, segno } from '../../../formato.ts'
import { ChipAMano } from '../../../pannello/AMano.tsx'
import { Num } from '../../../pannello/Pannello.tsx'
import { classeSegno } from '../../../pannello/spiega.ts'
import { Cella } from '../comuni.tsx'

const colorePct = (n: number) => segno(n * 100, 1)

/** Una frase con i pezzi in grassetto (e del colore del segno, se è una plusvalenza o minusvalenza). */
export function Frase({ pezzi }: { pezzi: Pezzo[] }) {
  return (
    <>
      {pezzi.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <b key={i} className={p.segno === undefined ? undefined : classeSegno(segno(p.segno, 2))}>
            {p.b}
          </b>
        ),
      )}
    </>
  )
}

function Fonte({ nome, borsa }: { nome: string; borsa?: boolean }) {
  return (
    <span className={`fonte${borsa ? ' borsa' : ''}`}>
      <span className="punto" aria-hidden="true" />
      {nome}
    </span>
  )
}

// ---------- Mese per mese ----------

export function MesiDelTitolo({ conto, righe }: { conto: ContoTitolo; righe: RigaMese[] }) {
  const inValuta = conto.valuta !== 'EUR'
  if (righe.length === 0)
    return (
      <div className="vuoto">
        {conto.stato === 'nuovo'
          ? 'Acquistato dopo l’ultimo fine mese con i prezzi: i mesi compaiono con il prossimo aggiornamento.'
          : 'Nessun prezzo di fine mese: il titolo è stato venduto prima della fine del mese.'}
      </div>
    )
  return (
    <>
      <div className="attrezzi">
        <span>
          Fine mese dal più recente. {inValuta ? `Il prezzo è in ${conto.valuta}, al cambio BCE di fine mese. ` : ''}Selezionare un
          valore per il dettaglio del calcolo; selezionare un prezzo per correggerlo.
        </span>
      </div>
      <div className="scorre">
        <table>
          <thead>
            <tr>
              <th>Fine mese</th>
              <th className="n">Prezzo ({inValuta ? conto.valuta : '€'})</th>
              {inValuta && <th className="n">Cambio</th>}
              <th className="n">Controvalore</th>
              <th className="n">Mensile</th>
              <th className="n">Rendimento</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.mese.mese}>
                <td>{mese(r.mese.mese)}</td>
                <td className="n">
                  {r.prima !== null && <s className="prima">{numero(r.prima, 2, 4)}</s>}
                  <Num numero={r.prezzo}>{numero(r.prezzo.n ?? 0, 2, 4)}</Num>
                </td>
                {inValuta && (
                  <td className="n">{r.cambio ? <Num numero={r.cambio}>{cambio(r.cambio.n ?? 0)}</Num> : <span className="tenue">—</span>}</td>
                )}
                <td className="n">
                  <Cella numero={r.mese.valore} scrivi={(n) => euro(n)} />
                </td>
                <td className="n">
                  <Cella numero={r.mese.sulMese} scrivi={percentuale} segno={colorePct} />
                </td>
                <td className="n">
                  <Cella numero={r.mese.dallAcquisto} scrivi={percentuale} segno={colorePct} />
                </td>
                <td>
                  {r.aMano ? <ChipAMano lungo={r.prima !== null} /> : <Fonte nome={r.fonte} borsa={r.borsa} />}
                  {r.perche && <span className="sotto">{r.perche}</span>}
                  {r.prezzoDel && <span className="sotto">prezzo del {data(r.prezzoDel)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ---------- Operazioni ----------

function SpiegaVendita({ vendita }: { vendita: VenditaSpiegata }) {
  return (
    <div className="spiega vendita-spiegata">
      <p>
        <Frase pezzi={venditaInParole(vendita)} />
      </p>
      <p className="tenue">
        {(vendita.guadagnoIncassato.n ?? 0) < 0 ? 'Minusvalenza' : 'Plusvalenza'} realizzata (selezionare per il dettaglio del
        calcolo):{' '}
        <Num numero={vendita.guadagnoIncassato} className={classeSegno(segno(vendita.guadagnoIncassato.n ?? 0, 2))}>
          {vendita.guadagnoIncassato.n === null ? '—' : guadagnoEuro(vendita.guadagnoIncassato.n, 2)}
        </Num>
      </p>
    </div>
  )
}

export function Operazioni({ scheda }: { scheda: SchedaDelTitolo }) {
  const parziali = scheda.operazioni.filter((r) => r.vendita?.parziale)
  return (
    <>
      {parziali.map((r) => (
        <SpiegaVendita key={r.operazione.id} vendita={r.vendita!} />
      ))}
      {scheda.operazioni.length === 0 ? (
        <div className="vuoto">Nessuna operazione registrata per questo titolo.</div>
      ) : (
        <div className="scorre">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Operazione</th>
                <th className="n">Quote</th>
                <th className="n">Prezzo</th>
                <th className="n">Commissioni</th>
                <th className="n">Importo</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {scheda.operazioni.map((r) => {
                const o = r.operazione
                const vendita = o.tipo === 'vendita'
                return (
                  <tr key={o.id} className={r.vendita?.parziale ? 'evidenziata' : undefined}>
                    <td>{data(o.data)}</td>
                    <td>{vendita ? <b>{r.cosa}</b> : r.cosa}</td>
                    <td className="n">{quote(o.quantita)}</td>
                    <td className="n">
                      {prezzo(o.prezzo, o.valuta)}
                      {o.valuta !== 'EUR' && <span className="sotto">cambio {cambio(o.cambio)}</span>}
                    </td>
                    <td className="n">{o.commissioni > 0 ? euro(o.commissioni, 2) : <span className="tenue">—</span>}</td>
                    <td className="n">
                      <Num numero={r.soldi}>
                        {vendita ? '+' : '−'}
                        {euro(o.totale, 2)}
                      </Num>
                      {r.vendita && (
                        <span className="sotto">
                          {(r.vendita.guadagnoIncassato.n ?? 0) < 0 ? 'minusvalenza' : 'plusvalenza'}{' '}
                          <span className={classeSegno(segno(r.vendita.guadagnoIncassato.n ?? 0, 2))}>
                            {guadagnoEuro(r.vendita.guadagnoIncassato.n ?? 0, 2)}
                          </span>
                        </span>
                      )}
                    </td>
                    <td>
                      <Fonte nome={r.fonte} />
                      {o.prima && (
                        <span className="sotto">
                          <ChipAMano />
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ---------- Dividendi ----------

export function DividendiDelTitolo({ conto, scheda }: { conto: ContoTitolo; scheda: SchedaDelTitolo }) {
  if (scheda.dividendi.length === 0)
    return <div className="vuoto">{conto.nomeCorto} non ha distribuito dividendi: i titoli ad accumulazione reinvestono i proventi nel prezzo.</div>
  const lordo = scheda.dividendi.reduce((a, r) => a + r.dividendo.lordo, 0)
  const imposte = scheda.dividendi.reduce((a, r) => a + r.dividendo.imposte, 0)
  return (
    <>
      <div className="attrezzi">
        <span>Il netto è l’importo accreditato: il lordo meno le imposte. È compreso nella plusvalenza del titolo.</span>
      </div>
      <div className="scorre">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th className="n">Lordo</th>
              <th className="n">Imposte</th>
              <th className="n">Netto</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>
            {scheda.dividendi.map((r) => (
              <tr key={r.dividendo.id}>
                <td>
                  {data(r.dividendo.data)}
                  {r.dividendo.nota && <span className="sotto">{r.dividendo.nota}</span>}
                </td>
                <td className="n">
                  <Num numero={r.netto}>{euro(r.dividendo.lordo, 2)}</Num>
                </td>
                <td className="n">
                  <Num numero={r.netto}>
                    {r.dividendo.imposte > 0 ? '−' : ''}
                    {euro(r.dividendo.imposte, 2)}
                  </Num>
                </td>
                <td className="n forte">
                  <Num numero={r.netto}>{euro(r.dividendo.netto, 2)}</Num>
                </td>
                <td>
                  <Fonte nome={r.fonte} />
                  {r.dividendo.prima && (
                    <span className="sotto">
                      <ChipAMano />
                    </span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="totale">
              <td>Totale</td>
              <td className="n">{euro(lordo, 2)}</td>
              <td className="n">
                {imposte > 0 ? '−' : ''}
                {euro(imposte, 2)}
              </td>
              <td className="n">
                <Cella numero={conto.dividendiTutti} scrivi={(n) => euro(n, 2)} />
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

// ---------- Provenienza ----------

export function DaDoveVengono({ paragrafi }: { paragrafi: Paragrafo[] }) {
  return (
    <>
      <div className="spiega da-dove">
        {paragrafi.map((p) => (
          <p key={p.nome}>
            <b>{p.nome}.</b> <Frase pezzi={p.pezzi} />
          </p>
        ))}
      </div>
      <p className="nota-scheda">Selezionare un valore qualsiasi della scheda per il calcolo riga per riga e la fonte.</p>
    </>
  )
}
