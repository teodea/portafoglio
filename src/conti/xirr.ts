// Il medio annuo che tiene conto di quando è entrato e uscito ogni euro (XIRR):
// il tasso r che, applicato a ogni flusso per il tempo che è rimasto investito, fa tornare i conti.
// Modulo puro.

export type Flusso = {
  /** AAAA-MM-GG */
  data: string
  /** Dal punto di vista di chi investe: soldi messi negativi, soldi ricevuti (o valore finale) positivi. */
  importo: number
}

const GIORNO = 24 * 60 * 60 * 1000
/** Anni di 365,25 giorni, come nelle bozze approvate. */
export const GIORNI_ANNO = 365.25

export function anniTra(da: string, a: string): number {
  return (Date.parse(a) - Date.parse(da)) / GIORNO / GIORNI_ANNO
}

/**
 * Il tasso annuo composto, come frazione (0,1 = +10,0% all'anno).
 * null se non si può calcolare: niente soldi messi, niente soldi ricevuti, o nessun tasso che torni.
 */
export function xirr(flussi: Flusso[]): number | null {
  if (flussi.length < 2) return null
  if (!flussi.some((f) => f.importo < 0) || !flussi.some((f) => f.importo > 0)) return null
  const inizio = flussi.reduce((min, f) => (f.data < min ? f.data : min), flussi[0].data)
  const punti = flussi.map((f) => ({ t: anniTra(inizio, f.data), a: f.importo }))
  if (punti.every((p) => p.t === 0)) return null
  const valoreOggi = (r: number) => punti.reduce((s, p) => s + p.a / Math.pow(1 + r, p.t), 0)

  // Bisezione: il valore di oggi scende al crescere del tasso quando i soldi messi vengono prima.
  let basso = -0.9999
  let alto = 1
  while (valoreOggi(alto) > 0 && alto < 1e6) alto *= 2
  const vb = valoreOggi(basso)
  const va = valoreOggi(alto)
  if (!Number.isFinite(vb) || !Number.isFinite(va) || Math.sign(vb) === Math.sign(va)) return null
  for (let i = 0; i < 300; i++) {
    const mezzo = (basso + alto) / 2
    const v = valoreOggi(mezzo)
    if (Math.sign(v) === Math.sign(vb)) basso = mezzo
    else alto = mezzo
    if (alto - basso < 1e-12) break
  }
  return (basso + alto) / 2
}
