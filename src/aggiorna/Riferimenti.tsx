// Riferimenti e inflazione nella schermata Aggiorna fine mese (ticket 9), come nella bozza 27: due riquadri
// in alto e, nella lista, i gruppi "Riferimenti" e "Inflazione", che possono aspettare. Quando manca un valore
// si legge "manca" con il perché e "Riprova"; il mese si salva lo stesso e si riprova al prossimo aggiornamento.
import { Fragment, useState, type ReactNode } from 'react'
import { fineMese, meseDopo, meseEAnno, nomeMese } from '../dati/aggiorna/calendario.ts'
import {
  DESCRIZIONE,
  elenco,
  finoAl,
  FONTE_RIFERIMENTO,
  inEuro,
  NOME_NIC,
  nicAgganciato,
  nicDelMese,
  nicFinoA,
  nicNonAncora,
  quandoEsceNic,
  riferimentiPronti,
  righeNic,
  storiaDellaRiga,
  sulMeseRiferimento,
  valoreDelMese,
  type ParteRiferimenti,
  type RigaNic,
  type RigaRiferimento,
} from '../dati/aggiorna/riferimenti.ts'
import { Icona } from '../icone.tsx'
import { useAggiorna } from './contesto.tsx'
import { cambio, euro, giorno, percentuale, prezzo, simboloValuta } from './numeri.ts'

/** La prima lettera maiuscola, ma non nei nomi dei siti: "investing.com non ha risposto". */
const Maiuscola = (t: string) => (!t || t.startsWith('investing') ? t : t[0].toUpperCase() + t.slice(1))

function Fonte({ fonte, nota }: { fonte: string; nota?: string }) {
  return (
    <>
      <span className={`agg-fonte ${fonte === FONTE_RIFERIMENTO.aMano ? 'riserva' : 'borsa'}`}>
        <span className="punto" />
        {fonte}
      </span>
      {nota && <span className="agg-sotto">{Maiuscola(nota)}</span>}
    </>
  )
}

function InArrivo({ attesa }: { attesa: boolean }) {
  return attesa ? (
    <span className="tenue">in attesa</span>
  ) : (
    <span className="tenue">
      <span className="agg-gira" aria-hidden="true" /> in arrivo…
    </span>
  )
}

function Pronto() {
  return (
    <span className="agg-ok" title="Pronto">
      <Icona nome="ok" piccola />
    </span>
  )
}

/** I due riquadri in alto: "Riferimenti 5 di 6, possono aspettare" e "Inflazione fino a settembre". */
export function RiquadriRiferimenti({ p }: { p: ParteRiferimenti }) {
  const pronti = riferimentiPronti(p)
  const inCorso = p.righe.some((r) => r.stato.tipo === 'attesa' || r.stato.tipo === 'scarica')
  const nicInCorso = p.nic.stato.tipo === 'attesa' || p.nic.stato.tipo === 'scarica'
  const finoA = nicFinoA(p.nic)
  const nonAncora = nicNonAncora(p.nic)
  return (
    <>
      <div className="numero">
        <small>Riferimenti</small>
        <b>
          {pronti} di {p.righe.length}
        </b>
        <span>{inCorso ? 'in arrivo, possono aspettare' : pronti < p.righe.length ? 'gli altri si riprovano dopo' : 'tutti arrivati'}</span>
      </div>
      <div className="numero">
        <small>Inflazione</small>
        <b>{nicInCorso && !finoA ? '…' : finoA ? finoAl(finoA) : 'manca'}</b>
        <span>
          {nicInCorso
            ? 'in arrivo da ISTAT'
            : p.nic.stato.tipo === 'manca'
              ? 'ISTAT non ha risposto'
              : nonAncora.includes(p.mese)
                ? `${nomeMese(p.mese)} esce ${quandoEsceNic(p.mese)}`
                : p.nic.stato.tipo === 'arrivato'
                  ? 'arrivata da ISTAT'
                  : 'può aspettare'}
        </span>
      </div>
    </>
  )
}

/** I gruppi "Riferimenti" e "Inflazione" della lista. colonne = quante colonne ha la tabella. */
export function RigheRiferimenti({ p, colonne }: { p: ParteRiferimenti; colonne: number }) {
  const [aperta, setAperta] = useState<string | null>(null)
  const nic = righeNic(p)
  return (
    <>
      <tr className="agg-gruppo">
        <td colSpan={colonne}>
          Riferimenti <span className="tenue">· possono aspettare</span>
          {p.primaVolta && p.dal && <span className="tenue"> · con la storia da {meseEAnno(p.dal)}</span>}
        </td>
      </tr>
      {p.righe.map((r) => (
        <Fragment key={r.id}>
          <RigaDelRiferimento p={p} r={r} colonne={colonne} aperta={aperta === r.id} apri={() => setAperta(aperta === r.id ? null : r.id)} />
          {aperta === r.id && <DettaglioRiferimento p={p} r={r} colonne={colonne} />}
        </Fragment>
      ))}
      <tr className="agg-gruppo">
        <td colSpan={colonne}>
          Inflazione <span className="tenue">· può aspettare</span>
        </td>
      </tr>
      {nic.map((riga, i) => (
        <RigaDelNic key={riga.tipo === 'mese' ? riga.mese : 'storia'} p={p} riga={riga} colonne={colonne} primaRiga={i === 0} />
      ))}
    </>
  )
}

/**
 * Le celle tra "Da dove viene" e lo stato: il controllo di investing.com, che per riferimenti e inflazione
 * non c'è ("—"), e con "Rifai" la colonna "Prima".
 */
function Mezzo({ colonne, children }: { colonne: number; children?: ReactNode }) {
  const n = colonne - 6
  if (n <= 0) return null
  if (n === 1) return <td className="tenue">—</td>
  return (
    <>
      <td className="tenue">—</td>
      <td colSpan={n - 1}>{children}</td>
    </>
  )
}

function NomeRiga({ nome, sotto }: { nome: string; sotto: string }) {
  return (
    <td>
      <div className="agg-tit">
        <b>{nome}</b>
        <span>{sotto}</span>
      </div>
    </td>
  )
}

function RigaDelRiferimento({
  p,
  r,
  colonne,
  aperta,
  apri,
}: {
  p: ParteRiferimenti
  r: RigaRiferimento
  colonne: number
  aperta: boolean
  apri: () => void
}) {
  const { riprovaRiferimento } = useAggiorna()
  const d = DESCRIZIONE[r.id]
  const v = valoreDelMese(p, r)
  const nome = <NomeRiga nome={d.nome} sotto={d.breve} />
  if (!v && (r.stato.tipo === 'attesa' || r.stato.tipo === 'scarica'))
    return (
      <tr>
        {nome}
        <td />
        <td colSpan={colonne - 2}>
          <InArrivo attesa={r.stato.tipo === 'attesa'} />
        </td>
      </tr>
    )
  if (!v) {
    const perche =
      r.stato.tipo === 'manca'
        ? r.stato.perche
        : r.stato.tipo === 'arrivato'
          ? `investing.com non ha il valore di fine ${nomeMese(p.mese)}`
          : ''
    return (
      <tr className="agg-manca">
        {nome}
        <td />
        <td className="n tenue">manca</td>
        <td />
        <td colSpan={colonne - 5}>
          <span className="agg-sotto">
            {Maiuscola(perche)}. Può aspettare: il mese si salva lo stesso e si riprova al prossimo aggiornamento.
          </span>
        </td>
        <td className="n">
          <button type="button" className="btn" onClick={() => riprovaRiferimento(r.id)}>
            <Icona nome="aggiorna" piccola /> Riprova
          </button>
        </td>
      </tr>
    )
  }
  const sm = sulMeseRiferimento(p, r)
  const storia = storiaDellaRiga(p, r)
  const prima = r.prima && r.date.includes(fineMese(p.mese)) ? r.prima : undefined
  return (
    <tr>
      {nome}
      <td />
      <td className="n">
        <button type="button" className="agg-num" aria-expanded={aperta} onClick={apri}>
          {prezzo(v.valore)} {simboloValuta(d.valuta)}
        </button>
      </td>
      <td className={`n ${sm === null ? '' : sm >= 0 ? 'agg-su' : 'agg-giu'}`}>{sm === null ? '' : percentuale(sm)}</td>
      <td>
        {v.fonte === FONTE_RIFERIMENTO.aMano ? (
          <Fonte fonte={v.fonte} nota="corretto a mano: resta com’era" />
        ) : r.stato.tipo === 'manca' ? (
          <Fonte fonte={v.fonte} nota={`non riscaricato (${r.stato.perche}): resta quello di prima`} />
        ) : (
          <Fonte fonte={v.fonte} nota={v.nota} />
        )}
        {storia.arrivate > 0 && (
          <span className="agg-sotto">
            con la storia: {storia.arrivate} {storia.arrivate === 1 ? 'data' : 'date'}
            {storia.mancano.length ? `, ne mancano ${storia.mancano.length}` : ''}
          </span>
        )}
      </td>
      <Mezzo colonne={colonne}>
        {prima &&
          (Math.abs(prima.valore - v.valore) < 0.005 ? (
            <span className="agg-uguale">
              <Icona nome="ok" piccola /> uguale
            </span>
          ) : (
            <b>
              <s className="tenue">{prezzo(prima.valore)}</s> → {prezzo(v.valore)}
            </b>
          ))}
      </Mezzo>
      <td className="n">
        {r.stato.tipo === 'manca' ? (
          <button type="button" className="btn" onClick={() => riprovaRiferimento(r.id)}>
            <Icona nome="aggiorna" piccola /> Riprova
          </button>
        ) : (
          <Pronto />
        )}
      </td>
    </tr>
  )
}

function DettaglioRiferimento({ p, r, colonne }: { p: ParteRiferimenti; r: RigaRiferimento; colonne: number }) {
  const d = DESCRIZIONE[r.id]
  const v = valoreDelMese(p, r)
  const storia = storiaDellaRiga(p, r)
  const euroDelMese = v ? inEuro(v, d.valuta) : null
  return (
    <tr className="agg-dettaglio">
      <td colSpan={colonne}>
        <div className="agg-dettaglio-corpo">
          <div>
            <p>
              <b>{d.nome}</b>: {d.cosa}. Si confronta con gli stessi euro, nelle stesse date dei tuoi movimenti.
            </p>
            {v && (
              <p>
                Chiusura {v.seduta ? <>del <b>{giorno(v.seduta)}</b> </> : ''}da <b>{v.fonte}</b>.
              </p>
            )}
            {storia.arrivate > 0 && (
              <p>
                Insieme al valore di fine {nomeMese(p.mese)} sono arrivate {storia.arrivate} date della storia: le fine mese
                {p.dal ? ` da ${meseEAnno(p.dal)}` : ''} e le date dei movimenti.
                {storia.mancano.length > 0 && ` Mancano ancora: ${elenco(storia.mancano.slice(0, 6).map(giorno))}${storia.mancano.length > 6 ? '…' : ''}.`}
              </p>
            )}
          </div>
          {v && d.valuta !== 'EUR' && (
            <div className="agg-conto">
              <div>
                <span>Valore in dollari</span>
                <span>{prezzo(v.valore)} $</span>
              </div>
              <div>
                <span>÷ cambio BCE dello stesso giorno</span>
                <span>{v.cambio ? cambio(v.cambio) : 'manca'}</span>
              </div>
              <div>
                <span>In euro</span>
                <span>{euroDelMese !== null ? euro(euroDelMese) : '…'}</span>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

function RigaDelNic({ p, riga, colonne, primaRiga }: { p: ParteRiferimenti; riga: RigaNic; colonne: number; primaRiga: boolean }) {
  const { riprovaNic } = useAggiorna()
  const n = p.nic
  if (riga.tipo === 'storia') {
    const arrivati = n.stato.tipo === 'arrivato' ? n.stato.esito.valori.filter((v) => v.data < fineMese(meseDopo(riga.a))).length : 0
    const nome = <NomeRiga nome={NOME_NIC} sotto={`storia da ${meseEAnno(riga.da)} ${nomeMese(riga.a).startsWith('a') ? 'ad' : 'a'} ${meseEAnno(riga.a)}`} />
    if (n.stato.tipo === 'attesa' || n.stato.tipo === 'scarica')
      return (
        <tr>
          {nome}
          <td>ISTAT</td>
          <td colSpan={colonne - 2}>
            <InArrivo attesa={n.stato.tipo === 'attesa'} />
          </td>
        </tr>
      )
    if (n.stato.tipo === 'manca') return <RigaNicManca nome={nome} perche={n.stato.perche} colonne={colonne} riprova={primaRiga ? riprovaNic : undefined} />
    return (
      <tr>
        {nome}
        <td>ISTAT</td>
        <td className="n">
          {arrivati} {arrivati === 1 ? 'mese' : 'mesi'}
        </td>
        <td />
        <td>
          <Fonte fonte="ISTAT" nota={arrivati < riga.mesi ? `ne mancano ${riga.mesi - arrivati}: si riprendono dopo` : 'storia completa'} />
        </td>
        <Mezzo colonne={colonne} />
        <td className="n">
          <Pronto />
        </td>
      </tr>
    )
  }
  const mese = riga.mese
  const nome = <NomeRiga nome={NOME_NIC} sotto={meseEAnno(mese)} />
  const chiesto = n.mesi.includes(mese)
  const v = nicDelMese(n, mese)
  if (chiesto && (n.stato.tipo === 'attesa' || n.stato.tipo === 'scarica'))
    return (
      <tr>
        {nome}
        <td>ISTAT</td>
        <td colSpan={colonne - 2}>
          <InArrivo attesa={n.stato.tipo === 'attesa'} />
        </td>
      </tr>
    )
  if (chiesto && n.stato.tipo === 'manca')
    return <RigaNicManca nome={nome} perche={n.stato.perche} colonne={colonne} riprova={primaRiga ? riprovaNic : undefined} />
  if (!v) {
    const prima = meseDopo(mese, -1)
    return (
      <tr>
        {nome}
        <td>ISTAT</td>
        <td className="n tenue">non ancora</td>
        <td />
        <td colSpan={colonne - 5} className="tenue">
          <span className="agg-sotto">
            ISTAT lo pubblica {quandoEsceNic(mese)}. Il confronto arriva {finoAl(prima)}; {nomeMese(mese)} si prende al prossimo
            aggiornamento.
          </span>
        </td>
        <td />
      </tr>
    )
  }
  const agganciato = nicAgganciato([
    ...n.nelFile,
    ...(n.stato.tipo === 'arrivato' ? n.stato.esito.valori.map((x) => ({ ...x, fonte: 'ISTAT' })) : []),
  ])
  const ora = agganciato.get(mese)
  const precedente = agganciato.get(meseDopo(mese, -1))
  const sm = ora !== undefined && precedente !== undefined ? (ora / precedente - 1) * 100 : null
  return (
    <tr>
      {nome}
      <td>ISTAT</td>
      <td className="n">
        {v.valore.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        <span className="agg-sotto">base {v.base} = 100</span>
      </td>
      <td className="n tenue">{sm === null ? '' : percentuale(sm)}</td>
      <td>
        <Fonte fonte={v.fonte} nota={riga.mancava ? 'mancava dall’aggiornamento scorso' : v.nota} />
      </td>
      <Mezzo colonne={colonne} />
      <td className="n">
        <Pronto />
      </td>
    </tr>
  )
}

function RigaNicManca({ nome, perche, colonne, riprova }: { nome: ReactNode; perche: string; colonne: number; riprova?: () => void }) {
  return (
    <tr className="agg-manca">
      {nome}
      <td>ISTAT</td>
      <td className="n tenue">manca</td>
      <td />
      <td colSpan={colonne - 5}>
        <span className="agg-sotto">{Maiuscola(perche)}. Può aspettare: si riprende al prossimo aggiornamento.</span>
      </td>
      <td className="n">
        {riprova && (
          <button type="button" className="btn" onClick={riprova}>
            <Icona nome="aggiorna" piccola /> Riprova
          </button>
        )}
      </td>
    </tr>
  )
}
