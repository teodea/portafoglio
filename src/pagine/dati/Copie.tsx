// La scheda "Copie" della pagina Dati (ticket 13, mappa 27): per ogni copia quando è stata fatta, perché,
// il nome del file e "Torna a questa copia". Prima di tornare indietro l'applicazione copia il file di adesso,
// così si può sempre tornare a quello di adesso. C'è anche "Apri la cartella".
import { useState } from 'react'
import { quandoInParole, type Copia } from '../../dati/copie.ts'
import type { EsitoRitorno } from '../../dati/torna-copia.ts'
import { Icona } from '../../icone.tsx'
import { ponte } from '../../ponte.ts'
import { useStato } from '../../stato.tsx'

type Esito = { ok: boolean; testo: string; copia?: string }

export function Copie({ copie }: { copie: Copia[] }) {
  const { esegui, occupato } = useStato()
  const [daConfermare, setDaConfermare] = useState<Copia | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)

  const torna = async (c: Copia) => {
    let risposta: EsitoRitorno | null = null
    await esegui(async () => {
      risposta = await ponte.tornaAQuestaCopia(c.file)
      return risposta.esito === 'errore' ? null : risposta.apertura
    })
    setDaConfermare(null)
    const r = risposta as EsitoRitorno | null
    if (!r) return // l'errore lo mostra già la striscia in alto
    if (r.esito === 'errore') return setEsito({ ok: false, testo: `Si è verificato un errore: ${r.perche}. I dati non sono stati modificati.` })
    if (r.esito === 'cambiato')
      return setEsito({
        ok: false,
        testo: 'Il file è stato modificato da un altro computer o fuori dall’applicazione: non è stato cambiato nulla e i dati sono stati ricaricati. Verificare le copie e riprovare.',
      })
    setEsito({
      ok: true,
      copia: r.copia,
      testo: `Ripristino completato: i dati sono quelli del ${quandoInParole(c.quando)}. Il file precedente è conservato nella copia “${r.copia}”, in cima all’elenco; per ripristinarlo, usare “Torna a questa copia” sulla sua riga.`,
    })
  }

  // Le copie dello stesso minuto non si distinguono dal nome: quella appena fatta va comunque in cima.
  const appena = esito?.copia ? copie.find((c) => c.file === esito.copia) : undefined
  const elenco = appena ? [appena, ...copie.filter((c) => c !== appena)] : copie

  return (
    <>
      <div className="attrezzi">
        <span>
          Prima di ogni scrittura il file viene copiato nella cartella <b>copie</b>. Le copie sono conservate tutte.
        </span>
        <button type="button" className="btn" onClick={() => void ponte.apriInEsplora('copie')}>
          <Icona nome="cartella" piccola /> Apri la cartella
        </button>
      </div>

      {daConfermare && (
        <div className="spiega" role="group" aria-label="Conferma">
          <p>
            Ripristinare la copia del <b>{quandoInParole(daConfermare.quando)}</b>
            {daConfermare.perche && `, fatta ${daConfermare.perche}`}? I dati tornano a quella data. Il file attuale non va perso: prima del
            ripristino se ne salva una copia, recuperabile con “Torna a questa copia”.
          </p>
          <div className="bottoni" style={{ marginTop: 12 }}>
            <button type="button" className="btn primario" autoFocus disabled={occupato} onClick={() => void torna(daConfermare)}>
              Sì, torna a questa copia
            </button>
            <button type="button" className="btn" disabled={occupato} onClick={() => setDaConfermare(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {esito && (
        <p className={`dati-esito${esito.ok ? '' : ' no'}`} role="status">
          <Icona nome={esito.ok ? 'ok' : 'info'} piccola />
          <span>{esito.testo}</span>
        </p>
      )}

      {copie.length === 0 ? (
        <div className="vuoto">La cartella copie è vuota: la prima copia si salva alla prima scrittura nel file.</div>
      ) : (
        <div className="scorre">
          <table className="dati-copie">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Motivo e nome del file</th>
                <th className="n"></th>
              </tr>
            </thead>
            <tbody>
              {elenco.map((c) => (
                <tr key={c.file} className={esito?.copia === c.file ? 'dati-appena' : undefined}>
                  <td>{quandoInParole(c.quando)}</td>
                  <td>
                    {c.rotta ? 'file non leggibile, messo da parte' : c.perche || '—'}
                    <span className="sotto dati-file">{c.file}</span>
                  </td>
                  <td className="n">
                    {c.rotta ? (
                      <span className="tenue piccolo">non leggibile</span>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        disabled={occupato}
                        onClick={() => {
                          setEsito(null)
                          setDaConfermare(c)
                        }}
                      >
                        Torna a questa copia
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
