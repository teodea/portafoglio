// Il prezzo di fine mese di un titolo: si chiedono le fonti nell'ordine di ORDINE_FONTI
// (src/dati/aggiorna/fonti.ts) e vince la prima che ha la chiusura del mese. Se vince la borsa,
// accanto si mette il controllo di investing.com (FONTE_DEL_CONTROLLO).
// Ogni fonte ha la stessa forma: (titolo, mese) → chiusure giornaliere, oppure un errore in parole.
import { meseFinito, NomeMese, oggiLocale } from '../../src/dati/aggiorna/calendario.ts'
import { NON_FATTO } from '../../src/dati/aggiorna/controllo-prezzo.ts'
import {
  ALTRA_BORSA,
  FONTE,
  FONTE_DEL_CONTROLLO,
  nomeBreve,
  ORDINE_FONTI,
  RISERVE,
  type EsitoPrezzo,
  type FonteDaScaricare,
  type RichiestaPrezzo,
  type Tentativo,
} from '../../src/dati/aggiorna/fonti.ts'
import type { ControlloPrezzo } from '../../src/dati/tipi.ts'
import { chiusureBorsaItaliana } from './borsa-italiana.ts'
import { chiusuraDiFineMese, NonVa, type Chiusura } from './comune.ts'
import { MERCATI_EURONEXT, chiusureEuronext } from './euronext.ts'
import { chiusureInvesting } from './investing.ts'
import { chiusureYahoo } from './yahoo.ts'

export type Lettore = (t: RichiestaPrezzo, mese: string) => Promise<Chiusura[]>

/**
 * Le fonti che si possono chiedere. Deutsche Börse e Londra usano una finestra nascosta di Electron,
 * investing.com la rete di Chromium: si caricano solo quando servono (così questo modulo si prova anche senza Electron).
 */
export const LETTORI: Partial<Record<FonteDaScaricare, Lettore>> = {
  [FONTE.borsaItaliana]: (t) => chiusureBorsaItaliana(t),
  [FONTE.euronextMilano]: (t, mese) => chiusureEuronext(t, mese, MERCATI_EURONEXT.milano),
  [FONTE.euronextParigi]: (t, mese) => chiusureEuronext(t, mese, MERCATI_EURONEXT.parigi),
  [FONTE.xetra]: async (t, mese) => (await import('./deutsche-boerse.ts')).chiusureDeutscheBoerse(t, mese, 'Xetra'),
  [FONTE.francoforte]: async (t, mese) => (await import('./deutsche-boerse.ts')).chiusureDeutscheBoerse(t, mese, 'Frankfurt'),
  [FONTE.lse]: async (t) => (await import('./lse.ts')).chiusureLse(t),
  [FONTE.investing]: async (t, mese) => chiusureInvesting(t, mese, { investing: (await import('./rete.ts')).scaricaComeBrowser, yahoo: fetch }),
  [FONTE.yahoo]: (t, mese) => chiusureYahoo(t, mese),
}

/**
 * Per le prove (--spegni): le fonti con questi nomi, interi o brevi ("Deutsche Börse" spegne Xetra e Francoforte),
 * non rispondono. Così si vede il prezzo arrivare dalla riserva senza aspettare che una borsa si fermi davvero.
 */
export function conFontiSpente(lettori: Partial<Record<FonteDaScaricare, Lettore>>, spente: string[]): Partial<Record<FonteDaScaricare, Lettore>> {
  if (!spente.length) return lettori
  const nomi = new Set(spente.map((x) => x.toLowerCase()))
  const tutti = { ...lettori }
  for (const fonte of Object.keys(tutti) as FonteDaScaricare[])
    if (nomi.has(fonte.toLowerCase()) || nomi.has(nomeBreve(fonte).toLowerCase()))
      tutti[fonte] = async () => {
        throw new NonVa('non ha risposto (spenta apposta per la prova)')
      }
  return tutti
}

/** "Borsa Italiana non ha risposto (errore 503)" → per la riga sotto il prezzo che viene da una riserva. */
function perche(tentativi: Tentativo[]): string {
  return tentativi.map((x) => `${nomeBreve(x.fonte)} ${x.perche}`).join('; ')
}

const eRiserva = (fonte: FonteDaScaricare) => (RISERVE as readonly string[]).includes(fonte)

/** Il controllo di investing.com accanto al prezzo arrivato da `fonte`, o perché non si fa. */
async function controlla(
  t: RichiestaPrezzo,
  mese: string,
  fonte: FonteDaScaricare,
  tentativi: Tentativo[],
  lettori: Partial<Record<FonteDaScaricare, Lettore>>,
): Promise<ControlloPrezzo | undefined> {
  if (fonte === FONTE_DEL_CONTROLLO) return { perche: NON_FATTO.giaInvesting }
  const fallito = tentativi.find((x) => x.fonte === FONTE_DEL_CONTROLLO)
  if (fallito) return { perche: `${nomeBreve(FONTE_DEL_CONTROLLO)} ${fallito.perche}` }
  const leggi = lettori[FONTE_DEL_CONTROLLO]
  if (!leggi) return undefined
  const altra = t.borsaRiserve ? ALTRA_BORSA[t.borsaRiserve] : null
  try {
    const fine = chiusuraDiFineMese(await leggi(t, mese), mese, t.borsaRiserve ?? t.borsa)
    if (!fine) return { perche: `${nomeBreve(FONTE_DEL_CONTROLLO)} non ha la chiusura di ${NomeMese(mese).toLowerCase()}` }
    const nota = [altra ? `prezzo di ${altra.nome}, altra borsa` : '', fine.nota ?? ''].filter(Boolean).join('; ')
    return { prezzo: fine.prezzo, seduta: fine.seduta, ...(nota ? { nota } : {}) }
  } catch (e) {
    return { perche: `${nomeBreve(FONTE_DEL_CONTROLLO)} ${e instanceof NonVa ? e.message : 'non ha risposto'}` }
  }
}

export async function prezzoFineMese(
  t: RichiestaPrezzo,
  mese: string,
  lettori: Partial<Record<FonteDaScaricare, Lettore>> = LETTORI,
  oggi = oggiLocale(),
): Promise<EsitoPrezzo> {
  if (!meseFinito(mese, oggi)) return { ok: false, perche: `${NomeMese(mese)} non è ancora finito`, tentativi: [] }
  const tentativi: Tentativo[] = []
  // Le riserve che hanno il titolo solo su un'altra borsa danno il prezzo di quella (es. Xetra per un titolo di Francoforte).
  const altra = t.borsaRiserve ? ALTRA_BORSA[t.borsaRiserve] : null
  for (const fonte of ORDINE_FONTI[t.borsa] ?? []) {
    const leggi = lettori[fonte]
    if (!leggi) continue
    const daAltra = eRiserva(fonte) && altra
    try {
      const fine = chiusuraDiFineMese(await leggi(t, mese), mese, daAltra ? t.borsaRiserve! : t.borsa)
      if (!fine) {
        tentativi.push({ fonte, perche: `non ha la chiusura di ${NomeMese(mese).toLowerCase()}` })
        continue
      }
      const note = [tentativi.length ? perche(tentativi) : '', daAltra ? `prezzo di ${altra.nome} da ${nomeBreve(fonte)}` : '', fine.nota ?? ''].filter(
        Boolean,
      )
      const controllo = await controlla(t, mese, fonte, tentativi, lettori)
      return {
        ok: true,
        prezzo: fine.prezzo,
        seduta: fine.seduta,
        fonte: daAltra ? altra.fonte : fonte,
        ...(note.length ? { nota: note.join('; ') } : {}),
        ...(controllo ? { controllo } : {}),
        tentativi,
      }
    } catch (e) {
      tentativi.push({ fonte, perche: e instanceof NonVa ? e.message : 'non ha risposto' })
    }
  }
  return { ok: false, perche: tentativi.length ? perche(tentativi) : 'nessuna fonte per questa borsa', tentativi }
}
