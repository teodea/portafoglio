// Registra dal PDF nel ponte finto, per guardare le pagine in un browser qualsiasi (ticket 12):
// i campi del PDF si leggono qui con la stessa funzione del processo principale; "Guarda il PDF" lo apre
// in una scheda; la ricerca dei codici è finta (trova solo i titoli inventati, con ISIN che comincia con ZZ).
import type { PontePdf } from '../../dati/titolo-nuovo.ts'

export function pdfFinto(): PontePdf {
  return {
    async leggiPdf(file) {
      const { campiDelPdf } = await import('../../dati/pdf-campi.ts')
      return Promise.all(
        file.map(async (f) => {
          const percorso = URL.createObjectURL(f)
          if (!/\.pdf$/i.test(f.name)) return { nome: f.name, percorso, perche: 'non è un PDF' }
          try {
            return { nome: f.name, percorso, campi: await campiDelPdf(await f.arrayBuffer()) }
          } catch {
            return { nome: f.name, percorso, perche: 'il file non si apre come PDF' }
          }
        }),
      )
    },
    async guardaPdf(percorso) {
      window.open(percorso, '_blank')
    },
    async cercaCodici(r) {
      await new Promise((fatto) => setTimeout(fatto, 900))
      if (!r.isin.startsWith('ZZ') && !r.indirizzo) return { investing: [], perche: `(prova nel browser) investing.com non conosce l’ISIN ${r.isin}`, yahoo: null }
      const ieri = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
      const nomeBorsa = { MIL: 'Milano', XET: 'Xetra', FRA: 'Francoforte', LON: 'Londra', PAR: 'Parigi' }[r.borsa]
      return {
        investing: [
          { codice: 990001, nome: `Fondo inventato ${r.simbolo}`, simbolo: r.simbolo, borsa: nomeBorsa, prezzo: 21.37, seduta: ieri },
          { codice: 990002, nome: `Fondo inventato ${r.simbolo} (altra classe)`, simbolo: `${r.simbolo}USD`, borsa: nomeBorsa, prezzo: 24.1, seduta: ieri },
        ],
        yahoo: `${r.simbolo}.MI`,
      }
    },
  }
}
