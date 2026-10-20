import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { Apertura } from './dati/ponte.ts'
import { quandoInParole } from './dati/copie.ts'
import { Barra } from './guscio/Barra.tsx'
import { AggiornaFineMese } from './aggiorna/AggiornaFineMese.tsx'
import { AggiornaProvider } from './aggiorna/contesto.tsx'
import { PERCORSO_AGGIORNA, StrisciaFineMese } from './aggiorna/Striscia.tsx'
import { VersioneNuova } from './guscio/VersioneNuova.tsx'
import { Icona } from './icone.tsx'
import { Dati } from './pagine/Dati.tsx'
import { Movimenti, PERCORSO_REGISTRA } from './pagine/Movimenti.tsx'
import { Registra } from './pagine/movimenti/Registra.tsx'
import { Portafoglio } from './pagine/Portafoglio.tsx'
import { SchedaTitolo } from './pagine/titoli/SchedaTitolo.tsx'
import { Titoli } from './pagine/titoli/Titoli.tsx'
import { ConPannello } from './pannello/Pannello.tsx'
import { nelBrowser, ponte } from './ponte.ts'
import { FileRotto } from './schermate/FileRotto.tsx'
import { SenzaFile } from './schermate/SenzaFile.tsx'
import { ContestoStato, type Stato } from './stato.tsx'
import { percheInParole } from './dati/errore.ts'

export default function App() {
  const [apertura, setApertura] = useState<Apertura | null>(null)
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const ultima = useRef<Apertura | null>(null)

  const esegui = useCallback(async (azione: () => Promise<Apertura | null>) => {
    setErrore(null)
    setOccupato(true)
    try {
      const nuova = await azione()
      if (nuova) {
        setMessaggio(messaggioDopo(ultima.current, nuova))
        ultima.current = nuova
        setApertura(nuova)
      }
      return nuova
    } catch (e) {
      setErrore(percheInParole(e))
      return null
    } finally {
      setOccupato(false)
    }
  }, [])

  useEffect(() => {
    void esegui(() => ponte.apri())
  }, [esegui])

  const stato = useMemo<Stato | null>(() => (apertura ? { apertura, esegui, occupato } : null), [apertura, esegui, occupato])
  if (!stato || !apertura) return null

  return (
    <ContestoStato.Provider value={stato}>
      <AggiornaProvider>
      <HashRouter>
        <ConPannello>
          <DallAlto />
          <div className="guscio">
            <Barra />
            <main>
              {nelBrowser && (
                <p className="prova-browser">Versione di prova nel browser: dati di esempio, nessun file viene letto o scritto.</p>
              )}
              <VersioneNuova />
              {errore && (
                <div className="striscia" role="alert">
                  <span>
                    <Icona nome="info" />
                    <span>Si è verificato un errore: {errore}</span>
                  </span>
                  <button type="button" className="btn solo-icona" aria-label="Chiudi" onClick={() => setErrore(null)}>
                    <Icona nome="x" piccola />
                  </button>
                </div>
              )}
              {messaggio && apertura.stato === 'pronto' && (
                <div className="striscia" role="status">
                  <span>
                    <Icona nome="ok" />
                    <span>{messaggio}</span>
                  </span>
                  <button type="button" className="btn solo-icona" aria-label="Chiudi" onClick={() => setMessaggio(null)}>
                    <Icona nome="x" piccola />
                  </button>
                </div>
              )}
              {apertura.stato === 'pronto' && <StrisciaFineMese />}
              {apertura.stato === 'pronto' ? (
                <Routes>
                  <Route path="/" element={<Portafoglio />} />
                  <Route path="/titoli" element={<Titoli />} />
                  <Route path="/titoli/:id" element={<SchedaTitolo />} />
                  <Route path="/movimenti" element={<Movimenti />} />
                  <Route path={PERCORSO_REGISTRA} element={<Registra />} />
                  <Route path="/dati" element={<Dati />} />
                  <Route path={PERCORSO_AGGIORNA} element={<AggiornaFineMese />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              ) : apertura.stato === 'rotto' ? (
                <FileRotto apertura={apertura} />
              ) : (
                <SenzaFile apertura={apertura} />
              )}
            </main>
          </div>
        </ConPannello>
      </HashRouter>
      </AggiornaProvider>
    </ContestoStato.Provider>
  )
}

/** Ogni pagina si apre dall'alto, non all'altezza a cui era scorsa quella di prima. Le schede (?scheda=…) restano dove sono. */
function DallAlto() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// Dopo il ripristino di una copia, si dice in parole che cosa è successo.
function messaggioDopo(vecchia: Apertura | null, nuova: Apertura): string | null {
  if (vecchia?.stato !== 'rotto' || nuova.stato !== 'pronto') return null
  const giaViste = new Set(vecchia.copie.map((c) => c.file))
  const messoDaParte = nuova.copie.find((c) => c.rotta && !giaViste.has(c.file))
  return `Il file dei dati è di nuovo leggibile.${messoDaParte ? ` Il file danneggiato non è stato cancellato: si trova nella cartella copie come “${messoDaParte.file}” (${quandoInParole(messoDaParte.quando)}).` : ''}`
}
