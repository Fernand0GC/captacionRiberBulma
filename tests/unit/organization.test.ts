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
  groupByPerson,
  NONE,
  parseGoal,
  overlaps,
  sameSlot,
  hasSubchannels,
  onlySubchannel,
  clashLabel,
  groupRows,
  defaultShiftFilter,
  goalsText,
  suggestedTimes,
  totals,
  usesFlyers,
  verifiedText,
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
  // spec 039: campos nuevos del contrato de Assignment.
  done: null,
  result_by: null,
  result_by_name: null,
  result_at: null,
  batch_id: null,
  uses_goal: true,
  uses_share_goal: false,
  uses_flyers: true,
  flyer_ids: [],
  flyers: [],
  share_verified: null,
  share_verified_note: null,
  share_verified_by_name: null,
  share_verified_at: null,
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
      { id: 10, strategy_id: 2, name: 'Llamadas', sort: 1, active: true, uses_goal: true, uses_share_goal: false, uses_flyers: false },
      { id: 14, strategy_id: 1, name: 'Activación', sort: 1, active: true, uses_goal: true, uses_share_goal: false, uses_flyers: true },
      { id: 11, strategy_id: 2, name: 'Comentarios', sort: 2, active: true, uses_goal: false, uses_share_goal: false, uses_flyers: false },
      { id: 12, strategy_id: 2, name: 'RRSS-Mensajería', sort: 3, active: true, uses_goal: false, uses_share_goal: false, uses_flyers: false },
      { id: 13, strategy_id: 2, name: 'Compartidas y estados', sort: 4, active: true, uses_goal: false, uses_share_goal: true, uses_flyers: false },
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

describe('ajustes de ventas (006)', () => {
  it('groupByPerson: junta las filas de cada persona por día y sucursal, en el orden de llegada', () => {
    const a1 = row({ profile_id: 'pa', person: 'Ana', start_time: '08:00' })
    const a2 = row({ profile_id: 'pa', person: 'Ana', start_time: '14:00' })
    const b1 = row({ profile_id: 'pb', person: 'Beto', start_time: '09:00' })
    const a3 = row({ profile_id: 'pa', person: 'Ana', start_time: '16:00' })
    const otherDay = row({ profile_id: 'pa', person: 'Ana', work_date: '2026-11-19' })
    const otherBranch = row({ profile_id: 'pa', person: 'Ana', branch_id: 7 })
    const groups = groupByPerson([a1, a2, b1, a3, otherDay, otherBranch])
    expect(groups.map((g) => g.rows.map((r) => r.id))).toEqual([[a1.id, a2.id, a3.id], [b1.id], [otherDay.id], [otherBranch.id]])
    expect(groupByPerson([])).toEqual([])
  })
  it('usesFlyers: según el canal; sin canal o sin catálogo, no', () => {
    const cat = {
      channels: [
        { id: 14, strategy_id: 1, name: 'Activación', sort: 1, active: true, uses_goal: true, uses_share_goal: false, uses_flyers: true },
        { id: 10, strategy_id: 2, name: 'Llamadas', sort: 1, active: true, uses_goal: true, uses_share_goal: false, uses_flyers: false },
      ],
    }
    expect(usesFlyers(cat, '14')).toBe(true)
    expect(usesFlyers(cat, 10)).toBe(false)
    expect(usesFlyers(cat, '')).toBe(false)
    expect(usesFlyers(undefined, 14)).toBe(false)
  })
  it('verifiedText: sin verificación no muestra nada; 0 sí cuenta', () => {
    expect(verifiedText(row())).toBeNull()
    expect(verifiedText(row({ share_verified: 12 }))).toBe('verificadas 12')
    expect(verifiedText(row({ share_verified: 0 }))).toBe('verificadas 0')
  })
})

describe('ajustes de ventas (007)', () => {
  it('parseGoal opcional: vacía es null; con valor valida igual', () => {
    expect(parseGoal('', 'meta de compartidas', true)).toBeNull()
    expect(parseGoal('15', 'meta de compartidas', true)).toBe(15)
    expect(parseGoal('-1', 'meta de compartidas', true)).toMatch(/entre 0 y 9999/)
    expect(parseGoal('', 'meta de captación')).toBe('Escribe la meta de captación.')
  })

  it('sameSlot: igual = turno, horario, canal y subcanal', () => {
    const a = row()
    expect(sameSlot(a, row())).toBe(true)
    expect(sameSlot(a, row({ end_time: '12:30' }))).toBe(false)
    expect(sameSlot(a, row({ subchannel_id: 8 }))).toBe(false)
    expect(sameSlot(a, row({ shift: 'afternoon' }))).toBe(false)
    expect(sameSlot(row({ subchannel_id: null }), row({ subchannel_id: null }))).toBe(true)
  })

  it('clashLabel: subcanal (o canal) y horario de la otra asignación', () => {
    expect(clashLabel(row({ start_time: '16:20', end_time: '19:00' }))).toBe('Activaciones en barrios (16:20–19:00)')
    expect(clashLabel(row({ subchannel: null }))).toBe('Activación (10:00–12:00)')
  })

  it('goalsText: junta las dos metas o null', () => {
    expect(goalsText(row({ goal: 10, share_goal: 30 }))).toBe('Capt 10 · Comp 30')
    expect(goalsText(row({ goal: null, share_goal: 30 }))).toBe('Comp 30')
    expect(goalsText(row({ goal: null }))).toBeNull()
  })

  it('groupRows: sucursal → persona → filas; la gerente una vez por sucursal', () => {
    const rows = [
      row({ person: 'Ana', profile_id: 'p1', lead: null }),
      row({ person: 'Ana', profile_id: 'p1', lead: 'Isabel', start_time: '15:00', end_time: '16:00' }),
      row({ person: 'Luis', profile_id: 'p2', lead: 'Isabel' }),
      row({ branch_id: 7, branch: 'TRINIDAD', person: 'Eva', profile_id: 'p3', lead: null }),
    ]
    const b = groupRows(rows)
    expect(b.map((x) => `${x.branch}:${x.lead ?? '-'}`)).toEqual(['VERDOLAGO:Isabel', 'TRINIDAD:-'])
    expect(b[0]!.people.map((p) => `${p.person}:${p.count}:${p.lines.length}`)).toEqual(['Ana:2:2', 'Luis:1:1'])
  })

  it('groupRows: una carga con igual horario va en una fila; si se editó la hora de una, aparte', () => {
    const rows = [
      row({ batch_id: 'b1', subchannel_id: 1, subchannel: 'Comentarios Facebook' }),
      row({ batch_id: 'b1', subchannel_id: 2, subchannel: 'Comentarios TikTok' }),
      row({ batch_id: 'b1', subchannel_id: 3, subchannel: 'Comentarios Instagram', end_time: '11:00' }),
      row({ batch_id: null, subchannel_id: 1 }),
    ]
    const lines = groupRows(rows)[0]!.people[0]!.lines
    expect(lines.map((l) => l.length)).toEqual([2, 1, 1])
    expect(groupRows(rows)[0]!.people[0]!.count).toBe(4)
  })

  it('groupRows: varios días separan a la misma persona por fecha', () => {
    const b = groupRows([row(), row({ work_date: '2026-11-19' })])
    expect(b).toHaveLength(1)
    expect(b[0]!.people.map((p) => p.work_date)).toEqual(['2026-11-18', '2026-11-19'])
  })

  it('defaultShiftFilter: Tarde solo hoy, desde las 13:00 de La Paz y con asignaciones de la tarde', () => {
    // 13:00 en La Paz = 17:00 UTC
    const at = (hhmm: string) => new Date(`2026-11-19T${hhmm}:00Z`)
    const tarde = [row({ shift: 'morning' }), row({ shift: 'afternoon' })]
    expect(defaultShiftFilter('2026-11-19', '2026-11-19', at('16:59'), tarde)).toBeUndefined()
    expect(defaultShiftFilter('2026-11-19', '2026-11-19', at('17:00'), tarde)).toBe('afternoon')
    expect(defaultShiftFilter('2026-11-18', '2026-11-18', at('17:00'), tarde)).toBeUndefined()
    expect(defaultShiftFilter('2026-11-13', '2026-11-19', at('17:00'), tarde)).toBeUndefined()
    expect(defaultShiftFilter('2026-11-19', '2026-11-19', at('17:00'), [row({ shift: 'morning' })])).toBeUndefined()
  })
})

describe('subcanal y horario obligatorios (008)', () => {
  const cat = {
    subchannels: [
      sub({ id: 1, channel_id: 10 }),
      sub({ id: 2, channel_id: 20 }),
      sub({ id: 3, channel_id: 20 }),
      sub({ id: 4, channel_id: 30, active: false }),
      sub({ id: 5, channel_id: 40 }),
      sub({ id: 6, channel_id: 40, active: false }),
    ],
  }
  it('hasSubchannels: cuenta solo los activos', () => {
    expect(hasSubchannels(cat, 10)).toBe(true)
    expect(hasSubchannels(cat, '20')).toBe(true)
    expect(hasSubchannels(cat, 30)).toBe(false)
    expect(hasSubchannels(cat, 99)).toBe(false)
    expect(hasSubchannels(undefined, 10)).toBe(false)
    expect(hasSubchannels(cat, '')).toBe(false)
  })
  it('onlySubchannel: el id si hay exactamente uno activo', () => {
    expect(onlySubchannel(cat, 10)).toBe(1)
    expect(onlySubchannel(cat, 20)).toBeNull()
    expect(onlySubchannel(cat, 30)).toBeNull()
    expect(onlySubchannel(cat, '40')).toBe(5)
    expect(onlySubchannel(undefined, 10)).toBeNull()
  })
})
