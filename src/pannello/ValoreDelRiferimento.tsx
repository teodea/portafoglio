// Nel pannello "Da dove viene" di un riferimento (ticket 10, mappa 27 e 28): il valore di fine mese con la sua
// fonte, "Scarica di nuovo" e la correzione a mano, come per i prezzi dei titoli (CorreggiPrezzo.tsx, ticket 8).
// Niente si scrive senza conferma: anche "Scarica di nuovo" prima mostra cosa è arrivato e chiede "Scrivi nel file".
// Ogni scrittura passa dalla scrittura sicura con la copia prima. Il valore si legge dal file di adesso.
import { useRef, useState, type ReactNode } from 'react'
import { leggiNumero } from '../aggiorna/numeri.ts'
import { meseDi, meseEAnno } from '../dati/aggiorna/calendario.ts'
import { dateDaChiedere, DESCRIZIONE, FONTE_NIC, FONTE_RIFERIMENTO, mesiNicDaChiedere, quandoEsceNic } from '../dati/aggiorna/riferimenti.ts'
import type { EsitoCorrezione } from '../dati/correzione.ts'
import {
  baseDelNic,
  nomeDelConfronto,
  qualeValore,
  trovaValore,
  valutaDel,
  type RifValore,
  type ScritturaRiferimento,
} from '../dati/correzione-riferimento.ts'
import type { NicDelMese, ValoreRiferimento } from '../dati/tipi.ts'
import { cambio as scriviCambio, data, euro, numero, percentuale } from '../formato.ts'
import { Icona } from '../icone.tsx'
import { ponte } from '../ponte.ts'
import { useStato } from '../stato.tsx'
import { ChipAMano } from './AMano.tsx'
import './riferimento.css'
import { FRASE_COPIA } from '../dati/copie.ts'

type Esito = { ok: boolean; testo: string }
type Scaricati = Extract<ScritturaRiferimento, { tipo: 'scaricati' }>
type Scarico =
  | { stato: 'scarica' }
  | { stato: 'no'; testo: string }
  /** Arrivato: cosa dice la fonte, e cosa si scriverebbe (niente se è tutto uguale). */
  | { stato: 'arrivato'; testo: ReactNode; scrivi: Scaricati | null }

/** 17.160,41 USD · 146,10 € · 104,6 */
function scriviValore(id: RifValore['id'], n: number): string {
  const v = valutaDel(id)
  return v === null ? numero(n, 1, 2) : `${numero(n, 2)} ${v === 'EUR' ? '€' : v}`
}

/** "17.160,41 USD, cambio BCE 1,1355 = 15.112,65 €" */
function conCambio(v: { valore: number; cambio?: number }, id: RifValore['id']): string {
  const testo = scriviValore(id, v.valore)
  return valutaDel(id) === 'USD' && v.cambio ? `${testo}, cambio BCE ${scriviCambio(v.cambio)} = ${euro(v.valore / v.cambio, 2)}` : testo
}

export function ValoreDelRiferimento({ rif }: { rif: RifValore }) {
  const { apertura, esegui, occupato } = useStato()
  const [testo, setTesto] = useState('')
  const [testoCambio, setTestoCambio] = useState('')
  const [sbagliato, setSbagliato] = useState<string | null>(null)
  const [conferma, setConferma] = useState<{ s: ScritturaRiferimento; frase: ReactNode } | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)
  const [scarico, setScarico] = useState<Scarico | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  const dati = apertura.stato === 'pronto' ? apertura.dati : null
  if (!dati) return null
  const nic = rif.id === 'nic'
  const mese = meseDi(rif.data)
  const v = trovaValore(dati, rif)
  const valuta = valutaDel(rif.id)
  const aMano = v?.fonte === FONTE_RIFERIMENTO.aMano
  const prima = aMano ? v.prima : undefined
  const serveCambio = valuta === 'USD' && !(v as ValoreRiferimento | undefined)?.cambio
  const nomeFonte = nic ? 'ISTAT' : 'investing.com'
  const inEuroDi = (x: { valore: number; cambio?: number }) => (valuta === 'USD' && x.cambio ? x.valore / x.cambio : x.valore)

  // ---------- "Scarica di nuovo": il valore di fine mese e quelli che mancano ----------
  const scarica = async () => {
    setEsito(null)
    setConferma(null)
    setScarico({ stato: 'scarica' })
    if (nic) {
      const mesi = [...new Set([...mesiNicDaChiedere(dati, mese, false), mese])].sort()
      const r = await ponte.nicIstat(mesi)
      if (!r.ok) return setScarico({ stato: 'no', testo: `${r.perche[0].toUpperCase()}${r.perche.slice(1)}. Riprova più tardi, oppure scrivi il NIC qui sotto.` })
      const arrivati: NicDelMese[] = r.valori.map((x) => ({ data: x.data, valore: x.valore, base: x.base, fonte: FONTE_NIC.istat, ...(x.nota ? { nota: x.nota } : {}) }))
      const delMese = arrivati.find((x) => x.data === rif.data)
      const cambiati = arrivati.filter((x) => {
        const c = (dati.nic ?? []).find((n) => n.data === x.data)
        return !c || c.valore !== x.valore || c.base !== x.base
      })
      const frase = delMese ? (
        <>
          ISTAT dice <b>{numero(delMese.valore, 1, 2)}</b> (base {delMese.base} = 100) per {meseEAnno(mese)}
          {v ? (v.valore === delMese.valore ? ': uguale a quello che c’è.' : `: diverso da ${numero(v.valore, 1, 2)} che c’è adesso.`) : '.'}
        </>
      ) : (
        <>ISTAT non ha ancora pubblicato il NIC di {meseEAnno(mese)}: esce {quandoEsceNic(mese)}.</>
      )
      return setScarico({
        stato: 'arrivato',
        testo: (
          <>
            {frase}
            {cambiati.filter((x) => x.data !== rif.data).length > 0 && ` Arrivano anche ${cambiati.filter((x) => x.data !== rif.data).length} mesi che mancavano.`}
          </>
        ),
        scrivi: cambiati.length ? { tipo: 'scaricati', id: 'nic', riferimenti: [], nic: cambiati } : null,
      })
    }
    const id = rif.id as Exclude<RifValore['id'], 'nic'>
    const date = [...new Set([...dateDaChiedere(dati, id, mese, false), rif.data])].sort()
    const r = await ponte.valoriRiferimento(id, date)
    if (!r.ok) return setScarico({ stato: 'no', testo: `${r.perche[0].toUpperCase()}${r.perche.slice(1)}. Riprova più tardi, oppure scrivi il valore qui sotto.` })
    const arrivati: ValoreRiferimento[] = r.valori.map((x) => ({
      riferimento: id,
      data: x.data,
      valore: x.valore,
      valuta: DESCRIZIONE[id].valuta,
      ...(x.cambio !== undefined ? { cambio: x.cambio } : {}),
      fonte: FONTE_RIFERIMENTO.investing,
      seduta: x.seduta,
      ...(x.nota ? { nota: x.nota } : {}),
    }))
    const nelFile = (d: string) => (dati.riferimenti ?? []).find((x) => x.riferimento === id && x.data === d)
    const cambiati = arrivati.filter((x) => {
      const c = nelFile(x.data)
      return !c || c.valore !== x.valore || c.cambio !== x.cambio
    })
    const delMese = arrivati.find((x) => x.data === rif.data)
    const vr = v as ValoreRiferimento | undefined
    const altri = cambiati.filter((x) => x.data !== rif.data).length
    const frase = delMese ? (
      <>
        investing.com dice <b>{conCambio(delMese, rif.id)}</b> (chiusura del {data(delMese.seduta ?? delMese.data)})
        {vr
          ? vr.valore === delMese.valore && vr.cambio === delMese.cambio
            ? ': uguale a quello che c’è.'
            : `: diverso di ${percentuale(inEuroDi(delMese) / inEuroDi(vr) - 1)} in euro da quello che c’è adesso.`
          : '.'}
      </>
    ) : (
      <>investing.com non ha ancora il valore di fine {meseEAnno(mese)}.</>
    )
    setScarico({
      stato: 'arrivato',
      testo: (
        <>
          {frase}
          {altri > 0 && ` Arrivano anche ${altri === 1 ? 'un valore che mancava' : `${altri} valori che mancavano`}.`}
          {r.mancano.filter((d) => d !== rif.data).length > 0 && ` Mancano ancora i valori del ${r.mancano.filter((d) => d !== rif.data).map(data).join(', ')}.`}
        </>
      ),
      scrivi: cambiati.length ? { tipo: 'scaricati', id, riferimenti: cambiati, nic: [] } : null,
    })
  }

  // ---------- la correzione a mano ----------
  const chiedi = () => {
    const n = leggiNumero(testo)
    const c = serveCambio ? leggiNumero(testoCambio) : undefined
    const vr = v as ValoreRiferimento | undefined
    let problema: string | null = null
    if (n === null) problema = `Scrivi un numero più di zero, per esempio ${nic ? '104,6' : valuta === 'USD' ? '17.160,41' : '146,10'}.`
    else if (serveCambio && c === null) problema = 'Scrivi anche il cambio BCE: quanti dollari per 1 euro, per esempio 1,1355.'
    else if (v && n === v.valore && (c === undefined || c === vr?.cambio)) problema = 'È uguale al valore che c’è già.'
    if (problema || n === null) {
      setSbagliato(problema)
      campo.current?.focus()
      return
    }
    setEsito(null)
    setScarico(null)
    const s: ScritturaRiferimento = { tipo: 'correggi', id: rif.id, data: rif.data, valore: n, ...(c ? { cambio: c } : {}) }
    const nuovo = conCambio({ valore: n, cambio: c ?? vr?.cambio }, rif.id)
    setConferma({
      s,
      frase: (
        <>
          Scrivo <b>{nuovo}</b>
          {v ? ` al posto di ${scriviValore(rif.id, v.valore)}` : ''} come {nic ? `NIC di ${meseEAnno(mese)} (base ${baseDelNic(rif.data)} = 100)` : `valore di ${qualeValore(rif)}`}. Resterà segnato
          “a mano”.
        </>
      ),
    })
  }

  const scriviNelFile = async (s: ScritturaRiferimento) => {
    let risposta: EsitoCorrezione | null = null
    await esegui(async () => {
      risposta = await ponte.scriviRiferimento(s)
      return risposta.esito === 'errore' ? null : risposta.apertura
    })
    setConferma(null)
    setScarico(null)
    const r = risposta as EsitoCorrezione | null
    if (!r) return // l'errore lo mostra già la striscia in alto
    if (r.esito === 'errore') return setEsito({ ok: false, testo: `Non ho scritto niente: ${r.perche}.` })
    if (r.esito === 'cambiato')
      return setEsito({
        ok: false,
        testo: 'Il file è stato cambiato da un altro PC (o fuori dall’applicazione): non ho scritto niente e ho ricaricato i dati. Controlla il valore e rifai.',
      })
    setTesto('')
    setTestoCambio('')
    const fatto = s.tipo === 'correggi' ? 'Corretto' : s.tipo === 'torna' ? 'Rimesso il valore di prima' : 'Scritto il valore scaricato di nuovo'
    setEsito({ ok: true, testo: `${fatto}: i numeri della classifica si sono rifatti. ${FRASE_COPIA}` })
  }

  const titolo = nic ? `Il NIC di ${meseEAnno(mese)}` : `Il valore di fine ${meseEAnno(mese)}`
  const vr = v as ValoreRiferimento | undefined
  return (
    <section className="correzione valore-rif" aria-label={titolo}>
      <h3>{titolo}</h3>
      {v ? (
        <p>
          <b>{conCambio(v, rif.id)}</b>
          {nic && <span className="tenue"> (base {(v as NicDelMese).base} = 100)</span>}
          <br />
          {aMano ? (
            <span className="stato-mano">
              <ChipAMano lungo={!!prima} />
              {v.quando ? ` il ${data(v.quando)}` : ''}
              {prima ? (
                <>
                  . Prima era <s>{scriviValore(rif.id, prima.valore)}</s>, {prima.fonte}.
                </>
              ) : (
                '.'
              )}
            </span>
          ) : (
            <span className="tenue piccolo">
              {v.fonte}
              {vr?.seduta ? `, chiusura del ${data(vr.seduta)}` : ''}
              {v.nota ? ` · ${v.nota}` : ''}
            </span>
          )}
        </p>
      ) : (
        <p>
          <span className="tenue">manca</span>
          <br />
          <span className="tenue piccolo">
            {nic ? `ISTAT pubblica il NIC di ${meseEAnno(mese)} ${quandoEsceNic(mese)}.` : `Nel file non c’è il valore di ${nomeDelConfronto(rif.id)} a fine ${meseEAnno(mese)}.`}
          </span>
        </p>
      )}

      <div className="bottoni">
        <button type="button" className="btn" disabled={occupato || scarico?.stato === 'scarica'} onClick={() => void scarica()}>
          <Icona nome="aggiorna" piccola /> {scarico?.stato === 'scarica' ? 'Scarico…' : 'Scarica di nuovo'}
        </button>
      </div>
      {scarico && scarico.stato !== 'scarica' && (
        <div className="conferma" role="group" aria-label={`Cosa dice ${nomeFonte}`}>
          <p>
            {scarico.testo}
            {scarico.stato === 'arrivato' && scarico.scrivi && ' Prima di scrivere faccio una copia del file.'}
          </p>
          <div className="bottoni">
            {scarico.stato === 'arrivato' && scarico.scrivi ? (
              <>
                <button type="button" className="btn primario" disabled={occupato} onClick={() => void scriviNelFile(scarico.scrivi!)}>
                  Scrivi nel file
                </button>
                <button type="button" className="btn" disabled={occupato} onClick={() => setScarico(null)}>
                  Lascia com’è
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setScarico(null)}>
                Va bene
              </button>
            )}
          </div>
        </div>
      )}

      {conferma ? (
        <div className="conferma" role="group" aria-label="Conferma">
          <p>{conferma.frase} Prima di scrivere faccio una copia del file.</p>
          <div className="bottoni">
            <button type="button" className="btn primario" autoFocus disabled={occupato} onClick={() => void scriviNelFile(conferma.s)}>
              {conferma.s.tipo === 'torna' ? 'Sì, torna al valore di prima' : 'Sì, correggi'}
            </button>
            <button type="button" className="btn" disabled={occupato} onClick={() => setConferma(null)}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <>
          <label>
            {v
              ? nic
                ? 'Se il NIC è sbagliato, scrivi quello giusto'
                : 'Se il valore di fine mese è sbagliato, scrivi quello giusto'
              : nic
                ? `Scrivi il NIC di ${meseEAnno(mese)}`
                : `Scrivi il valore di fine ${meseEAnno(mese)}`}
            <span className="campo-valuta">
              <input
                ref={campo}
                inputMode="decimal"
                placeholder={v ? scriviValore(rif.id, v.valore).replace(/ \S+$/, '') : ''}
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
                  chiedi()
                }}
              />
              {valuta === null ? `base ${(v as NicDelMese | undefined)?.base ?? baseDelNic(rif.data)} = 100` : valuta === 'EUR' ? '€' : valuta}
            </span>
          </label>
          {serveCambio && (
            <label>
              Il cambio BCE di quel giorno (dollari per 1 euro)
              <span className="campo-valuta">
                <input
                  inputMode="decimal"
                  placeholder="1,1355"
                  value={testoCambio}
                  onChange={(e) => {
                    setTestoCambio(e.target.value)
                    setSbagliato(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    chiedi()
                  }}
                />
              </span>
            </label>
          )}
          {sbagliato && (
            <p className="sbagliato" role="alert">
              {sbagliato}
            </p>
          )}
          <div className="bottoni">
            <button type="button" className="btn primario" disabled={occupato} onClick={chiedi}>
              Correggi a mano
            </button>
            {prima && v && (
              <button
                type="button"
                className="btn"
                disabled={occupato}
                onClick={() => {
                  setEsito(null)
                  setScarico(null)
                  setConferma({
                    s: { tipo: 'torna', id: rif.id, data: rif.data },
                    frase: (
                      <>
                        Rimetto <b>{scriviValore(rif.id, prima.valore)}</b> ({prima.fonte}) al posto di {scriviValore(rif.id, v.valore)} scritto a mano.
                      </>
                    ),
                  })
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
      <p className="tenue piccolo">Il valore corretto resta segnato “a mano”. Niente si scrive nel file finché non confermi.</p>
    </section>
  )
}
