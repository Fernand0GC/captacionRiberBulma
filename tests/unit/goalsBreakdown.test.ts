import { describe, expect, it } from 'vitest'
import { channelBreakdown } from '@/features/goals/logic'

/** La tabla existe cuando hay filas; si no, la prueba falla con un mensaje claro. */
const table = (r: Parameters<typeof channelBreakdown>[0]) => {
  const b = channelBreakdown(r)
  if (!b) throw new Error('se esperaba tabla')
  return b
}

// Spec 037, criterio 4: tabla «Por canal» de la tarjeta «Hoy».
const rows = [
  { channel: 'RRSS-Mensajería', goal: 20, result: 6, share_goal: 10, share_result: 2 },
  { channel: 'Llamadas', goal: 15, result: 4, share_goal: 0, share_result: 0 },
  { channel: 'Compartidas y estados', goal: 0, result: 0, share_goal: 15, share_result: 4 },
]

describe('channelBreakdown', () => {
  it('filas con % redondeado y «—» cuando la meta es 0', () => {
    const b = table(rows)
    expect(b.rows.map((r) => [r.channel, r.pct])).toEqual([
      ['RRSS-Mensajería', '30%'],
      ['Llamadas', '27%'],
      ['Compartidas y estados', '—'],
    ])
  })

  it('total con las sumas y su %', () => {
    expect(table(rows).total).toEqual({
      channel: 'Total',
      goal: 35,
      result: 10,
      share_goal: 25,
      share_result: 6,
      pct: '29%',
    })
  })

  it('muestra columnas de compartidas solo si algún canal tiene esa meta', () => {
    expect(table(rows).showShares).toBe(true)
    expect(table(rows.slice(1, 2)).showShares).toBe(false)
  })

  it('sin filas no hay tabla', () => {
    expect(channelBreakdown([])).toBeNull()
  })
})
