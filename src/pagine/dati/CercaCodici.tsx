// "Cerca i codici investing.com" (collaudo del 19/10, punto 7), sopra la scheda Prezzi dei titoli della pagina Dati:
// per i titoli che hai senza il codice investing.com, l'applicazione cerca la linea dall'ISIN sulla borsa del titolo
// (la stessa ricerca del titolo nuovo, ticket 12) e la mostra con il prezzo di ieri accanto all'ultimo prezzo del file,
// per riconoscerla. "Non è lui" passa alla linea dopo; se non la trova si può incollare l'indirizzo della pagina.
// Un titolo di Francoforte che investing.com non ha su Francoforte si cerca su Xetra, come faceva lo strumento.
// Si scrivono solo i codici spuntati, dopo la conferma e con la copia del file prima.
import { useState } from 'react'
import { valutaDelTitolo } from '../../dati/aggiorna/mesi.ts'
import { titoliSenzaCodice, type CodiciDelTitolo, type EsitoCodici } from '../../dati/codici-riserve.ts'
import { FRASE_COPIA } from '../../dati/copie.ts'
import type { FileDati, Titolo } from '../../dati/tipi.ts'
import type { CodiciTrovati } from '../../dati/titolo-nuovo.ts'
import { data, prezzo } from '../../formato.ts'
import { Icona } from '../../icone.tsx'
import { ponte } from '../../ponte.ts'
import { useStato } from '../../stato.tsx'

type Riga = {
  titolo: Titolo
  valuta: string
  /** null mentre si cerca. */
  trovati: CodiciTrovati | null
  /** Quale linea di investing.com: "Non è lui" passa alla dopo. */
  indice: number
  /** Spuntato: il codice si scrive. */
  usa: boolean
  indirizzo: string
  /** Titolo di Francoforte trovato solo su Xetra: i codici sono quelli di Xetra. */
  suXetra: boolean
}

type Esito = { ok: boolean; testo: string }

const nomeDi = (t: Titolo) => t.simbolo ?? t.isin

/** L'ultimo prezzo di fine mese nel file, per riconoscere la linea giusta. */
function ultimoPrezzo(dati: FileDati, id: string) {
  return (dati.prezzi ?? []).filter((p) => p.titolo === id).sort((a, b) => (a.data < b.data ? 1 : -1))[0]
}

/** I codici da scrivere per una riga spuntata: solo quelli che mancano nel file. */
function codiciDi(r: Riga): CodiciDelTitolo | null {
  const linea = r.trovati?.investing[r.indice]
  const yahoo = r.titolo.codiceYahoo === undefined ? (r.trovati?.yahoo ?? undefined) : undefined
  if (!r.usa || (!linea && !yahoo)) return null
  return {
    titolo: r.titolo.id,
    ...(linea ? { codiceInvesting: linea.codice } : {}),
    ...(yahoo ? { codiceYahoo: yahoo } : {}),
    ...(r.suXetra && r.titolo.borsaRiserve === undefined ? { borsaRiserve: 'XET' as const } : {}),
  }
}

export function CercaCodici({ dati }: { dati: FileDati }) {
  const { esegui, occupato } = useStato()
  const senza = titoliSenzaCodice(dati)
  const [righe, setRighe] = useState<Riga[] | null>(null)
  const [cercando, setCercando] = useState(false)
  const [conferma, setConferma] = useState<CodiciDelTitolo[] | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)

  const cambia = (id: string, cosa: Partial<Riga>) => setRighe((rr) => rr?.map((r) => (r.titolo.id === id ? { ...r, ...cosa } : r)) ?? null)

  const cercaUno = async (r: Riga, indirizzo?: string) => {
    cambia(r.titolo.id, { trovati: null, indice: 0, suXetra: false })
    const cerca = (borsa: Titolo['borsa']) =>
      ponte
        .cercaCodici({ isin: r.titolo.isin, borsa, simbolo: r.titolo.simbolo ?? '', valuta: r.valuta, ...(indirizzo ? { indirizzo } : {}) })
        .catch((): CodiciTrovati => ({ investing: [], perche: 'la ricerca non è andata', yahoo: null }))
    let trovati = await cerca(r.titolo.borsa)
    let suXetra = false
    if (!indirizzo && trovati.investing.length === 0 && r.titolo.borsa === 'FRA') {
      const xetra = await cerca('XET')
      if (xetra.investing.length > 0) [trovati, suXetra] = [xetra, true]
    }
    cambia(r.titolo.id, { trovati, indice: 0, suXetra, usa: trovati.investing.length > 0 || (!!trovati.yahoo && r.titolo.codiceYahoo === undefined) })
  }

  // Uno alla volta: la ricerca di investing.com va fatta con calma, poche richieste distanziate.
  const cercaTutti = async () => {
    const nuove: Riga[] = senza.map((t) => ({ titolo: t, valuta: valutaDelTitolo(dati, t), trovati: null, indice: 0, usa: false, indirizzo: '', suXetra: false }))
    setRighe(nuove)
    setEsito(null)
    setCercando(true)
    for (const r of nuove) await cercaUno(r)
    setCercando(false)
  }

  const scrivi = async (codici: CodiciDelTitolo[]) => {
    let risposta: EsitoCodici | null = null
    await esegui(async () => {
      risposta = await ponte.scriviCodici({ codici })
      return risposta.esito === 'errore' ? null : risposta.apertura
    })
    setConferma(null)
    const r = risposta as EsitoCodici | null
    if (!r) return // l'errore lo mostra già la striscia in alto
    if (r.esito === 'errore') return setEsito({ ok: false, testo: `Non ho scritto niente: ${r.perche}.` })
    if (r.esito === 'cambiato')
      return setEsito({ ok: false, testo: 'Il file è stato cambiato da un altro PC (o fuori dall’applicazione): non ho scritto niente e ho ricaricato i dati. Rifai la ricerca.' })
    setRighe(null)
    setEsito({
      ok: true,
      testo: `Scritti i codici di ${codici.length === 1 ? '1 titolo' : `${codici.length} titoli`}: dal prossimo Aggiorna fine mese il controllo di investing.com si fa anche per ${codici.length === 1 ? 'lui' : 'loro'}. ${FRASE_COPIA}`,
    })
  }

  if (senza.length === 0 && !righe)
    return esito ? (
      <div className="dati-codici">
        <p className="esito" role="status">
          <Icona nome={esito.ok ? 'ok' : 'info'} piccola />
          <span>{esito.testo}</span>
        </p>
      </div>
    ) : null

  const daScrivere = (righe ?? []).map(codiciDi).filter((c): c is CodiciDelTitolo => c !== null)
  const quanti = senza.length === 1 ? '1 titolo che hai non ha' : `${senza.length} titoli che hai non hanno`

  return (
    <div className="dati-codici" aria-live="polite">
      {esito && (
        <p className="esito" role="status">
          <Icona nome={esito.ok ? 'ok' : 'info'} piccola />
          <span>{esito.testo}</span>
        </p>
      )}
      {!righe ? (
        senza.length > 0 && (
          <div className="dati-codici-testa">
            <p>
              <b>{quanti} il codice investing.com.</b> Senza, il controllo di investing.com accanto al prezzo della borsa non si fa, e se la borsa
              non risponde manca la riserva. L’applicazione li cerca dall’ISIN; tu guardi se sono giusti prima di scriverli.
            </p>
            <button type="button" className="btn" disabled={occupato} onClick={() => void cercaTutti()}>
              <Icona nome="aggiorna" piccola /> Cerca i codici investing.com
            </button>
          </div>
        )
      ) : (
        <>
          <p className="dati-codici-testa">
            {cercando
              ? `Cerco su investing.com, un titolo alla volta: ${righe.filter((r) => r.trovati).length} di ${righe.length}…`
              : 'Guarda se la linea trovata è quella giusta: il prezzo di ieri deve essere vicino all’ultimo prezzo del file. Si scrivono solo i codici spuntati.'}
          </p>
          <ul className="dati-codici-lista">
            {righe.map((r) => {
              const linea = r.trovati?.investing[r.indice]
              const altre = (r.trovati?.investing.length ?? 0) - r.indice - 1
              const ultimo = ultimoPrezzo(dati, r.titolo.id)
              const yahoo = r.titolo.codiceYahoo === undefined ? r.trovati?.yahoo : null
              return (
                <li key={r.titolo.id}>
                  <div className="tit">
                    <b>{nomeDi(r.titolo)}</b>
                    <span>{r.titolo.paroleSemplici ?? r.titolo.nome}</span>
                    <span>
                      {r.titolo.nomeBorsa}
                      {ultimo ? ` · nel file, fine ${data(ultimo.data)}: ${prezzo(ultimo.prezzo, ultimo.valuta)}` : ''}
                    </span>
                  </div>
                  <div className="dati-codici-trovato">
                    {!r.trovati ? (
                      <span className="tenue">{cercando ? 'in attesa…' : 'cerco…'}</span>
                    ) : linea ? (
                      <>
                        <b>{linea.nome || `Linea ${linea.codice}`}</b>
                        <span className="dati-sotto">
                          {[
                            linea.simbolo,
                            linea.borsa,
                            `codice ${linea.codice}`,
                            linea.prezzo !== null && linea.seduta ? `chiusura del ${data(linea.seduta)}: ${prezzo(linea.prezzo, r.valuta)}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {r.suXetra && (
                          <span className="dati-sotto">
                            investing.com non ce l’ha su Francoforte: è la linea di Xetra. Il prezzo di riserva sarà scritto “Xetra (riserva, altra
                            borsa)”.
                          </span>
                        )}
                        {yahoo && <span className="dati-sotto">Yahoo: {yahoo}</span>}
                        {altre > 0 && (
                          <button type="button" className="link piccolo" disabled={cercando} onClick={() => cambia(r.titolo.id, { indice: r.indice + 1 })}>
                            Non è lui
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="dati-sotto">
                          {r.indice > 0 ? 'Non ho altre linee di questo titolo.' : `Non trovato${r.trovati.perche ? `: ${r.trovati.perche}` : ''}.`}
                          {yahoo ? ` Su Yahoo è ${yahoo}.` : ''}
                        </span>
                        <label className="dati-codici-indirizzo">
                          Se lo trovi tu, incolla l’indirizzo della pagina di investing.com
                          <input
                            value={r.indirizzo}
                            placeholder="https://it.investing.com/etfs/…"
                            onChange={(e) => cambia(r.titolo.id, { indirizzo: e.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="link piccolo"
                          disabled={cercando || !r.indirizzo.trim()}
                          onClick={() => void cercaUno(r, r.indirizzo.trim())}
                        >
                          Cerca con l’indirizzo
                        </button>
                      </>
                    )}
                  </div>
                  <label className="dati-codici-usa">
                    <input
                      type="checkbox"
                      checked={r.usa}
                      disabled={!r.trovati || (!linea && !yahoo)}
                      onChange={(e) => cambia(r.titolo.id, { usa: e.target.checked })}
                    />
                    Scrivi
                  </label>
                </li>
              )
            })}
          </ul>
          {conferma ? (
            <div className="conferma" role="group" aria-label="Conferma">
              <p>Scrivo nel file i codici di {conferma.length === 1 ? '1 titolo' : `${conferma.length} titoli`}:</p>
              <ul>
                {conferma.map((c) => {
                  const t = righe.find((r) => r.titolo.id === c.titolo)!.titolo
                  return (
                    <li key={c.titolo}>
                      {nomeDi(t)}:{' '}
                      {[
                        c.codiceInvesting !== undefined ? `investing.com ${c.codiceInvesting}` : null,
                        c.codiceYahoo ? `Yahoo ${c.codiceYahoo}` : null,
                        c.borsaRiserve ? 'su Xetra, altra borsa' : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </li>
                  )
                })}
              </ul>
              <p>Non cambio nient’altro. Prima di scrivere faccio una copia del file.</p>
              <div className="bottoni">
                <button type="button" className="btn primario" autoFocus disabled={occupato} onClick={() => void scrivi(conferma)}>
                  Sì, scrivi i codici
                </button>
                <button type="button" className="btn" disabled={occupato} onClick={() => setConferma(null)}>
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <div className="bottoni">
              <button type="button" className="btn primario" disabled={cercando || occupato || daScrivere.length === 0} onClick={() => setConferma(daScrivere)}>
                Scrivi i codici spuntati ({daScrivere.length})
              </button>
              <button type="button" className="btn" disabled={cercando} onClick={() => setRighe(null)}>
                Lascia stare
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
