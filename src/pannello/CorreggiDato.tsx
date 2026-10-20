// La correzione a mano di un NIC, di un cambio o di un riferimento di fine mese, nel pannello "Da dove viene"
// (ticket 13, mappa 27): "Scarica di nuovo" dalla sua fonte, la casella per scriverlo (anche quando manca),
// "Correggi a mano" con conferma, poi la scrittura sicura con la copia prima. Dopo restano il chip "a mano"
// e il valore di prima barrato, con "Torna al valore di prima". Stesso schema di CorreggiPrezzo.tsx (ticket 8).
// Il dato si legge dal file di adesso, non dalla spiegazione: dopo la correzione si vede subito com'è.
import { useMemo, useRef, useState } from 'react'
import { leggiNumero } from '../aggiorna/numeri.ts'
import { datoInCifre, nomeColonna, valutaDelDato } from '../conti/pagina-dati.ts'
import { meseDi } from '../dati/aggiorna/calendario.ts'
import { aVersione3 } from '../dati/aggiorna/versione3.ts'
import {
  fonteDelDato,
  nomeDelDato,
  primaDelDato,
  trovaDato,
  valoreDelDato,
  type CorrezioneDato,
  type EsitoCorrezioneDato,
  type RifDato,
} from '../dati/correzione-dati.ts'
import type { FileDati } from '../dati/tipi.ts'
import { data, mese } from '../formato.ts'
import { Icona } from '../icone.tsx'
import { ponte } from '../ponte.ts'
import { useStato } from '../stato.tsx'
import { ChipAMano } from './AMano.tsx'
import { percheInParole } from '../dati/errore.ts'
import { FRASE_COPIA } from '../dati/copie.ts'

type Esito = { ok: boolean; testo: string }

/** Il dato scritto con la sua unità: "104,6", "0,8546", "14.123,45 $". */
function scrivi(d: RifDato, n: number): string {
  return datoInCifre(d, n) + (valutaDelDato(d) === 'USD' ? ' USD' : '')
}

/** Un altro riferimento in dollari dello stesso giorno ha già il cambio BCE: è lo stesso. */
function cambioGiaNelFile(dati: FileDati, d: RifDato): number | undefined {
  const x = trovaDato(dati, d) as { cambio?: number } | undefined
  if (x?.cambio) return x.cambio
  return (dati.riferimenti ?? []).find((v) => v.data === d.data && v.valuta === 'USD' && v.cambio)?.cambio
}

/** Scarica di nuovo il dato dalla sua fonte. Escono dal PC solo il nome del riferimento, la valuta o il mese. */
async function scaricaDiNuovo(d: RifDato): Promise<{ ok: true; c: Extract<CorrezioneDato, { azione: 'scaricato' }> } | { ok: false; perche: string }> {
  const m = meseDi(d.data)
  if (d.tipo === 'nic') {
    const e = await ponte.nicIstat([m])
    if (!e.ok) return e
    const v = e.valori.find((x) => x.data === d.data)
    if (!v) return { ok: false, perche: `ISTAT non ha ancora pubblicato il NIC di ${mese(d.data)}` }
    return { ok: true, c: { azione: 'scaricato', dato: d, valore: v.valore, base: v.base, ...(v.nota ? { nota: v.nota } : {}) } }
  }
  if (d.tipo === 'cambio') {
    const e = await ponte.cambioFineMese(d.valuta, m)
    if (!e.ok) return e
    return { ok: true, c: { azione: 'scaricato', dato: d, valore: e.cambio, seduta: e.seduta } }
  }
  const e = await ponte.valoriRiferimento(d.riferimento, [d.data])
  if (!e.ok) return e
  const v = e.valori.find((x) => x.data === d.data)
  if (!v) return { ok: false, perche: `investing.com non ha il valore di fine ${mese(d.data)}` }
  return {
    ok: true,
    c: { azione: 'scaricato', dato: d, valore: v.valore, seduta: v.seduta, ...(v.cambio ? { cambio: v.cambio } : {}), ...(v.nota ? { nota: v.nota } : {}) },
  }
}

export function CorreggiDato({ dato }: { dato: RifDato }) {
  const { apertura, esegui, occupato } = useStato()
  const [testo, setTesto] = useState('')
  const [sbagliato, setSbagliato] = useState<string | null>(null)
  const [conferma, setConferma] = useState<CorrezioneDato | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)
  const [scarica, setScarica] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  const grezzi = apertura.stato === 'pronto' ? apertura.dati : null
  const dati = useMemo(() => (grezzi ? aVersione3(grezzi) : null), [grezzi])
  if (!dati) return null

  const x = trovaDato(dati, dato)
  const prima = primaDelDato(x)
  const aMano = x?.fonte === 'a mano'
  const quale = `${nomeDelDato(dato)} di fine ${mese(dato.data)}`
  const fonte = fonteDelDato(dato)
  const occupatoOra = occupato || scarica

  const chiedi = async () => {
    const n = leggiNumero(testo)
    const problema = n === null ? `Scrivi un numero più di zero, per esempio ${dato.tipo === 'nic' ? '104,6' : dato.tipo === 'cambio' ? '0,8546' : '14123,45'}.` : x && n === valoreDelDato(x) ? 'È uguale a quello che c’è già.' : null
    if (problema || n === null) {
      setSbagliato(problema)
      campo.current?.focus()
      return
    }
    setEsito(null)
    // Un riferimento in dollari che manca ha bisogno del cambio BCE di quel giorno: se nel file non c'è, lo chiedo alla BCE.
    if (valutaDelDato(dato) === 'USD' && !cambioGiaNelFile(dati, dato)) {
      setScarica(true)
      try {
        const e = await ponte.cambioFineMese('USD', meseDi(dato.data))
        if (!e.ok) return setEsito({ ok: false, testo: `Per scrivere il valore in euro serve il cambio BCE del dollaro, ma la BCE non ha risposto: ${e.perche}. Riprova più tardi.` })
        setConferma({ azione: 'correggi', dato, valore: n, cambio: e.cambio })
      } finally {
        setScarica(false)
      }
      return
    }
    setConferma({ azione: 'correggi', dato, valore: n })
  }

  const scaricaOra = async () => {
    setEsito(null)
    setScarica(true)
    try {
      const r = await scaricaDiNuovo(dato)
      if (!r.ok) return setEsito({ ok: false, testo: `Non è arrivato niente: ${r.perche}.` })
      if (x && x.fonte === fonte && valoreDelDato(x) === r.c.valore)
        return setEsito({ ok: true, testo: `${fonte} dà lo stesso valore, ${scrivi(dato, r.c.valore)}: non c’è niente da cambiare.` })
      setConferma(r.c)
    } catch (e) {
      setEsito({ ok: false, testo: `Non è arrivato niente: ${percheInParole(e)}.` })
    } finally {
      setScarica(false)
    }
  }

  const scriviNelFile = async (c: CorrezioneDato) => {
    let risposta: EsitoCorrezioneDato | null = null
    await esegui(async () => {
      risposta = await ponte.correggiDato(c)
      return risposta.esito === 'errore' ? null : risposta.apertura
    })
    setConferma(null)
    const r = risposta as EsitoCorrezioneDato | null
    if (!r) return // l'errore lo mostra già la striscia in alto
    if (r.esito === 'errore') return setEsito({ ok: false, testo: `Non ho scritto niente: ${r.perche}.` })
    if (r.esito === 'cambiato')
      return setEsito({
        ok: false,
        testo: 'Il file è stato cambiato da un altro PC (o fuori dall’applicazione): non ho scritto niente e ho ricaricato i dati. Controlla il dato e rifai la correzione.',
      })
    setTesto('')
    const fatto = c.azione === 'correggi' ? (x ? 'Corretto' : 'Scritto') : c.azione === 'torna' ? 'Rimesso il valore di prima' : `Scritto il valore di ${fonte}`
    setEsito({ ok: true, testo: `${fatto}. ${FRASE_COPIA}` })
  }

  const ora = x ? scrivi(dato, valoreDelDato(x)) : null
  return (
    <section className="correzione" aria-label="Correzione a mano">
      {aMano && (
        <p className="stato-mano">
          <ChipAMano lungo={!!prima} />
          {x?.quando ? ` il ${data(x.quando)}` : ''}
          {prima ? (
            <>
              . Prima era <s>{scrivi(dato, prima.numero)}</s>, {prima.fonte === 'a mano' ? 'scritto a mano' : `da ${prima.fonte}`}.
            </>
          ) : (
            '.'
          )}
        </p>
      )}

      {conferma ? (
        <div className="conferma" role="group" aria-label="Conferma">
          <p>
            {conferma.azione === 'correggi' && (
              <>
                Scrivo <b>{scrivi(dato, conferma.valore)}</b> {ora ? `al posto di ${ora}` : 'dove adesso manca'} per {quale}. Resterà segnato “a mano”.
                {conferma.cambio && ` In euro vale con il cambio BCE del dollaro di fine mese, ${datoInCifre({ tipo: 'cambio', valuta: 'USD', data: dato.data }, conferma.cambio)}.`}
              </>
            )}
            {conferma.azione === 'torna' && prima && (
              <>
                Rimetto <b>{scrivi(dato, prima.numero)}</b> ({prima.fonte}) al posto di {ora} scritto a mano.
              </>
            )}
            {conferma.azione === 'scaricato' && (
              <>
                {fonte} dice <b>{scrivi(dato, conferma.valore)}</b>
                {conferma.seduta ? ` (${dato.tipo === 'cambio' ? 'cambio di riferimento' : 'chiusura'} del ${data(conferma.seduta)})` : ''}. Lo scrivo {ora ? `al posto di ${ora}${aMano ? ' scritto a mano' : ''}` : 'dove adesso manca'}.
              </>
            )}{' '}
            Prima di scrivere faccio una copia del file.
          </p>
          <div className="bottoni">
            <button type="button" className="btn primario" autoFocus disabled={occupatoOra} onClick={() => void scriviNelFile(conferma)}>
              {conferma.azione === 'correggi' ? (x ? 'Sì, correggi' : 'Sì, scrivi') : conferma.azione === 'torna' ? 'Sì, torna al valore di prima' : 'Sì, scrivi'}
            </button>
            <button type="button" className="btn" disabled={occupatoOra} onClick={() => setConferma(null)}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bottoni">
            <button type="button" className="btn" disabled={occupatoOra} onClick={() => void scaricaOra()}>
              <Icona nome="aggiorna" piccola />
              {scarica ? 'Scarico…' : 'Scarica di nuovo'}
            </button>
          </div>
          <label>
            {x ? 'Se è sbagliato, scrivi quello giusto' : `Scrivi ${nomeColonna(dato) === 'Inflazione NIC' ? 'il NIC' : 'il valore'} a mano`}
            <span className="campo-valuta">
              <input
                ref={campo}
                inputMode="decimal"
                placeholder={ora ? ora.replace(/ USD$/, '') : dato.tipo === 'nic' ? 'es. 104,6' : ''}
                value={testo}
                aria-invalid={sbagliato !== null}
                onChange={(e) => {
                  setTesto(e.target.value)
                  setSbagliato(null)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  // Senza questo, lo stesso Invio premerebbe anche "Sì, correggi", che prende il focus.
                  e.preventDefault()
                  void chiedi()
                }}
              />
              {valutaDelDato(dato) === 'USD' ? 'USD' : ''}
            </span>
          </label>
          {sbagliato && (
            <p className="sbagliato" role="alert">
              {sbagliato}
            </p>
          )}
          <div className="bottoni">
            <button type="button" className="btn primario" disabled={occupatoOra} onClick={() => void chiedi()}>
              {x ? 'Correggi a mano' : 'Scrivi a mano'}
            </button>
            {prima && aMano && (
              <button
                type="button"
                className="btn"
                disabled={occupatoOra}
                onClick={() => {
                  setEsito(null)
                  setConferma({ azione: 'torna', dato })
                }}
              >
                Torna al valore di prima
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
      <p className="tenue piccolo">
        Resta segnato “a mano” in tutte le tabelle
        {dato.tipo === 'cambio' ? ' (se rifai quel mese, arriva di nuovo il cambio della BCE)' : ' e l’aggiornamento di fine mese non lo cambia'}. Niente si scrive nel file
        finché non confermi.
        {dato.tipo === 'nic' && (
          <>
            {' '}
            Il NIC di ISTAT si legge su{' '}
            <a href="https://esploradati.istat.it/" target="_blank" rel="noreferrer">
              esploradati.istat.it
            </a>{' '}
            (Prezzi, indici dei prezzi al consumo NIC, indice generale).
          </>
        )}
      </p>
    </section>
  )
}
