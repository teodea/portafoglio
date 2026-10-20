// La scheda Venduti: i titoli che non hai più, venduti del tutto o rimborsati a scadenza.
import type { ContiTitoli } from '../../conti/titoli.ts'
import { data, euro, guadagnoEuro, segno } from '../../formato.ts'
import { Cella, NomeTitolo, Pill } from './comuni.tsx'
import { rigaCheApre, useApriScheda } from './usa.ts'

export function Venduti({ conti }: { conti: ContiTitoli }) {
  const apri = useApriScheda()
  const righe = conti.titoli.filter((t) => t.stato === 'chiuso')
  const con2 = (n: number) => euro(n, 2)

  if (righe.length === 0) return <div className="vuoto">Nessun titolo venduto.</div>

  return (
    <>
      <div className="attrezzi">
        <span>Titoli venduti del tutto o rimborsati a scadenza. Il loro risultato resta compreso in quello del portafoglio.</span>
      </div>
      <div className="scorre">
        <table>
          <thead>
            <tr>
              <th>Titolo</th>
              <th>Acquisto</th>
              <th>Vendita</th>
              <th className="n">Costo</th>
              <th className="n">Ricavo</th>
              <th className="n">Dividendi</th>
              <th className="n">Plus/minus</th>
              <th className="n">Rendimento</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((t) => (
              <tr key={t.id} {...rigaCheApre(apri, t.id)}>
                <td>
                  <NomeTitolo conto={t} />
                </td>
                <td>{t.primoAcquisto ? data(t.primoAcquisto) : '—'}</td>
                <td>{t.ultimaVendita ? data(t.ultimaVendita) : '—'}</td>
                <td className="n">
                  <Cella numero={t.pagato} scrivi={con2} />
                </td>
                <td className="n">
                  <Cella numero={t.incassato} scrivi={con2} />
                </td>
                <td className={t.dividendi.n ? 'n' : 'n tenue'}>{t.dividendi.n ? <Cella numero={t.dividendi} scrivi={con2} /> : '—'}</td>
                <td className="n">
                  <Cella numero={t.guadagno} scrivi={(n) => guadagnoEuro(n, 2)} segno={(n) => segno(n, 2)} />
                </td>
                <td className="n">
                  <Pill numero={t.dallAcquisto} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
