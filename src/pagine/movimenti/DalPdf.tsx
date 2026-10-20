// Registra dal PDF (ticket 12): la zona dove trascinare o scegliere il PDF della banca, e i riquadri
// che accompagnano la frase quando il movimento viene da un PDF: da dove è letto con "Guarda il PDF",
// i pezzi dello stesso ordine sommati, gli avvisi, e il rifiuto di un PDF già registrato con "Apri quel movimento".
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { spiegazioneDelMovimento } from '../../conti/movimenti.ts'
import { movimentoInParole, quoteAlGiorno, trovaMovimento } from '../../dati/movimenti.ts'
import { euro, prezzo, quote } from '../../formato.ts'
import { Icona } from '../../icone.tsx'
import { useSpiega } from '../../pannello/spiega.ts'
import { ponte } from '../../ponte.ts'
import { useFile } from '../../stato.tsx'
import { leggiData } from './bozza.ts'
import { bozzaDaiPdf, type BozzaPdf } from './dal-pdf.ts'
import './dal-pdf.css'
import { portaFile, pdfTrascinati, prendiPdf } from './trascina.ts'
import { percheInParole } from '../../dati/errore.ts'

// ---------- la zona ----------

export function ZonaPdf({ quandoLetto }: { quandoLetto: (b: BozzaPdf) => void }) {
  const { dati } = useFile()
  const input = useRef<HTMLInputElement>(null)
  const [sopra, setSopra] = useState(false)
  const [leggo, setLeggo] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const leggi = async (file: File[]) => {
    if (file.length === 0) return setErrore('Questo non è un PDF. Trascina qui il PDF della banca (il file che finisce con .pdf).')
    setErrore(null)
    setLeggo(true)
    try {
      const esito = bozzaDaiPdf(dati, await ponte.leggiPdf(file))
      if (esito.ok) quandoLetto(esito.bozza)
      else setErrore(esito.perche)
    } catch (e) {
      setErrore(`Non riesco a leggere il PDF: ${percheInParole(e)}`)
    } finally {
      setLeggo(false)
    }
  }

  // Arrivati dalla pagina Movimenti con un PDF trascinato: si legge subito.
  useEffect(() => {
    const file = prendiPdf()
    if (file) void leggi(file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="gruppo">
      <div
        className={`zona-pdf${sopra ? ' sopra' : ''}`}
        onDragOver={(e) => {
          if (!portaFile(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setSopra(true)
        }}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => {
          e.preventDefault()
          setSopra(false)
          void leggi(pdfTrascinati(e))
        }}
      >
        <Icona nome="doc" />
        <b>Trascina qui il PDF della banca</b>
        <span>
          oppure{' '}
          <button type="button" className="link" disabled={leggo} onClick={() => input.current?.click()}>
            scegli il file
          </button>
          . Se un ordine è in due pezzi (“a” e “b”), mettili insieme.
        </span>
        <small>I campi si compilano da soli e li rivedi prima di registrare.</small>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            const file = [...(e.target.files ?? [])]
            e.target.value = ''
            void leggi(file)
          }}
        />
      </div>
      {leggo && (
        <p className="nota-scrittura" role="status">
          Leggo il PDF…
        </p>
      )}
      {errore && (
        <div className="manca" role="alert">
          {errore}
        </div>
      )}
    </div>
  )
}

// ---------- accanto alla frase ----------

/** "Letto da …" e "Guarda il PDF". */
export function LettoDa({ bozza }: { bozza: BozzaPdf }) {
  const info = bozza.dalPdfInfo
  if (!bozza.pdf?.length) return null
  const percorsi = info?.percorsi ?? []
  return (
    <div className="letto-da">
      <p className="nota-scrittura">
        <Icona nome="doc" piccola /> Letto da {bozza.pdf.join(' e ')}
      </p>
      {percorsi.some(Boolean) && (
        <div className="bottoni">
          {bozza.pdf.map((nome, i) =>
            percorsi[i] ? (
              <button key={nome} type="button" className="btn piccolo" onClick={() => void ponte.guardaPdf(percorsi[i]!)}>
                <Icona nome="doc" piccola />
                {bozza.pdf!.length > 1 ? `Guarda ${nome}` : 'Guarda il PDF'}
              </button>
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}

/** I pezzi dello stesso ordine, sommati in un solo movimento. */
export function Pezzi({ bozza }: { bozza: BozzaPdf }) {
  const info = bozza.dalPdfInfo
  if (!info?.pezzi) return null
  const tot = info.pezzi.reduce((s, p) => s + p.quantita, 0)
  const cosa = bozza.tipo === 'vendita' ? 'una sola vendita' : 'un solo acquisto'
  return (
    <div className="avviso-conto">
      <Icona nome="info" />
      <div>
        <p>
          Questi {info.pezzi.length} PDF sono <b>lo stesso ordine</b>
          {info.ordine ? ` (n. ${info.ordine})` : ''} eseguito in {info.pezzi.length} pezzi: li sommo in {cosa} di <b>{quote(tot)} quote</b>.
        </p>
        <ul className="pezzi">
          {info.pezzi.map((p) => (
            <li key={p.nome}>
              {p.nome}: {quote(p.quantita)} quote a {prezzo(p.prezzo, p.valuta)}, {euro(p.totale, 2)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Gli avvisi letti nel PDF, e per un dividendo le quote del PDF diverse da quelle del file. */
export function AvvisiPdf({ bozza }: { bozza: BozzaPdf }) {
  const { dati } = useFile()
  const info = bozza.dalPdfInfo
  if (!info) return null
  const avvisi = [...info.avvisi]
  const giorno = leggiData(bozza.testi.data)
  if (bozza.tipo === 'dividendo' && info.quotePdf !== null && giorno && bozza.testi.titolo) {
    const q = quoteAlGiorno(dati, bozza.testi.titolo, giorno)
    if (Math.abs(q - info.quotePdf) > 1e-6)
      avvisi.push(
        `Il PDF dice ${quote(info.quotePdf)} quote, ma nel file quel giorno ne avevi ${quote(q)}. Controlla i movimenti di questo titolo: forse manca un acquisto o una vendita.`,
      )
  }
  if (avvisi.length === 0) return null
  return (
    <>
      {avvisi.map((a) => (
        <div key={a} className="avviso-conto">
          <Icona nome="info" />
          <p>{a}</p>
        </div>
      ))}
    </>
  )
}

/** Il PDF è già registrato: non si registra due volte, e si può aprire il movimento che c'è. */
export function GiaRegistrato({ id, indietro }: { id: string; indietro: string }) {
  const { dati } = useFile()
  const spiega = useSpiega()
  const navigate = useNavigate()
  const t = trovaMovimento(dati, id)
  if (!t) return null
  const fonte = t.tipo === 'operazione' ? t.operazione.fonte : t.dividendo.fonte
  return (
    <div className="gia-registrato" role="alert">
      <Icona nome="info" />
      <div>
        <p>
          <b>Questo movimento è già registrato:</b> {movimentoInParole(dati, t)}
          {t.tipo === 'operazione' ? `, ${quote(t.operazione.quantita)} quote, ${euro(t.operazione.totale, 2)}` : `, ${euro(t.dividendo.lordo, 2)} lordi`}
          {fonte ? ` (fonte: ${fonte})` : ''}. Non lo registro due volte.
        </p>
        <div className="bottoni">
          <button
            type="button"
            className="btn primario"
            onClick={() => {
              navigate(indietro)
              const s = spiegazioneDelMovimento(dati, id)
              if (s) spiega(s)
            }}
          >
            Apri quel movimento
          </button>
        </div>
      </div>
    </div>
  )
}
