// La pagina Dati (ticket 13, mappa 27, bozza A "a schede"): in testata "Scarica in Excel"; quattro riquadri
// (la cartella dei dati con "Cambia", il file "Integro", l'ultima copia, fino a che mese ci sono prezzi e
// inflazione); le schede Prezzi dei titoli, Inflazione cambi e riferimenti, Copie.
// La scheda e il fine mese scelti stanno nell'indirizzo (?scheda=…&mese=…).
import { useMemo, useRef, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mesiConPrezzi, ultimoNic } from '../conti/pagina-dati.ts'
import { finoAl } from '../dati/aggiorna/riferimenti.ts'
import { aVersione3 } from '../dati/aggiorna/versione3.ts'
import { quandoInParole } from '../dati/copie.ts'
import { mese, percorsoBreve, quando } from '../formato.ts'
import { ponte } from '../ponte.ts'
import { useFile, useStato } from '../stato.tsx'
import { CercaCodici } from './dati/CercaCodici.tsx'
import { Copie } from './dati/Copie.tsx'
import './dati/dati.css'
import { InflazioneCambiRiferimenti } from './dati/InflazioneCambiRiferimenti.tsx'
import { PrezziDeiTitoli } from './dati/PrezziDeiTitoli.tsx'
import { ScaricaInExcel } from './dati/ScaricaInExcel.tsx'

const SCHEDE = ['prezzi', 'riferimenti', 'copie'] as const
type Scheda = (typeof SCHEDE)[number]

export function Dati() {
  const { esegui, occupato } = useStato()
  const { cartella, dati: grezzi, controllato, copie } = useFile()
  // Le pagine leggono il file come sarebbe alla versione 3: fonti con il loro nome fisso, cambi nel loro elenco.
  const dati = useMemo(() => aVersione3(grezzi), [grezzi])
  const [cerca, setCerca] = useSearchParams()
  const scelta = cerca.get('scheda')
  const scheda: Scheda = (SCHEDE as readonly string[]).includes(scelta ?? '') ? (scelta as Scheda) : 'prezzi'
  const bottoni = useRef<(HTMLButtonElement | null)[]>([])

  const mesi = useMemo(() => mesiConPrezzi(dati), [dati])
  const meseScelto = cerca.get('mese')
  const fineMese = meseScelto && mesi.includes(meseScelto) ? meseScelto : (mesi[0] ?? '')
  const ultimaCopia = copie.find((c) => !c.rotta)
  const nic = ultimoNic(dati)

  const vai = (s: Scheda, m?: string) => setCerca(s === 'prezzi' ? (m ? { mese: m } : {}) : { scheda: s }, { replace: true })
  const frecce = (e: KeyboardEvent, i: number) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!passo) return
    const j = (i + passo + SCHEDE.length) % SCHEDE.length
    vai(SCHEDE[j])
    bottoni.current[j]?.focus()
  }
  const nomi: Record<Scheda, string> = {
    prezzi: 'Prezzi dei titoli',
    riferimenti: 'Inflazione, cambi e riferimenti',
    copie: `Copie (${copie.length})`,
  }

  return (
    <section className="dati-pagina">
      <div className="testata">
        <h1>Dati</h1>
        <ScaricaInExcel />
      </div>
      <div className="numeri">
        <div className="numero">
          <small>Cartella dei dati</small>
          <b>{cartella.nome}</b>
          <span title={cartella.percorso}>{percorsoBreve(cartella.percorso)}</span>
          <div className="azioni">
            <button type="button" className="link" disabled={occupato} onClick={() => void esegui(() => ponte.scegliCartella())}>
              Cambia
            </button>
            <button type="button" className="link" onClick={() => void ponte.apriInEsplora('dati')}>
              Apri la cartella
            </button>
          </div>
        </div>
        <div className="numero">
          <small>File dei dati</small>
          <b>Integro</b>
          <span>ultimo controllo {quando(controllato)}; verificato all’apertura e a ogni salvataggio</span>
        </div>
        <div className="numero">
          <small>Ultima copia</small>
          {ultimaCopia ? (
            <>
              <b>{quandoInParole(ultimaCopia.quando).split(' alle ')[0]}</b>
              <span>
                {ultimaCopia.perche ? `fatta ${ultimaCopia.perche}, ` : ''}alle {ultimaCopia.quando.slice(11)}
              </span>
            </>
          ) : (
            <>
              <b>Nessuna</b>
              <span>creata automaticamente prima della prima modifica</span>
            </>
          )}
          {copie.length > 0 && (
            <div className="azioni">
              <button type="button" className="link" onClick={() => vai('copie')}>
                Mostra le copie
              </button>
            </div>
          )}
        </div>
        <div className="numero">
          <small>Prezzi di fine mese</small>
          <b>{mesi[0] ? `fino a ${mese(mesi[0]).split(' ')[0]}` : 'nessuno'}</b>
          <span>{mesi[0] ? mese(mesi[0]) : 'disponibili dopo il primo aggiornamento di fine mese'}</span>
          <span>{nic ? `inflazione ${finoAl(nic)} ${nic.slice(0, 4)}` : 'inflazione non ancora disponibile'}</span>
        </div>
      </div>

      <div className="riquadro">
        <div className="schede" role="tablist" aria-label="Contenuto del file dei dati">
          {SCHEDE.map((s, i) => (
            <button
              key={s}
              ref={(el) => {
                bottoni.current[i] = el
              }}
              type="button"
              role="tab"
              id={`scheda-dati-${s}`}
              aria-selected={scheda === s}
              aria-controls="pannello-scheda-dati"
              tabIndex={scheda === s ? 0 : -1}
              onClick={() => vai(s)}
              onKeyDown={(e) => frecce(e, i)}
            >
              {nomi[s]}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="pannello-scheda-dati" aria-labelledby={`scheda-dati-${scheda}`}>
          {scheda === 'prezzi' && <CercaCodici dati={grezzi} />}
          {scheda === 'prezzi' && <PrezziDeiTitoli dati={dati} mesi={mesi} scelto={fineMese} scegli={(m) => vai('prezzi', m)} />}
          {scheda === 'riferimenti' && <InflazioneCambiRiferimenti dati={dati} />}
          {scheda === 'copie' && <Copie copie={copie} />}
        </div>
      </div>
    </section>
  )
}
