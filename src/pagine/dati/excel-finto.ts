// "Scarica in Excel" nel ponte finto, per guardare le pagine in un browser qualsiasi (ticket 14):
// il file vero lo scrive solo il processo principale, qui si fa finta e si dice come si chiamerebbe.
import { nomeFileExcel, type PonteExcel } from '../../dati/excel.ts'

export function excelFinto(): PonteExcel {
  return {
    async scaricaInExcel(libro) {
      await new Promise((fatto) => setTimeout(fatto, 400))
      const nome = nomeFileExcel(libro.oggi)
      console.info(`(prova nel browser) qui si scriverebbe ${nome} nella cartella Download, con i fogli:`, libro.fogli.map((f) => f.nome))
      return { esito: 'fatto', nome, percorso: 'C:\\Prove\\Download\\' + nome }
    },
    async apriFileScaricato(percorso) {
      console.info(`(prova nel browser) qui si aprirebbe in Excel ${percorso}`)
    },
  }
}
