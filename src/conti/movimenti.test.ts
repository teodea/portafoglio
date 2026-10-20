// Le prove dei conti della pagina Movimenti, sul portafoglio inventato.
import { describe, expect, it } from 'vitest'
import { applicaModifica } from '../dati/movimenti.ts'
import { portafoglioInventato } from '../dati/portafoglio-inventato.ts'
import type { FileDati } from '../dati/tipi.ts'
import { anniDeiMovimenti, anteprimaVendita, elencoMovimenti, riquadriMovimenti, spiegazioneDelMovimento, totaleDividendi } from './movimenti.ts'
import { contiDeiTitoli } from './titoli.ts'

const MOND = 'ZZ0000000001-MIL'

/** Il portafoglio inventato con una vendita parziale di MOND e un dividendo, a ottobre (dopo l'ultimo fine mese). */
function conVendita(): FileDati {
  let d = portafoglioInventato()
  d = applicaModifica(d, { azione: 'registra', movimento: { tipo: 'acquisto', titolo: MOND, data: '2025-01-10', quantita: 50, prezzo: 13, cambio: 1, commissioni: 5, totale: 655 } }, '').dati
  d = applicaModifica(d, { azione: 'registra', movimento: { tipo: 'vendita', titolo: MOND, data: '2026-10-05', quantita: 60, prezzo: 13, cambio: 1, commissioni: 5, totale: 775 } }, '').dati
  d = applicaModifica(d, { azione: 'registra', movimento: { tipo: 'dividendo', titolo: MOND, data: '2026-10-05', lordo: 9, imposte: 2.34 } }, '').dati
  return d
}

describe('l’elenco dei movimenti', () => {
  it('dal più recente; a parità di data prima quello scritto dopo; anche dopo l’ultimo fine mese', () => {
    const righe = elencoMovimenti(conVendita())
    expect(righe.map((r) => `${r.data} ${r.tipo}`)).toEqual([
      '2026-10-05 dividendo',
      '2026-10-05 vendita',
      '2025-09-15 vendita',
      '2025-03-01 dividendo',
      '2025-01-10 acquisto',
      '2024-06-03 acquisto',
      '2024-03-01 acquisto',
      '2024-02-12 acquisto',
    ])
    expect(anniDeiMovimenti(righe)).toEqual(['2026', '2025', '2024'])
  })

  it('la vendita parziale: costo medio e guadagno incassato come nei conti dei titoli', () => {
    const d = conVendita()
    const v = elencoMovimenti(d).find((r) => r.tipo === 'vendita' && r.data === '2026-10-05')!
    // 100 a 10,05 € + 50 a 13,10 € = 1.660 € per 150 quote: 11,0667 € a quota.
    expect(v.vendita!.quotePrima).toBe(150)
    expect(v.vendita!.costoMedio).toBeCloseTo(1660 / 150, 10)
    expect(v.vendita!.guadagnoIncassato.n).toBeCloseTo(775 - (1660 / 150) * 60, 10)
    expect(v.sotto).toBe('vendita parziale')
    expect(v.verso).toBe(1)
    // Per le vendite fino all'ultimo fine mese, i conti dei titoli dicono lo stesso.
    const obbl = elencoMovimenti(d).find((r) => r.id === 'op-4')!
    const dalConto = contiDeiTitoli(d).titoli.find((t) => t.id === 'ZZ0000000003-MIL')!.vendite[0]
    expect(obbl.vendita!.guadagnoIncassato.n).toBeCloseTo(dalConto.guadagnoIncassato.n!, 10)
    expect(obbl.vendita!.costoMedio).toBeCloseTo(dalConto.costoMedio, 10)
  })

  it('il dividendo: quote di quel giorno, lordo per quota, % di imposte, e il conto nel pannello', () => {
    const d = conVendita()
    const r = elencoMovimenti(d).find((x) => x.tipo === 'dividendo' && x.data === '2026-10-05')!
    expect(r.quote).toBe(90)
    expect(r.perQuota).toBeCloseTo(0.1, 10)
    expect(r.impostePct).toBeCloseTo(0.26, 10)
    expect(r.soldi.n).toBe(6.66)
    const s = spiegazioneDelMovimento(d, r.id)!
    expect(s.movimento).toBe(r.id)
    expect(s.conto.map((c) => c.etichetta)).toEqual(['Quote in portafoglio', '× lordo per quota', '= lordo', '− imposte (26,0%)', 'Netto accreditato'])
    const cedola = elencoMovimenti(d).find((x) => x.id === 'div-1')!
    expect(cedola.sotto).toBe('cedola dell’obbligazione')
    expect(spiegazioneDelMovimento(d, 'non-c-e')).toBeNull()
  })

  it('un movimento corretto a mano porta il segno; scritto a mano dice "scritto a mano"', () => {
    const d = applicaModifica(conVendita(), { azione: 'correggi', id: 'op-1', campi: { commissioni: 6, totale: 1006 } }, 'x').dati
    const righe = elencoMovimenti(d)
    expect(righe.find((r) => r.id === 'op-1')!.aMano).toBe(true)
    expect(righe.find((r) => r.data === '2025-01-10')!).toMatchObject({ aMano: false, fonte: 'inserito manualmente' })
    expect(righe.find((r) => r.id === 'op-1')!.soldi.perche.movimento).toBe('op-1')
  })
})

describe('i quattro riquadri', () => {
  it('tutti gli anni: soldi investiti = comprato − venduto; i dividendi a parte', () => {
    const d = portafoglioInventato()
    const q = riquadriMovimenti(elencoMovimenti(d), null)
    expect(q.comprato.n).toBeCloseTo(1005 + 951.18 + 992.95, 10)
    expect(q.venduto.n).toBeCloseTo(1007.05, 10)
    expect(q.investiti.n).toBeCloseTo(1005 + 951.18 + 992.95 - 1007.05, 10)
    expect(q.dividendi.n).toBe(17.5)
    expect([q.acquisti, q.vendite, q.pagamenti]).toEqual([3, 1, 1])
    expect(q.investiti.perche.titolo).toBe('Capitale investito')
    expect(q.comprato.perche.conto.map((r) => r.etichetta)).toEqual(['Nel 2024 (3)', 'Totale acquisti'])
  })

  it('un anno: i numeri di quell’anno', () => {
    const righe = elencoMovimenti(conVendita())
    const q = riquadriMovimenti(righe, '2025')
    expect(q.comprato.n).toBe(655)
    expect(q.venduto.n).toBe(1007.05)
    expect(q.investiti.n).toBeCloseTo(655 - 1007.05, 10)
    expect(q.investiti.perche.titolo).toBe('Investimento netto del 2025')
    expect(q.comprato.perche.conto[0].etichetta).toBe('Acquisto di MOND del 10/01/2025')
    expect(totaleDividendi(righe.filter((r) => r.anno === '2026'))).toEqual({ lordo: 9, imposte: 2.34, netto: 6.66 })
  })
})

describe('l’anteprima di una vendita prima di registrarla', () => {
  it('dice quante quote c’erano, il costo medio e il guadagno incassato', () => {
    const d = portafoglioInventato()
    const v = anteprimaVendita(d, { tipo: 'vendita', titolo: MOND, data: '2026-10-05', quantita: 40, prezzo: 13, cambio: 1, commissioni: 5, totale: 515 })!
    expect(v.quotePrima).toBe(100)
    expect(v.costoMedio).toBeCloseTo(10.05, 10)
    expect(v.guadagnoIncassato.n).toBeCloseTo(515 - 402, 10)
    expect(v.parziale).toBe(true)
  })
})
