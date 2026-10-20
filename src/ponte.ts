// Il ponte verso il processo principale. Dentro Electron è window.ponte (dal preload).
// Aperte in un browser qualsiasi (per guardare le pagine durante lo sviluppo) le pagine
// usano invece un ponte finto, con il portafoglio inventato e niente file veri.
import { controllaFile } from './dati/controllo.ts'
import { nomeCopia, nomeRotto, ordinaCopie, PERCHE_APERTURA } from './dati/copie.ts'
import { comeTesto, portafoglioInventato } from './dati/portafoglio-inventato.ts'
import type { Apertura, Cartella, Ponte } from './dati/ponte.ts'
import { aggiornaFinto, type AccessoFinto } from './aggiorna/ponte-finto.ts'
import { correzioneFinta } from './pannello/correzione-finta.ts'
import { movimentiFinti } from './pannello/movimenti-finti.ts'
import { pdfFinto } from './pagine/movimenti/pdf-finto.ts'
import { riferimentiFinti } from './aggiorna/ponte-finto-riferimenti.ts'
import { codiciFinti, conRiferimentiInventati as conDatiInventati, correzioneDatoFinta } from './pagine/dati/ponte-finto-dati.ts'
import { percheDelRitorno } from './dati/torna-copia.ts'
import { conRiferimentiInventati, riferimentoAManoFinto } from './pannello/riferimento-finto.ts'
import { excelFinto } from './pagine/dati/excel-finto.ts'

declare global {
  interface Window {
    ponte?: Ponte
  }
}

export const nelBrowser = !window.ponte
export const ponte: Ponte = window.ponte ?? creaPonteFinto(new URLSearchParams(location.search).get('prova'))

/**
 * Il ponte finto. Con ?prova=… nell'indirizzo si vede un caso particolare:
 * nessuna (cartella da scegliere), mancante (cartella sparita), senza-file, rotto, rotto-senza-copie, dato (un dato sbagliato),
 * riferimenti (con i valori inventati dei riferimenti e del NIC, per la classifica della pagina Portafoglio),
 * dati (lo stesso, con qualche "manca", per la pagina Dati).
 */
function creaPonteFinto(prova: string | null): Ponte {
  const cartella: Cartella = { percorso: 'C:\\Prove\\Dati inventati', nome: 'Dati inventati' }
  const buono = comeTesto(
    prova === 'riferimenti'
      ? conRiferimentiInventati(portafoglioInventato())
      : prova === 'dati'
        ? conDatiInventati(portafoglioInventato())
        : portafoglioInventato(),
  )
  const ieri = new Date(Date.now() - 24 * 60 * 60 * 1000)
  let copie: string[] = prova === 'rotto-senza-copie' ? [] : [nomeCopia(ieri, PERCHE_APERTURA)]
  // Il contenuto di ogni copia, per "Torna a questa copia" (ticket 13).
  const contenuti = new Map<string, string>(copie.map((c) => [c, buono]))
  const nuovaCopia = (perche: string, com: string) => {
    let n = 1
    while (copie.includes(nomeCopia(new Date(), perche, n))) n++
    const nome = nomeCopia(new Date(), perche, n)
    copie = [...copie, nome]
    contenuti.set(nome, com)
    return nome
  }
  let scelta = prova !== 'nessuna'
  let testo =
    prova === 'rotto' || prova === 'rotto-senza-copie'
      ? buono.replace('"valuta": "GBP",', '"valuta": "GBP"')
      : prova === 'dato'
        ? buono.replace('"prezzo": 12.75', '"prezzo": "12,75"')
        : prova === 'senza-file'
          ? null
          : buono
  const aspetta = () => new Promise((fatto) => setTimeout(fatto, 150))

  const apri = async (): Promise<Apertura> => {
    await aspetta()
    if (!scelta) return { stato: 'nessuna-cartella' }
    if (prova === 'mancante') return { stato: 'cartella-mancante', cartella }
    if (testo === null) return { stato: 'file-mancante', cartella }
    const esito = controllaFile(testo)
    const controllato = new Date().toISOString()
    if (!esito.ok) return { stato: 'rotto', cartella, problema: esito.problema, controllato, copie: ordinaCopie(copie) }
    return { stato: 'pronto', cartella, dati: esito.dati, controllato, copie: ordinaCopie(copie) }
  }

  const accesso: AccessoFinto = {
    leggi: () => testo,
    scrivi: (nuovo, perche) => {
      nuovaCopia(perche, testo ?? '')
      testo = nuovo
    },
    apri,
  }

  return {
    ...riferimentiFinti(),
    ...aggiornaFinto(accesso),
    ...correzioneFinta(accesso),
    ...correzioneDatoFinta(accesso),
    ...codiciFinti(accesso),
    tornaAQuestaCopia: async (file) => {
      await aspetta()
      const com = contenuti.get(file)
      const c = ordinaCopie([file])[0]
      if (com === undefined || !c || c.rotta) return { esito: 'errore', perche: 'la copia scelta non è stata trovata' }
      const fatta = nuovaCopia(percheDelRitorno(c), testo ?? '')
      testo = com
      return { esito: 'fatto', apertura: await apri(), copia: fatta }
    },
    ...riferimentoAManoFinto(accesso),
    ...movimentiFinti(accesso),
    ...pdfFinto(),
    ...excelFinto(),
    apri,
    scegliCartella: async () => {
      scelta = true
      prova = null
      return apri()
    },
    tornaAllaCopia: async () => {
      copie = [...copie, nomeRotto(new Date())]
      testo = buono
      return apri()
    },
    creaFileVuoto: async () => {
      testo = comeTesto({ formato: 'portafoglio', versione: 2, creato: new Date().toISOString(), titoli: [], operazioni: [], dividendi: [], prezzi: [] })
      return apri()
    },
    apriInEsplora: async (quale) => {
      console.info(`(prova nel browser) qui si aprirebbe in Esplora file la cartella ${quale}`)
    },
  }
}
