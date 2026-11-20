import { describe, expect, it } from 'vitest'
import { filterAssigned, outcomeOf, summarizeAssigned } from '@/features/monitoring/assigned'
import type { AgentAssignedRow } from '@/features/monitoring/api'

const row = (full_name: string, n: Partial<AgentAssignedRow> = {}): AgentAssignedRow => ({
  prospect_id: full_name,
  full_name,
  assigned_at: '2026-11-20T18:10:00Z', // 14:10 La Paz
  self_assigned: false,
  assigned_by: 'Enc. Isabel',
  stage_at: 'capture',
  stage_now: 'capture',
  contacts: 0,
  first_at: null,
  last_at: null,
  last_method: null,
  last_result: null,
  last_note: null,
  reassigned: false,
  reassigned_to: null,
  reassigned_at: null,
  ...n,
})

const rows = [
  row('a', { contacts: 1, stage_now: 'recapture', first_at: '2026-11-20T20:00:00Z' }),
  row('b', { contacts: 2, stage_at: 'recapture', stage_now: 'followup', first_at: '2026-11-21T13:15:00Z' }), // al otro día
  row('c', { contacts: 1, stage_at: 'interested', stage_now: 'sale', first_at: '2026-11-20T21:00:00Z' }),
  row('d', { contacts: 1, stage_at: 'followup', stage_now: 'followup', first_at: '2026-11-20T21:00:00Z' }),
  row('e'),
  row('f', { stage_at: 'sale', stage_now: 'sale' }),
]

describe('outcomeOf', () => {
  it('sin contactos: «Sin contactar» aunque otro le haya cambiado la etapa', () =>
    expect(outcomeOf({ contacts: 0, stage_at: 'capture', stage_now: 'followup' })).toBe('none'))
  it('contactado y en la misma etapa: «Sin cambio»', () =>
    expect(outcomeOf({ contacts: 1, stage_at: 'followup', stage_now: 'followup' })).toBe('same'))
  it('contactado y cambió: la etapa de hoy', () =>
    expect(outcomeOf({ contacts: 1, stage_at: 'capture', stage_now: 'lost' })).toBe('lost'))
})

describe('summarizeAssigned', () => {
  const s = summarizeAssigned(rows)
  it('asignados, contactados y porcentaje', () => expect([s.total, s.contacted, s.pct]).toEqual([6, 4, 67]))
  it('de dónde vienen, con cuántos contactó de cada etapa', () => {
    expect(s.byOrigin.capture).toEqual({ n: 2, contacted: 1 })
    expect(s.byOrigin.recapture).toEqual({ n: 1, contacted: 1 })
    expect(s.byOrigin.sale).toEqual({ n: 1, contacted: 0 })
  })
  it('a qué pasaron: suma el total', () => {
    expect(s.byOutcome).toMatchObject({ recapture: 1, followup: 1, sale: 1, same: 1, none: 2 })
    expect(Object.values(s.byOutcome).reduce((a, n) => a + n, 0)).toBe(6)
  })
  it('cuenta los contactados al día siguiente (hora La Paz)', () => expect(s.contactedLater).toBe(1))
  it('sin filas: todo en cero, sin dividir por cero', () => expect(summarizeAssigned([]).pct).toBe(0))
})

describe('filterAssigned', () => {
  const all = { contact: 'all', origin: null, outcome: null } as const
  it('sin filtros: todos', () => expect(filterAssigned(rows, all)).toHaveLength(6))
  it('sin contactar', () => expect(filterAssigned(rows, { ...all, contact: 'none' }).map((r) => r.full_name)).toEqual(['e', 'f']))
  it('por origen y resultado combinados', () => {
    expect(filterAssigned(rows, { ...all, origin: 'capture' }).map((r) => r.full_name)).toEqual(['a', 'e'])
    expect(filterAssigned(rows, { contact: 'done', origin: 'capture', outcome: null }).map((r) => r.full_name)).toEqual(['a'])
    expect(filterAssigned(rows, { ...all, outcome: 'sale' }).map((r) => r.full_name)).toEqual(['c'])
  })
})
