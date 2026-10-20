// La scheda "Inflazione, cambi e riferimenti" della pagina Dati (ticket 13, mappa 27): un mese per riga,
// con l'inflazione NIC, i cambi BCE dei titoli in valuta e i sei riferimenti. Dove un dato non c'è si legge
// "manca". Il clic su un numero, o su "manca", apre la provenienza con la fonte, "Scarica di nuovo" e la
// correzione a mano (CorreggiDato.tsx).
import { datoInCifre, nomeColonna, righeDati, senzaRiferimenti, spiegaDato, valuteDeiTitoli, type CellaDato } from '../../conti/pagina-dati.ts'
import { DESCRIZIONE } from '../../dati/aggiorna/riferimenti.ts'
import { RIFERIMENTI, type FileDati } from '../../dati/tipi.ts'
import { mese } from '../../formato.ts'
import { ChipAMano } from '../../pannello/AMano.tsx'
import { useSpiega } from '../../pannello/spiega.ts'

function Cella({ c, dati }: { c: CellaDato; dati: FileDati }) {
  const spiega = useSpiega()
  if (c.tipo === 'non-serve')
    return (
      <span className="tenue" title="Dato non necessario per questo mese">
        —
      </span>
    )
  const apri = () => spiega(spiegaDato(dati, c.dato))
  if (c.tipo === 'manca')
    return (
      <button type="button" className="num tenue dati-manca" aria-haspopup="dialog" onClick={apri} title={c.perche}>
        manca
      </button>
    )
  return (
    <>
      <button type="button" className="num" aria-haspopup="dialog" onClick={apri}>
        {c.aMano && c.prima !== null && <s className="prima">{datoInCifre(c.dato, c.prima)}</s>}
        {datoInCifre(c.dato, c.numero)}
      </button>
      {c.aMano && (
        <span className="sotto">
          <ChipAMano />
        </span>
      )}
    </>
  )
}

export function InflazioneCambiRiferimenti({ dati }: { dati: FileDati }) {
  const righe = righeDati(dati)
  const valute = valuteDeiTitoli(dati)
  if (!righe.length) return <div className="vuoto">Nessun movimento registrato: inflazione e riferimenti servono dal primo acquisto.</div>
  const quanti = righe.reduce(
    (n, r) => n + [r.nic, ...r.cambi, ...r.riferimenti].filter((c) => c.tipo === 'manca').length,
    0,
  )
  return (
    <>
      <div className="attrezzi">
        <span>Selezionare un numero per vederne la provenienza, scaricarlo di nuovo o correggerlo; selezionare “manca” per inserirlo.</span>
        <span>{quanti === 0 ? 'Nessun dato mancante.' : `${quanti === 1 ? 'Manca 1 dato' : `Mancano ${quanti} dati`}.`}</span>
      </div>
      {senzaRiferimenti(dati) && (
        <div className="spiega">
          Inflazione e riferimenti non sono ancora presenti: si scaricano con il prossimo <b>Aggiorna fine mese</b>, che la prima volta
          recupera tutta la serie dal primo acquisto. Un valore si può anche inserire manualmente selezionando “manca”.
        </div>
      )}
      <div className="scorre">
        <table className="dati-mesi">
          <thead>
            <tr>
              <th>Fine mese</th>
              <th className="n">
                Inflazione NIC<span className="sotto">ISTAT</span>
              </th>
              {valute.map((v) => (
                <th key={v} className="n">
                  {nomeColonna({ tipo: 'cambio', valuta: v, data: '' })}
                  <span className="sotto">{v} per 1 €</span>
                </th>
              ))}
              {RIFERIMENTI.map((id) => (
                <th key={id} className="n">
                  {DESCRIZIONE[id].nome}
                  <span className="sotto">{DESCRIZIONE[id].valuta === 'USD' ? 'in dollari' : 'in euro'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.data}>
                <td>{mese(r.data)}</td>
                <td className="n">
                  <Cella c={r.nic} dati={dati} />
                </td>
                {r.cambi.map((c, i) => (
                  <td key={valute[i]} className="n">
                    <Cella c={c} dati={dati} />
                  </td>
                ))}
                {r.riferimenti.map((c, i) => (
                  <td key={RIFERIMENTI[i]} className="n">
                    <Cella c={c} dati={dati} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota dati-nota">
        Inflazione: indice NIC di ISTAT, fino a dicembre 2025 in base 2015 = 100 e da gennaio 2026 in base 2025 = 100 (nei conti le due
        basi si agganciano). Cambi: BCE, a fine mese. Riferimenti: valore di chiusura a fine mese da investing.com, con i dividendi
        reinvestiti; quelli in dollari si portano in euro con il cambio BCE dello stesso giorno.
      </p>
    </>
  )
}
