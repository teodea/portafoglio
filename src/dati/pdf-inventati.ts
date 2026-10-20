// I campi di due PDF della banca INVENTATI, per le prove: stessi nomi dei campi dei moduli Fineco
// (AMM021 per acquisti e vendite, CED026 per dividendi), numeri e codici di fantasia (ISIN che comincia con ZZ).
import type { CampiPdf } from './pdf-fineco.ts'

/** Un modulo d'acquisto o di vendita inventato (AMM021). */
export function campiAcquisto(c: Partial<CampiPdf> = {}): CampiPdf {
  return {
    Intestazione_dossier: 'PERSONA INVENTATA',
    dossier: '0000000',
    Descrizione: 'INVENTATO MONDO ACC',
    Simbolo: 'MOND',
    Isin: 'ZZ0000000001',
    Operazione: 'ACQUISTO TITOLI',
    Rif_ordine: '000000000123456789',
    Data_ora_esecuzione: '08/10/2026 10:15:00',
    Valuta_regolamento: '12/10/2026',
    Mercato: 'EURONEXT MILAN',
    Quantita: '73,000',
    Prezzo_eseguito: '12,50000',
    Divisa: 'EUR ',
    Cambio_applicato: '1,00000',
    Ritenuta_rateo: '0,00 EUR ',
    Bolli: '0,00 EUR ',
    Commissioni: '2,95 EUR ',
    Spese: '0,00 EUR ',
    Tot_Commissioni_Spese: '2,95 EUR ',
    Tot_EUR_debito_credito: '915,45 EUR ',
    ...c,
  } as CampiPdf
}

/** Un modulo di dividendo inventato (CED026). */
export function campiDividendo(c: Partial<CampiPdf> = {}): CampiPdf {
  return {
    Intestazione_dossier: 'PERSONA INVENTATA',
    Descrizione: 'INVENTATO MONDO ACC',
    Simbolo: '            XYZABC',
    Isin: 'ZZ0000000001',
    Operazione: 'DIVIDENDI',
    Valuta_regolamento: '30/09/2026',
    Divisa: 'EUR',
    cambio: '1,00000',
    Quantita: '100,000',
    Cedola: '   ',
    Importo_unitario: '0,20000 EUR',
    Commissioni: '0,00 EUR ',
    Spese: '0,00 EUR ',
    Controvalore_lordo: '20,00 EUR ',
    Importo_ritenuta: '5,20 EUR ',
    Controvalore_netto: '14,80 EUR ',
    Commissioni_valutarie: '0,00 EUR ',
    ...c,
  } as CampiPdf
}
