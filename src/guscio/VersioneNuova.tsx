// La striscia "C'è una versione nuova: la installo?" in cima alle pagine.
// Il controllo lo fa il processo principale all'apertura; qui si mostra lo stato e si manda la risposta.
// Aperte in un browser, le pagine non hanno window.aggiornamento: con ?versione=nuova nell'indirizzo
// si vede una prova finta (versione 9.9.9 che si "scarica" in pochi secondi), altrimenti niente.
import { useEffect, useState } from 'react'
import { inParole, NESSUNO, prossimoStato, type PonteAggiornamento, type StatoAggiornamento } from '../dati/aggiornamento.ts'
import { Icona } from '../icone.tsx'

declare global {
  interface Window {
    aggiornamento?: PonteAggiornamento
  }
}

const ponteAggiornamento: PonteAggiornamento | null =
  window.aggiornamento ?? (new URLSearchParams(location.search).get('versione') === 'nuova' ? creaPonteFinto() : null)

export function VersioneNuova() {
  const [stato, setStato] = useState<StatoAggiornamento>(NESSUNO)
  const [nascosta, setNascosta] = useState(false)

  useEffect(() => {
    if (!ponteAggiornamento) return
    let attivo = true
    const smetti = ponteAggiornamento.quandoCambia((s) => attivo && setStato(s))
    void ponteAggiornamento.leggi().then((s) => attivo && setStato(s))
    return () => {
      attivo = false
      smetti()
    }
  }, [])

  const parole = inParole(stato)
  if (!ponteAggiornamento || !parole || nascosta) return null

  const icona = stato.stato === 'scarico' || stato.stato === 'installo' ? 'aggiorna' : 'info'
  return (
    <div className="striscia" role="status">
      <span>
        <Icona nome={icona} />
        <span>{parole.testo}</span>
      </span>
      <span>
        {parole.bottoni.map((b) => (
          <button
            key={b.testo}
            type="button"
            className={b.primario ? 'btn primario' : 'btn'}
            onClick={() => void ponteAggiornamento.rispondi(b.installa).then(setStato)}
          >
            {b.testo}
          </button>
        ))}
        {parole.chiudibile && (
          <button type="button" className="btn solo-icona" aria-label="Chiudi" onClick={() => setNascosta(true)}>
            <Icona nome="x" piccola />
          </button>
        )}
      </span>
    </div>
  )
}

/** Solo nel browser, con ?versione=nuova: finge una versione nuova che si scarica in tre secondi. */
function creaPonteFinto(): PonteAggiornamento {
  let stato: StatoAggiornamento = prossimoStato(NESSUNO, { tipo: 'trovata', versione: '9.9.9' })
  const ascoltatori = new Set<(s: StatoAggiornamento) => void>()
  const cambia = (s: StatoAggiornamento) => {
    stato = s
    for (const fai of ascoltatori) fai(s)
  }
  return {
    leggi: async () => stato,
    rispondi: async (installa) => {
      cambia(prossimoStato(stato, { tipo: 'risposta', installa }))
      if (stato.stato === 'scarico') {
        for (let p = 20; p <= 100; p += 20) {
          setTimeout(() => cambia(prossimoStato(stato, p < 100 ? { tipo: 'avanzamento', percento: p } : { tipo: 'scaricata' })), p * 30)
        }
      }
      return stato
    },
    quandoCambia: (fai) => {
      ascoltatori.add(fai)
      return () => void ascoltatori.delete(fai)
    },
  }
}
