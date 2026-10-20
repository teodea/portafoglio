// L'aggiornamento dell'applicazione: all'apertura si controlla su GitHub se c'è una versione nuova
// e si chiede "È disponibile una nuova versione: installarla?". Con il sì si scarica e, appena scaricata, il programma
// si chiude, l'installatore mostra la sua finestra di avanzamento e al termine riapre il programma.
// Con "Non ora" non si fa niente e si richiede la volta dopo. Mai controlli ad applicazione chiusa.
// Modulo puro: il processo principale tiene lo stato con prossimoStato(), le pagine lo mostrano con inParole().

export type StatoAggiornamento =
  /** Niente da dire: controllo in corso, nessuna versione nuova, niente internet, oppure "Non ora". */
  | { stato: 'nessuno' }
  | { stato: 'disponibile'; versione: string }
  | { stato: 'scarico'; versione: string; percento: number }
  /** Scaricata: tra un attimo il programma si chiude, si installa (con la finestra di avanzamento) e si riapre. */
  | { stato: 'installo'; versione: string }
  | { stato: 'non-scaricata'; versione: string }

export type EventoAggiornamento =
  | { tipo: 'trovata'; versione: string }
  | { tipo: 'nessuna' }
  | { tipo: 'risposta'; installa: boolean }
  | { tipo: 'avanzamento'; percento: number }
  | { tipo: 'scaricata' }
  | { tipo: 'errore' }

export const NESSUNO: StatoAggiornamento = { stato: 'nessuno' }

export function prossimoStato(s: StatoAggiornamento, e: EventoAggiornamento): StatoAggiornamento {
  switch (e.tipo) {
    case 'trovata':
      // Una versione trovata mentre se ne scarica già una non cambia niente.
      return s.stato === 'nessuno' ? { stato: 'disponibile', versione: e.versione } : s
    case 'nessuna':
      return s.stato === 'disponibile' ? NESSUNO : s
    case 'risposta':
      if (s.stato !== 'disponibile' && s.stato !== 'non-scaricata') return s
      return e.installa ? { stato: 'scarico', versione: s.versione, percento: 0 } : NESSUNO
    case 'avanzamento':
      if (s.stato !== 'scarico') return s
      return { ...s, percento: Math.max(s.percento, Math.min(100, Math.round(e.percento))) }
    case 'scaricata':
      return s.stato === 'scarico' ? { stato: 'installo', versione: s.versione } : s
    case 'errore':
      // Un errore del controllo (niente internet, GitHub che non risponde) non si dice: si riprova la volta dopo.
      // Un errore mentre si scarica si dice, perché hai appena risposto "sì".
      return s.stato === 'scarico' ? { stato: 'non-scaricata', versione: s.versione } : s
  }
}

/**
 * Che cosa fare quando il programma si chiude. Con una versione scaricata la si installa mostrando la finestra
 * di avanzamento, e alla fine il programma si riapre da solo: un'installazione in silenzio non diceva niente,
 * e chi riapriva il programma a metà ritrovava la versione vecchia e la domanda "installarla?".
 * Con la finta fonte di versioni (prove) non si installa mai.
 */
export function allaChiusura(s: StatoAggiornamento, { prova }: { prova: boolean }): 'installa-e-riapri' | 'chiudi' {
  return s.stato === 'installo' && !prova ? 'installa-e-riapri' : 'chiudi'
}

export type Bottone = { testo: string; installa: boolean; primario?: boolean }

export type InParole = {
  testo: string
  bottoni: Bottone[]
  /** Si può chiudere la striscia con la x (solo nasconderla: non cambia niente). */
  chiudibile: boolean
}

/** La striscia da mostrare in cima alle pagine, oppure null se non c'è niente da dire. */
export function inParole(s: StatoAggiornamento): InParole | null {
  switch (s.stato) {
    case 'nessuno':
      return null
    case 'disponibile':
      return {
        testo: `È disponibile una nuova versione (${s.versione}): installarla?`,
        bottoni: [
          { testo: 'Non ora', installa: false },
          { testo: 'Installa', installa: true, primario: true },
        ],
        chiudibile: false,
      }
    case 'scarico':
      return {
        testo: `Scaricamento della versione ${s.versione}… ${s.percento}%. Al termine il programma si chiude, installa la versione nuova e si riapre automaticamente.`,
        bottoni: [],
        chiudibile: false,
      }
    case 'installo':
      return {
        testo: `Installazione della versione ${s.versione}: il programma si chiude e si riapre automaticamente al termine. Non occorre fare nulla.`,
        bottoni: [],
        chiudibile: false,
      }
    case 'non-scaricata':
      return {
        testo: `Non è stato possibile scaricare la versione ${s.versione}. Riprovare adesso, oppure la richiesta verrà ripetuta al prossimo avvio.`,
        bottoni: [
          { testo: 'Non ora', installa: false },
          { testo: 'Riprova', installa: true, primario: true },
        ],
        chiudibile: false,
      }
  }
}

/**
 * Per le prove: la "finta fonte di versioni" passata con --fonte-versioni=<indirizzo>.
 * Vale solo un indirizzo su questo PC (localhost o 127.0.0.1): una fonte su internet non si accetta mai.
 */
export function fonteDiProva(indirizzo: string | undefined): string | null {
  if (!indirizzo) return null
  try {
    const u = new URL(indirizzo)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return null
    return u.href
  } catch {
    return null
  }
}

/** Le funzioni che il preload espone alle pagine in window.aggiornamento. */
export type PonteAggiornamento = {
  /** Lo stato di adesso. */
  leggi(): Promise<StatoAggiornamento>
  /** La risposta a "installarla?": true installa (scarica, poi chiude, installa e riapre), false "Non ora". */
  rispondi(installa: boolean): Promise<StatoAggiornamento>
  /** Chiamata a ogni cambio di stato; restituisce la funzione per smettere di ascoltare. */
  quandoCambia(fai: (s: StatoAggiornamento) => void): () => void
}

export const CANALI_AGGIORNAMENTO = {
  leggi: 'aggiornamento:leggi',
  rispondi: 'aggiornamento:rispondi',
  cambiato: 'aggiornamento:cambiato',
} as const
