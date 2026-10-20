// La parte "Aggiorna fine mese" del ponte finto, per guardare le pagine in un browser qualsiasi:
// niente internet, i prezzi sono inventati a partire da quelli del portafoglio inventato.
// Il primo titolo in valuta "manca" alla prima richiesta e arriva al "Riprova", per provare i due casi.
// Al primo "Riprova" arriva da Yahoo (seconda riserva). Il primo titolo di Milano arriva da Euronext Milano,
// con il controllo di investing.com diverso di +0,6%.
import { fineMese } from '../dati/aggiorna/calendario.ts'
import { FONTE, ORDINE_FONTI, type EsitoPrezzo } from '../dati/aggiorna/fonti.ts'
import type { PonteAggiorna } from '../dati/aggiorna/ponte-aggiorna.ts'
import { aVersione3, controllaMese, meseGiaNelFile, percheDellaCopia, scriviMese } from '../dati/aggiorna/versione3.ts'
import { controllaFile } from '../dati/controllo.ts'
import { comeTesto } from '../dati/portafoglio-inventato.ts'
import type { Apertura } from '../dati/ponte.ts'

export type AccessoFinto = {
  leggi: () => string | null
  scrivi: (testo: string, perche: string) => void
  apri: () => Promise<Apertura>
}

const pausa = (ms: number) => new Promise((fatto) => setTimeout(fatto, ms))

export function aggiornaFinto(accesso: AccessoFinto): PonteAggiorna {
  const tentativi = new Map<string, number>()
  return {
    async prezzoFineMese(r, mese): Promise<EsitoPrezzo> {
      await pausa(250 + Math.random() * 350)
      const n = (tentativi.get(r.isin) ?? 0) + 1
      tentativi.set(r.isin, n)
      const testo = accesso.leggi()
      const dati = testo ? controllaFile(testo) : null
      if (!dati?.ok) return { ok: false, perche: 'file non leggibile', tentativi: [] }
      const ultimo = (dati.dati.prezzi ?? [])
        .filter((p) => p.titolo.startsWith(r.isin) && p.data < mese + '-01')
        .sort((a, b) => b.data.localeCompare(a.data))[0]
      const fonte = ORDINE_FONTI[r.borsa][0]
      if (r.valuta !== 'EUR' && n === 1)
        return {
          ok: false,
          perche: `${fonte} non ha risposto (prova nel browser: riprova)`,
          tentativi: [{ fonte, perche: 'non ha risposto' }],
        }
      const base = ultimo?.prezzo ?? 10
      const prezzo = Math.round(base * (1 + ((r.isin.charCodeAt(11) % 7) - 3) / 100) * 100) / 100
      const seduta = fineMese(mese) // nel browser basta così
      // Il controllo di investing.com: uguale, tranne per il primo titolo di Milano (diverso di +0,6%).
      const controllo = r.codiceInvesting
        ? { prezzo: r.isin.endsWith('1') ? Math.round(prezzo * 1.006 * 100) / 100 : prezzo, seduta }
        : { perche: 'investing.com non si può chiedere: nel file manca il codice investing.com del titolo' }
      if (r.borsa === 'MIL' && r.isin.endsWith('1'))
        return {
          ok: true,
          prezzo,
          seduta,
          fonte: FONTE.euronextMilano,
          nota: 'Borsa Italiana non ha risposto (prova nel browser)',
          controllo,
          tentativi: [{ fonte: FONTE.borsaItaliana, perche: 'non ha risposto' }],
        }
      // Al "Riprova" il titolo in valuta arriva dalla seconda riserva.
      if (r.valuta !== 'EUR' && n === 2)
        return {
          ok: true,
          prezzo,
          seduta,
          fonte: FONTE.yahoo,
          nota: `${fonte} e investing.com non hanno risposto (prova nel browser)`,
          controllo: { perche: 'investing.com non ha risposto' },
          tentativi: [
            { fonte, perche: 'non ha risposto' },
            { fonte: FONTE.investing, perche: 'non ha risposto' },
          ],
        }
      return { ok: true, prezzo, seduta, fonte, controllo, tentativi: [] }
    },
    async cambioFineMese(valuta, mese) {
      await pausa(300)
      return { ok: true, cambio: valuta === 'GBP' ? 0.8691 : 1.1, seduta: fineMese(mese), fonte: 'BCE' }
    },
    async salvaMese(m) {
      await pausa(400)
      const testo = accesso.leggi()
      const esito = testo ? controllaFile(testo) : null
      if (!esito?.ok) return { esito: 'errore', perche: 'il file non si legge' }
      const v3 = aVersione3(esito.dati)
      const ok = controllaMese(v3, m)
      if (!ok.ok) return { esito: 'errore', perche: ok.perche }
      const perche = percheDellaCopia(m.mese, meseGiaNelFile(esito.dati, m.mese))
      accesso.scrivi(comeTesto(scriviMese(v3, m, new Date().toISOString())), perche)
      const apertura = await accesso.apri()
      const copia = apertura.stato === 'pronto' ? (apertura.copie[0]?.file ?? '') : ''
      return { esito: 'salvato', apertura, copia }
    },
  }
}
