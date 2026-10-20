// Come si disegna ogni linea del grafico degli andamenti, condiviso con la tabella sotto. Modulo puro.
import type { IdAndamento } from '../../conti/riferimenti.ts'

type Id = IdAndamento

/** Il colore della linea: il blu per il portafoglio, per gli indici e l'inflazione i colori di classifica.css. */
export const coloreDi = (id: Id) => (id === 'portafoglio' ? 'var(--azione)' : `var(--rif-${id})`)

/** L'inflazione è tratteggiata: è la soglia per non perdere potere d'acquisto, non un investimento. */
export const tratteggiata = (id: Id) => id === 'nic'
