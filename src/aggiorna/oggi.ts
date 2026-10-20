import { oggiLocale } from '../dati/aggiorna/calendario.ts'

/** Il giorno di oggi; per le prove si può fingere un altro giorno con ?oggi=AAAA-MM-GG nell'indirizzo. */
export function oggiDellApp(): string {
  const finto = new URLSearchParams(location.search).get('oggi')
  return finto && /^\d{4}-\d{2}-\d{2}$/.test(finto) ? finto : oggiLocale()
}
