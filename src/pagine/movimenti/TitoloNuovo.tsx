// Il riquadro "Titolo nuovo" (mappa, ticket 26; costruzione, ticket 12): sotto la frase, quando il PDF
// è l'acquisto di un titolo che non è ancora nel file. ISIN, simbolo e borsa arrivano dal PDF (la borsa si sceglie
// se il PDF dice "fuori mercato"); "Descrizione in parole semplici" è obbligatoria. Il codice investing.com lo cerca
// l'applicazione dall'ISIN, sulla borsa del titolo, e mostra cosa ha trovato con "Non è questo"; se non lo trova
// lo dice, con la casella per incollare l'indirizzo della pagina. Il codice Yahoo si cerca insieme.
import { useEffect, useRef, useState } from 'react'
import { data, prezzo } from '../../formato.ts'
import { Icona } from '../../icone.tsx'
import { ponte } from '../../ponte.ts'
import { BORSE, type Borsa } from '../../dati/tipi.ts'
import { NOMI_BORSE, eBorsa, type CodiciTrovati } from '../../dati/titolo-nuovo.ts'
import type { TitoloNuovoDelPdf } from './dal-pdf.ts'

/**
 * Il riquadro. La ricerca e il suo esito stanno nella bozza ("ricerca"), non qui: tornando dai campi alla frase
 * il riquadro si ridisegna senza cercare di nuovo. Si cerca una volta per ISIN e borsa, o con "Cerca di nuovo".
 */
export function TitoloNuovo({ nuovo, cambia }: { nuovo: TitoloNuovoDelPdf; cambia: (n: Partial<TitoloNuovoDelPdf>) => void }) {
  const [indirizzo, setIndirizzo] = useState('')
  const borsa = nuovo.borsa
  const chiave = `${nuovo.isin}-${borsa ?? ''}`
  const ricerca = nuovo.ricerca?.chiave === chiave ? nuovo.ricerca : null
  const inCorso = useRef<string | null>(null)

  const cerca = async (conIndirizzo?: string) => {
    if (!borsa) return
    inCorso.current = chiave
    cambia({ ricerca: { chiave, trovati: null, indice: 0 } })
    const trovati = await ponte
      .cercaCodici({ isin: nuovo.isin, borsa, simbolo: nuovo.simbolo, valuta: nuovo.valuta, ...(conIndirizzo ? { indirizzo: conIndirizzo } : {}) })
      .catch((): CodiciTrovati => ({ investing: [], perche: 'la ricerca non è riuscita', yahoo: null }))
    // Se intanto è cambiata la borsa, questa risposta non serve più.
    if (inCorso.current !== chiave) return
    inCorso.current = null
    const primo = trovati.investing[0]
    cambia({
      ricerca: { chiave, trovati, indice: 0 },
      codiceInvesting: primo?.codice,
      nome: primo?.nome || undefined,
      ...(trovati.yahoo ? { codiceYahoo: trovati.yahoo } : {}),
    })
  }

  // La ricerca parte da sola appena si sa la borsa (dal PDF, o scelta): una volta per ISIN e borsa.
  useEffect(() => {
    if (borsa && !ricerca && inCorso.current !== chiave) void cerca()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave])

  const nonELui = () => {
    if (!ricerca?.trovati) return
    const indice = ricerca.indice + 1
    const l = ricerca.trovati.investing[indice]
    cambia({ ricerca: { ...ricerca, indice }, codiceInvesting: l?.codice, nome: l?.nome || undefined })
  }

  const linea = ricerca?.trovati ? ricerca.trovati.investing[ricerca.indice] : undefined
  const valuta = nuovo.valuta

  return (
    <div className="titolo-nuovo">
      <h3>Titolo nuovo</h3>
      <p className="nota-scrittura">{nuovo.simbolo || nuovo.isin} non è ancora presente: sarà aggiunto insieme a questo acquisto.</p>
      <div className="campi">
        <div className="campo">
          <span className="testa">
            <span>ISIN</span>
            <DalPdf />
          </span>
          <span className="fisso">{nuovo.isin}</span>
        </div>
        <label className="campo">
          <span className="testa">
            <span>Simbolo</span>
            {nuovo.simbolo ? null : <span className="dalpdf">da inserire</span>}
          </span>
          <input value={nuovo.simbolo} placeholder="es. VWCE" onChange={(e) => cambia({ simbolo: e.target.value })} />
        </label>
        <label className="campo largo">
          <span className="testa">
            <span>Descrizione in parole semplici</span>
            <span className="dalpdf">obbligatorio</span>
          </span>
          <input
            value={nuovo.parole}
            placeholder="es. Azioni di tutto il mondo"
            aria-invalid={!nuovo.parole.trim() || undefined}
            onChange={(e) => cambia({ parole: e.target.value })}
          />
          <span className="aiuto">
            Compare sotto il simbolo in tutte le pagine. Denominazione della banca: “{nuovo.descrizioneBanca || '…'}”.
          </span>
        </label>
        <label className="campo largo">
          <span className="testa">
            <span>Borsa di quotazione</span>
            {!nuovo.fuoriMercato && borsa ? <DalPdf /> : null}
          </span>
          <select value={borsa ?? ''} onChange={(e) => cambia({ borsa: eBorsa(e.target.value) ? (e.target.value as Borsa) : null })}>
            <option value="">Selezionare…</option>
            {BORSE.map((b) => (
              <option key={b} value={b}>
                {NOMI_BORSE[b]}
              </option>
            ))}
          </select>
          <span className="aiuto">
            {nuovo.fuoriMercato
              ? `Il PDF indica “${nuovo.mercato}” e non specifica la borsa: selezionare quella da cui prendere il prezzo di fine mese.`
              : 'Da questa borsa si prende il prezzo di fine mese.'}
          </span>
        </label>
      </div>

      <div className="investing" aria-live="polite">
        {!borsa ? (
          <p className="nota-scrittura">Selezionata la borsa, il titolo viene cercato su investing.com.</p>
        ) : !ricerca?.trovati ? (
          <p className="nota-scrittura">Ricerca di {nuovo.isin} su investing.com in corso…</p>
        ) : linea ? (
          <>
            <div className="trovato">
              <div>
                <b>{linea.nome || `Linea ${linea.codice}`}</b> su investing.com
                <span className="sotto">
                  {[linea.simbolo, linea.borsa, linea.prezzo !== null && linea.seduta ? `chiusura del ${data(linea.seduta)}: ${prezzo(linea.prezzo, valuta)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <span className="dalpdf">
                <Icona nome="ok" piccola /> trovato
              </span>
            </div>
            <p className="nota-scrittura">Serve a controllare il prezzo di fine mese della borsa e come fonte di riserva se la borsa non lo fornisce.</p>
            <div className="bottoni">
              <button type="button" className="btn piccolo" onClick={nonELui}>
                Non è questo
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              {ricerca.indice > 0 ? 'Non risultano altre linee di questo titolo su investing.com' : `Titolo non trovato su investing.com${ricerca.trovati.perche ? ` (${ricerca.trovati.perche})` : ''}`}. Il prezzo
              di fine mese sarà preso solo dalla borsa, senza controllo e senza la fonte di riserva investing.com.
            </p>
            <label className="campo">
              In alternativa, incollare l’indirizzo della pagina del titolo su investing.com (facoltativo)
              <input value={indirizzo} placeholder="https://it.investing.com/etfs/…" onChange={(e) => setIndirizzo(e.target.value)} />
            </label>
            <div className="bottoni">
              <button type="button" className="btn piccolo" onClick={() => void cerca(indirizzo.trim() || undefined)}>
                <Icona nome="aggiorna" piccola />
                Cerca di nuovo
              </button>
            </div>
          </>
        )}
      </div>

      <label className="campo">
        <span className="testa">
          <span>Codice Yahoo (seconda riserva, facoltativo)</span>
          {ricerca?.trovati?.yahoo && nuovo.codiceYahoo === ricerca.trovati.yahoo ? <span className="dalpdf">trovato</span> : null}
        </span>
        <input value={nuovo.codiceYahoo ?? ''} placeholder="es. VWCE.MI" onChange={(e) => cambia({ codiceYahoo: e.target.value })} />
        <span className="aiuto">
          {ricerca?.trovati && !ricerca.trovati.yahoo
            ? 'Titolo non trovato su Yahoo: senza codice, se la borsa e investing.com non forniscono il prezzo, va inserito manualmente.'
            : 'Se la borsa e investing.com non forniscono il prezzo di fine mese, si usa questo codice.'}
        </span>
      </label>
    </div>
  )
}

function DalPdf() {
  return (
    <span className="dalpdf">
      <span className="punto" />
      dal PDF
    </span>
  )
}
