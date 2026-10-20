// La schermata Aggiorna fine mese (ticket 27 della mappa): testata, riquadri, la lista a gruppi che si
// riempie, "Riprova" e "Inserisci manualmente", la barra ferma con "Annulla" e "Salva <mese>", poi
// "Aggiornamento di <mese> salvato" con "Ripeti <mese>". Se non c'è un mese da fare, dice qual è l'ultimo salvato e permette di rifarlo.
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { confrontoDellaRiga, senzaCodice } from '../dati/aggiorna/controllo-prezzo.ts'
import { fineMese, meseDopo, meseEAnno, NomeMese, nomeMese, ultimaSeduta } from '../dati/aggiorna/calendario.ts'
import { eUfficiale, FONTE, FONTE_CAMBIO, fonteDaMostrare, fonteDaVersione2, nomeBreve } from '../dati/aggiorna/fonti.ts'
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
        <h1>{agg.rifai ? `Ripeti l’aggiornamento di ${nomeMese(agg.mese)}` : 'Aggiorna fine mese'}</h1>
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
          <small>Controvalore a fine {nomeMese(agg.mese)}</small>
          <b>{valore !== null ? euro(valore) : '…'}</b>
          {valore !== null && prima !== null ? (
            <span className={valore - prima >= 0 ? 'agg-su' : 'agg-giu'}>{euroConSegno(valore - prima)} rispetto al mese precedente</span>
          ) : (
            <span>calcolato quando tutti i prezzi sono disponibili</span>
          )}
        </div>
        <div className="numero">
          <small>Prezzi dei titoli</small>
          <b>
            {prezziPronti(agg)} di {agg.titoli.length}
          </b>
          <span>
            {manca.titoli.length ? `${manca.titoli.length} da richiedere di nuovo o inserire manualmente` : scarica ? 'in arrivo' : 'tutti ricevuti'}
          </span>
        </div>
        {agg.cambi.length > 0 && (
          <div className="numero">
            <small>Cambi BCE</small>
            <b>
              {cambiPronti} di {agg.cambi.length}
            </b>
            <span>
              {manca.cambi.length ? 'da richiedere di nuovo o inserire manualmente' : cambiPronti === agg.cambi.length ? 'ricevuti' : 'in arrivo'}
            </span>
          </div>
        )}
        {agg.rif && <RiquadriRiferimenti p={agg.rif} />}
        {agg.rifai && (
          <div className="numero">
            <small>Rispetto ai valori precedenti</small>
            <b>
              {pd.uguali + pd.tenuti} uguali su {agg.titoli.length}
            </b>
            <span>
              {pd.diversi.length ? `diversi: ${elenco(pd.diversi.map(etichetta))}` : scarica ? 'in arrivo' : 'nessun prezzo modificato'}
            </span>
          </div>
        )}
      </div>

      {senzaCodici > 0 && (
        <div className="striscia" role="status">
          <span>
            <Icona nome="info" />
            <span>
              Il controllo con investing.com non è possibile per {senzaCodici === 1 ? '1 titolo' : `${senzaCodici} titoli`}: nel file{' '}
              {senzaCodici === 1 ? 'manca il relativo codice' : 'mancano i relativi codici'} investing.com. I prezzi arrivano comunque dalla borsa.
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
            ? 'La lista si completa riga per riga. Il file dei dati non viene modificato fino al salvataggio.'
            : 'Selezionare un prezzo per vederne la provenienza o inserirlo manualmente.'}
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
                <th>Provenienza</th>
                <th>
                  Controllo
                  <br />
                  investing.com
                </th>
                {agg.rifai && <th>Precedente</th>}
                <th className="n" aria-label="Stato" />
              </tr>
            </thead>
            <tbody>
              <tr className="agg-gruppo">
                <td colSpan={colonne}>
                  Prezzi dei titoli <span className="tenue">· tutti necessari per salvare</span>
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
                    Cambi <span className="tenue">· necessari per salvare</span>
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
        {fonteDaMostrare(fonte)}
      </span>
      {nota && <span className="agg-sotto">{nota[0].toUpperCase() + nota.slice(1)}</span>}
    </>
  )
}

function AMano() {
  return (
    <span className="agg-amano">
      <Matita /> manuale
    </span>
  )
}

/** Il nome della fonte di prima, anche se il file è ancora alla versione 2 ("file (foglio …)" → "file Excel iniziale"). */
const fontePrima = (fonte: string) => fonteDaMostrare(fonteDaVersione2(fonte))

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
  if (!prima) return <span className="tenue">assente</span>
  if (tieni?.tenuto)
    return (
      <span>
        <b>mantenuto</b>
        <span className="agg-sotto">
          {tieni.nuovo !== undefined && <>prezzo della borsa: {prezzo(tieni.nuovo)} · </>}
          <button type="button" className="link" onClick={() => tieni.cambia(false)}>
            Usa il nuovo prezzo
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
        differenza di {percentuale(c.differenza)} · prima: {fontePrima(prima.fonte)}
        {tieni && (
          <>
            {' · '}
            <button type="button" className="link" onClick={() => tieni.cambia(true)}>
              Mantieni il precedente
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
          <b>mancante</b>
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
              <Matita /> Inserisci manualmente
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
          <Fonte fonte={fontePrima(r.prima.fonte)} nota="mantenuto" />
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
          <b>mancante</b>
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
              <Matita /> Inserisci manualmente
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

// ---------- il dettaglio di una riga: la provenienza, e "Inserisci manualmente" ----------

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
          <Matita /> Inserisci manualmente
        </button>
        {togli && (
          <button type="button" className="btn" onClick={togli}>
            Rimuovi il valore manuale
          </button>
        )}
      </span>
      {sbagliato && <span className="agg-errore" role="alert">Inserire un numero maggiore di zero, per esempio 12,75.</span>}
      <span className="agg-sotto">Il valore resta segnato come manuale. Il file dei dati non viene modificato fino al salvataggio.</span>
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
                <AMano /> inserito ora
                {r.stato.tipo === 'arrivato' && (
                  <>
                    . Prezzo ricevuto: <s>{prezzo(r.stato.esito.prezzo)}</s> da {r.stato.esito.fonte}
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
                Il prezzo di chiusura del {giorno(seduta)} non è disponibile. Si trova sul sito della borsa o nel PDF di fine mese della
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
                  <span>Controvalore a fine {nomeMese(agg.mese)}</span>
                  <span>{c !== undefined ? euro((r.quote * p) / c) : '…'}</span>
                </div>
              </div>
            )}
            <ControlloNelDettaglio r={r} />
          </div>
          <CasellaAMano
            etichettaCampo={
              p === undefined
                ? `Prezzo di chiusura del ${giorno(seduta)}, in ${r.valuta}`
                : 'Prezzo corretto, se quello ricevuto è errato'
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
                <AMano /> inserito ora.
              </p>
            ) : c.stato.tipo === 'arrivato' ? (
              <p>
                Cambio di riferimento della <b>BCE</b> del <b>{giorno(c.stato.esito.seduta)}</b>: {c.valuta} per 1 euro.
              </p>
            ) : (
              <p>
                Il cambio di fine {nomeMese(agg.mese)} non è disponibile. Si trova sul sito della BCE (“euro foreign exchange reference
                rates”).
              </p>
            )}
          </div>
          <CasellaAMano
            etichettaCampo={v === undefined ? `Cambio: ${c.valuta} per 1 euro` : 'Cambio corretto, se quello ricevuto è errato'}
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
  if (esci) frase = <b>Uscire senza salvare? I prezzi scaricati andranno persi; il file dei dati non viene modificato.</b>
  else if (salvando) frase = <span>Copia di sicurezza e salvataggio in corso…</span>
  else if (pronto)
    frase = (
      <span>
        {agg.rifai &&
          `${elenco([
            `${pd.uguali} ${pd.uguali === 1 ? 'prezzo uguale al precedente' : 'prezzi uguali ai precedenti'}`,
            ...(pd.tenuti ? [`${pd.tenuti} ${pd.tenuti === 1 ? 'mantenuto' : 'mantenuti'}`] : []),
            ...(pd.diversi.length ? [`${pd.diversi.length} ${pd.diversi.length === 1 ? 'diverso' : 'diversi'}`] : []),
          ])}. `}
        Pronto per il salvataggio. Prima di salvare viene fatta una copia del file attuale nella cartella <b>copie</b>.
        {versione < 3 && ' Il file passa alla versione 3, in cui ogni prezzo riporta la propria provenienza.'}
        {versione === 3 && ' Gli indici di borsa sono ora in punti, senza dividendi: i valori scaricati in precedenza si sostituiscono.'}
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
        <b>Manca {elenco(cosa)}</b>: per poter salvare, richiederlo di nuovo o inserirlo manualmente.
      </span>
    )
  } else frase = <span>Scaricamento in corso…</span>
  return (
    <div className="agg-piede" role="region" aria-label="Salvataggio">
      {frase}
      <span className="bottoni">
        {esci ? (
          <>
            <button type="button" className="btn" onClick={() => setEsci(false)}>
              No, continua
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
      if (f === FONTE.aMano) return `${n} inserit${n === 1 ? 'o' : 'i'} manualmente`
      if (f === TENUTO) return `${n} ${n === 1 ? 'mantenuto' : 'mantenuti'}`
      if (f === FONTE.fileExcel) return `${n} dal file Excel iniziale`
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
          Aggiornamento di {nomeMese(s.mese)} salvato
        </h2>
        <ul>
          <li>
            Prima della scrittura è stata fatta la copia <b>copie\{s.copia}</b>.
          </li>
          <li>
            {totale} prezzi dei titoli: {frasiFonti(s.fonti)}.
          </li>
          {s.rifai && (
            <li>
              {s.uguali} uguali ai precedenti (salvo gli arrotondamenti del file Excel)
              {s.tenuti ? `, ${s.tenuti} ${s.tenuti === 1 ? 'mantenuto' : 'mantenuti'}` : ''}
              {s.diversi.length
                ? `; modificati: ${elenco(s.diversi.map((d) => `${d.titolo} ${prezzo(d.prima)} → ${prezzo(d.dopo)}`))}`
                : ', nessuno modificato'}
              .
            </li>
          )}
          {s.controlli && s.controlli.uguali + s.controlli.diversi.length + s.controlli.nonFatti > 0 && (
            <li>
              Controllo con investing.com:{' '}
              {elenco([
                ...(s.controlli.uguali ? [`${s.controlli.uguali} ${s.controlli.uguali === 1 ? 'uguale' : 'uguali'}`] : []),
                ...s.controlli.diversi.map((d) => `${d.titolo} con differenza di ${differenza(d.differenza)}`),
                ...(s.controlli.nonFatti
                  ? [
                      `${s.controlli.nonFatti} non ${s.controlli.nonFatti === 1 ? 'eseguito' : 'eseguiti'}${
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
              Il file è passato alla versione 3: ogni prezzo riporta la propria provenienza.{' '}
              {s.rifai ? 'Gli altri mesi' : 'I prezzi già presenti'} sono invariati.
            </li>
          )}
          {s.versione4 && <li>Gli indici di borsa sono ora in punti, senza dividendi, come li pubblica la borsa; il BTP 10 anni non è più tra i riferimenti.</li>}
          {s.frasiRiferimenti.map((f) => (
            <li key={f}>{f}</li>
          ))}
          {prossimo && <li>Resta da aggiornare {nomeMese(prossimo)}: si procede un mese alla volta.</li>}
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
            Provenienza dei prezzi
          </Link>
          <button type="button" className="btn" onClick={() => inizia(s.mese)}>
            Ripeti {nomeMese(s.mese)}
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
            {elenco(mesiDaFare.map(NomeMese))} {mesiDaFare.length === 1 ? 'è concluso' : 'sono conclusi'}: i prezzi di fine mese non sono
            ancora presenti
          </h2>
          <ul>
            <li>
              I prezzi arrivano dalle borse in cui sono quotati i titoli, i cambi dalla BCE. Si procede un mese alla volta, dal meno recente.
            </li>
            <li>Il file dei dati viene modificato solo al salvataggio, dopo una copia di sicurezza.</li>
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
          Aggiornamento di {nomeMese(ultimo)} salvato
        </h2>
        <ul>
          <li>
            {prezzi.length} prezzi dei titoli: {frasiFonti(fonti)}.
          </li>
          <li>
            L’aggiornamento di {nomeMese(prossimo)} sarà possibile dal 1° {nomeMese(meseDopo(prossimo))}: in cima a ogni pagina comparirà l’avviso
            “{NomeMese(prossimo)} è concluso”.
          </li>
          <li>
            “Ripeti {nomeMese(ultimo)}” scarica di nuovo i prezzi dalle borse e li mette a confronto con i precedenti. Il file dei dati
            viene modificato solo al salvataggio, dopo una copia di sicurezza.
          </li>
        </ul>
        <p className="bottoni">
          <button type="button" className="btn primario" onClick={() => inizia(ultimo)}>
            <Icona nome="aggiorna" piccola /> Ripeti {nomeMese(ultimo)}
          </button>
          <Link to="/dati" className="btn">
            Provenienza dei prezzi
          </Link>
        </p>
      </div>
    </>
  )
}
