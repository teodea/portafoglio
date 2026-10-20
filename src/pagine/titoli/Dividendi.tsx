// La scheda Dividendi: i dividendi netti per titolo e per anno, con i totali.
import type { ContiTitoli } from '../../conti/titoli.ts'
import { euro } from '../../formato.ts'
import { Cella, NomeTitolo } from './comuni.tsx'
import { rigaCheApre, useApriScheda } from './usa.ts'

export function Dividendi({ conti }: { conti: ContiTitoli }) {
  const apri = useApriScheda()
  const { anni, perAnno, totale } = conti.dividendi
  const righe = conti.titoli.filter((t) => t.dividendiPerAnno.size > 0)
  const con2 = (n: number) => euro(n, 2)

  if (righe.length === 0) return <div className="vuoto">Nessun dividendo ricevuto: i titoli ad accumulazione reinvestono i proventi nel prezzo.</div>

  return (
    <>
      <div className="attrezzi">
        <span>Dividendi netti, cioè l’importo accreditato dopo le imposte. Comprendono le cedole delle obbligazioni.</span>
      </div>
      <div className="scorre">
        <table>
          <thead>
            <tr>
              <th>Titolo</th>
              {anni.map((a) => (
                <th key={a} className="n">
                  {a}
                </th>
              ))}
              <th className="n">Totale</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((t) => (
              <tr key={t.id} {...rigaCheApre(apri, t.id)}>
                <td>
                  <NomeTitolo conto={t} />
                </td>
                {anni.map((a) => {
                  const n = t.dividendiPerAnno.get(a)
                  return (
                    <td key={a} className={n ? 'n' : 'n tenue'}>
                      {n ? <Cella numero={n} scrivi={con2} /> : '—'}
                    </td>
                  )
                })}
                <td className="n forte">
                  <Cella numero={t.dividendiTutti} scrivi={con2} />
                </td>
              </tr>
            ))}
            <tr className="totale">
              <td>Totale</td>
              {anni.map((a) => (
                <td key={a} className="n">
                  <Cella numero={perAnno.get(a)!} scrivi={con2} />
                </td>
              ))}
              <td className="n">
                <Cella numero={totale} scrivi={con2} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
