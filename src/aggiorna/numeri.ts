// I numeri della schermata Aggiorna, all'italiana.
const formati = new Map<string, Intl.NumberFormat>()
/** Come Intl.NumberFormat, ma con il vero segno meno "−" (DESIGN.md, "La regola del segno"), come nel resto dell'applicazione. */
function formato(min: number, max: number, segno = false): { format: (n: number) => string } {
  const k = `${min}|${max}|${segno}`
  let f = formati.get(k)
  if (!f) {
    f = new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      signDisplay: segno ? 'exceptZero' : 'auto',
      useGrouping: 'always',
    })
    formati.set(k, f)
  }
  const g = f
  return { format: (n: number) => g.format(n).replace('-', '−') }
}

/** 12.75 → "12,75"; 54.135 → "54,135"; 47.5 → "47,50" */
export function prezzo(n: number): string {
  return formato(2, 4).format(n)
}

/** 0.86912 → "0,86912" */
export function cambio(n: number): string {
  return formato(4, 6).format(n)
}

/** "€" per l'euro, altrimenti il codice della valuta ("GBP", "USD"), come nel resto dell'applicazione (DESIGN.md). */
export function simboloValuta(valuta: string): string {
  return valuta === 'EUR' ? '€' : valuta
}

/** 1234.5 → "1.234,50 €" */
export function euro(n: number): string {
  return `${formato(2, 2).format(n)} €`
}

/** 1234.5 → "+1.234,50 €" */
export function euroConSegno(n: number): string {
  return `${formato(2, 2, true).format(n)} €`
}

/** 1.234 → "+1,23%" */
export function percentuale(n: number): string {
  return `${formato(2, 2, true).format(n)}%`
}

/** Il controllo di investing.com: +0,6%, con due decimali sotto lo 0,1% (+0,04%). */
export function differenza(n: number): string {
  const decimali = Math.abs(n) < 0.1 ? 2 : 1
  return `${formato(decimali, decimali, true).format(n)}%`
}

/** Legge un numero scritto da una persona: "12,75", "1.234,5", "54.135" (un solo punto = decimali). */
export function leggiNumero(testo: string): number | null {
  let t = testo.trim().replace(/\s|€|£/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return n > 0 ? n : null
}

/** "2026-10-30" → "30/10/2026" */
export function giorno(data: string): string {
  return data.split('-').reverse().join('/')
}
