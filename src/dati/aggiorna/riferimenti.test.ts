// Le prove di riferimenti e inflazione sui moduli puri, con il portafoglio inventato
// (primo acquisto il 12/02/2024, poi 01/03/2024, 03/06/2024 e una vendita il 15/09/2025).
import { describe, expect, it } from 'vitest'
import { controllaFile } from '../controllo.ts'
import { comeTesto, portafoglioInventato } from '../portafoglio-inventato.ts'
import type { FileDati, NicDelMese, ValoreRiferimento } from '../tipi.ts'
import {
  conNic,
  conRiga,
  creaRiferimenti,
  dateDaChiedere,
  dateNecessarie,
  frasiDopoIlSalvataggio,
  inEuro,
  mesiNicDaChiedere,
  mesiNicNecessari,
  nicAgganciato,
  nicFinoA,
  nicNonAncora,
  RACCORDO_2015_2025,
  riferimentiDaSalvare,
  riferimentiPronti,
  righeNic,
  scriviRiferimenti,
  statoDaNic,
  statoDaRiferimento,
  storiaMancante,
  sulMeseRiferimento,
  valoreDelMese,
  type EsitoRiferimento,
} from './riferimenti.ts'
import { aVersioneAttuale, controllaMese, scriviMese } from './versione3.ts'

const tutteLeFineMese = (da: string, a: string) => {
  const r: string[] = []
  for (let d = new Date(da + '-01T00:00:00Z'); d.toISOString().slice(0, 7) <= a; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const fine = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    r.push(fine.toISOString().slice(0, 10))
  }
  return r
}

const valore = (riferimento: ValoreRiferimento['riferimento'], data: string, v: number, extra: Partial<ValoreRiferimento> = {}): ValoreRiferimento => ({
  riferimento,
  data,
  valore: v,
  valuta: riferimento === 'sp500' || riferimento === 'nasdaq100' || riferimento === 'dowjones' ? 'USD' : 'EUR',
  ...(riferimento === 'sp500' || riferimento === 'nasdaq100' || riferimento === 'dowjones' ? { cambio: 1.1 } : {}),
  fonte: 'investing.com',
  seduta: data,
  ...extra,
})

/** Un esito che ha tutte le date chieste, con valori inventati. */
const tutto = (date: string[], v = 100, cambio?: number): EsitoRiferimento => ({
  ok: true,
  valori: date.map((data, i) => ({ data, valore: v + i, seduta: data, ...(cambio ? { cambio } : {}) })),
  mancano: [],
})

describe('quali date e quali mesi servono', () => {
  it('le fine mese dal primo movimento, senza le date dei movimenti', () => {
    const dati = portafoglioInventato()
    expect(dateNecessarie(dati, '2024-06')).toEqual(['2024-02-29', '2024-03-31', '2024-04-30', '2024-05-31', '2024-06-30'])
    expect(dateNecessarie(dati, '2025-09')).not.toContain('2025-09-15')
    expect(dateNecessarie(dati, '2026-10')).toEqual(tutteLeFineMese('2024-02', '2026-10'))
  })

  it('il NIC dal mese prima del primo acquisto', () => {
    const mesi = mesiNicNecessari(portafoglioInventato(), '2026-10')
    expect(mesi[0]).toBe('2024-01')
    expect(mesi.at(-1)).toBe('2026-10')
    expect(mesi).toHaveLength(34)
  })

  it('si chiede solo quello che manca; con "Rifai" anche la fine del mese, ma mai un valore a mano', () => {
    const dati: FileDati = {
      ...aVersioneAttuale(portafoglioInventato()),
      riferimenti: [valore('sp500', '2024-02-29', 4000), valore('sp500', '2026-09-30', 7000)],
      nic: [{ data: '2026-09-30', valore: 104.6, base: 2025, fonte: 'ISTAT' }],
    }
    const date = dateDaChiedere(dati, 'sp500', '2026-09', false)
    expect(date).not.toContain('2024-02-29')
    expect(date).not.toContain('2026-09-30')
    expect(dateDaChiedere(dati, 'sp500', '2026-09', true)).toContain('2026-09-30')
    expect(dateDaChiedere(dati, 'ftsemib', '2026-09', false)).toContain('2026-09-30')
    const aMano = { ...dati, riferimenti: [valore('sp500', '2026-09-30', 7000, { fonte: 'a mano' })] }
    expect(dateDaChiedere(aMano, 'sp500', '2026-09', true)).not.toContain('2026-09-30')
    // "Rifai" che non riesce a riscaricare: resta il valore di prima.
    let p = creaRiferimenti(dati, '2026-09', true)
    p = conRiga(p, 'sp500', (r) => ({ ...r, stato: statoDaRiferimento({ ok: false, perche: 'investing.com non ha risposto' }) }))
    expect(valoreDelMese(p, p.righe.find((r) => r.id === 'sp500')!)).toMatchObject({ valore: 7000, fonte: 'investing.com' })
    expect(riferimentiDaSalvare(p).riferimenti.filter((v) => v.riferimento === 'sp500')).toEqual([])
    expect(mesiNicDaChiedere(dati, '2026-09', false)).not.toContain('2026-09')
    expect(mesiNicDaChiedere(dati, '2026-09', true)).toContain('2026-09')
  })
})

describe('la parte della lista di Aggiorna', () => {
  it('la prima volta scarica anche la storia', () => {
    const p = creaRiferimenti(portafoglioInventato(), '2026-10', false)
    expect(p.primaVolta).toBe(true)
    expect(p.dal).toBe('2024-02')
    expect(p.righe.map((r) => r.id)).toEqual(['ftsemib', 'eurostoxx50', 'nasdaq100', 'dowjones', 'sp500'])
    expect(p.righe.every((r) => r.date.length === 33 && r.stato.tipo === 'attesa')).toBe(true)
    expect(p.nic.mesi).toHaveLength(34)
    // Storia lunga: una riga per la storia e una per il mese.
    expect(righeNic(p)).toEqual([
      { tipo: 'storia', da: '2024-01', a: '2026-09', mesi: 33 },
      { tipo: 'mese', mese: '2026-10', mancava: false },
    ])
  })

  it('il NIC che mancava dall’aggiornamento scorso si riprende da solo', () => {
    const dati: FileDati = { ...portafoglioInventato(), nic: mesiNicNecessari(portafoglioInventato(), '2026-08').map((m) => nic(m, 100)) }
    const p = creaRiferimenti(dati, '2026-10', false)
    expect(p.nic.mesi).toEqual(['2026-09', '2026-10'])
    expect(righeNic(p)).toEqual([
      { tipo: 'mese', mese: '2026-09', mancava: true },
      { tipo: 'mese', mese: '2026-10', mancava: false },
    ])
    // ISTAT ha settembre ma non ottobre: "fino a settembre", ottobre "non ancora".
    const arrivato = conNic(p, (n) => ({ ...n, stato: statoDaNic({ ok: true, valori: [{ data: '2026-09-30', valore: 104.6, base: 2025 }] }) }))
    expect(nicFinoA(arrivato.nic)).toBe('2026-09')
    expect(nicNonAncora(arrivato.nic)).toEqual(['2026-10'])
  })

  it('valore del mese, sul mese in punti, pronti e da salvare', () => {
    const dati = portafoglioInventato()
    let p = creaRiferimenti(dati, '2026-10', false)
    const sp = p.righe.find((r) => r.id === 'sp500')!
    // Fine settembre 100 punti, fine ottobre 110 punti: +10% sul mese, in punti (il cambio non conta).
    const esito: EsitoRiferimento = {
      ok: true,
      valori: [
        ...sp.date.filter((d) => d !== '2026-10-31' && d !== '2026-09-30').map((data) => ({ data, valore: 90, seduta: data, cambio: 1.2 })),
        { data: '2026-09-30', valore: 100, seduta: '2026-09-30', cambio: 1.25 },
        { data: '2026-10-31', valore: 110, seduta: '2026-10-30', cambio: 1.1 },
      ],
      mancano: [],
    }
    p = conRiga(p, 'sp500', (r) => ({ ...r, stato: statoDaRiferimento(esito) }))
    p = conRiga(p, 'nasdaq100', (r) => ({ ...r, stato: statoDaRiferimento({ ok: false, perche: 'investing.com non ha risposto' }) }))
    const riga = p.righe.find((r) => r.id === 'sp500')!
    expect(valoreDelMese(p, riga)).toMatchObject({ valore: 110, cambio: 1.1, seduta: '2026-10-30', fonte: 'investing.com' })
    expect(sulMeseRiferimento(p, riga)).toBeCloseTo(10, 6)
    expect(inEuro({ valore: 110, cambio: 1.1 }, 'USD')).toBeCloseTo(100, 9)
    expect(riferimentiPronti(p)).toBe(1)
    const s = riferimentiDaSalvare(p)
    expect(s.riferimenti).toHaveLength(33)
    expect(s.riferimenti.find((v) => v.data === '2026-10-31')).toEqual({
      riferimento: 'sp500',
      data: '2026-10-31',
      valore: 110,
      valuta: 'USD',
      cambio: 1.1,
      fonte: 'investing.com',
      seduta: '2026-10-30',
    })
    expect(s.nic).toEqual([])
  })
})

const nic = (mese: string, v: number, base: 2015 | 2025 = mese >= '2026-01' ? 2025 : 2015): NicDelMese => ({
  data: new Date(Date.UTC(+mese.slice(0, 4), +mese.slice(5, 7), 0)).toISOString().slice(0, 10),
  valore: v,
  base,
  fonte: 'ISTAT',
})

describe('dalla lista al file', () => {
  it('si scrive con il mese, il file resta valido, e un valore a mano resta', () => {
    const v3 = aVersioneAttuale(portafoglioInventato())
    const prima: FileDati = { ...v3, riferimenti: [valore('ftsemib', '2024-02-29', 130, { fonte: 'a mano', quando: '2026-10-01T10:00:00Z' })] }
    let p = creaRiferimenti(prima, '2026-09', true)
    for (const r of p.righe) p = conRiga(p, r.id, (x) => ({ ...x, stato: statoDaRiferimento(tutto(x.date, 100, r.id === 'sp500' || r.id === 'nasdaq100' || r.id === 'dowjones' ? 1.1 : undefined)) }))
    p = conNic(p, (n) => ({ ...n, stato: statoDaNic({ ok: true, valori: n.mesi.slice(0, -1).map((m) => ({ data: nic(m, 120).data, valore: 120, base: nic(m, 120).base })) }) }))
    const mese = { mese: '2026-09', prezzi: [], cambi: [{ valuta: 'GBP', cambio: 0.86, seduta: '2026-09-30', fonte: 'BCE' as const }], ...riferimentiDaSalvare(p) }
    expect(controllaMese(prima, mese)).toEqual({ ok: true })
    const dopo = scriviMese(prima, mese, '2026-10-19T20:00:00Z')
    // 5 indici × 32 fine mese; il valore a mano non si chiede e resta.
    expect(dopo.riferimenti).toHaveLength(5 * 32)
    expect(dopo.riferimenti!.find((v) => v.riferimento === 'ftsemib' && v.data === '2024-02-29')).toMatchObject({ valore: 130, fonte: 'a mano' })
    expect(dopo.nic).toHaveLength(32)
    expect(controllaFile(comeTesto(dopo)).ok).toBe(true)
    // Nessuno manca più, tranne il NIC di settembre.
    expect(storiaMancante(dopo, '2026-09')).toEqual({ riferimenti: {}, nic: ['2026-09'] })
    expect(frasiDopoIlSalvataggio(dopo, '2026-09', true)).toEqual([
      'I 5 indici di borsa hanno il valore di fine settembre.',
      'Lo storico degli indici da febbraio 2024 è completo, un valore per ogni fine mese.',
      'L’inflazione è disponibile fino ad agosto: il dato di settembre esce verso metà ottobre e si acquisisce al prossimo aggiornamento.',
    ])
    // Rifai: lo stesso valore sostituisce quello di prima, non si raddoppia.
    const ancora = scriviRiferimenti(dopo, { riferimenti: [valore('sp500', '2026-09-30', 7777)] })
    expect(ancora.riferimenti!.filter((v) => v.riferimento === 'sp500' && v.data === '2026-09-30')).toEqual([valore('sp500', '2026-09-30', 7777)])
  })

  it('il controllo rifiuta valori senza senso', () => {
    expect(controllaMese(portafoglioInventato(), { mese: '2026-09', prezzi: [], cambi: [], riferimenti: [valore('sp500', '2026-09-30', 0)] }).ok).toBe(false)
    expect(
      controllaMese(portafoglioInventato(), { mese: '2026-09', prezzi: [], cambi: [], riferimenti: [valore('sp500', '2026-09-30', 10, { cambio: undefined })] }).ok,
    ).toBe(false)
    expect(controllaMese(portafoglioInventato(), { mese: '2026-09', prezzi: [], cambi: [], nic: [{ ...nic('2026-09', 104), base: 2020 as 2025 }] }).ok).toBe(false)
  })

  it('il controllo all’apertura: elenchi nuovi e base del NIC come numero', () => {
    const v3 = aVersioneAttuale(portafoglioInventato())
    const buono: FileDati = { ...v3, riferimenti: [valore('ftsemib', '2026-09-30', 250)], nic: [nic('2026-09', 104.6)] }
    expect(controllaFile(comeTesto(buono)).ok).toBe(true)
    const testo = comeTesto(buono).replace('"base": 2025', '"base": "2025"')
    const esito = controllaFile(testo)
    expect(esito.ok).toBe(false)
    if (!esito.ok) expect(esito.problema.spiegazione).toContain('l’inflazione NIC')
    const sconosciuto = comeTesto({ ...buono, riferimenti: [{ ...valore('ftsemib', '2026-09-30', 250), riferimento: 'mib' as never }] })
    expect(controllaFile(sconosciuto).ok).toBe(false)
  })
})

describe('il NIC con le due basi agganciate', () => {
  it('base 2015 divisa per il coefficiente di raccordo', () => {
    const m = nicAgganciato([nic('2025-12', 122.6, 2015), nic('2026-01', 100.4, 2025)])
    expect(m.get('2025-12')).toBeCloseTo(122.6 / RACCORDO_2015_2025, 9)
    expect(m.get('2026-01')).toBe(100.4)
    // Da dicembre a gennaio: +0,4% circa, come le variazioni ISTAT (non un salto da 122,6 a 100,4).
    expect((m.get('2026-01')! / m.get('2025-12')! - 1) * 100).toBeCloseTo(0.43, 1)
  })
})
