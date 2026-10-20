// La schermata Registra (mappa, ticket 26, versione "prima in parole"): si apre dal tasto "Registra" di Movimenti.
// Scritto a mano: scegli acquisto, vendita o dividendo, scrivi i numeri, poi l'applicazione dice il movimento
// in parole con tre riquadri, e solo dopo "Sì, registra" scrive nel file (con una copia prima).
// "No, modifica i dati" riapre i campi. Non si vendono più quote di quelle che hai.
//
// Dal PDF (ticket 12): si trascina o si sceglie il PDF della banca nella prima pagina (o sulla pagina Movimenti).
// La schermata parte allora dalla frase, con "Letto da …" e "Apri il PDF", e nei campi scrive "dal PDF"
// o "manuale" accanto a ogni numero. Un PDF già registrato non si registra ("Apri il movimento"); l'acquisto
// di un titolo che non c'è apre sotto la frase il riquadro "Titolo nuovo" (TitoloNuovo.tsx).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { anteprimaVendita } from '../../conti/movimenti.ts'
import { venditaInParole } from '../../conti/scheda.ts'
import { controllaModifica, movimentoInParole, quoteAlGiorno, type EsitoMovimento, type NuovoMovimento, type TipoMovimento } from '../../dati/movimenti.ts'
import { cambio, data, euro, guadagnoEuro, MENO, numero, prezzo, quote, segno } from '../../formato.ts'
import { Icona } from '../../icone.tsx'
import { ChipAMano } from '../../pannello/AMano.tsx'
import { mostraAvviso } from '../../pannello/avviso.ts'
import { classeSegno } from '../../pannello/spiega.ts'
import { ponte } from '../../ponte.ts'
import { useFile, useStato } from '../../stato.tsx'
import { segnaAppena } from './appena.ts'
import { bozzaVuota, campoCambiato, leggiData, leggiNumero, numeroNellaCasella, titoliDaScegliere, type CampoBozza } from './bozza.ts'
import { leggiBozzaPdf, NUOVO, type BozzaPdf, type TitoloNuovoDelPdf } from './dal-pdf.ts'
import { AvvisiPdf, GiaRegistrato, LettoDa, Pezzi, ZonaPdf } from './DalPdf.tsx'
import { TitoloNuovo } from './TitoloNuovo.tsx'
import type { FileDati } from '../../dati/tipi.ts'
import './movimenti.css'
import { FRASE_COPIA } from '../../dati/copie.ts'

/** Il file come lo vede la schermata: con il titolo nuovo dentro, se il PDF ne porta uno (dal-pdf.ts). */
const DatiVisti = createContext<FileDati | null>(null)
function useDati(): FileDati {
  const { dati } = useFile()
  return useContext(DatiVisti) ?? dati
}

type Fase = 'campi' | 'rivedi'

const NOMI: Record<TipoMovimento, string> = { acquisto: 'Nuovo acquisto', vendita: 'Nuova vendita', dividendo: 'Nuovo dividendo' }

export function Registra() {
  const { dati } = useFile()
  const { esegui, occupato } = useStato()
  const navigate = useNavigate()
  const location = useLocation()
  const arrivo = (location.state ?? {}) as { indietro?: string; bozza?: BozzaPdf }
  const indietro = arrivo.indietro ?? '/movimenti'
  const [bozza, setBozza] = useState<BozzaPdf | null>(arrivo.bozza ?? null)
  const [fase, setFase] = useState<Fase>(arrivo.bozza?.origine === 'pdf' ? 'rivedi' : 'campi')
  const [esito, setEsito] = useState<string | null>(null)

  const capo = useRef<HTMLHeadingElement>(null)
  const titolo = bozza ? `${NOMI[bozza.tipo]}${bozza.origine === 'pdf' ? ' dal PDF' : ', inserimento manuale'}` : 'Registrazione di un movimento'
  const testa = (
    <>
      <div className="indietro">
        <Link className="link" to={indietro}>
          <Icona nome="indietro" piccola />
          Movimenti
        </Link>
      </div>
      <div className="testata">
        <h1 ref={capo} tabIndex={-1}>
          {titolo}
        </h1>
      </div>
    </>
  )
  // Quando cambia la schermata (scegli, campi, frase) il bottone premuto sparisce: il focus va al titolo,
  // così con la tastiera si riparte da capo pagina e il lettore dello schermo dice dove sei.
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) capo.current?.focus()
  }, [titolo, fase])

  if (!bozza)
    return (
      <section className="registra">
        {testa}
        <div className="riquadro">
          <div className="colonna">
            <ZonaPdf
              quandoLetto={(b) => {
                setBozza(b)
                setFase('rivedi')
              }}
            />
            <div className="gruppo">
              <small>In assenza del PDF, inserire manualmente un acquisto, una vendita o un dividendo, riportando i dati dal documento della banca:</small>
              <div className="scelte">
                {(['acquisto', 'vendita', 'dividendo'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="btn"
                    onClick={() => {
                      setBozza(bozzaVuota(t))
                      setFase('campi')
                    }}
                  >
                    {t === 'acquisto' ? 'Acquisto' : t === 'vendita' ? 'Vendita' : 'Dividendo'}
                  </button>
                ))}
              </div>
            </div>
            <p className="nota-scrittura">Una cedola di un’obbligazione si registra come dividendo; il rimborso a scadenza come vendita.</p>
          </div>
        </div>
      </section>
    )

  const letta = leggiBozzaPdf(dati, bozza)
  const { vista } = letta
  const m = letta.movimento
  const info = bozza.dalPdfInfo
  const doppio = info?.doppio ?? null
  const controllo = m && !doppio ? controllaModifica(vista.dati, { azione: 'registra', movimento: m }) : null
  const problema = controllo && !controllo.ok ? controllo.perche : null
  const pronto = m !== null && controllo?.ok === true && letta.mancano.length === 0
  const cambiaNuovo = (n: Partial<TitoloNuovoDelPdf>) => {
    if (info?.nuovo) setBozza((b) => (b?.dalPdfInfo?.nuovo ? { ...b, dalPdfInfo: { ...b.dalPdfInfo, nuovo: { ...b.dalPdfInfo.nuovo, ...n } } } : b))
  }
  const riquadroNuovo = info?.nuovo && bozza.testi.titolo === NUOVO ? <TitoloNuovo nuovo={info.nuovo} cambia={cambiaNuovo} /> : null

  const registra = async () => {
    if (!m || !pronto) return
    setEsito(null)
    let risposta: EsitoMovimento | null = null
    await esegui(async () => {
      risposta = await ponte.modificaMovimento({ azione: 'registra', movimento: m, ...(vista.titoloNuovo ? { titoloNuovo: vista.titoloNuovo } : {}) })
      return risposta.esito === 'errore' ? null : risposta.apertura
    })
    const r = risposta as EsitoMovimento | null
    if (!r) return
    if (r.esito === 'errore') return setEsito(`Si è verificato un errore: ${r.perche}. Il file non è stato modificato.`)
    if (r.esito === 'cambiato')
      return setEsito(
        'Il file è stato modificato da un altro computer o fuori dall’applicazione: non è stato scritto nulla e i dati sono stati ricaricati. Verificare che il movimento non sia già presente, quindi premere di nuovo “Sì, registra”.',
      )
    segnaAppena(r.id)
    const soldi = m.tipo === 'dividendo' ? `+${euro(m.lordo - m.imposte, 2)}` : `${m.tipo === 'acquisto' ? MENO : '+'}${euro(m.totale, 2)}`
    const nuovo = vista.titoloNuovo ? ` ${vista.titoloNuovo.simbolo ?? vista.titoloNuovo.isin} è stato aggiunto ai titoli.` : ''
    mostraAvviso(`Registrato: ${movimentoInParole(vista.dati, m)}, ${soldi}.${nuovo} ${FRASE_COPIA}`)
    navigate(m.tipo === 'dividendo' ? '/movimenti?scheda=div' : '/movimenti')
  }

  const cambia = (k: CampoBozza, v: string) =>
    setBozza({ ...bozza, testi: { ...bozza.testi, [k]: v }, totaleScritto: bozza.totaleScritto || k === 'totale' })

  return (
    <DatiVisti.Provider value={vista.dati}>
    <section className="registra">
      {testa}
      {fase === 'rivedi' && m ? (
        <div className="riquadro frase-box">
          <LettoDa bozza={bozza} />
          {doppio && <GiaRegistrato id={doppio} indietro={indietro} />}
          <Frase m={m} valuta={letta.valuta} />
          <Riquadri m={m} valuta={letta.valuta} />
          <Pezzi bozza={bozza} />
          <AvvisiPdf bozza={vista.bozza} />
          {m.tipo === 'vendita' && <SpiegaVendita m={m} />}
          {letta.conto !== null && m.tipo !== 'dividendo' && <AvvisoConto totale={m.totale} conto={letta.conto} />}
          {riquadroNuovo}
          {problema && <div className="manca">Registrazione non possibile: {problema}.</div>}
          {!doppio && !problema && letta.mancano.length > 0 && <div className="manca">Per registrare occorre indicare: {letta.mancano.join(', ')}.</div>}
          {!doppio && <p className="domanda">I dati sono corretti?</p>}
          <div className="bottoni">
            {!doppio && (
              <button type="button" className="btn primario" autoFocus={!riquadroNuovo} disabled={occupato || !pronto} onClick={() => void registra()}>
                <Icona nome="ok" piccola />
                Sì, registra
              </button>
            )}
            {!doppio && (
              <button type="button" className="btn" disabled={occupato} onClick={() => setFase('campi')}>
                <Icona nome="matita" piccola />
                No, modifica i dati
              </button>
            )}
            {doppio && (
              <Link className="btn" to={indietro}>
                Annulla
              </Link>
            )}
          </div>
          {esito && (
            <p className="esito" role="status">
              {esito}
            </p>
          )}
          {!doppio && (
            <p className="nota-scrittura">
              Il file non viene modificato fino alla conferma con “Sì, registra”. Prima della scrittura si salva una copia del file attuale nella cartella copie.
            </p>
          )}
        </div>
      ) : (
        <div className="riquadro">
          <form
            className="colonna"
            onSubmit={(e) => {
              e.preventDefault()
              if (pronto) setFase('rivedi')
            }}
            onKeyDown={(e) => {
              // Invio in una casella porta alla frase; fermato qui, non arriva anche a "Sì, registra".
              if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
              e.preventDefault()
              if (pronto) setFase('rivedi')
            }}
          >
            <LettoDa bozza={bozza} />
            {doppio && <GiaRegistrato id={doppio} indietro={indietro} />}
            <Campi bozza={bozza} cambia={cambia} conto={letta.conto} valuta={letta.valuta} />
            {m && m.tipo !== 'dividendo' && letta.conto !== null && <AvvisoConto totale={m.totale} conto={letta.conto} />}
            {m && m.tipo === 'vendita' && !problema && <SpiegaVendita m={m} />}
            {riquadroNuovo}
            <div className="piede-reg">
              {letta.mancano.length > 0 ? (
                <div className="manca">Per proseguire occorre indicare: {letta.mancano.join(', ')}.</div>
              ) : problema ? (
                <div className="manca">Registrazione non possibile: {problema}.</div>
              ) : null}
              <div className="bottoni">
                <button type="submit" className="btn primario" disabled={!pronto}>
                  Avanti: riepilogo
                </button>
                <Link className="btn" to={indietro}>
                  Annulla
                </Link>
              </div>
              <p className="nota-scrittura">Il file non viene modificato fino alla conferma nella pagina successiva.</p>
            </div>
          </form>
        </div>
      )}
    </section>
    </DatiVisti.Provider>
  )
}

// ---------- i campi ----------

function Campi({ bozza, cambia, conto, valuta }: { bozza: BozzaPdf; cambia: (k: CampoBozza, v: string) => void; conto: number | null; valuta: string }) {
  const { dati } = useFile()
  const nuovo = bozza.dalPdfInfo?.nuovo
  const t = bozza.testi
  const scelte = titoliDaScegliere(dati, bozza.tipo)
  const acquisto = bozza.tipo === 'acquisto'
  const giorno = leggiData(t.data)

  const campo = (k: CampoBozza, nome: string, opzioni: { aiuto?: ReactNode; data?: boolean; valore?: string; largo?: boolean } = {}) => (
    <label className={`campo${opzioni.largo ? ' largo' : ''}`}>
      <span className="testa">
        <span>{nome}</span>
        <Etichetta bozza={bozza} k={k} />
      </span>
      <input
        className={opzioni.data ? undefined : 'n'}
        inputMode={opzioni.data ? 'numeric' : 'decimal'}
        placeholder={opzioni.data ? 'gg/mm/aaaa' : undefined}
        value={opzioni.valore ?? t[k]}
        onChange={(e) => cambia(k, e.target.value)}
      />
      {opzioni.aiuto && <span className="aiuto">{opzioni.aiuto}</span>}
      {campoCambiato(bozza, k) && (
        <span className="aiuto">
          nel PDF: <s>{bozza.dalPdf![k]}</s>
        </span>
      )}
    </label>
  )

  const titolo = (
    <label className="campo largo">
      <span className="testa">
        <span>Titolo</span>
        <Etichetta bozza={bozza} k="titolo" />
      </span>
      <select value={t.titolo} onChange={(e) => cambia('titolo', e.target.value)}>
        <option value="">Selezionare…</option>
        {nuovo && <option value={NUOVO}>{`Titolo nuovo: ${nuovo.simbolo || nuovo.isin} (dal PDF)`}</option>}
        {scelte.map((s) => (
          <option key={s.titolo.id} value={s.titolo.id}>
            {[s.titolo.simbolo ?? s.titolo.nome, s.titolo.paroleSemplici ?? (s.titolo.simbolo ? s.titolo.nome : null), s.titolo.nomeBorsa, s.quote > 0 ? null : 'venduto']
              .filter(Boolean)
              .join(' · ')}
          </option>
        ))}
      </select>
      {bozza.tipo === 'vendita' && scelte.length === 0 && <span className="aiuto">Nessun titolo in portafoglio da vendere.</span>}
      {acquisto && !nuovo && <span className="aiuto">Un titolo non ancora presente si aggiunge registrandone l’acquisto dal PDF della banca.</span>}
    </label>
  )

  if (bozza.tipo === 'dividendo') {
    const lordo = leggiNumero(t.lordo)
    const imposte = leggiNumero(t.imposte)
    const q = t.titolo && giorno ? quoteAlGiorno(dati, t.titolo, giorno) : null
    return (
      <div className="campi">
        {titolo}
        {campo('data', 'Data', { data: true, aiuto: 'Data di accredito sul conto (nel documento: “valuta”).' })}
        <div className="campo">
          <span>Quote possedute alla data</span>
          <span className="fisso">{q === null ? '—' : quote(q)}</span>
          <span className="aiuto">{q === null ? 'Calcolate dopo la selezione di titolo e data.' : 'Calcolate dai movimenti registrati.'}</span>
        </div>
        {campo('lordo', 'Lordo (€)', { aiuto: 'Al lordo delle imposte.' })}
        {campo('imposte', 'Imposte trattenute (€)')}
        <div className="campo largo">
          <span>Netto accreditato</span>
          <span className="fisso">{lordo !== null && imposte !== null ? euro(lordo - imposte, 2) : '—'}</span>
          <span className="aiuto">Calcolato automaticamente: lordo meno imposte.</span>
        </div>
      </div>
    )
  }

  const estero = valuta !== 'EUR'
  return (
    <div className="campi">
      {titolo}
      {campo('data', 'Data', { data: true, aiuto: `Data di ${acquisto ? 'addebito' : 'accredito'} sul conto (nel documento: “valuta di regolamento”).` })}
      {campo('quantita', 'Quote')}
      {campo('prezzo', `Prezzo per quota (${estero ? valuta : '€'})`)}
      {estero && campo('cambio', `Cambio della banca (${valuta} per 1 €)`)}
      {campo('commissioni', 'Commissioni e spese (€)')}
      {campo('totale', acquisto ? 'Costo d’acquisto (€)' : 'Ricavo della vendita (€)', {
        largo: true,
        valore: bozza.totaleScritto || bozza.origine === 'pdf' ? t.totale : conto !== null ? numeroNellaCasella(conto, 2) : '',
        aiuto: 'Calcolato automaticamente da quote, prezzo e commissioni. Se il documento della banca riporta un importo diverso, inserire quello: prevale l’importo della banca.',
      })}
    </div>
  )
}

/** Accanto al campo: "dal PDF" se è come nel PDF, "manuale" se l'hai cambiato. Scritto a mano: niente. */
function Etichetta({ bozza, k }: { bozza: BozzaPdf; k: CampoBozza }) {
  if (bozza.origine !== 'pdf' || bozza.dalPdf?.[k] === undefined) return null
  if (campoCambiato(bozza, k)) return <ChipAMano />
  return (
    <span className="dalpdf">
      <span className="punto" />
      dal PDF
    </span>
  )
}

// ---------- in parole ----------

function useNome(id: string): { simbolo: string; parole: string | null } {
  const dati = useDati()
  const t = (dati.titoli ?? []).find((x) => x.id === id)
  return { simbolo: t ? (t.simbolo ?? t.nome) : id, parole: t?.paroleSemplici ?? null }
}

function Frase({ m, valuta: vt }: { m: NuovoMovimento; valuta: string }) {
  const dati = useDati()
  const { simbolo, parole } = useNome(m.titolo)
  const nome = (
    <>
      <b>{simbolo}</b>
      {parole ? ` (${parole})` : ''}
    </>
  )
  if (m.tipo === 'dividendo') {
    const q = quoteAlGiorno(dati, m.titolo, m.data)
    return (
      <p className="frase">
        Il <b>{data(m.data)}</b> {nome} ha pagato un dividendo: <b>{euro(m.lordo, 2)}</b> lordi, <b>{euro(m.imposte, 2)}</b> di imposte,{' '}
        <b>{euro(m.lordo - m.imposte, 2)}</b> netti accreditati.
        {q > 0 && ` Con ${quote(q)} quote possedute, ${prezzo(m.lordo / q, 'EUR')} lordi per quota; imposte pari al ${numero((m.imposte / m.lordo) * 100, 1)}%.`}
      </p>
    )
  }
  const alCambio = vt !== 'EUR' ? `, al cambio ${cambio(m.cambio)}` : ''
  if (m.tipo === 'acquisto')
    return (
      <p className="frase">
        Acquisto del <b>{data(m.data)}</b>: <b>{quote(m.quantita)} quote</b> di {nome} a <b>{prezzo(m.prezzo, vt)}</b> per quota{alCambio}. Costo d’acquisto:{' '}
        <b>{euro(m.totale, 2)}</b>, commissioni comprese ({euro(m.commissioni, 2)}).
      </p>
    )
  const sv = anteprimaVendita(dati, m)
  const g = sv?.guadagnoIncassato.n ?? 0
  return (
    <p className="frase">
      Vendita del <b>{data(m.data)}</b>: <b>{sv ? `${quote(m.quantita)} quote su ${quote(sv.quotePrima)}` : `${quote(m.quantita)} quote`}</b> di {nome} a{' '}
      <b>{prezzo(m.prezzo, vt)}</b> per quota{alCambio}. Ricavo della vendita: <b>{euro(m.totale, 2)}</b>, al netto delle commissioni ({euro(m.commissioni, 2)}).
      {sv && (
        <>
          {' '}
          {segno(g, 2) < 0 ? 'Minusvalenza realizzata' : 'Plusvalenza realizzata'}: <b className={classeSegno(segno(g, 2))}>{guadagnoEuro(g, 2)}</b>; il calcolo è riportato sotto.
        </>
      )}
    </p>
  )
}

function Riquadri({ m, valuta: v }: { m: NuovoMovimento; valuta: string }) {
  const numeri: [string, string][] =
    m.tipo === 'dividendo'
      ? [
          ['Lordo', euro(m.lordo, 2)],
          ['Imposte', euro(m.imposte, 2)],
          ['Netto accreditato', euro(m.lordo - m.imposte, 2)],
        ]
      : [
          ['Quote', quote(m.quantita)],
          ['Prezzo per quota', prezzo(m.prezzo, v)],
          [m.tipo === 'acquisto' ? 'Costo d’acquisto' : 'Ricavo della vendita', euro(m.totale, 2)],
        ]
  return (
    <div className="numeri">
      {numeri.map(([a, b]) => (
        <div key={a} className="numero">
          <small>{a}</small>
          <b>{b}</b>
        </div>
      ))}
    </div>
  )
}

/** Per una vendita: quote vendute su quante, costo medio e guadagno incassato, come nella Scheda del titolo. */
function SpiegaVendita({ m }: { m: NuovoMovimento }) {
  const dati = useDati()
  if (m.tipo !== 'vendita') return null
  const v = anteprimaVendita(dati, m)
  if (!v || v.quotePrima + 1e-9 < m.quantita) return null
  return (
    <div className="spiega">
      <p>
        {venditaInParole(v).map((p, i) =>
          typeof p === 'string' ? (
            p
          ) : (
            <b key={i} className={p.segno !== undefined ? classeSegno(Math.sign(p.segno)) : undefined}>
              {p.b}
            </b>
          ),
        )}
      </p>
    </div>
  )
}

/** Il totale della banca è il numero che conta: se il conto non torna, si dice (ma si può registrare lo stesso). */
function AvvisoConto({ totale, conto }: { totale: number; conto: number }) {
  const diff = totale - conto
  if (Math.abs(diff) <= 0.02) return null
  return (
    <div className="avviso-conto">
      <Icona nome="info" />
      <p>
        Il calcolo (quote × prezzo, ± commissioni) dà {euro(conto, 2)}, ma il totale indicato è {euro(totale, 2)} ({guadagnoEuro(diff, 2)}). Prevale il totale
        della banca: una differenza dovuta a ratei o ritenute è corretta; in caso di errore, correggere il dato.
      </p>
    </div>
  )
}
