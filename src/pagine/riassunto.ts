// Piccoli riassunti del file, per le testate e la pagina Dati.
import type { FileDati } from '../dati/tipi.ts'

/** La data dell'ultimo prezzo di fine mese nel file, "AAAA-MM-GG", o null. */
export function ultimoPrezzo(dati: FileDati): string | null {
  let ultimo: string | null = null
  for (const p of dati.prezzi ?? []) if (!ultimo || p.data > ultimo) ultimo = p.data
  return ultimo
}

/** "15 titoli, 17 acquisti e vendite, 9 dividendi e 316 prezzi di fine mese" */
export function contenuto(dati: FileDati): string {
  const n = (quanti: number, uno: string, tanti: string) => `${quanti} ${quanti === 1 ? uno : tanti}`
  const parti = [
    n(dati.titoli?.length ?? 0, 'titolo', 'titoli'),
    n(dati.operazioni?.length ?? 0, 'acquisto o vendita', 'acquisti e vendite'),
    n(dati.dividendi?.length ?? 0, 'dividendo', 'dividendi'),
    n(dati.prezzi?.length ?? 0, 'prezzo di fine mese', 'prezzi di fine mese'),
  ]
  return parti.slice(0, -1).join(', ') + ' e ' + parti[parti.length - 1]
}
