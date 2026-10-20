// La schermata Aggiorna fine mese (ticket 27 della mappa): testata, riquadri, la lista a gruppi che si
// riempie, "Riprova" e "Scrivo a mano", la barra ferma con "Annulla" e "Salva <mese>", poi "<Mese> è salvato"
// con "Rifai <mese>". Se non c'è un mese da fare, dice qual è l'ultimo salvato e permette di rifarlo.
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { confrontoDellaRiga, senzaCodice } from '../dati/aggiorna/controllo-prezzo.ts'
import { fineMese, meseDopo, meseEAnno, NomeMese, nomeMese, ultimaSeduta } from '../dati/aggiorna/calendario.ts'
import { eUfficiale, FONTE, FONTE_CAMBIO, fonteDaVersione2, nomeBreve } from '../dati/aggiorna/fonti.ts'
import {
  cambioDi,
  confrontoConPrima,
  contaFonti,
  etichetta,
  inCorso,
  mancano,
  prezziPronti,
  prezzoDi,
  primaEDopo,
  puoSalvare,
  sulMese,
  valoreAFineMese,
  valoreMesePrima,
  type Aggiornamento,
  type RigaCambio,
  type RigaTitolo,
  TENUTO,
} from '../dati/aggiorna/lista.ts'
import { nomeValuta, ultimoMeseSalvato } from '../dati/aggiorna/mesi.ts'
import { Icona } from '../icone.tsx'
import { useFile } from '../stato.tsx'
import { useAggiorna, type Salvato } from './contesto.tsx'
import { RigheRiferimenti, RiquadriRiferimenti } from './Riferimenti.tsx'
import { fraseBarraRiferimenti, riferimentiInCorso } from '../dati/aggiorna/riferimenti.ts'
import { ColonnaControllo, ControlloNelDettaglio } from './Controllo.tsx'
import { cambio, differenza, euro, euroConSegno, giorno, leggiNumero, percentuale, prezzo, simboloValuta } from './numeri.ts'
import './aggiorna.css'

function Matita() {
  return (
    <svg className="ic p" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}

function Gira() {
  return <span className="agg-gira" aria-hidden="true" />
}

const elenco = (parole: string[]) => (parole.length < 2 ? parole.join('') : parole.slice(0, -1).join(', ') + ' e ' + parole.at(-1))

export function AggiornaFineMese() {
  const { agg, salvato, mesiDaFare, inizia } = useAggiorna()
  // Premere il tasto vuol dire cominciare: se c'è un mese da fare e non c'è niente in corso, parte il più vecchio.
  const partito = useRef(false)
  useEffect(() => {
    if (!partito.current && !agg && !salvato && mesiDaFare.length) {
      partito.current = true
      inizia(mesiDaFare[0])
    }
  }, [agg, salvato, mesiDaFare, inizia])

  // Quando cambia la schermata (la lista, "è salvato", niente da fare) il bottone premuto sparisce:
  // il focus va al titolo, così con la tastiera si riparte da capo pagina e il lettore dello schermo dice dove sei.
  const sezione = useRef<HTMLElement>(null)
  const schermata = agg ? `lista ${agg.mese} ${agg.rifai}` : salvato ? `salvato ${salvato.mese}` : 'niente'
  useEffect(() => {
    if (document.activeElement && document.activeElement !== document.body) return
    const h1 = sezione.current?.querySelector('h1')
    if (!h1) return
    h1.tabIndex = -1
    h1.focus()
  }, [schermata])

  return (
    <section className="agg" ref={sezione}>
      {agg ? <Lista agg={agg} /> : salvato ? <RiquadroSalvato s={salvato} /> : <NienteDaFare />}
    </section>
  )
}

// ---------- la lista ----------

function Lista({ agg }: { agg: Aggiornamento }) {
  const { dati } = useFile()
  const { avviso, chiudiAvviso } = useAggiorna()
  const [aperta, setAperta] = useState<string | null>(null)
  const seduta = ultimaSeduta('MIL', agg.mese)
  const valore = valoreAFineMese(agg)
  const prima = valoreMesePrima(agg)
  const manca = mancano(agg)
  const scarica = inCorso(agg) || riferimentiInCorso(agg.rif)
  const pd = primaEDopo(agg)
  const colonne = agg.rifai ? 8 : 7
  const cambiPronti = agg.cambi.filter((c) => cambioDi(c) !== undefined).length
  const senzaCodici = agg.titoli.filter((r) => senzaCodice(confrontoDellaRiga(r))).length

  return (
    <>
      <div className="testata">
        <h1>{agg.rifai ? `Rifai ${nomeMese(agg.mese)}` : 'Aggiorna fine mese'}</h1>
        <span className="tenue">
          {meseEAnno(agg.mese)}: prezzi di chiusura del {giorno(seduta)}, ultimo giorno di borsa
        </span>
      </div>
      {avviso && (
        <div className="striscia" role="alert">
          <span>
            <Icona nome="info" />
            <span>{avviso}</span>
          </span>
          <button type="button" className="btn solo-icona" aria-label="Chiudi" onClick={chiudiAvviso}>
            <Icona nome="x" piccola />
          </button>
        </div>
      )}
      <div className="numeri">
        <div className="numero">
          <small>Valore dei titoli a fine {nomeMese(agg.mese)}</small>
          <b>{valore !== null ? euro(valore) : '…'}</b>
          {valore !== null && prima !== null ? (
            <span className={valore - prima >= 0 ? 'agg-su' : 'agg-giu'}>{euroConSegno(valore - prima)} rispetto al mese prima</span>
          ) : (
            <span>si calcola quando arrivano tutti i prezzi</span>
          )}
        </div>
        <div className="numero">
          <small>Prezzi dei titoli</small>
          <b>
            {prezziPronti(agg)} di {agg.titoli.length}
          </b>
          <span>
            {manca.titoli.length ? `${manca.titoli.length} da riprovare o scrivere a mano` : scarica ? 'in arrivo' : 'tutti arrivati'}
          </span>
        </div>
        {agg.cambi.length > 0 && (
          <div className="numero">
            <small>Cambi BCE</small>
            <b>
              {cambiPronti} di {agg.cambi.length}
            </b>
            <span>
              {manca.cambi.length ? 'da riprovare o scrivere a mano' : cambiPronti === agg.cambi.length ? 'arrivati' : 'in arrivo'}
            </span>
          </div>
        )}
        {agg.rif && <RiquadriRiferimenti p={agg.rif} />}
        {agg.rifai && (
          <div className="numero">
            <small>Rispetto a prima</small>
            <b>
              {pd.uguali + pd.tenuti} uguali su {agg.titoli.length}
            </b>
            <span>
              {pd.diversi.length ? `diversi: ${elenco(pd.diversi.map(etichetta))}` : scarica ? 'in arrivo' : 'nessun prezzo cambiato'}
            </span>
          </div>
        )}
      </div>

      {senzaCodici > 0 && (
        <div className="striscia" role="status">
          <span>
            <Icona nome="info" />
            <span>
              Il controllo di investing.com non si fa per {senzaCodici === 1 ? '1 titolo' : `${senzaCodici} titoli`}: nel file{' '}
              {senzaCodici === 1 ? 'manca il suo codice' : 'mancano i loro codici'} investing.com. I prezzi arrivano lo stesso dalla borsa.
              I codici si cercano nella pagina <Link className="link" to="/dati">
                Dati
              </Link>, scheda Prezzi dei titoli.
            </span>
          </span>
        </div>
      )}
      <div className="riquadro">
        <div className="agg-attrezzi">
          {scarica
            ? 'La lista si riempie riga per riga. Nel file non si scrive niente finché non premi Salva.'
            : 'Clic su un prezzo per vedere da dove viene o per scriverlo a mano.'}
          {scarica && <Gira />}
        </div>
        <div className="agg-scorre">
          <table className="agg-tabella">
            <thead>
              <tr>
                <th>Titolo</th>
                <th>Borsa</th>
                <th className="n">Prezzo</th>
                <th className="n">Sul mese</th>
                <th>Da dove viene</th>
                <th>
                  Controllo
                  <br />
                  investing.com
                </th>
                {agg.rifai && <th>Prima</th>}
                <th className="n" aria-label="Stato" />
              </tr>
            </thead>
            <tbody>
              <tr className="agg-gruppo">
                <td colSpan={colonne}>
                  Prezzi dei titoli <span className="tenue">· servono tutti per salvare</span>
                </td>
              </tr>
              {agg.titoli.map((r) => (
                <Fragment key={r.id}>
                  <RigaDelTitolo r={r} rifai={agg.rifai} aperta={aperta === r.id} apri={() => setAperta(aperta === r.id ? null : r.id)} />
                  {aperta === r.id && <Dettaglio r={r} agg={agg} colonne={colonne} chiudi={() => setAperta(null)} />}
                </Fragment>
              ))}
              {agg.cambi.length > 0 && (
                <tr className="agg-gruppo">
                  <td colSpan={colonne}>
                    Cambi <span className="tenue">· servono per salvare</span>
                  </td>
                </tr>
              )}
              {agg.cambi.map((c) => (
                <Fragment key={c.valuta}>
                  <RigaDelCambio
                    c={c}
                    rifai={agg.rifai}
                    aperta={aperta === c.valuta}
                    apri={() => setAperta(aperta === c.valuta ? null : c.valuta)}
                  />
                  {aperta === c.valuta && <DettaglioCambio c={c} agg={agg} colonne={colonne} chiudi={() => setAperta(null)} />}
                </Fragment>
              ))}
              {agg.rif && <RigheRiferimenti p={agg.rif} colonne={colonne} />}
            </tbody>
          </table>
        </div>
      </div>
      <BarraFerma agg={agg} versione={dati.versione} />
    </>
  )
}

function Fonte({ fonte, nota }: { fonte: string; nota?: string }) {
  return (
    <>
      <span className={`agg-fonte ${eUfficiale(fonte) || fonte === FONTE_CAMBIO.bce ? 'borsa' : 'riserva'}`}>
        <span className="punto" />
        {fonte}
      </span>
      {nota && <span className="agg-sotto">{nota[0].toUpperCase() + nota.slice(1)}</span>}
    </>
  )
}

function AMano() {
  return (
    <span className="agg-amano">
      <Matita /> a mano
    </span>
  )
}

/** Il nome della fonte di prima, anche se il file è ancora alla versione 2 ("file (foglio …)" → "dal tuo file Excel"). */
const fontePrima = (fonte: string) => fonteDaVersione2(fonte)

function Prima({
  prima,
  dopo,
  tieni,
}: {
  prima: { prezzo: number; fonte: string } | undefined
  dopo: number | undefined
  /** Solo per i titoli: tieni il prezzo di prima, o usa quello nuovo. */
  tieni?: { tenuto: boolean; cambia: (tieni: boolean) => void; nuovo?: number }
}) {
  if (!prima) return <span className="tenue">non c’era</span>
  if (tieni?.tenuto)
    return (
      <span>
        <b>tenuto com’era</b>
        <span className="agg-sotto">
          {tieni.nuovo !== undefined && <>dalla borsa sarebbe {prezzo(tieni.nuovo)} · </>}
          <button type="button" className="link" onClick={() => tieni.cambia(false)}>
            Usa quello nuovo
          </button>
        </span>
      </span>
    )
  if (dopo === undefined)
    return (
      <span className="tenue">
        {prezzo(prima.prezzo)} <span className="agg-sotto">{fontePrima(prima.fonte)}</span>
      </span>
    )
  const c = confrontoConPrima(prima.prezzo, dopo)
  if (c.uguale)
    return (
      <span className="agg-uguale">
        <Icona nome="ok" piccola /> uguale
      </span>
    )
  return (
    <span>
      <b>
        <s className="tenue">{prezzo(prima.prezzo)}</s> → {prezzo(dopo)}
      </b>
      <span className="agg-sotto">
        diverso di {percentuale(c.differenza)} · prima {fontePrima(prima.fonte)}
        {tieni && (
          <>
            {' · '}
            <button type="button" className="link" onClick={() => tieni.cambia(true)}>
              Tieni quello di prima
            </button>
          </>
        )}
      </span>
    </span>
  )
}

function Stato({ attesa, scarica }: { attesa: boolean; scarica: boolean }) {
  if (scarica)
    return (
      <span className="tenue">
        <Gira /> in arrivo…
      </span>
    )
  if (attesa) return <span className="tenue">in attesa</span>
  return null
}

function RigaDelTitolo({ r, rifai, aperta, apri }: { r: RigaTitolo; rifai: boolean; aperta: boolean; apri: () => void }) {
  const { riprova, tieniPrima } = useAggiorna()
  const nuovo = r.aMano ?? (r.stato.tipo === 'arrivato' ? r.stato.esito.prezzo : undefined)
  const p = prezzoDi(r)
  const sm = sulMese(r)
  const nome = (
    <td>
      <div className="agg-tit">
        <b>{etichetta(r)}</b>
        <span>{r.nome}</span>
      </div>
    </td>
  )
  if (p === undefined && (r.stato.tipo === 'attesa' || r.stato.tipo === 'scarica'))
    return (
      <tr>
        {nome}
        <td className="agg-borsa">{r.nomeBorsa}</td>
        <td colSpan={rifai ? 6 : 5}>
          <Stato attesa={r.stato.tipo === 'attesa'} scarica={r.stato.tipo === 'scarica'} />
        </td>
      </tr>
    )
  if (p === undefined)
    return (
      <tr className="agg-manca">
        {nome}
        <td className="agg-borsa">{r.nomeBorsa}</td>
        <td className="n">
          <b>manca</b>
        </td>
        <td />
        <td colSpan={rifai ? 3 : 2}>
          <span className="agg-sotto">{r.stato.tipo === 'manca' ? r.stato.perche[0].toUpperCase() + r.stato.perche.slice(1) : ''}</span>
        </td>
        <td className="n">
          <span className="bottoni agg-destra">
            <button type="button" className="btn" onClick={() => riprova(r.id)}>
              <Icona nome="aggiorna" piccola /> Riprova
            </button>
            <button type="button" className="btn" aria-expanded={aperta} onClick={apri}>
              <Matita /> Scrivo a mano
            </button>
          </span>
        </td>
      </tr>
    )
  return (
    <tr>
      {nome}
      <td className="agg-borsa">{r.nomeBorsa}</td>
      <td className="n">
        <button type="button" className="agg-num" aria-expanded={aperta} onClick={apri}>
          {prezzo(p)} {simboloValuta(r.valuta)}
        </button>
      </td>
      <td className={`n ${sm === null ? '' : sm >= 0 ? 'agg-su' : 'agg-giu'}`}>{sm === null ? '' : percentuale(sm)}</td>
      <td>
        {r.aMano !== undefined ? (
          <AMano />
        ) : r.tieni && r.prima ? (
          <Fonte fonte={fontePrima(r.prima.fonte)} nota="tenuto com’era" />
        ) : r.stato.tipo === 'arrivato' ? (
          <Fonte fonte={r.stato.esito.fonte} nota={r.stato.esito.nota} />
        ) : null}
      </td>
      <td>
        <ColonnaControllo r={r} aperta={aperta} apri={apri} />
      </td>
      {rifai && (
        <td>
          <Prima
            prima={r.prima}
            dopo={nuovo}
            tieni={
              r.aMano === undefined && nuovo !== undefined ? { tenuto: !!r.tieni, cambia: (t) => tieniPrima(r.id, t), nuovo } : undefined
            }
          />
        </td>
      )}
      <td className="n">
        <span className="agg-ok" title="Pronto">
          <Icona nome="ok" piccola />
        </span>
      </td>
    </tr>
  )
}

function RigaDelCambio({ c, rifai, aperta, apri }: { c: RigaCambio; rifai: boolean; aperta: boolean; apri: () => void }) {
  const { riprovaCambio } = useAggiorna()
  const v = cambioDi(c)
  const nome = (
    <td>
      <div className="agg-tit">
        <b>{nomeValuta(c.valuta)}</b>
        <span>
          {c.valuta} per 1 euro · per {elenco(c.perTitoli)}
        </span>
      </div>
    </td>
  )
  if (v === undefined && c.stato.tipo !== 'manca')
    return (
      <tr>
        {nome}
        <td>BCE</td>
        <td colSpan={rifai ? 6 : 5}>
          <Stato attesa={c.stato.tipo === 'attesa'} scarica={c.stato.tipo === 'scarica'} />
        </td>
      </tr>
    )
  if (v === undefined)
    return (
      <tr className="agg-manca">
        {nome}
        <td>BCE</td>
        <td className="n">
          <b>manca</b>
        </td>
        <td />
        <td colSpan={rifai ? 3 : 2}>
          <span className="agg-sotto">{c.stato.tipo === 'manca' ? c.stato.perche[0].toUpperCase() + c.stato.perche.slice(1) : ''}</span>
        </td>
        <td className="n">
          <span className="bottoni agg-destra">
            <button type="button" className="btn" onClick={() => riprovaCambio(c.valuta)}>
              <Icona nome="aggiorna" piccola /> Riprova
            </button>
            <button type="button" className="btn" aria-expanded={aperta} onClick={apri}>
              <Matita /> Scrivo a mano
            </button>
          </span>
        </td>
      </tr>
    )
  const sm = c.precedente ? (v / c.precedente - 1) * 100 : null
  return (
    <tr>
      {nome}
      <td>BCE</td>
      <td className="n">
        <button type="button" className="agg-num" aria-expanded={aperta} onClick={apri}>
          {cambio(v)}
        </button>
      </td>
      <td className="n tenue">{sm === null ? '' : percentuale(sm)}</td>
      <td>{c.aMano !== undefined ? <AMano /> : <Fonte fonte="BCE" />}</td>
      <td className="tenue">—</td>
      {rifai && (
        <td>
          <Prima prima={c.prima ? { prezzo: c.prima.cambio, fonte: c.prima.fonte } : undefined} dopo={v} />
        </td>
      )}
      <td className="n">
        <span className="agg-ok" title="Pronto">
          <Icona nome="ok" piccola />
        </span>
      </td>
    </tr>
  )
}

// ---------- il dettaglio di una riga: da dove viene, e "Scrivo a mano" ----------

function CasellaAMano({
  etichettaCampo,
  segnaposto,
  usa,
  togli,
}: {
  etichettaCampo: string
  segnaposto: string
  usa: (n: number) => void
  togli?: () => void
}) {
  const [testo, setTesto] = useState('')
  const [sbagliato, setSbagliato] = useState(false)
  const conferma = () => {
    const n = leggiNumero(testo)
    if (n === null) return setSbagliato(true)
    usa(n)
  }
  return (
    <div className="agg-amano-campo">
      <label>
        {etichettaCampo}
        <input
          inputMode="decimal"
          placeholder={segnaposto}
          value={testo}
          autoFocus
          aria-invalid={sbagliato}
          onChange={(e) => {
            setTesto(e.target.value)
            setSbagliato(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') conferma()
          }}
        />
      </label>
      <span className="bottoni">
        <button type="button" className="btn primario" onClick={conferma}>
          <Matita /> Scrivo a mano
        </button>
        {togli && (
          <button type="button" className="btn" onClick={togli}>
            Togli quello a mano
          </button>
        )}
      </span>
      {sbagliato && <span className="agg-errore" role="alert">Scrivi un numero più di zero, per esempio 12,75.</span>}
      <span className="agg-sotto">Resta segnato “a mano”. Nel file non si scrive niente finché non premi Salva.</span>
    </div>
  )
}

function Dettaglio({ r, agg, colonne, chiudi }: { r: RigaTitolo; agg: Aggiornamento; colonne: number; chiudi: () => void }) {
  const { scriviAMano } = useAggiorna()
  const p = prezzoDi(r)
  const valuta = simboloValuta(r.valuta)
  const c = r.valuta === 'EUR' ? 1 : cambioDi(agg.cambi.find((x) => x.valuta === r.valuta)!)
  const seduta = ultimaSeduta(r.borsa, agg.mese)
  const esito = r.stato.tipo === 'arrivato' ? r.stato.esito : r.stato.tipo === 'manca' ? r.stato.esito : undefined
  return (
    <tr className="agg-dettaglio">
      <td colSpan={colonne}>
        <div className="agg-dettaglio-corpo">
          <div>
            {r.aMano !== undefined ? (
              <p>
                <AMano /> scritto adesso
                {r.stato.tipo === 'arrivato' && (
                  <>
                    . Era <s>{prezzo(r.stato.esito.prezzo)}</s> da {r.stato.esito.fonte}
                  </>
                )}
                .
              </p>
            ) : r.stato.tipo === 'arrivato' ? (
              <p>
                Chiusura del <b>{giorno(r.stato.esito.seduta)}</b> da <b>{r.stato.esito.fonte}</b>. Borsa di quotazione: {r.nomeBorsa}.
              </p>
            ) : (
              <p>
                Il prezzo di chiusura del {giorno(seduta)} non è arrivato. Puoi trovarlo sul sito della borsa o nel PDF di fine mese della
                banca.
              </p>
            )}
            {esito && esito.tentativi.length > 0 && (
              <ul className="agg-tentativi">
                {esito.tentativi.map((t) => (
                  <li key={t.fonte}>
                    {nomeBreve(t.fonte)}: {t.perche}
                  </li>
                ))}
              </ul>
            )}
            {p !== undefined && (
              <div className="agg-conto">
                <div>
                  <span>Quote</span>
                  <span>{r.quote.toLocaleString('it-IT')}</span>
                </div>
                <div>
                  <span>× prezzo</span>
                  <span>
                    {prezzo(p)} {valuta}
                  </span>
                </div>
                {r.valuta !== 'EUR' && (
                  <div>
                    <span>÷ cambio BCE</span>
                    <span>{c !== undefined ? cambio(c) : 'manca'}</span>
                  </div>
                )}
                <div>
                  <span>Valore a fine {nomeMese(agg.mese)}</span>
                  <span>{c !== undefined ? euro((r.quote * p) / c) : '…'}</span>
                </div>
              </div>
            )}
            <ControlloNelDettaglio r={r} />
          </div>
          <CasellaAMano
            etichettaCampo={
              p === undefined
                ? `Scrivi il prezzo di chiusura del ${giorno(seduta)}, in ${r.valuta}`
                : 'Se il prezzo è sbagliato, scrivi quello giusto'
            }
            segnaposto={p !== undefined ? prezzo(p) : r.precedente ? prezzo(r.precedente.prezzo) : ''}
            usa={(n) => {
              scriviAMano(r.id, n)
              chiudi()
            }}
            togli={r.aMano !== undefined ? () => scriviAMano(r.id, undefined) : undefined}
          />
        </div>
      </td>
    </tr>
  )
}

function DettaglioCambio({ c, agg, colonne, chiudi }: { c: RigaCambio; agg: Aggiornamento; colonne: number; chiudi: () => void }) {
  const { cambioAMano } = useAggiorna()
  const v = cambioDi(c)
  return (
    <tr className="agg-dettaglio">
      <td colSpan={colonne}>
        <div className="agg-dettaglio-corpo">
          <div>
            {c.aMano !== undefined ? (
              <p>
                <AMano /> scritto adesso.
              </p>
            ) : c.stato.tipo === 'arrivato' ? (
              <p>
                Cambio di riferimento della <b>BCE</b> del <b>{giorno(c.stato.esito.seduta)}</b>: quante{' '}
                {nomeValuta(c.valuta).toLowerCase()} per 1 euro.
              </p>
            ) : (
              <p>
                Il cambio di fine {nomeMese(agg.mese)} non è arrivato. Lo trovi sul sito della BCE (“euro foreign exchange reference
                rates”).
              </p>
            )}
          </div>
          <CasellaAMano
            etichettaCampo={v === undefined ? `Scrivi il cambio: ${c.valuta} per 1 euro` : 'Se il cambio è sbagliato, scrivi quello giusto'}
            segnaposto={v !== undefined ? cambio(v) : c.precedente ? cambio(c.precedente) : ''}
            usa={(n) => {
              cambioAMano(c.valuta, n)
              chiudi()
            }}
            togli={c.aMano !== undefined ? () => cambioAMano(c.valuta, undefined) : undefined}
          />
        </div>
      </td>
    </tr>
  )
}

// ---------- la barra ferma in basso ----------

function BarraFerma({ agg, versione }: { agg: Aggiornamento; versione: number }) {
  const { annulla, salva, salvando } = useAggiorna()
  const [esci, setEsci] = useState(false)
  const manca = mancano(agg)
  const pronto = puoSalvare(agg)
  const pd = primaEDopo(agg)
  let frase
  if (esci) frase = <b>Esci senza salvare? I prezzi scaricati si perdono, il file resta com’era.</b>
  else if (salvando) frase = <span>Faccio la copia e salvo…</span>
  else if (pronto)
    frase = (
      <span>
        {agg.rifai &&
          `${elenco([
            `${pd.uguali} ${pd.uguali === 1 ? 'prezzo uguale' : 'prezzi uguali'} a prima`,
            ...(pd.tenuti ? [`${pd.tenuti} ${pd.tenuti === 1 ? 'tenuto' : 'tenuti'} com’era`] : []),
            ...(pd.diversi.length ? [`${pd.diversi.length} ${pd.diversi.length === 1 ? 'diverso' : 'diversi'}`] : []),
          ])}. `}
        Tutto pronto. Prima di salvare faccio una copia del file com’è adesso, in <b>copie</b>.
        {versione < 3 && ' Il file passa alla versione 3, dove ogni prezzo porta scritto da dove viene.'}
        {fraseBarraRiferimenti(agg.rif)}
      </span>
    )
  else if (manca.titoli.length || manca.cambi.length) {
    const cosa = [
      ...(manca.titoli.length ? [`il prezzo di ${elenco(manca.titoli.map(etichetta))}`] : []),
      ...manca.cambi.map((c) => `il cambio ${c.valuta}`),
    ]
    frase = (
      <span>
        <b>Manca {elenco(cosa)}</b>: riprova o scrivilo a mano per poter salvare.
      </span>
    )
  } else frase = <span>Sto scaricando…</span>
  return (
    <div className="agg-piede" role="region" aria-label="Salvataggio">
      {frase}
      <span className="bottoni">
        {esci ? (
          <>
            <button type="button" className="btn" onClick={() => setEsci(false)}>
              No, resto
            </button>
            <button type="button" className="btn primario" onClick={annulla}>
              Sì, esci senza salvare
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" disabled={salvando} onClick={() => setEsci(true)}>
              Annulla
            </button>
            <button type="button" className="btn primario" disabled={!pronto || salvando} onClick={() => void salva()}>
              Salva {nomeMese(agg.mese)}
            </button>
          </>
        )}
      </span>
    </div>
  )
}

// ---------- dopo "Salva" ----------

function frasiFonti(fonti: [string, number][]): string {
  return elenco(
    fonti.map(([f, n]) => {
      if (f === FONTE.aMano) return `${n} scritt${n === 1 ? 'o' : 'i'} a mano`
      if (f === TENUTO) return `${n} ${n === 1 ? 'tenuto' : 'tenuti'} com’era`
      if (f === FONTE.fileExcel) return `${n} dal tuo file Excel`
      return `${n} da ${f}`
    }),
  )
}

function RiquadroSalvato({ s }: { s: Salvato }) {
  const { mesiDaFare, inizia } = useAggiorna()
  const totale = s.fonti.reduce((t, [, n]) => t + n, 0)
  const prossimo = mesiDaFare[0]
  return (
    <>
      <div className="testata">
        <h1>Aggiorna fine mese</h1>
        <span className="tenue">{meseEAnno(s.mese)}</span>
      </div>
      <div className="riquadro agg-salvato">
        <h2>
          <span className="agg-ok">
            <Icona nome="ok" />
          </span>
          {NomeMese(s.mese)} è salvato
        </h2>
        <ul>
          <li>
            Prima di scrivere ho fatto la copia <b>copie\{s.copia}</b>.
          </li>
          <li>
            {totale} prezzi dei titoli: {frasiFonti(s.fonti)}.
          </li>
          {s.rifai && (
            <li>
              {s.uguali} uguali a quelli di prima (a parte gli arrotondamenti del file Excel)
              {s.tenuti ? `, ${s.tenuti} ${s.tenuti === 1 ? 'tenuto' : 'tenuti'} com’era` : ''}
              {s.diversi.length
                ? `; cambiati: ${elenco(s.diversi.map((d) => `${d.titolo} ${prezzo(d.prima)} → ${prezzo(d.dopo)}`))}`
                : ', nessuno cambiato'}
              .
            </li>
          )}
          {s.controlli && s.controlli.uguali + s.controlli.diversi.length + s.controlli.nonFatti > 0 && (
            <li>
              Controllo di investing.com:{' '}
              {elenco([
                ...(s.controlli.uguali ? [`${s.controlli.uguali} ${s.controlli.uguali === 1 ? 'uguale' : 'uguali'}`] : []),
                ...s.controlli.diversi.map((d) => `${d.titolo} diverso di ${differenza(d.differenza)}`),
                ...(s.controlli.nonFatti
                  ? [
                      `${s.controlli.nonFatti} non ${s.controlli.nonFatti === 1 ? 'fatto' : 'fatti'}${
                        s.controlli.senzaCodice === s.controlli.nonFatti
                          ? ` perché nel file ${s.controlli.nonFatti === 1 ? 'manca il codice' : 'mancano i codici'} investing.com (si cercano nella pagina Dati)`
                          : ''
                      }`,
                    ]
                  : []),
              ])}
              .
            </li>
          )}
          {s.versione3 && (
            <li>
              Il file è passato alla versione 3: ogni prezzo porta scritto da dove viene.{' '}
              {s.rifai ? 'Gli altri mesi' : 'I prezzi che c’erano'} sono rimasti come prima.
            </li>
          )}
          {s.frasiRiferimenti.map((f) => (
            <li key={f}>{f}</li>
          ))}
          {prossimo && <li>Manca ancora {nomeMese(prossimo)}: si fa adesso, un mese alla volta.</li>}
        </ul>
        <p className="bottoni">
          {prossimo && (
            <button type="button" className="btn primario" onClick={() => inizia(prossimo)}>
              <Icona nome="aggiorna" piccola /> Aggiorna {nomeMese(prossimo)}
            </button>
          )}
          <Link to="/titoli" className={`btn ${prossimo ? '' : 'primario'}`}>
            Vai ai titoli
          </Link>
          <Link to="/dati" className="btn">
            Vedi da dove vengono i prezzi
          </Link>
          <button type="button" className="btn" onClick={() => inizia(s.mese)}>
            Rifai {nomeMese(s.mese)}
          </button>
        </p>
      </div>
    </>
  )
}

/** Nessun mese da fare: si dice qual è l'ultimo salvato, da dove vengono i suoi prezzi, e quando tocca al prossimo. */
function NienteDaFare() {
  const { dati } = useFile()
  const { inizia, mesiDaFare } = useAggiorna()
  const ultimo = ultimoMeseSalvato(dati)
  if (mesiDaFare.length)
    return (
      <>
        <div className="testata">
          <h1>Aggiorna fine mese</h1>
        </div>
        <div className="riquadro agg-salvato">
          <h2>
            {elenco(mesiDaFare.map(NomeMese))} {mesiDaFare.length === 1 ? 'è finito' : 'sono finiti'}: i prezzi di fine mese non ci sono
            ancora
          </h2>
          <ul>
            <li>
              I prezzi arrivano dalle borse in cui sono quotati i titoli, i cambi dalla BCE. Si fa un mese alla volta, dal più vecchio.
            </li>
            <li>Nel file non si scrive niente finché non premi Salva, e prima si fa una copia.</li>
          </ul>
          <p className="bottoni">
            <button type="button" className="btn primario" onClick={() => inizia(mesiDaFare[0])}>
              <Icona nome="aggiorna" piccola /> Aggiorna {nomeMese(mesiDaFare[0])}
            </button>
          </p>
        </div>
      </>
    )
  if (!ultimo)
    return (
      <>
        <div className="testata">
          <h1>Aggiorna fine mese</h1>
        </div>
        <div className="riquadro vuoto">Nel file non ci sono ancora titoli da aggiornare.</div>
      </>
    )
  const data = fineMese(ultimo)
  const prezzi = (dati.prezzi ?? []).filter((p) => p.data === data)
  const fonti = contaFonti(prezzi.map((p) => (p.fonte.startsWith('file') ? FONTE.fileExcel : p.fonte)))
  const prossimo = meseDopo(ultimo)
  return (
    <>
      <div className="testata">
        <h1>Aggiorna fine mese</h1>
        <span className="tenue">{meseEAnno(ultimo)}</span>
      </div>
      <div className="riquadro agg-salvato">
        <h2>
          <span className="agg-ok">
            <Icona nome="ok" />
          </span>
          {NomeMese(ultimo)} è salvato
        </h2>
        <ul>
          <li>
            {prezzi.length} prezzi dei titoli: {frasiFonti(fonti)}.
          </li>
          <li>
            {NomeMese(prossimo)} si aggiorna dal 1° {nomeMese(meseDopo(prossimo))}: in alto su ogni pagina comparirà la striscia “
            {NomeMese(prossimo)} è finito”.
          </li>
          <li>
            “Rifai {nomeMese(ultimo)}” riscarica i prezzi dalle borse e ti mostra prima e dopo. Scrive solo se premi Salva, e prima fa una
            copia.
          </li>
        </ul>
        <p className="bottoni">
          <button type="button" className="btn primario" onClick={() => inizia(ultimo)}>
            <Icona nome="aggiorna" piccola /> Rifai {nomeMese(ultimo)}
          </button>
          <Link to="/dati" className="btn">
            Vedi da dove vengono i prezzi
          </Link>
        </p>
      </div>
    </>
  )
}
