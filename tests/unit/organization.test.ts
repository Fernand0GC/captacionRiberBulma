import { describe, expect, it } from 'vitest'
import type { Assignment, Subchannel } from '@/features/organization/api'
import {
  addDays,
  applyFilters,
  compliance,
  daysBetween,
  filterOptions,
  formFields,
  goalFlags,
  NONE,
  parseGoal,
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
  uses_goal: true,
  uses_share_goal: false,
  added_by: null,
  added_at: null,
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
  share_goal: null,
  share_result: null,
  batch_id: null,
  uses_goal: true,
  uses_share_goal: false,
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
    expect(totals(applyFilters(rows, { branch: 'COBIJA' }))).toEqual({ goal: 0, result: 0, shareGoal: 0, shareResult: 0, count: 0, withResult: 0 })
  })
  it('los totales siguen al filtro y no cuentan los pendientes como resultado', () => {
    expect(totals(rows)).toEqual({ goal: 60, result: 5, shareGoal: 0, shareResult: 0, count: 3, withResult: 2 })
    expect(totals(applyFilters(rows, { channel: 'Activación' }))).toEqual({ goal: 40, result: 5, shareGoal: 0, shareResult: 0, count: 2, withResult: 2 })
  })
  it('captación y compartidas suman por separado (004, FR-008)', () => {
    const shared = [
      row({ goal: 20, result: 18, share_goal: 15, share_result: 15 }),
      row({ goal: null, result: null, share_goal: 40, share_result: null }),
      row({ goal: null, result: null, share_goal: 30, share_result: 10 }),
    ]
    expect(totals(shared)).toEqual({ goal: 20, result: 18, shareGoal: 85, shareResult: 25, count: 3, withResult: 2 })
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

describe('metas por subcanal (004)', () => {
  const cat = {
    strategies: [
      { id: 1, name: 'Calle', sort: 1, active: true, uses_place: true },
      { id: 2, name: 'Tienda', sort: 2, active: true, uses_place: false },
    ],
    channels: [
      { id: 10, strategy_id: 2, name: 'Llamadas', sort: 1, active: true, uses_goal: true, uses_share_goal: false },
      { id: 11, strategy_id: 2, name: 'Comentarios', sort: 2, active: true, uses_goal: false, uses_share_goal: false },
      { id: 12, strategy_id: 2, name: 'RRSS-Mensajería', sort: 3, active: true, uses_goal: false, uses_share_goal: false },
      { id: 13, strategy_id: 2, name: 'Compartidas y estados', sort: 4, active: true, uses_goal: false, uses_share_goal: true },
    ],
    subchannels: [
      sub({ id: 21, channel_id: 12, name: 'Mensajería WhatsApp', uses_goal: true, uses_share_goal: true }),
      sub({ id: 22, channel_id: 12, name: 'Mensajería TikTok', uses_goal: false, uses_share_goal: false }),
    ],
  }
  it('goalFlags: manda el subcanal; sin subcanal, el canal', () => {
    expect(goalFlags(cat, 12, 21)).toEqual({ goal: true, share: true })
    expect(goalFlags(cat, '12', '22')).toEqual({ goal: false, share: false })
    expect(goalFlags(cat, 12, null)).toEqual({ goal: false, share: false })
    expect(goalFlags(cat, '13', '')).toEqual({ goal: false, share: true })
    expect(goalFlags(cat, 10)).toEqual({ goal: true, share: false })
  })
  it('goalFlags: sin canal o sin catálogo pide solo captación', () => {
    expect(goalFlags(cat, '')).toEqual({ goal: true, share: false })
    expect(goalFlags(undefined, 12, 21)).toEqual({ goal: true, share: false })
  })
  it('formFields: Tienda no pide ubicación; las metas siguen la marca efectiva', () => {
    expect(formFields(cat, '2', '11')).toEqual({ place: false, goal: false, share: false })
    expect(formFields(cat, '2', '10')).toEqual({ place: false, goal: true, share: false })
    expect(formFields(cat, '2', '12', '21')).toEqual({ place: false, goal: true, share: true })
    expect(formFields(cat, '1', '')).toEqual({ place: true, goal: true, share: false })
  })
  it('formFields: sin elegir o sin catálogo muestra ubicación y captación', () => {
    expect(formFields(cat, '', '')).toEqual({ place: true, goal: true, share: false })
    expect(formFields(undefined, '2', '11')).toEqual({ place: true, goal: true, share: false })
  })
  it('parseGoal: vacía falta; fuera de rango o decimal es error', () => {
    expect(parseGoal('20', 'meta de captación')).toBe(20)
    expect(parseGoal('0', 'meta de captación')).toBe(0)
    expect(parseGoal(' ', 'meta de compartidas')).toBe('Escribe la meta de compartidas.')
    expect(parseGoal('10000', 'meta')).toMatch(/entre 0 y 9999/)
    expect(parseGoal('2.5', 'meta')).toMatch(/entre 0 y 9999/)
  })
})
