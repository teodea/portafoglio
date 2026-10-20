// La scheda Mese per mese: gli ultimi 12 fine mese, come valore in €, variazione sul mese o % dall'acquisto.
import { eAMano } from '../../conti/prezzo-a-mano.ts'
import type { ContiTitoli } from '../../conti/titoli.ts'
import { euro, meseBreve, percentuale, segno } from '../../formato.ts'
import { MatitaAMano } from '../../pannello/AMano.tsx'
import { Cella, NomeTitolo } from './comuni.tsx'
import { rigaCheApre, useApriScheda } from './usa.ts'

const VISTE = [
  { k: 'valore', nome: 'Valore in €', frase: 'Clic su un valore per vedere quote, prezzo, cambio e fonte, o per correggere il prezzo.' },
  { k: 'mese', nome: 'Sul mese', frase: 'Di quanto è cambiato ogni titolo nel mese, in euro, senza contare i soldi messi o tolti.' },
  { k: 'acquisto', nome: 'Dall’acquisto', frase: 'Il guadagno di ogni titolo a quel fine mese, diviso quello che avevi pagato.' },
] as const
type Vista = (typeof VISTE)[number]['k']

export function MesePerMese({ conti, vista: scelta, scegliVista }: { conti: ContiTitoli; vista: string | null; scegliVista: (v: Vista) => void }) {
  const apri = useApriScheda()
  const vista: Vista = VISTE.some((v) => v.k === scelta) ? (scelta as Vista) : 'valore'
  const mesi = conti.mesi.slice(-12)
  const righe = conti.titoli.filter((t) => t.stato === 'aperto')
  const pct = (n: number) => percentuale(n)
  const colorePct = (n: number) => segno(n * 100, 1)

  if (mesi.length === 0 || righe.length === 0) return <div className="vuoto">Non ci sono ancora prezzi di fine mese dei titoli che hai.</div>

  return (
    <>
      <div className="attrezzi">
        <span>
          Ultimi {mesi.length} fine mese. {VISTE.find((v) => v.k === vista)!.frase}
        </span>
        <div className="segmenti" role="group" aria-label="Cosa mostrare">
          {VISTE.map((v) => (
            <button key={v.k} type="button" aria-pressed={vista === v.k} onClick={() => scegliVista(v.k)}>
              {v.nome}
            </button>
          ))}
        </div>
      </div>
      <div className="scorre">
        <table className="mesi">
          <thead>
            <tr>
              <th>Titolo</th>
              {mesi.map((m) => (
                <th key={m} className="n">
                  {meseBreve(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.map((t) => (
              <tr key={t.id} {...rigaCheApre(apri, t.id)}>
                <td>
                  <NomeTitolo conto={t} senzaParole />
                </td>
                {mesi.map((m) => {
                  const r = t.mesi.find((x) => x.mese === m)
                  if (!r)
                    return (
                      <td key={m} className="n tenue">
                        —
                      </td>
                    )
                  return (
                    <td key={m} className="n">
                      {/* Il prezzo di quel fine mese è scritto a mano: la matita accanto al valore (DESIGN.md). */}
                      {eAMano(r.prezzo) && <MatitaAMano />}
                      {vista === 'valore' && <Cella numero={r.valore} scrivi={(n) => euro(n)} />}
                      {vista === 'mese' && <Cella numero={r.sulMese} scrivi={pct} segno={colorePct} />}
                      {vista === 'acquisto' && <Cella numero={r.dallAcquisto} scrivi={pct} segno={colorePct} />}
                    </td>
                  )
                })}
              </tr>
            ))}
            {vista !== 'acquisto' && (
              <tr className="totale">
                <td>Tutti i titoli</td>
                {mesi.map((m) => {
                  const tot = conti.totaliDelMese.get(m)!
                  return (
                    <td key={m} className="n">
                      {vista === 'valore' ? (
                        <Cella numero={tot.valore} scrivi={(n) => euro(n)} />
                      ) : (
                        <Cella numero={tot.sulMese} scrivi={pct} segno={colorePct} />
                      )}
                    </td>
                  )
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
