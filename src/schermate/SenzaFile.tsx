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
          <h1>Dove sono i tuoi dati?</h1>
          <p>
            Portafoglio titoli tiene tutto nel file <b>portafoglio.json</b>, dentro una cartella del tuo PC che scegli tu
            (per esempio una cartella dentro <b>OneDrive › Documenti</b>). L’applicazione la ricorda: la scegli una volta sola.
          </p>
          <div className="bottoni">{scegli}</div>
        </div>
      </div>
    )

  if (apertura.stato === 'cartella-mancante')
    return (
      <div className="schermata">
        <div className="riquadro">
          <h1>Non trovo la cartella dei dati</h1>
          <p>
            La cartella <b>{apertura.cartella.percorso}</b> non c’è più, o non si raggiunge. Se è su OneDrive, forse il PC
            non l’ha ancora scaricata: aspetta un momento e riprova.
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
        <h1>In questa cartella non ci sono i dati</h1>
        <p>
          Nella cartella <b>{apertura.cartella.nome}</b> non c’è il file <b>portafoglio.json</b>. Se i tuoi dati sono in
          un’altra cartella, sceglila. Se invece vuoi cominciare da zero, posso creare qui un portafoglio vuoto.
        </p>
        {conferma ? (
          <div className="spiega">
            <p>
              Creo un portafoglio vuoto in <b>{apertura.cartella.percorso}</b>?
            </p>
            <div className="bottoni" style={{ marginTop: 12 }}>
              <button type="button" className="btn primario" disabled={occupato} onClick={() => void esegui(() => ponte.creaFileVuoto())}>
                Sì, crea il portafoglio vuoto
              </button>
              <button type="button" className="btn" onClick={() => setConferma(false)}>
                No
              </button>
            </div>
          </div>
        ) : (
          <div className="bottoni">
            {scegli}
            <button type="button" className="btn" onClick={() => setConferma(true)}>
              Comincia da zero qui
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
