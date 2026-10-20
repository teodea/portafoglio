// "Scarica in Excel" (ticket 14, mappa 27, come nella bozza 27): il tasto nella testata della pagina Dati apre
// il pannello che dice cosa c'è nel file e come si chiama, con il tasto primario "Scarica". Il file
// "Portafoglio titoli <data>.xlsx" lo scrive il processo principale nella cartella Download; poi "Apri il file".
import { useState } from 'react'
import { oggiDellApp } from '../../aggiorna/oggi.ts'
import { libroExcel, NOMI_FOGLI } from '../../conti/excel.ts'
import { testo } from '../../conti/spiegazione.ts'
import { nomeFileExcel, type EsitoExcel } from '../../dati/excel.ts'
import { Icona } from '../../icone.tsx'
import { useSpiega } from '../../pannello/spiega.ts'
import { ponte } from '../../ponte.ts'
import { useFile } from '../../stato.tsx'
import './dati.css'
import { percheInParole } from '../../dati/errore.ts'

export function ScaricaInExcel() {
  const spiega = useSpiega()
  return (
    <button
      type="button"
      className="btn"
      aria-haspopup="dialog"
      onClick={() => spiega({ titolo: 'Scarica in Excel', grande: testo(''), conto: [], note: [], excel: true })}
    >
      <svg className="ic p" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </svg>
      Scarica in Excel
    </button>
  )
}

const COSA: Record<(typeof NOMI_FOGLI)[number], string> = {
  Leggimi: 'il contenuto di ogni foglio, la data e i dati di sintesi del portafoglio',
  Titoli: 'un titolo per riga, compresi i venduti, con i valori di fine mese',
  Operazioni: 'acquisti e vendite',
  Dividendi: 'lordo, imposte, netto',
  'Prezzi di fine mese': 'un prezzo per riga, con cambio, fonte e controllo',
  'Valore mese per mese': 'titoli per riga, mesi per colonna',
  'Inflazione e riferimenti': 'un mese per riga',
}

type Stato = { tipo: 'pronto' } | { tipo: 'in-corso' } | EsitoExcel

/** Il corpo del pannello "Scarica in Excel" (dentro il pannello di destra, Pannello.tsx). */
export function PannelloExcel() {
  const { dati } = useFile()
  const oggi = oggiDellApp()
  const [stato, setStato] = useState<Stato>({ tipo: 'pronto' })

  const scarica = async () => {
    setStato({ tipo: 'in-corso' })
    try {
      setStato(await ponte.scaricaInExcel(libroExcel(dati, oggi)))
    } catch (e) {
      setStato({ esito: 'errore', perche: percheInParole(e) })
    }
  }

  const fatto = 'esito' in stato && stato.esito === 'fatto' ? stato : null
  const errore = 'esito' in stato && stato.esito === 'errore' ? stato : null
  const inCorso = 'tipo' in stato && stato.tipo === 'in-corso'
  return (
    <div className="dati-excel">
      <p>
        Un file Excel con tutti i dati, da consultare, filtrare o inviare. L’esportazione è in una sola direzione: le modifiche fatte nel
        file Excel non tornano nell’applicazione.
      </p>
      <div className="conto">
        {NOMI_FOGLI.map((f) => (
          <div key={f}>
            <span>
              <b>{f}</b>
            </span>
            <span className="tenue">{COSA[f]}</span>
          </div>
        ))}
      </div>
      <p className="tenue">
        Nome del file: <b>{fatto?.nome ?? nomeFileExcel(oggi)}</b>, nella cartella Download. I numeri sono valori (sommabili), non
        formule.
      </p>
      {fatto && (
        <p className="esito" role="status">
          <Icona nome="ok" piccola />
          <span>File salvato nella cartella Download.</span>
        </p>
      )}
      {errore && (
        <p className="esito" role="status">
          <Icona nome="info" piccola />
          <span>Si è verificato un errore: {errore.perche}. Il file non è stato salvato.</span>
        </p>
      )}
      <div className="bottoni">
        {fatto ? (
          <>
            <button type="button" className="btn primario" onClick={() => void ponte.apriFileScaricato(fatto.percorso)}>
              Apri il file
            </button>
            <button type="button" className="btn" onClick={() => void scarica()}>
              Scarica di nuovo
            </button>
          </>
        ) : (
          <button type="button" className="btn primario" disabled={inCorso} onClick={() => void scarica()}>
            {inCorso ? 'Scaricamento in corso…' : 'Scarica'}
          </button>
        )}
      </div>
    </div>
  )
}
