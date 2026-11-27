import { describe, expect, it } from 'vitest'
import { shownGoalKeys, todaySubtitle } from '@/features/goals/logic'
import type { DayGoals } from '@/features/goals/api'

// Spec 034, criterio 6: la tarjeta «Hoy» muestra Compartidas cuando hay meta y avisa si Captaciones sale de la
// Planificación.
const base: DayGoals = {
  day: '2026-11-27',
  adjusted: false,
  note: null,
  captures_from_plan: false,
  by_channel: [],
  goals: { captures: 20, contacts: null, potential: 5, sales: 2, shares: null },
  actuals: { captures: 3, contacts: 0, potential: 1, sales: 0, shares: 0 },
}

describe('shownGoalKeys', () => {
  it('solo las metas que tienen valor, en orden; Compartidas al final', () => {
    expect(shownGoalKeys(base)).toEqual(['captures', 'potential', 'sales'])
    expect(shownGoalKeys({ ...base, goals: { ...base.goals, shares: 15 } })).toEqual([
      'captures',
      'potential',
      'sales',
      'shares',
    ])
  })
})

describe('todaySubtitle', () => {
  it('meta base o ajustada, como antes', () => {
    expect(todaySubtitle(base)).toBe('Meta base')
    expect(todaySubtitle({ ...base, adjusted: true, note: 'feria' })).toBe('Meta ajustada · feria')
  })

  it('agrega «Captaciones desde la Planificación»', () => {
    expect(todaySubtitle({ ...base, captures_from_plan: true })).toBe('Meta base · Captaciones desde la Planificación')
    expect(todaySubtitle({ ...base, adjusted: true, note: null, captures_from_plan: true })).toBe(
      'Meta ajustada · Captaciones desde la Planificación',
    )
  })
})
