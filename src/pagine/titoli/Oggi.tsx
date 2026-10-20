// La scheda Oggi: una riga per titolo che hai, con le colonne che si ordinano con un clic.
import { useState } from 'react'
import type { ContiTitoli, ContoTitolo } from '../../conti/titoli.ts'
import { euro, guadagnoEuro, NomeMese, percentuale, segno } from '../../formato.ts'
import { Cella, NomeTitolo, Pill, PrezzoConFonte } from './comuni.tsx'
import { rigaCheApre, useApriScheda } from './usa.ts'

type Chiave = 'nome' | 'valore' | 'pagato' | 'guadagno' | 'dallAcquisto' | 'medioAnnuo' | 'ultimoMese' | 'prezzo'
type Ordine = { chiave: Chiave; verso: 1 | -1 }

function valoreDa(c: ContoTitolo, k: Chiave): number | string | null {
  switch (k) {
    case 'nome':
      return c.nomeCorto
    case 'prezzo':
      return c.stato === 'aperto' ? (c.prezzo.n ?? null) : null
    default:
      return c[k].n
  }
}

/** Ordina; i numeri che mancano vanno sempre in fondo. */
function ordina(righe: ContoTitolo[], { chiave, verso }: Ordine): ContoTitolo[] {
  return righe.slice().sort((a, b) => {
    const va = valoreDa(a, chiave)
    const vb = valoreDa(b, chiave)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb), 'it') * verso
    return (va - vb) * verso
  })
}

export function Oggi({ conti }: { conti: ContiTitoli }) {
  const [ordine, setOrdine] = useState<Ordine>({ chiave: 'dallAcquisto', verso: -1 })
  const apri = useApriScheda()
  const righe = ordina(
    conti.titoli.filter((t) => t.stato !== 'chiuso'),
    ordine,
  )
  const colonne: { k: Chiave; nome: string; numeri: boolean }[] = [
    { k: 'nome', nome: 'Titolo', numeri: false },
    { k: 'valore', nome: 'Valore', numeri: true },
    { k: 'pagato', nome: 'Pagato', numeri: true },
    { k: 'guadagno', nome: 'Guadagno', numeri: true },
    { k: 'dallAcquisto', nome: 'Dall’acquisto', numeri: true },
    { k: 'medioAnnuo', nome: 'Medio annuo', numeri: true },
    { k: 'ultimoMese', nome: conti.fine ? NomeMese(conti.fine) : 'Ultimo mese', numeri: true },
    { k: 'prezzo', nome: 'Prezzo', numeri: true },
  ]
  const cambiaOrdine = (k: Chiave) =>
    setOrdine((o) => (o.chiave === k ? { chiave: k, verso: o.verso === 1 ? -1 : 1 } : { chiave: k, verso: k === 'nome' ? 1 : -1 }))

  if (righe.length === 0) return <div className="vuoto">Oggi non hai titoli: quelli venduti sono nella scheda Venduti.</div>

  return (
    <>
      <div className="attrezzi">
        <span>Clic su un titolo per aprirne la scheda; clic su un numero per sapere la provenienza.</span>
      </div>
      <div className="scorre">
        <table>
          <thead>
            <tr>
              {colonne.map((c) => (
                <th
                  key={c.k}
                  className={c.numeri ? 'n' : undefined}
                  aria-sort={ordine.chiave === c.k ? (ordine.verso === 1 ? 'ascending' : 'descending') : undefined}
                >
                  <button type="button" onClick={() => cambiaOrdine(c.k)}>
                    {c.nome}
                    {ordine.chiave === c.k && <Freccia su={ordine.verso === 1} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.map((t) => (
              <tr key={t.id} {...rigaCheApre(apri, t.id)}>
                <td>
                  <NomeTitolo conto={t} />
                </td>
                <td className="n">
                  <Cella numero={t.valore} scrivi={(n) => euro(n)} />
                </td>
                <td className="n">
                  <Cella numero={t.pagato} scrivi={(n) => euro(n)} />
                </td>
                <td className="n">
                  <Cella numero={t.guadagno} scrivi={(n) => guadagnoEuro(n)} segno={(n) => segno(n)} />
                </td>
                <td className="n">
                  <Pill numero={t.dallAcquisto} />
                </td>
                <td className="n">
                  <Cella numero={t.medioAnnuo} scrivi={percentuale} />
                </td>
                <td className="n">
                  <Cella numero={t.ultimoMese} scrivi={percentuale} segno={(n) => segno(n * 100, 1)} />
                </td>
                <td className="n">
                  <PrezzoConFonte conto={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function Freccia({ su }: { su: boolean }) {
  return (
    <svg className="ic p" viewBox="0 0 24 24" aria-hidden="true">
      <path d={su ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'} />
    </svg>
  )
}
