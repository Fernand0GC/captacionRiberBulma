import { describe, expect, it } from 'vitest'
import type { RangeContact } from '@/features/referrals/api'
import { filterReferrals, referralOutcome, summarizeReferrals } from '@/features/referrals/detail'

const c = (full_name: string, n: Partial<RangeContact> = {}): RangeContact => ({
  id: full_name,
  branch_id: 5,
  branch_name: 'VERDOLAGO',
  referrer_id: 1,
  referrer_name: 'Rosa',
  full_name,
  phone: '71234567',
  product: null,
  assigned_to: 'Isabel',
  registered_by: 'Jessica',
  stage: 'capture',
  arrived_at: '2026-11-18T13:00:00Z',
  sold_at: null,
  last_contact_at: null,
  days_waiting: null,
  contacts: 0,
  ...n,
})

const list = [
  c('Estela', { stage: 'sale', sold_at: '2026-11-20T15:00:00Z', contacts: 3 }),
  c('Julio', { stage: 'followup', contacts: 2 }),
  c('Pedro', { days_waiting: 3, assigned_to: null }),
  c('Marta', { contacts: 1 }),
  c('Óscar', { days_waiting: 5, arrived_at: '2026-11-16T13:00:00Z' }),
]

describe('referralOutcome', () => {
  it('sin contactar, sin cambio o la etapa de hoy', () => {
    expect(list.map(referralOutcome)).toEqual(['sale', 'followup', 'none', 'same', 'none'])
  })
  it('con la base anterior deduce el contacto del último', () => {
    expect(referralOutcome(c('X', { contacts: undefined, last_contact_at: '2026-11-19T12:00:00Z', stage: 'interested' }))).toBe('interested')
  })
})

describe('summarizeReferrals', () => {
  it('cuenta llegados, contactados, espera máxima, compras y responsables', () => {
    const s = summarizeReferrals(list)
    expect([s.total, s.contacted, s.pct, s.pending, s.maxWait, s.sold, s.soldPct]).toEqual([5, 3, 60, 2, 5, 1, 20])
    expect(s.byAssignee).toEqual([
      { name: 'Isabel', n: 4, contacted: 3 },
      { name: null, n: 1, contacted: 0 },
    ])
    expect(s.byOutcome.none).toBe(2)
    expect(s.byOutcome.same).toBe(1)
  })
  it('sin referidos no divide por cero', () => {
    expect(summarizeReferrals([])).toMatchObject({ total: 0, pct: 0, soldPct: 0, maxWait: null })
  })
})

describe('filterReferrals', () => {
  it('primero los sin contactar (el que más espera), luego los más recientes', () => {
    expect(filterReferrals(list, { contact: 'all', outcome: null }).map((x) => x.full_name)).toEqual(['Óscar', 'Pedro', 'Estela', 'Julio', 'Marta'])
  })
  it('filtra por contacto, responsable (incluido «Sin asignar») y proceso', () => {
    expect(filterReferrals(list, { contact: 'done', outcome: null }).length).toBe(3)
    expect(filterReferrals(list, { contact: 'all', assignee: null, outcome: null }).map((x) => x.full_name)).toEqual(['Pedro'])
    expect(filterReferrals(list, { contact: 'all', outcome: 'sale' }).map((x) => x.full_name)).toEqual(['Estela'])
  })
})
