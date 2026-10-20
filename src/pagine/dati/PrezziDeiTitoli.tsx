// La scheda "Prezzi dei titoli" della pagina Dati (ticket 13, mappa 27): si sceglie il fine mese; una riga
// per titolo con la borsa di quotazione, il prezzo con la fonte sotto, il controllo di investing.com e il
// codice investing.com. In alto il conto delle fonti. Il clic sul prezzo apre la provenienza, con la
// correzione a mano (ticket 8).
import { contaFonti, fraseFonti, righePrezzi, spiegaPrezzo, type RigaPrezzo } from '../../conti/pagina-dati.ts'
import { differenza } from '../../aggiorna/numeri.ts'
import { senzaCodice } from '../../dati/aggiorna/controllo-prezzo.ts'
import { fonteInParole, NOME_FILE_EXCEL } from '../../conti/fonti.ts'
import type { FileDati } from '../../dati/tipi.ts'
import { cambio, mese, prezzo } from '../../formato.ts'
import { Icona } from '../../icone.tsx'
import { ChipAMano } from '../../pannello/AMano.tsx'
import { useSpiega } from '../../pannello/spiega.ts'

const maiuscola = (t: string) => t[0].toUpperCase() + t.slice(1)

function Controllo({ r, apri }: { r: RigaPrezzo; apri: () => void }) {
  const c = r.controllo
  if (!c)
    return <span className="tenue piccolo">{r.fonte.nome === NOME_FILE_EXCEL ? '— non previsto per i mesi importati da Excel' : '—'}</span>
  // Senza il codice il perché è lo stesso per tutti: lo dice una volta sola il riquadro "Cerca i codici investing.com".
  if (senzaCodice(c)) return <span className="tenue piccolo">{r.codiceInvesting ? '— non eseguito: mancava il codice' : '— manca il codice'}</span>
  if (c.tipo === 'non-fatto') return <span className="dati-sotto">non eseguito: {c.perche}</span>
  const nota = c.nota ? <span className="dati-sotto">{maiuscola(c.nota)}</span> : null
  if (c.tipo === 'uguale')
    return (
      <span>
        <span className="dati-uguale">
          <Icona nome="ok" piccola /> uguale
        </span>
        {nota}
      </span>
    )
  return (
    <span>
      <button type="button" className="num dati-diverso" aria-haspopup="dialog" onClick={apri}>
        {prezzo(c.controllo, r.prezzo.valuta).replace(/ \S+$/, '')}: differenza di {differenza(c.differenza)}
      </button>
      {nota}
    </span>
  )
}

function Fonte({ r }: { r: RigaPrezzo }) {
  const p = r.prezzo
  if (r.aMano)
    return (
      <span>
        <ChipAMano lungo={!!p.prima} />
        {p.prima && (
          <span className="dati-sotto">
            prima <s>{prezzo(p.prima.prezzo, p.valuta)}</s>, {fonteInParole(p.prima.fonte).nome}
          </span>
        )}
      </span>
    )
  return (
    <span>
      <span className={`dati-fonte${r.fonte.borsa ? ' borsa' : /riserva/i.test(r.fonte.nome) ? ' riserva' : ''}`}>
        <span className="punto" aria-hidden="true" />
        {r.fonte.nome}
      </span>
      {r.perche && <span className="dati-sotto">{r.perche}</span>}
    </span>
  )
}

export function PrezziDeiTitoli({ dati, mesi, scelto, scegli }: { dati: FileDati; mesi: string[]; scelto: string; scegli: (data: string) => void }) {
  const spiega = useSpiega()
  if (!mesi.length) return <div className="vuoto">Nessun prezzo di fine mese: i prezzi si scaricano con il primo Aggiorna fine mese.</div>
  const righe = righePrezzi(dati, scelto)
  const apri = (r: RigaPrezzo) => {
    const s = spiegaPrezzo(dati, { titolo: r.titolo, data: r.prezzo.data })
    if (s) spiega(s)
  }
  return (
    <>
      <div className="attrezzi">
        <span>
          <b>{righe.length} prezzi</b> di fine {mese(scelto)}: {fraseFonti(contaFonti(righe))}.
        </span>
        <label className="dati-scegli">
          Fine mese
          <select value={scelto} onChange={(e) => scegli(e.target.value)}>
            {mesi.map((m) => (
              <option key={m} value={m}>
                {mese(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="scorre">
        <table className="dati-prezzi">
          <thead>
            <tr>
              <th>Titolo</th>
              <th>Borsa di quotazione</th>
              <th className="n">Prezzo</th>
              <th>Provenienza</th>
              <th>Controllo investing.com</th>
              <th>Codice investing.com</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.titolo}>
                <td>
                  <div className="tit">
                    <b>{r.nome}</b>
                    {r.sotto && <span>{r.sotto}</span>}
                  </div>
                </td>
                <td>{r.borsa}</td>
                <td className="n">
                  <button type="button" className="num" aria-haspopup="dialog" onClick={() => apri(r)}>
                    {prezzo(r.prezzo.prezzo, r.prezzo.valuta)}
                  </button>
                  {r.prezzo.valuta !== 'EUR' && r.prezzo.cambio && <span className="sotto">cambio {cambio(r.prezzo.cambio)}</span>}
                </td>
                <td>
                  <Fonte r={r} />
                </td>
                <td>
                  <Controllo r={r} apri={() => apri(r)} />
                </td>
                <td>{r.codiceInvesting ? <span className="tenue">{r.codiceInvesting}</span> : <span className="tenue">nessuno</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota dati-nota">
        Selezionare un prezzo per vederne la provenienza e, se errato, correggerlo manualmente. I mesi importati dal file Excel non hanno il
        controllo di investing.com, che si esegue sui prezzi scaricati con Aggiorna fine mese.
      </p>
    </>
  )
}
