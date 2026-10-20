// La pagina Portafoglio, la prima che si apre (mappa, ticket 28, versione B "prima la risposta"):
// 1. testata con "Prezzi al …";
// 2. il riquadro della risposta "Quanto stai guadagnando" e accanto la classifica "Fai meglio dei riferimenti?"
//    (ticket 10), uno sotto l'altro nella finestra stretta;
// 3. il grafico "Come è cresciuto il valore", dall'inizio o negli ultimi 12 mesi;
// 4. i 3 titoli che vanno meglio e i 3 che vanno peggio.
import { useMemo, useState } from 'react'
import { contiDelPortafoglio, type MisuraTitoli } from '../conti/portafoglio.ts'
import { confrontoConIRiferimenti } from '../conti/riferimenti.ts'
import { data } from '../formato.ts'
import { useFile } from '../stato.tsx'
import { Classifica } from './portafoglio/Classifica.tsx'
import './portafoglio/classifica.css'
import { GraficoValore } from './portafoglio/GraficoValore.tsx'
import { MeglioPeggio } from './portafoglio/MeglioPeggio.tsx'
import './portafoglio/portafoglio.css'
import { Risposta } from './portafoglio/Risposta.tsx'
import { useConti } from './titoli/usa.ts'

type Periodo = 'tutto' | '12'
const PERIODI: [Periodo, string][] = [
  ['tutto', 'Dall’inizio'],
  ['12', 'Ultimi 12 mesi'],
]

export function Portafoglio() {
  const { dati } = useFile()
  const titoli = useConti()
  const conti = useMemo(() => contiDelPortafoglio(dati, titoli), [dati, titoli])
  const confronto = useMemo(() => confrontoConIRiferimenti(dati, conti), [dati, conti])
  // Le scelte non si ricordano alla riapertura (DESIGN.md, "Bottoni della misura").
  const [periodo, setPeriodo] = useState<Periodo>('tutto')
  const [misura, setMisura] = useState<MisuraTitoli>('acquisto')

  const testata = (
    <div className="testata">
      <h1>Portafoglio</h1>
      {conti.fine && <span className="tenue">Prezzi al {data(conti.fine)}</span>}
    </div>
  )
  if (titoli.titoli.length === 0 || !conti.fine)
    return (
      <section className="pagina-portafoglio">
        {testata}
        <div className="riquadro vuoto">
          {titoli.titoli.length === 0
            ? 'Nel file dei dati non ci sono ancora titoli: arrivano quando registri il primo acquisto.'
            : 'Nel file dei dati non ci sono ancora prezzi di fine mese: quanto stai guadagnando si vede dopo il primo aggiornamento.'}
        </div>
      </section>
    )

  // "Ultimi 12 mesi": dal fine mese di un anno fa, così si vedono 12 mesi interi.
  const punti = periodo === '12' ? conti.serie.slice(-13) : conti.serie
  return (
    <section className="pagina-portafoglio">
      {testata}

      <div className={`dueparti${confronto ? '' : ' solo'}`}>
        <Risposta conti={conti} />
        {confronto && <Classifica confronto={confronto} />}
      </div>

      <div className="riquadro blocco">
        <div className="testa">
          <h2>Come è cresciuto il valore</h2>
          <div className="segmenti" role="group" aria-label="Quali mesi vedere">
            {PERIODI.map(([k, nome]) => (
              <button key={k} type="button" aria-pressed={periodo === k} onClick={() => setPeriodo(k)}>
                {nome}
              </button>
            ))}
          </div>
        </div>
        <GraficoValore punti={punti} />
      </div>

      <MeglioPeggio titoli={titoli} misura={misura} scegli={setMisura} />
    </section>
  )
}
