// Il passaggio del file alla versione 3 e la scrittura di un mese nuovo.
// Si usano nel processo principale, sul file appena riletto dal disco, subito prima della scrittura sicura.
// Modulo puro: niente file. Non cambia mai l'oggetto ricevuto, ne restituisce uno nuovo.
import { FONTE, FONTE_CAMBIO, fonteDaVersione2, type FonteDaScaricare } from './fonti.ts'
import { fineMese, nomeMese } from './calendario.ts'
import { controlloValido } from './controllo-prezzo.ts'
import { valutaDelTitolo } from './mesi.ts'
import { controllaRiferimenti, scriviRiferimenti, type RiferimentiDaSalvare } from './riferimenti.ts'
import { VERSIONE_ATTUALE, type CambioFineMese, type ControlloPrezzo, type FileDati, type PrezzoFineMese } from '../tipi.ts'

/**
 * Da versione 1 o 2 a versione 3. Esempio: il prezzo con fonte "file (foglio Nasdaq 100)" diventa
 * fonte "dal tuo file Excel" con nota "file (foglio Nasdaq 100)"; i cambi scritti sui prezzi in sterline
 * vanno anche nell'elenco dei cambi; ogni titolo ha la sua valuta. I numeri non cambiano.
 */
export function aVersione3(dati: FileDati): FileDati {
  if (dati.versione >= 3) return dati
  const prezzi = (dati.prezzi ?? []).map((p): PrezzoFineMese => {
    const fonte = fonteDaVersione2(p.fonte)
    return fonte === p.fonte ? { ...p } : { ...p, fonte, nota: p.nota ?? p.fonte }
  })
  const cambi: CambioFineMese[] = [...(dati.cambi ?? [])]
  const visti = new Set(cambi.map((c) => c.valuta + '|' + c.data))
  for (const p of dati.prezzi ?? []) {
    if (!p.cambio || p.valuta === 'EUR') continue
    const k = p.valuta + '|' + p.data
    if (visti.has(k)) continue
    visti.add(k)
    cambi.push({ valuta: p.valuta, data: p.data, cambio: p.cambio, fonte: FONTE_CAMBIO.fileExcel })
  }
  cambi.sort((a, b) => a.valuta.localeCompare(b.valuta) || a.data.localeCompare(b.data))
  return {
    ...dati,
    versione: VERSIONE_ATTUALE,
    titoli: (dati.titoli ?? []).map((t) => ({ ...t, valuta: valutaDelTitolo(dati, t) })),
    prezzi,
    cambi,
  }
}

/** Il prezzo di un titolo per il mese, come lo manda la schermata Aggiorna. */
export type PrezzoScelto =
  | { titolo: string; prezzo: number; seduta: string; fonte: FonteDaScaricare; nota?: string; controllo?: ControlloPrezzo }
  | { titolo: string; prezzo: number; fonte: typeof FONTE.aMano }

export type CambioScelto =
  | { valuta: string; cambio: number; seduta: string; fonte: typeof FONTE_CAMBIO.bce }
  | { valuta: string; cambio: number; fonte: typeof FONTE_CAMBIO.aMano }

/** Con i prezzi e i cambi possono arrivare i riferimenti e i NIC scaricati (ticket 9), storia compresa. */
export type MeseDaSalvare = { mese: string; prezzi: PrezzoScelto[]; cambi: CambioScelto[] } & Partial<RiferimentiDaSalvare>

export type ProblemaMese = { ok: false; perche: string }

/** Controlla che il mese mandato dalla schermata sia completo e sensato, prima di toccare il file. */
export function controllaMese(dati: FileDati, m: MeseDaSalvare): { ok: true } | ProblemaMese {
  if (!/^\d{4}-\d{2}$/.test(m.mese)) return { ok: false, perche: `il mese "${m.mese}" non va` }
  const titoli = new Map((dati.titoli ?? []).map((t) => [t.id, t]))
  const valute = new Set(m.cambi.map((c) => c.valuta))
  for (const p of m.prezzi) {
    const t = titoli.get(p.titolo)
    if (!t) return { ok: false, perche: `il titolo ${p.titolo} non è nel file` }
    if (!(typeof p.prezzo === 'number' && Number.isFinite(p.prezzo) && p.prezzo > 0))
      return { ok: false, perche: `il prezzo di ${t.simbolo ?? t.isin} non è un numero più di zero` }
    const valuta = valutaDelTitolo(dati, t)
    if (valuta !== 'EUR' && !valute.has(valuta)) return { ok: false, perche: `manca il cambio ${valuta}` }
    if ('controllo' in p && p.controllo !== undefined && !controlloValido(p.controllo))
      return { ok: false, perche: `il controllo del prezzo di ${t.simbolo ?? t.isin} non va` }
  }
  for (const c of m.cambi)
    if (!(typeof c.cambio === 'number' && Number.isFinite(c.cambio) && c.cambio > 0))
      return { ok: false, perche: `il cambio ${c.valuta} non è un numero più di zero` }
  return controllaRiferimenti(m)
}

/**
 * Scrive nel file (già in versione 3) i prezzi e i cambi del mese. Se il mese c'era già ("Rifai"),
 * i prezzi di quei titoli e quei cambi si sostituiscono; un prezzo a mano che sostituisce un altro prezzo
 * tiene quello di prima. Gli altri dati non si toccano. "quando" è l'istante della scrittura (ISO).
 */
export function scriviMese(dati: FileDati, m: MeseDaSalvare, quando: string): FileDati {
  const data = fineMese(m.mese)
  const titoli = new Map((dati.titoli ?? []).map((t) => [t.id, t]))
  const cambiNuovi = new Map(m.cambi.map((c) => [c.valuta, c]))
  const vecchiPrezzi = new Map((dati.prezzi ?? []).filter((p) => p.data === data).map((p) => [p.titolo, p]))
  const vecchiCambi = new Map((dati.cambi ?? []).filter((c) => c.data === data).map((c) => [c.valuta, c]))

  const nuoviPrezzi = m.prezzi.map((s): PrezzoFineMese => {
    const t = titoli.get(s.titolo)!
    const valuta = valutaDelTitolo(dati, t)
    // L'ordine dei campi è quello che si legge meglio con Blocco note.
    const p: PrezzoFineMese = {
      titolo: s.titolo,
      data,
      prezzo: s.prezzo,
      valuta,
      ...(valuta !== 'EUR' ? { cambio: cambiNuovi.get(valuta)!.cambio } : {}),
      fonte: s.fonte,
    }
    if ('seduta' in s) {
      p.seduta = s.seduta
      if (s.nota) p.nota = s.nota
      if (s.controllo) p.controllo = s.controllo
    } else {
      p.quando = quando
      const prima = vecchiPrezzi.get(s.titolo)
      if (prima && prima.prezzo !== s.prezzo) p.prima = { prezzo: prima.prezzo, fonte: prima.fonte }
    }
    return p
  })
  const nuoviCambi = m.cambi.map((s): CambioFineMese => {
    const c: CambioFineMese = { valuta: s.valuta, data, cambio: s.cambio, fonte: s.fonte }
    if ('seduta' in s) c.seduta = s.seduta
    else {
      c.quando = quando
      const prima = vecchiCambi.get(s.valuta)
      if (prima && prima.cambio !== s.cambio) c.prima = { cambio: prima.cambio, fonte: prima.fonte }
    }
    return c
  })

  const sostituiti = new Set(nuoviPrezzi.map((p) => p.titolo))
  const prezzi = [
    ...(dati.prezzi ?? [])
      .filter((p) => !(p.data === data && sostituiti.has(p.titolo)))
      // Un titolo in valuta il cui prezzo non è stato toccato prende il cambio nuovo del mese.
      .map((p) => (p.data === data && p.cambio && cambiNuovi.has(p.valuta) ? { ...p, cambio: cambiNuovi.get(p.valuta)!.cambio } : p)),
    ...nuoviPrezzi,
  ]
  prezzi.sort((a, b) => a.titolo.localeCompare(b.titolo) || a.data.localeCompare(b.data))

  const cambi = [...(dati.cambi ?? []).filter((c) => !(c.data === data && cambiNuovi.has(c.valuta))), ...nuoviCambi]
  cambi.sort((a, b) => a.valuta.localeCompare(b.valuta) || a.data.localeCompare(b.data))
  return scriviRiferimenti({ ...dati, prezzi, cambi }, m)
}

/** Il perché della copia fatta prima di scrivere il mese: "prima dell'aggiornamento di ottobre", o "prima di rifare settembre". */
export function percheDellaCopia(mese: string, rifai: boolean): string {
  return rifai ? `prima di rifare ${nomeMese(mese)}` : `prima dell'aggiornamento di ${nomeMese(mese)}`
}

/** Il mese c'è già nel file (allora salvarlo è un "Rifai"). */
export function meseGiaNelFile(dati: FileDati, mese: string): boolean {
  return (dati.prezzi ?? []).some((p) => p.data.startsWith(mese + '-'))
}
