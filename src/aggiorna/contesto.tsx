// Lo stato di Aggiorna fine mese, tenuto sopra le pagine: se mentre la lista si riempie vai su un'altra
// pagina, l'aggiornamento continua e lo ritrovi com'era. Nel file non si scrive niente finché non premi "Salva".
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  conCambio,
  conTitolo,
  contaFonti,
  creaAggiornamento,
  daSalvare,
  fontiDellaLista,
  primaEDopo,
  richiestaDi,
  statoDaCambio,
  statoDaEsito,
  type Aggiornamento,
  type RigaTitolo,
} from '../dati/aggiorna/lista.ts'
import { contaControlli, confrontoDellaRiga } from '../dati/aggiorna/controllo-prezzo.ts'
import { mesiDaAggiornare } from '../dati/aggiorna/mesi.ts'
import { ponte } from '../ponte.ts'
import { useStato } from '../stato.tsx'
import { oggiDellApp } from './oggi.ts'
import { creaRiferimenti, frasiDopoIlSalvataggio, riferimentiDaSalvare } from '../dati/aggiorna/riferimenti.ts'
import type { IdRiferimento } from '../dati/tipi.ts'
import { useScaricaRiferimenti } from './scarica-riferimenti.ts'

/** Cosa resta da dire dopo "Salva": il riquadro "<Mese> è salvato". */
export type Salvato = {
  mese: string
  copia: string
  rifai: boolean
  /** [fonte, quanti] */
  fonti: [string, number][]
  uguali: number
  tenuti: number
  diversi: { titolo: string; prima: number; dopo: number; valuta: string }[]
  /** Il file è passato adesso dalla versione 2 alla 3. */
  versione3: boolean
  /** Riferimenti e inflazione: cosa è arrivato e cosa si riprende al prossimo aggiornamento. */
  frasiRiferimenti: string[]
  /** Il controllo di investing.com dei prezzi salvati. */
  controlli?: ReturnType<typeof contaControlli>
}

type ContestoAggiorna = {
  agg: Aggiornamento | null
  salvato: Salvato | null
  /** Un avviso da mostrare nella schermata (per esempio il file cambiato da un altro PC). */
  avviso: string | null
  salvando: boolean
  mesiDaFare: string[]
  inizia: (mese: string) => void
  riprova: (id: string) => void
  riprovaCambio: (valuta: string) => void
  scriviAMano: (id: string, prezzo: number | undefined) => void
  /** "Rifai": tieni il prezzo che c'era (true) o usa quello nuovo (false). */
  tieniPrima: (id: string, tieni: boolean) => void
  cambioAMano: (valuta: string, cambio: number | undefined) => void
  riprovaRiferimento: (id: IdRiferimento) => void
  riprovaNic: () => void
  annulla: () => void
  salva: () => Promise<void>
  chiudiAvviso: () => void
}

const Contesto = createContext<ContestoAggiorna | null>(null)

export function useAggiorna(): ContestoAggiorna {
  const c = useContext(Contesto)
  if (!c) throw new Error('useAggiorna fuori da AggiornaProvider')
  return c
}

/** Quante richieste insieme: le borse lette dalle pagine si mettono comunque in fila da sole. */
const INSIEME = 3

export function AggiornaProvider({ children }: { children: ReactNode }) {
  const { apertura, esegui } = useStato()
  const [agg, setAgg] = useState<Aggiornamento | null>(null)
  const [salvato, setSalvato] = useState<Salvato | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Ogni aggiornamento ha il suo numero: le risposte di uno annullato non toccano quello nuovo.
  const giro = useRef(0)
  const attuale = useRef<Aggiornamento | null>(null)

  const cambia = useCallback((f: (a: Aggiornamento) => Aggiornamento, numero: number) => {
    if (numero !== giro.current) return
    setAgg((a) => {
      const nuovo = a ? f(a) : a
      attuale.current = nuovo
      return nuovo
    })
  }, [])

  const attivo = useCallback((numero: number) => numero === giro.current, [])
  const riferimenti = useScaricaRiferimenti(cambia, attivo)

  const chiediPrezzo = useCallback(
    async (r: RigaTitolo, mese: string, numero: number) => {
      cambia((a) => conTitolo(a, r.id, (x) => ({ ...x, stato: { tipo: 'scarica' } })), numero)
      let stato
      try {
        stato = statoDaEsito(await ponte.prezzoFineMese(richiestaDi(r), mese))
      } catch {
        stato = { tipo: 'manca' as const, perche: 'qualcosa non è andato: riprova' }
      }
      cambia((a) => conTitolo(a, r.id, (x) => ({ ...x, stato })), numero)
    },
    [cambia],
  )

  const chiediCambio = useCallback(
    async (valuta: string, mese: string, numero: number) => {
      cambia((a) => conCambio(a, valuta, (x) => ({ ...x, stato: { tipo: 'scarica' } })), numero)
      let stato
      try {
        stato = statoDaCambio(await ponte.cambioFineMese(valuta, mese))
      } catch {
        stato = { tipo: 'manca' as const, perche: 'qualcosa non è andato: riprova' }
      }
      cambia((a) => conCambio(a, valuta, (x) => ({ ...x, stato })), numero)
    },
    [cambia],
  )

  const inizia = useCallback(
    (mese: string) => {
      if (apertura.stato !== 'pronto') return
      const numero = ++giro.current
      const lista = creaAggiornamento(apertura.dati, mese)
      const nuovo = { ...lista, rif: creaRiferimenti(apertura.dati, mese, lista.rifai) }
      attuale.current = nuovo
      setAgg(nuovo)
      setSalvato(null)
      setAvviso(null)
      for (const c of nuovo.cambi) void chiediCambio(c.valuta, mese, numero)
      const coda = [...nuovo.titoli]
      const lavora = async () => {
        for (let r = coda.shift(); r; r = coda.shift()) {
          if (numero !== giro.current) return
          await chiediPrezzo(r, mese, numero)
        }
      }
      for (let i = 0; i < INSIEME; i++) void lavora()
      riferimenti.parti(nuovo, numero)
    },
    [apertura, chiediCambio, chiediPrezzo, riferimenti],
  )

  const salva = useCallback(async () => {
    const a = attuale.current
    if (!a || salvando) return
    let contenuto
    try {
      contenuto = { ...daSalvare(a), ...riferimentiDaSalvare(a.rif) }
    } catch {
      return
    }
    const versionePrima = apertura.stato === 'pronto' ? apertura.dati.versione : 3
    setSalvando(true)
    setAvviso(null)
    let esito: Awaited<ReturnType<typeof ponte.salvaMese>> | null = null
    await esegui(async () => {
      esito = await ponte.salvaMese(contenuto)
      return esito.esito === 'errore' ? null : esito.apertura
    })
    setSalvando(false)
    const e = esito as Awaited<ReturnType<typeof ponte.salvaMese>> | null
    if (!e) return
    if (e.esito === 'errore') {
      setAvviso(`Non ho salvato: ${e.perche}. Il file è rimasto com’era.`)
      return
    }
    if (e.esito === 'cambiato') {
      setAvviso(
        'Il file è stato cambiato da un altro PC (o fuori dall’applicazione) mentre aggiornavi: non ho scritto niente e ho ricaricato i dati. Controlla la lista e premi di nuovo Salva.',
      )
      return
    }
    const pd = primaEDopo(a)
    giro.current++
    attuale.current = null
    setAgg(null)
    setSalvato({
      mese: a.mese,
      copia: e.copia,
      rifai: a.rifai,
      fonti: contaFonti(fontiDellaLista(a)),
      uguali: pd.uguali,
      tenuti: pd.tenuti,
      diversi: pd.diversi.map((r) => ({
        titolo: r.simbolo ?? r.isin,
        prima: r.prima!.prezzo,
        dopo: r.aMano ?? (r.stato.tipo === 'arrivato' ? r.stato.esito.prezzo : 0),
        valuta: r.valuta,
      })),
      versione3: versionePrima < 3,
      frasiRiferimenti:
        a.rif && e.apertura.stato === 'pronto' ? frasiDopoIlSalvataggio(e.apertura.dati, a.mese, a.rif.primaVolta) : [],
      controlli: contaControlli(a.titoli.map((r) => ({ titolo: r.simbolo ?? r.isin, confronto: confrontoDellaRiga(r) }))),
    })
  }, [apertura, esegui, salvando])

  const valore = useMemo<ContestoAggiorna>(() => {
    const mesiDaFare = apertura.stato === 'pronto' ? mesiDaAggiornare(apertura.dati, oggiDellApp()) : []
    return {
      agg,
      salvato,
      avviso,
      salvando,
      mesiDaFare,
      inizia,
      riprova: (id) => {
        const r = agg?.titoli.find((x) => x.id === id)
        if (r && agg) void chiediPrezzo(r, agg.mese, giro.current)
      },
      riprovaCambio: (valuta) => {
        if (agg) void chiediCambio(valuta, agg.mese, giro.current)
      },
      scriviAMano: (id, prezzo) => cambia((a) => conTitolo(a, id, (x) => ({ ...x, aMano: prezzo })), giro.current),
      tieniPrima: (id, tieni) => cambia((a) => conTitolo(a, id, (x) => ({ ...x, tieni })), giro.current),
      cambioAMano: (valuta, cambio) => cambia((a) => conCambio(a, valuta, (x) => ({ ...x, aMano: cambio })), giro.current),
      riprovaRiferimento: (id) => {
        const r = agg?.rif?.righe.find((x) => x.id === id)
        if (r) void riferimenti.chiediRiferimento(id, r.date, giro.current)
      },
      riprovaNic: () => {
        if (agg?.rif) void riferimenti.chiediNic(agg.rif.nic.mesi, giro.current)
      },
      annulla: () => {
        giro.current++
        attuale.current = null
        setAgg(null)
        setAvviso(null)
      },
      salva,
      chiudiAvviso: () => setAvviso(null),
    }
  }, [agg, salvato, avviso, salvando, apertura, inizia, chiediPrezzo, chiediCambio, cambia, salva, riferimenti])

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}
