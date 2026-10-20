// La schermata intera "Il file dei dati non è leggibile" (ticket 27 della mappa, variante A).
// Dice dov'è l'errore, non scrive niente da sola e propone di ripristinare l'ultima copia.
import { useState } from 'react'
import { quandoInParole, type Copia } from '../dati/copie.ts'
import type { Apertura } from '../dati/ponte.ts'
import { quando } from '../formato.ts'
import { ponte } from '../ponte.ts'
import { useStato } from '../stato.tsx'

type Rotto = Extract<Apertura, { stato: 'rotto' }>

export function FileRotto({ apertura }: { apertura: Rotto }) {
  const { esegui, occupato } = useStato()
  const { cartella, problema, copie, controllato, avviso } = apertura
  const buone = copie.filter((c) => !c.rotta)
  const ultima = buone[0]
  const [daConfermare, setDaConfermare] = useState<Copia | null>(null)
  const [altre, setAltre] = useState(false)
  const [riprovato, setRiprovato] = useState(false)

  const torna = (c: Copia) => void esegui(() => ponte.tornaAllaCopia(c.file))
  const riprova = async () => {
    setDaConfermare(null)
    await esegui(() => ponte.apri())
    setRiprovato(true)
  }

  return (
    <div className="schermata">
      <div className="riquadro" role="alert" aria-labelledby="titolo-rotto">
        <h1 id="titolo-rotto">Il file dei dati non è leggibile</h1>
        <p>
          Nel file <b>portafoglio.json</b> della cartella <b>{cartella.nome}</b>
          {problema.riga ? (
            <>
              , alla <b>riga {problema.riga}</b>, {problema.scrittura ? '' : 'è presente un dato non valido: '}
              {problema.spiegazione}.
            </>
          ) : (
            <>: {problema.spiegazione}.</>
          )}{' '}
          {problema.scrittura && 'Accade quando il file viene modificato manualmente, per esempio con Blocco note.'}
          {problema.altri > 0 && (problema.altri === 1 ? ' Segue un altro problema.' : ` Seguono altri ${problema.altri} problemi.`)}
        </p>
        {problema.estratto.length > 0 && (
          <pre className="codice" aria-label={`Righe intorno alla riga ${problema.riga}`}>
            {problema.estratto.map((r) => (
              <span key={r.numero} className={r.numero === problema.riga ? 'qui' : undefined}>
                <span className="num-riga">{String(r.numero).padStart(5, ' ')}   </span>
                {r.testo}
                {r.numero === problema.riga && `     ← ${problema.breve}`}
                {'\n'}
              </span>
            ))}
          </pre>
        )}
        <p className="tenue">Il file non è stato modificato né cancellato.</p>
        {avviso && <p className="avviso">{avviso}</p>}
        {riprovato && !avviso && (
          <p className="avviso" role="status">
            Nuova lettura {quando(controllato)}: il file non è ancora leggibile.
          </p>
        )}

        {daConfermare ? (
          <div className="spiega" role="group" aria-label="Conferma">
            <p>
              Ripristinare la copia del <b>{quandoInParole(daConfermare.quando)}</b>
              {daConfermare.perche && `, fatta ${daConfermare.perche}`}? Si perdono solo le modifiche successive. Il file
              danneggiato non viene cancellato: viene spostato nella cartella <b>copie</b> come <b>portafoglio rotto …json</b>.
            </p>
            <div className="bottoni" style={{ marginTop: 12 }}>
              <button type="button" className="btn primario" disabled={occupato} onClick={() => torna(daConfermare)}>
                Ripristina questa copia
              </button>
              <button type="button" className="btn" onClick={() => setDaConfermare(null)}>
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <div className="bottoni">
            {ultima && (
              <button type="button" className="btn primario" disabled={occupato} onClick={() => setDaConfermare(ultima)}>
                Ripristina l’ultima copia
              </button>
            )}
            <button type="button" className="btn" onClick={() => void ponte.apriInEsplora('dati')}>
              Apri la cartella
            </button>
            <button type="button" className="btn" disabled={occupato} onClick={() => void riprova()}>
              Rileggi il file
            </button>
          </div>
        )}

        {ultima ? (
          <>
            <p className="tenue piccolo">
              L’ultima copia è del <b>{quandoInParole(ultima.quando)}</b>
              {ultima.perche && `, fatta ${ultima.perche}`}. Ripristinandola si perdono solo le modifiche successive.
            </p>
            {buone.length > 1 && (
              <p>
                <button type="button" className="link" onClick={() => setAltre(!altre)} aria-expanded={altre}>
                  {altre ? 'Nascondi le altre copie' : 'Mostra le altre copie'}
                </button>
              </p>
            )}
            {altre && (
              <div className="copie">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Motivo</th>
                      <th className="n"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {buone.map((c) => (
                      <tr key={c.file}>
                        <td>{quandoInParole(c.quando)}</td>
                        <td className="tenue">{c.perche || '—'}</td>
                        <td className="n">
                          <button type="button" className="btn" disabled={occupato} onClick={() => setDaConfermare(c)}>
                            Ripristina
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="tenue piccolo">
              Nella cartella <b>copie</b> non è ancora presente alcuna copia da ripristinare. È possibile correggere il file
              con Blocco note e poi selezionare “Rileggi il file”, oppure scegliere un’altra cartella dei dati.
            </p>
            <p>
              <button type="button" className="link" disabled={occupato} onClick={() => void esegui(() => ponte.scegliCartella())}>
                Scegli un’altra cartella
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
