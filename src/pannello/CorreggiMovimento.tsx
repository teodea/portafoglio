// La correzione a mano di un movimento, nel pannello "Da dove viene" (ticket 11, mappa 26): lo stesso gesto
// dei prezzi (ticket 8). "Se qualcosa è sbagliato": le caselle con i valori di adesso, "Correggi a mano",
// una conferma che elenca cosa cambia, poi la scrittura sicura con la copia prima. Dopo, il chip "a mano",
// "prima era ~~30~~, ora 31" e "Torna a com'era". In fondo "Togli questo movimento", per uno registrato per sbaglio.
// Il movimento si legge dal file di adesso, non dalla spiegazione: dopo la correzione si vede subito com'è.
// Come in Registra, il pagato (o l'incassato) si rifà da solo con il conto quando cambi quote, prezzo, cambio o
// commissioni, finché non lo scrivi tu; se non torna con il conto, lo si dice (collaudo del 19/10, punto 4).
import { useEffect, useRef, useState } from 'react'
import {
  CAMPI_DIVIDENDO,
  CAMPI_OPERAZIONE,
  controllaModifica,
  movimentoInParole,
  trovaMovimento,
  type EsitoMovimento,
  type ModificaMovimento,
} from '../dati/movimenti.ts'
import { cambio, data, euro, guadagnoEuro, prezzo, quote } from '../formato.ts'
import { Icona } from '../icone.tsx'
import { dataNellaCasella, leggiData, leggiNumero, numeroNellaCasella, totaleDalConto } from '../pagine/movimenti/bozza.ts'
import { ponte } from '../ponte.ts'
import { useStato } from '../stato.tsx'
import { ChipAMano } from './AMano.tsx'
import { mostraAvviso } from './avviso.ts'
import { FRASE_COPIA } from '../dati/copie.ts'

type Esito = { ok: boolean; testo: string }
type Campo = 'data' | 'quantita' | 'prezzo' | 'cambio' | 'commissioni' | 'totale' | 'lordo' | 'imposte' | 'netto'
/** I campi da cui viene il conto del pagato: cambiandoli, il pagato si rifà. */
const DEL_CONTO: readonly Campo[] = ['quantita', 'prezzo', 'cambio', 'commissioni']

export function CorreggiMovimento({ id }: { id: string }) {
  const { apertura, esegui, occupato } = useStato()
  const dati = apertura.stato === 'pronto' ? apertura.dati : null
  const trovato = dati ? trovaMovimento(dati, id) : null
  const valori = (trovato ? (trovato.tipo === 'operazione' ? trovato.operazione : trovato.dividendo) : null) as Record<string, string | number> | null
  const campi: Campo[] = !trovato
    ? []
    : trovato.tipo === 'dividendo'
      ? [...CAMPI_DIVIDENDO]
      : CAMPI_OPERAZIONE.filter((k) => k !== 'cambio' || trovato.operazione.valuta !== 'EUR')
  const iniziali = () => Object.fromEntries(campi.map((k) => [k, valori ? casella(k, valori[k]) : ''])) as Record<string, string>

  const [testi, setTesti] = useState(iniziali)
  // true quando il pagato l'hai scritto tu: allora non si rifà più da solo.
  const [totaleScritto, setTotaleScritto] = useState(false)
  const [sbagliato, setSbagliato] = useState<string | null>(null)
  const [conferma, setConferma] = useState<ModificaMovimento | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)
  // Dopo una scrittura il messaggio si vede e prende il focus: resta dentro il pannello che scorre.
  const esitoRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!esito) return
    esitoRef.current?.focus({ preventScroll: true })
    esitoRef.current?.scrollIntoView({ block: 'nearest' })
  }, [esito])
  // Dopo una scrittura le caselle ripartono dai valori di adesso.
  const [datiVisti, setDatiVisti] = useState(dati)
  if (dati !== datiVisti) {
    setDatiVisti(dati)
    setTesti(iniziali())
    setTotaleScritto(false)
  }

  if (!dati || !trovato || !valori) return null
  const operazione = trovato.tipo === 'operazione' ? trovato.operazione : null
  const valuta = operazione?.valuta ?? 'EUR'
  const prima = (operazione ? operazione.prima : trovato.tipo === 'dividendo' ? trovato.dividendo.prima : undefined) as Record<string, string | number> | undefined
  const quando = operazione ? operazione.quando : trovato.tipo === 'dividendo' ? trovato.dividendo.quando : undefined
  const quale = movimentoInParole(dati, trovato)
  const nome = (k: Campo) => nomeDelCampo(k, valuta, operazione?.tipo)
  const scrivi = (k: Campo, v: string | number) => scriviCampo(k, v, valuta)

  // Il conto del pagato con i numeri delle caselle (null se ne manca uno, o per un dividendo).
  const contoDi = (t: Record<string, string>): number | null => {
    if (!operazione) return null
    const n = (k: Campo) => (k === 'cambio' && valuta === 'EUR' ? 1 : leggiNumero(t[k] ?? ''))
    const [q, p, c, comm] = [n('quantita'), n('prezzo'), n('cambio'), n('commissioni')]
    return q === null || p === null || c === null || comm === null ? null : totaleDalConto(operazione.tipo, q, p, c, comm)
  }
  // Il pagato si rifà da solo solo se nel file tornava con il conto (scritto a mano): uno della banca con un rateo resta com'è.
  const contoDelFile = operazione ? totaleDalConto(operazione.tipo, operazione.quantita, operazione.prezzo, operazione.cambio || 1, operazione.commissioni) : null
  const seguiIlConto = operazione !== null && contoDelFile !== null && Math.abs(operazione.totale - contoDelFile) <= 0.02
  const cambiaCasella = (k: Campo, v: string) => {
    const nuovi = { ...testi, [k]: v }
    if (k === 'totale') setTotaleScritto(true)
    else if (seguiIlConto && !totaleScritto && DEL_CONTO.includes(k)) {
      const conto = contoDi(nuovi)
      if (conto !== null) nuovi.totale = numeroNellaCasella(conto, 2)
    }
    setTesti(nuovi)
    setSbagliato(null)
  }
  // Il pagato delle caselle non torna con il conto, e prima tornava (o hai cambiato i numeri del conto): si dice.
  const contoOra = contoDi(testi)
  const totaleOra = operazione ? leggiNumero(testi.totale ?? '') : null
  const contoCambiato = DEL_CONTO.some((k) => k in testi && leggiNumero(testi[k]) !== (valori[k] as number))
  const nonTorna =
    contoOra !== null && totaleOra !== null && Math.abs(totaleOra - contoOra) > 0.02 && (seguiIlConto || contoCambiato) ? { conto: contoOra, totale: totaleOra } : null

  const chiedi = () => {
    const nuovi: Record<string, string | number> = {}
    for (const k of campi) {
      const t = testi[k]
      const v = k === 'data' ? leggiData(t) : leggiNumero(t)
      if (v === null) {
        setSbagliato(k === 'data' ? 'La data va scritta come 12/10/2026.' : `${nome(k)}: scrivi un numero, per esempio 12,75.`)
        return
      }
      if (v !== valori[k]) nuovi[k] = v
    }
    if (Object.keys(nuovi).length === 0) return setSbagliato('Non hai cambiato niente: scrivi il numero giusto nella sua casella.')
    const m: ModificaMovimento = { azione: 'correggi', id, campi: nuovi }
    const ok = controllaModifica(dati, m)
    if (!ok.ok) return setSbagliato(`Così non va: ${ok.perche}.`)
    setSbagliato(null)
    setEsito(null)
    setConferma(m)
  }

  const scriviNelFile = async (m: ModificaMovimento) => {
    let risposta: EsitoMovimento | null = null
    await esegui(async () => {
      risposta = await ponte.modificaMovimento(m)
      return risposta.esito === 'errore' ? null : risposta.apertura
    })
    setConferma(null)
    const r = risposta as EsitoMovimento | null
    if (!r) return // l'errore lo mostra già la striscia in alto
    if (r.esito === 'errore') return setEsito({ ok: false, testo: `Non ho scritto niente: ${r.perche}.` })
    if (r.esito === 'cambiato')
      return setEsito({
        ok: false,
        testo: 'Il file è stato cambiato da un altro PC (o fuori dall’applicazione): non ho scritto niente e ho ricaricato i dati. Controlla il movimento e rifai.',
      })
    const copia = FRASE_COPIA
    if (m.azione === 'togli') {
      // Il pannello si chiude da solo (il movimento non c'è più): il messaggio va in basso.
      mostraAvviso(`Tolto: ${quale}. ${copia}`)
      return
    }
    setEsito({ ok: true, testo: `${m.azione === 'correggi' ? 'Corretto' : 'Rimesso com’era'}. ${copia}` })
  }

  return (
    <section className="correzione correzione-movimento" aria-label="Correzione a mano">
      {prima && (
        <div className="stato-mano">
          <p>
            <ChipAMano lungo />
            {quando ? ` il ${data(quando)}` : ''}.
          </p>
          <ul>
            {Object.entries(prima).map(([k, v]) => (
              <li key={k}>
                {nome(k as Campo)}: prima era <s>{scrivi(k as Campo, v)}</s>, ora {scrivi(k as Campo, valori[k])}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {esito && (
        <p className="esito" role="status" tabIndex={-1} ref={esitoRef}>
          <Icona nome={esito.ok ? 'ok' : 'info'} piccola />
          <span>{esito.testo}</span>
        </p>
      )}

      {conferma ? (
        <div className="conferma" role="group" aria-label="Conferma">
          {conferma.azione === 'correggi' && (
            <>
              <p>Correggo a mano {quale}:</p>
              <ul>
                {Object.entries(conferma.campi).map(([k, v]) => (
                  <li key={k}>
                    {nome(k as Campo)}: {scrivi(k as Campo, valori[k])} → <b>{scrivi(k as Campo, v as string | number)}</b>
                  </li>
                ))}
              </ul>
              <p>Resterà segnato “a mano” e si vedrà cosa c’era prima. Prima di scrivere faccio una copia del file.</p>
            </>
          )}
          {conferma.azione === 'torna' && (
            <>
              <p>Rimetto {quale} com’era prima della correzione a mano:</p>
              <ul>
                {Object.entries(prima ?? {}).map(([k, v]) => (
                  <li key={k}>
                    {nome(k as Campo)}: {scrivi(k as Campo, valori[k])} → <b>{scrivi(k as Campo, v)}</b>
                  </li>
                ))}
              </ul>
              <p>Prima di scrivere faccio una copia del file.</p>
            </>
          )}
          {conferma.azione === 'togli' && (
            <p>
              Tolgo dal file {quale} ({euro(trovato.tipo === 'operazione' ? trovato.operazione.totale : trovato.dividendo.netto, 2)}). Prima di scrivere
              faccio una copia del file: se ti serve di nuovo, è lì.
            </p>
          )}
          <div className="bottoni">
            <button type="button" className="btn primario" autoFocus disabled={occupato} onClick={() => void scriviNelFile(conferma)}>
              {conferma.azione === 'correggi' ? 'Sì, correggi' : conferma.azione === 'torna' ? 'Sì, torna a com’era' : 'Sì, togli'}
            </button>
            <button type="button" className="btn" disabled={occupato} onClick={() => setConferma(null)}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <>
          {prima && (
            <div className="bottoni">
              <button
                type="button"
                className="btn"
                disabled={occupato}
                onClick={() => {
                  setEsito(null)
                  const m: ModificaMovimento = { azione: 'torna', id }
                  const ok = controllaModifica(dati, m)
                  if (!ok.ok) return setSbagliato(`Non si può: ${ok.perche}.`)
                  setConferma(m)
                }}
              >
                Torna a com’era
              </button>
            </div>
          )}
          <h3>Se qualcosa è sbagliato</h3>
          <form
            className="campi-correzione"
            onSubmit={(e) => {
              e.preventDefault()
              chiedi()
            }}
            onKeyDown={(e) => {
              // Invio in una casella chiede la conferma e non scrive: fermato qui, lo stesso Invio
              // non arriva al tasto "Sì, correggi" che prende il focus.
              if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
              e.preventDefault()
              chiedi()
            }}
          >
            {campi.map((k) => (
              <label key={k}>
                {nome(k)}
                <input
                  inputMode={k === 'data' ? 'numeric' : 'decimal'}
                  placeholder={k === 'data' ? 'gg/mm/aaaa' : undefined}
                  className={k === 'data' ? undefined : 'n'}
                  value={testi[k] ?? ''}
                  onChange={(e) => cambiaCasella(k, e.target.value)}
                />
              </label>
            ))}
            {nonTorna && operazione && (
              <div className="avviso-conto" role="status">
                <Icona nome="info" />
                <p>
                  Il conto (quote × prezzo, ± commissioni) fa {euro(nonTorna.conto, 2)}, ma {operazione.tipo === 'vendita' ? 'l’incassato' : 'il pagato'} in tutto è{' '}
                  {euro(nonTorna.totale, 2)} ({guadagnoEuro(nonTorna.totale - nonTorna.conto, 2)}). Se hai cambiato le quote o il prezzo, correggi anche{' '}
                  {operazione.tipo === 'vendita' ? 'l’incassato' : 'il pagato'}; se la differenza è un rateo o una ritenuta della banca, va bene così.
                </p>
              </div>
            )}
            {sbagliato && (
              <p className="sbagliato" role="alert">
                {sbagliato}
              </p>
            )}
            <div className="bottoni">
              <button type="submit" className="btn primario" disabled={occupato}>
                Correggi a mano
              </button>
            </div>
          </form>
          <p className="tenue piccolo">
            {trovato.tipo === 'dividendo'
              ? 'Il netto si rifà da solo: lordo meno imposte. '
              : seguiIlConto
                ? `${operazione?.tipo === 'vendita' ? 'L’incassato' : 'Il pagato'} si rifà da solo con il conto quando cambi quote, prezzo o commissioni, finché non lo scrivi tu. `
                : ''}
            Il movimento corretto resta segnato “a mano” e si vede
            cosa c’era prima. Niente si scrive nel file finché non confermi.
          </p>

          <h3>Registrato per sbaglio?</h3>
          <p className="tenue piccolo">Per esempio lo stesso movimento registrato due volte. Prima di toglierlo faccio una copia del file.</p>
          <div className="bottoni">
            <button
              type="button"
              className="btn"
              disabled={occupato}
              onClick={() => {
                setEsito(null)
                const m: ModificaMovimento = { azione: 'togli', id }
                const ok = controllaModifica(dati, m)
                if (!ok.ok) return setSbagliato(`Non si può togliere: ${ok.perche}. Prima togli o correggi quella vendita.`)
                setSbagliato(null)
                setConferma(m)
              }}
            >
              Togli questo movimento
            </button>
          </div>
        </>
      )}

    </section>
  )
}

function casella(k: Campo, v: string | number | undefined): string {
  if (v === undefined) return ''
  if (k === 'data') return dataNellaCasella(String(v))
  // Gli euro e i prezzi con due decimali: "120,50", non "120,5". Quote e cambio come sono.
  return numeroNellaCasella(Number(v), k === 'quantita' || k === 'cambio' ? 0 : 2)
}

function nomeDelCampo(k: Campo, valuta: string, tipo?: 'acquisto' | 'vendita'): string {
  switch (k) {
    case 'data':
      return 'Data'
    case 'quantita':
      return 'Quote'
    case 'prezzo':
      return `Prezzo per quota (${valuta === 'EUR' ? '€' : valuta})`
    case 'cambio':
      return `Cambio (${valuta} per 1 €)`
    case 'commissioni':
      return 'Commissioni (€)'
    case 'totale':
      return tipo === 'vendita' ? 'Incassato in tutto (€)' : 'Pagato in tutto (€)'
    case 'lordo':
      return 'Lordo (€)'
    case 'imposte':
      return 'Imposte (€)'
    case 'netto':
      return 'Netto (€)'
  }
}

function scriviCampo(k: Campo, v: string | number, valuta: string): string {
  if (k === 'data') return data(String(v))
  const n = Number(v)
  if (k === 'quantita') return quote(n)
  if (k === 'prezzo') return prezzo(n, valuta)
  if (k === 'cambio') return cambio(n)
  return euro(n, 2)
}
