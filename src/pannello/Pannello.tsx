// Il pannello "Da dove viene": si apre da destra al clic su un numero e lo spiega in parole,
// con il conto riga per riga e la fonte (DESIGN.md, "componente firma"). Se il numero viene da un
// prezzo di fine mese, sotto c'è la correzione a mano (ticket 8, CorreggiPrezzo.tsx); se è il confronto con un
// riferimento, il conto movimento per movimento e il valore di fine mese con "Scarica di nuovo" (ticket 10).
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { spiegazioneDelMovimento } from '../conti/movimenti.ts'
import { spiegazioneDelPrezzo } from '../conti/prezzo-a-mano.ts'
import { spiegazioneDelConfronto } from '../conti/riferimenti.ts'
import type { Numero, Spiegazione } from '../conti/spiegazione.ts'
import { cifra, segnoCifra } from '../formato.ts'
import { Icona } from '../icone.tsx'
import { useStato } from '../stato.tsx'
import { CorreggiDato } from './CorreggiDato.tsx'
import { Avviso } from './Avviso.tsx'
import { CorreggiMovimento } from './CorreggiMovimento.tsx'
import { CorreggiPrezzo } from './CorreggiPrezzo.tsx'
import { ValoreDelRiferimento } from './ValoreDelRiferimento.tsx'
import { PannelloExcel } from '../pagine/dati/ScaricaInExcel.tsx'
import { classeSegno, Contesto, useSpiega } from './spiega.ts'

export function ConPannello({ children }: { children: ReactNode }) {
  const [aperta, setAperta] = useState<Spiegazione | null>(null)
  // L'ultima spiegazione resta dentro il pannello mentre si chiude, così scorre via piena.
  const [mostrata, setMostrata] = useState<Spiegazione | null>(null)
  const da = useRef<HTMLElement | SVGElement | null>(null)
  const chiudiBtn = useRef<HTMLButtonElement>(null)
  const idTitolo = useId()
  // Ogni apertura ricomincia la correzione da capo (campo vuoto, niente conferma in sospeso).
  const [volta, setVolta] = useState(0)
  const { apertura } = useStato()

  const apri = useCallback((s: Spiegazione) => {
    // Anche un grafico (SVG) che ha il focus: chiuso il pannello, il focus torna lì.
    const ora = document.activeElement
    if ((ora instanceof HTMLElement || ora instanceof SVGElement) && !ora.closest('.cassetto')) da.current = ora
    setAperta(s)
    setMostrata(s)
    setVolta((v) => v + 1)
  }, [])

  // Dopo una correzione il file è cambiato: il pannello aperto mostra subito il prezzo com'è adesso.
  const dati = apertura.stato === 'pronto' ? apertura.dati : null
  const [datiVisti, setDatiVisti] = useState(dati)
  if (dati !== datiVisti) {
    setDatiVisti(dati)
    const rif = aperta?.correggi
    // Chi sa rifare la sua spiegazione (pagina Dati, ticket 13) la rifà; poi il prezzo (ticket 8) e il confronto (ticket 10).
    const nuova = !dati
      ? null
      : aperta?.rifai
        ? aperta.rifai(dati)
        : rif
          ? spiegazioneDelPrezzo(dati, rif)
          : aperta?.riferimento
            ? spiegazioneDelConfronto(dati, aperta)
            : null
    if (nuova) {
      setAperta(nuova)
      setMostrata(nuova)
    }
    // Un movimento corretto si rifà; uno tolto non c'è più e il pannello si chiude (il messaggio va in basso).
    const mov = aperta?.movimento
    if (mov && dati) {
      const rifatta = spiegazioneDelMovimento(dati, mov)
      if (rifatta) {
        setAperta(rifatta)
        setMostrata(rifatta)
      } else setAperta(null)
    }
  }
  const chiudi = useCallback(() => setAperta(null), [])

  // Il focus va sul tasto Chiudi solo quando il pannello si apre (o mostra un altro numero), non quando la spiegazione
  // si rifà dopo una correzione: lì resta nel corpo che scorre, sul messaggio "Corretto" (collaudo del 19/10, punto 11).
  const aperto = !!aperta
  useEffect(() => {
    // Chiuso il pannello, il focus torna al numero da cui si era aperto: dopo il disegno, quando la pagina non è più inerte.
    if (!aperto) {
      da.current?.focus()
      da.current = null
      return
    }
    chiudiBtn.current?.focus()
    const tasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') chiudi()
    }
    document.addEventListener('keydown', tasto)
    return () => document.removeEventListener('keydown', tasto)
  }, [aperto, volta, chiudi])

  const s = mostrata
  return (
    <Contesto.Provider value={apri}>
      {/* Con il pannello aperto la pagina dietro non si raggiunge con la tastiera: Tab resta nel pannello. */}
      <div className="sotto-pannello" inert={!!aperta}>
        {children}
      </div>
      <div className={`velo${aperta ? ' aperto' : ''}`} onClick={chiudi} aria-hidden="true" />
      <aside className={`cassetto${aperta ? ' aperto' : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitolo} inert={!aperta}>
        {s && (
          <>
            <header>
              <b id={idTitolo}>{s.titolo}</b>
              <button ref={chiudiBtn} type="button" className="btn solo-icona" aria-label="Chiudi" onClick={chiudi}>
                <Icona nome="x" piccola />
              </button>
            </header>
            <div className="corpo">
              <div className={`grande ${classeSegno(segnoCifra(s.grande))}`}>
                {cifra(s.grande)}
                {s.dopo && <span className="dopo"> {s.dopo}</span>}
              </div>
              {s.frase && <p>{s.frase}</p>}
              {s.conto.length > 0 && (
                <div className="conto">
                  {s.conto.map((r, i) => (
                    <div key={i}>
                      <span>{r.etichetta}</span>
                      <span className={classeSegno(segnoCifra(r.cifra))}>{cifra(r.cifra)}</span>
                    </div>
                  ))}
                </div>
              )}
              {s.passi && (
                <>
                  <h3 className="passi">{s.passi.titolo}</h3>
                  <div className="conto">
                    {s.passi.righe.map((r, i) => (
                      <div key={i}>
                        <span>{r.etichetta}</span>
                        <span className={classeSegno(segnoCifra(r.cifra))}>{cifra(r.cifra)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {s.note.map((n, i) => (
                <p key={i} className="tenue piccolo">
                  {n}
                </p>
              ))}
              {s.correggi && <CorreggiPrezzo key={`${volta}|${s.correggi.titolo}|${s.correggi.data}`} rif={s.correggi} />}
              {s.correggiDato && <CorreggiDato key={`${volta}|${JSON.stringify(s.correggiDato)}`} dato={s.correggiDato} />}
              {s.riferimento && <ValoreDelRiferimento key={`${volta}|${s.riferimento.id}|${s.riferimento.data}`} rif={s.riferimento} />}
              {s.movimento && <CorreggiMovimento key={`${volta}|${s.movimento}`} id={s.movimento} />}
              {s.excel && <PannelloExcel key={volta} />}
            </div>
          </>
        )}
      </aside>
      <Avviso />
    </Contesto.Provider>
  )
}

/** Un numero che sembra testo ed è un bottone: il clic apre "Da dove viene" (e non apre la riga). */
export function Num({ numero, children, className }: { numero: Numero; children: ReactNode; className?: string }) {
  const spiega = useSpiega()
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={`num${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        spiega(numero.perche)
      }}
    >
      {children}
    </button>
  )
}
