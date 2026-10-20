// La correzione a mano di un prezzo, nel pannello "Da dove viene" (ticket 8, mappa 25 e DESIGN.md):
// "Se il prezzo è errato, inserire quello corretto", "Correggi", una conferma, poi la scrittura sicura
// con la copia prima. Dopo, il prezzo porta "manuale" e quello di prima barrato, con "Torna al prezzo di prima".
// Il prezzo si legge dal file di adesso, non dalla spiegazione: dopo la correzione si vede subito com'è.
import { useRef, useState } from 'react'
import { leggiNumero } from '../aggiorna/numeri.ts'
import { fonteInParole } from '../conti/fonti.ts'
import { eAMano } from '../conti/prezzo-a-mano.ts'
import { nomeDelTitolo, trovaPrezzo, type Correzione, type EsitoCorrezione, type RifPrezzo } from '../dati/correzione.ts'
import { data, mese, prezzo } from '../formato.ts'
import { Icona } from '../icone.tsx'
import { ponte } from '../ponte.ts'
import { useStato } from '../stato.tsx'
import { ChipAMano } from './AMano.tsx'
import { FRASE_COPIA } from '../dati/copie.ts'

type Esito = { ok: boolean; testo: string }

export function CorreggiPrezzo({ rif }: { rif: RifPrezzo }) {
  const { apertura, esegui, occupato } = useStato()
  const [testo, setTesto] = useState('')
  const [sbagliato, setSbagliato] = useState<string | null>(null)
  const [conferma, setConferma] = useState<Correzione | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  const dati = apertura.stato === 'pronto' ? apertura.dati : null
  const p = dati ? trovaPrezzo(dati, rif) : undefined
  if (!dati || !p) return null

  const quale = `${nomeDelTitolo(dati, rif.titolo)} a fine ${mese(rif.data)}`
  const scrivi = (n: number) => prezzo(n, p.valuta)
  const aMano = eAMano(p)
  const prima = aMano ? p.prima : undefined

  const chiedi = () => {
    const n = leggiNumero(testo)
    const problema = n === null ? 'Inserire un numero maggiore di zero, per esempio 12,75.' : n === p.prezzo ? 'Il prezzo è uguale a quello già presente.' : null
    if (problema || n === null) {
      setSbagliato(problema)
      campo.current?.focus()
      return
    }
    setEsito(null)
    setConferma({ tipo: 'correggi', titolo: rif.titolo, data: rif.data, prezzo: n })
  }

  const scriviNelFile = async (c: Correzione) => {
    let risposta: EsitoCorrezione | null = null
    await esegui(async () => {
      risposta = await ponte.correggiPrezzo(c)
      return risposta.esito === 'errore' ? null : risposta.apertura
    })
    setConferma(null)
    const r = risposta as EsitoCorrezione | null
    if (!r) return // l'errore lo mostra già la striscia in alto
    if (r.esito === 'errore') return setEsito({ ok: false, testo: `Si è verificato un errore: ${r.perche}. Il file non è stato modificato.` })
    if (r.esito === 'cambiato')
      return setEsito({
        ok: false,
        testo: 'Il file è stato modificato da un altro computer o fuori dall’applicazione: non è stato scritto nulla e i dati sono stati ricaricati. Verificare il prezzo e ripetere la correzione.',
      })
    setTesto('')
    setEsito({
      ok: true,
      testo: `${c.tipo === 'correggi' ? 'Correzione salvata' : 'Prezzo precedente ripristinato'}. ${FRASE_COPIA}`,
    })
  }

  return (
    <section className="correzione" aria-label="Correzione manuale">
      {aMano && (
        <p className="stato-mano">
          <ChipAMano lungo={!!prima} />
          {p.quando ? ` il ${data(p.quando)}` : ''}
          {prima ? (
            <>
              . Prezzo precedente: <s>{scrivi(prima.prezzo)}</s>, {fonteInParole(prima.fonte).nome}.
            </>
          ) : (
            '.'
          )}
        </p>
      )}

      {conferma ? (
        <div className="conferma" role="group" aria-label="Conferma">
          <p>
            {conferma.tipo === 'correggi' ? (
              <>
                Si scrive <b>{scrivi(conferma.prezzo)}</b> al posto di {scrivi(p.prezzo)} come prezzo di {quale}. Il prezzo resterà segnato come “manuale”.
              </>
            ) : (
              <>
                Si ripristina <b>{scrivi(prima!.prezzo)}</b> ({fonteInParole(prima!.fonte).nome}) al posto di {scrivi(p.prezzo)}, inserito manualmente.
              </>
            )}{' '}
            Prima della scrittura si salva una copia del file.
          </p>
          <div className="bottoni">
            <button type="button" className="btn primario" autoFocus disabled={occupato} onClick={() => void scriviNelFile(conferma)}>
              {conferma.tipo === 'correggi' ? 'Sì, correggi' : 'Sì, torna al prezzo di prima'}
            </button>
            <button type="button" className="btn" disabled={occupato} onClick={() => setConferma(null)}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <>
          <label>
            Se il prezzo è errato, inserire quello corretto
            <span className="campo-valuta">
              <input
                ref={campo}
                inputMode="decimal"
                placeholder={prezzo(p.prezzo, p.valuta).replace(/ \S+$/, '')}
                value={testo}
                aria-invalid={sbagliato !== null}
                onChange={(e) => {
                  setTesto(e.target.value)
                  setSbagliato(null)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  // Senza questo, lo stesso Invio premerebbe anche "Sì, correggi", che prende il focus: si scriverebbe senza conferma.
                  e.preventDefault()
                  chiedi()
                }}
              />
              {p.valuta === 'EUR' ? '€' : p.valuta}
            </span>
          </label>
          {sbagliato && (
            <p className="sbagliato" role="alert">
              {sbagliato}
            </p>
          )}
          <div className="bottoni">
            <button type="button" className="btn primario" disabled={occupato} onClick={chiedi}>
              Correggi
            </button>
            {prima && (
              <button type="button" className="btn" disabled={occupato} onClick={() => {
                  setEsito(null)
                  setConferma({ tipo: 'torna', titolo: rif.titolo, data: rif.data })
                }}>
                Torna al prezzo di prima
              </button>
            )}
          </div>
        </>
      )}

      {esito && (
        <p className="esito" role="status">
          <Icona nome={esito.ok ? 'ok' : 'info'} piccola />
          <span>{esito.testo}</span>
        </p>
      )}
      <p className="tenue piccolo">Il prezzo corretto resta segnato come “manuale” in tutte le tabelle. Il file non viene modificato fino alla conferma.</p>
    </section>
  )
}
