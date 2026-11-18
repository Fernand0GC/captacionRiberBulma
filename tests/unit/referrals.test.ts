import { describe, expect, it } from 'vitest'
import {
  conversion,
  fmtPercent,
  fulfillment,
  groupByKind,
  monthDays,
  monthLabel,
  monthStart,
  percent,
  totals,
  type CountsWithGoal,
  type ReferrerKind,
} from '@/features/referrals/logic'

const row = (over: Partial<CountsWithGoal> = {}): CountsWithGoal => ({
  arrived: 0,
  uncontacted: 0,
  in_followup: 0,
  sold: 0,
  lost: 0,
  goal: null,
  ...over,
})

describe('referidos: porcentajes', () => {
  it('conversión = compraron ÷ llegados (10 referidos, 1 venta = 10 %)', () => {
    expect(conversion(row({ arrived: 10, sold: 1 }))).toBe(10)
  })
  it('sin llegados no hay conversión', () => {
    expect(conversion(row())).toBeNull()
  })
  it('cumplimiento = llegados ÷ meta, redondeado', () => {
    expect(fulfillment(row({ arrived: 10, goal: 20 }))).toBe(50)
    expect(fulfillment(row({ arrived: 2, goal: 3 }))).toBe(67)
    expect(fulfillment(row({ arrived: 25, goal: 20 }))).toBe(125)
  })
  it('sin meta (o meta 0) no hay cumplimiento', () => {
    expect(fulfillment(row({ arrived: 5 }))).toBeNull()
    expect(percent(5, 0)).toBeNull()
    expect(fmtPercent(null)).toBe('—')
    expect(fmtPercent(10)).toBe('10%')
  })
})

describe('referidos: totales y grupos', () => {
  it('suma conteos y solo las metas que existen', () => {
    const t = totals([row({ arrived: 3, sold: 1, uncontacted: 2, goal: 20 }), row({ arrived: 2, lost: 1, in_followup: 1 })])
    expect(t).toEqual({ arrived: 5, uncontacted: 2, in_followup: 1, sold: 1, lost: 1, goal: 20 })
  })
  it('sin ninguna meta, la meta total queda vacía', () => {
    expect(totals([row({ arrived: 1 })]).goal).toBeNull()
    expect(totals([]).arrived).toBe(0)
  })
  it('agrupa por tipo en orden fijo y sin grupos vacíos', () => {
    const rows: { name: string; kind: ReferrerKind }[] = [
      { name: 'Walker', kind: 'freelance' },
      { name: 'Fernanda', kind: 'staff' },
      { name: 'Tamara', kind: 'freelance' },
    ]
    const g = groupByKind(rows)
    expect(g.map((x) => x.kind)).toEqual(['staff', 'freelance'])
    expect(g[1]?.rows.map((r) => r.name)).toEqual(['Walker', 'Tamara'])
  })
})

describe('referidos: meses', () => {
  it('normaliza el mes al día 1', () => {
    expect(monthStart('2026-11')).toBe('2026-11-01')
    expect(monthStart('2026-11-18')).toBe('2026-11-01')
  })
  it('días del mes y nombre en español', () => {
    expect(monthDays(30)).toHaveLength(30)
    expect(monthDays(3)).toEqual([1, 2, 3])
    expect(monthLabel('2026-11-01')).toBe('noviembre 2026')
  })
})
