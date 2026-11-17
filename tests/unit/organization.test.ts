import { describe, expect, it } from 'vitest'
import type { Assignment, Subchannel } from '@/features/organization/api'
import {
  addDays,
  applyFilters,
  compliance,
  daysBetween,
  filterOptions,
  NONE,
  overlaps,
  suggestedTimes,
  totals,
} from '@/features/organization/logic'

const sub = (over: Partial<Subchannel> = {}): Subchannel => ({
  id: 1,
  channel_id: 1,
  name: 'Activaciones en barrios',
  sort: 1,
  active: true,
  morning_start: '10:00:00',
  morning_end: '12:00:00',
  afternoon_start: '16:30:00',
  afternoon_end: '18:30:00',
  ...over,
})

let seq = 0
const row = (over: Partial<Assignment> = {}): Assignment => ({
  id: `a${++seq}`,
  branch_id: 5,
  branch: 'VERDOLAGO',
  work_date: '2026-11-18',
  shift: 'morning',
  start_time: '10:00',
  end_time: '12:00',
  profile_id: 'p1',
  person: 'Ana',
  strategy_id: 1,
  strategy: 'Calle',
  channel_id: 2,
  channel: 'Activación',
  subchannel_id: 7,
  subchannel: 'Activaciones en barrios',
  place: null,
  goal: 10,
  result: null,
  notes: null,
  lead_id: 'l1',
  lead: 'Jessica',
  can_replan: true,
  can_set_result: true,
  ...over,
})

describe('suggestedTimes', () => {
  it('devuelve el horario del turno sin segundos', () => {
    expect(suggestedTimes(sub(), 'morning')).toEqual({ start: '10:00', end: '12:00' })
    expect(suggestedTimes(sub(), 'afternoon')).toEqual({ start: '16:30', end: '18:30' })
  })
  it('null si el subcanal no tiene horario para ese turno o no hay subcanal', () => {
    expect(suggestedTimes(sub({ afternoon_start: null, afternoon_end: null }), 'afternoon')).toBeNull()
    expect(suggestedTimes(undefined, 'morning')).toBeNull()
  })
})

describe('overlaps', () => {
  const base = row({ id: 'x', start_time: '10:00', end_time: '12:00' })
  it('detecta un cruce de la misma persona el mismo día', () => {
    expect(overlaps(base, [row({ start_time: '11:00', end_time: '13:00' })])).toHaveLength(1)
  })
  it('seguidas no se cruzan', () => {
    expect(overlaps(base, [row({ start_time: '12:00', end_time: '13:00' })])).toHaveLength(0)
  })
  it('otra persona, otro día, la misma fila o sin horario no cuentan', () => {
    expect(
      overlaps(base, [
        row({ profile_id: 'p2', start_time: '11:00', end_time: '13:00' }),
        row({ work_date: '2026-11-19', start_time: '11:00', end_time: '13:00' }),
        row({ id: 'x', start_time: '11:00', end_time: '13:00' }),
        row({ start_time: null, end_time: null }),
      ]),
    ).toHaveLength(0)
    expect(overlaps(row({ start_time: null }), [row()])).toHaveLength(0)
  })
})

describe('compliance', () => {
  it('resultado ÷ meta redondeado', () => {
    expect(compliance(30, 15)).toBe(50)
    expect(compliance(3, 2)).toBe(67)
  })
  it('sin resultado no es 0 %; resultado 0 sí', () => {
    expect(compliance(30, null)).toBeNull()
    expect(compliance(30, 0)).toBe(0)
  })
  it('sin meta o meta 0 no hay cumplimiento', () => {
    expect(compliance(null, 5)).toBeNull()
    expect(compliance(0, 5)).toBeNull()
  })
})

describe('filtros y totales', () => {
  const rows = [
    row({ branch: 'VERDOLAGO', channel: 'Activación', goal: 10, result: 5 }),
    row({ branch: 'VERDOLAGO', channel: 'Llamadas', goal: 20, result: null }),
    row({ branch: 'SAN JOSÉ', channel: 'Activación', goal: 30, result: 0, subchannel: null }),
  ]
  it('sin filtros devuelve todo', () => {
    expect(applyFilters(rows, {})).toHaveLength(3)
    expect(applyFilters(rows, { channel: '' })).toHaveLength(3)
  })
  it('combina filtros', () => {
    expect(applyFilters(rows, { channel: 'Activación' })).toHaveLength(2)
    expect(applyFilters(rows, { channel: 'Activación', branch: 'VERDOLAGO' })).toHaveLength(1)
    expect(applyFilters(rows, { subchannel: NONE })).toHaveLength(1)
  })
  it('un filtro sin coincidencias deja totales en cero', () => {
    expect(totals(applyFilters(rows, { branch: 'COBIJA' }))).toEqual({ goal: 0, result: 0, count: 0, withResult: 0 })
  })
  it('los totales siguen al filtro y no cuentan los pendientes como resultado', () => {
    expect(totals(rows)).toEqual({ goal: 60, result: 5, count: 3, withResult: 2 })
    expect(totals(applyFilters(rows, { channel: 'Activación' }))).toEqual({ goal: 40, result: 5, count: 2, withResult: 2 })
  })
  it('opciones de filtro: valores presentes, sin repetir y ordenados', () => {
    expect(filterOptions(rows, 'branch')).toEqual(['SAN JOSÉ', 'VERDOLAGO'])
    expect(filterOptions(rows, 'subchannel')).toEqual(['(sin dato)', 'Activaciones en barrios'])
  })
})

describe('fechas', () => {
  it('suma días y mide rangos', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(0)
    expect(daysBetween('2026-11-01', '2026-12-01')).toBe(30)
  })
})
