// Il perché di un errore, in parole: senza il prefisso tecnico che Electron aggiunge quando
// una richiesta al processo principale non va ("Error invoking remote method 'x': Error: …").

const PREFISSO_ELECTRON = /^Error invoking remote method '[^']*':\s*/
const NOME_ERRORE = /^(?:[A-Z][A-Za-z]*)?Error:\s*/

export function percheInParole(e: unknown): string {
  const testo = e instanceof Error ? e.message : String(e)
  const pulito = testo.replace(PREFISSO_ELECTRON, '').replace(NOME_ERRORE, '').trim()
  return pulito || 'non so perché'
}
