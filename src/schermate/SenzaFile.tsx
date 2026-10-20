// Le schermate di quando non c'è ancora un file da leggere:
// la prima apertura (cartella da scegliere), la cartella sparita, la cartella senza portafoglio.json.
import { useState } from 'react'
import type { Apertura } from '../dati/ponte.ts'
import { ponte } from '../ponte.ts'
import { useStato } from '../stato.tsx'

type SenzaFileStato = Extract<Apertura, { stato: 'nessuna-cartella' | 'cartella-mancante' | 'file-mancante' }>

export function SenzaFile({ apertura }: { apertura: SenzaFileStato }) {
  const { esegui, occupato } = useStato()
  const [conferma, setConferma] = useState(false)
  const scegli = (
    <button type="button" className="btn primario" disabled={occupato} onClick={() => void esegui(() => ponte.scegliCartella())}>
      Scegli la cartella dei dati
    </button>
  )

  if (apertura.stato === 'nessuna-cartella')
    return (
      <div className="schermata">
        <div className="riquadro">
          <h1>Cartella dei dati</h1>
          <p>
            Portafoglio titoli conserva tutti i dati nel file <b>portafoglio.json</b>, in una cartella del computer a scelta
            (per esempio in <b>OneDrive › Documenti</b>). La cartella si sceglie una volta sola: l’applicazione la ricorda.
          </p>
          <div className="bottoni">{scegli}</div>
        </div>
      </div>
    )

  if (apertura.stato === 'cartella-mancante')
    return (
      <div className="schermata">
        <div className="riquadro">
          <h1>Cartella dei dati non trovata</h1>
          <p>
            La cartella <b>{apertura.cartella.percorso}</b> non esiste più o non è raggiungibile. Se si trova su OneDrive,
            potrebbe non essere ancora stata scaricata sul computer: attendere qualche istante e riprovare.
          </p>
          <div className="bottoni">
            <button type="button" className="btn" disabled={occupato} onClick={() => void esegui(() => ponte.apri())}>
              Riprova
            </button>
            {scegli}
          </div>
        </div>
      </div>
    )

  return (
    <div className="schermata">
      <div className="riquadro">
        <h1>La cartella non contiene i dati</h1>
        <p>
          Nella cartella <b>{apertura.cartella.nome}</b> non è presente il file <b>portafoglio.json</b>. Se i dati si
          trovano in un’altra cartella, sceglierla; per cominciare da zero, è possibile creare qui un portafoglio vuoto.
        </p>
        {conferma ? (
          <div className="spiega">
            <p>
              Creare un portafoglio vuoto in <b>{apertura.cartella.percorso}</b>?
            </p>
            <div className="bottoni" style={{ marginTop: 12 }}>
              <button type="button" className="btn primario" disabled={occupato} onClick={() => void esegui(() => ponte.creaFileVuoto())}>
                Crea il portafoglio vuoto
              </button>
              <button type="button" className="btn" onClick={() => setConferma(false)}>
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <div className="bottoni">
            {scegli}
            <button type="button" className="btn" onClick={() => setConferma(true)}>
              Crea un portafoglio vuoto
            </button>
            <button type="button" className="btn" onClick={() => void ponte.apriInEsplora('dati')}>
              Apri la cartella
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
