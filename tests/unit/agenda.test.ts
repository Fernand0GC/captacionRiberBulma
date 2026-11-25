import { describe, expect, it, vi } from 'vitest'
import type { FollowupRow } from '@/features/followup/api'
import { summarize } from '@/features/followup/inboxView'
import type { AgendaPerson, AgendaRow } from '@/features/monitoring/api'
import { agendaByPerson, agendaTotals, ageOf, bucketOf, filterLate, lateAssignable, lateBranch, priorityMessage } from '@/features/monitoring/agenda'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

// Spec 023: agenda de recontacto de las jefas. Misma regla que las tarjetas de «Mis contactos» (spec 022).
const now = new Date('2026-11-23T12:00:00-04:00') // lunes, mediodía en La Paz
const MAICO = 'u-maico'
const ANA = 'u-ana'

const base: AgendaRow = {
  id: '1',
  full_name: 'Cliente',
  phone_raw: '70000000',
  stage: 'recapture',
  contact_attempts: 1,
  next_contact_at: null,
  visit_at: null,
  client_created_at: '2026-11-10T10:00:00-04:00',
  assigned_to: MAICO,
  branch_id: 5,
  assigned_at: '2026-11-20T10:00:00-04:00',
  reassigned_from_name: null,
  last_contacted_at: '2026-11-21T10:00:00-04:00',
  last_result: 'no_answer',
  last_method: 'call',
  last_note: null,
}
const row = (id: string, o: Partial<AgendaRow> = {}): AgendaRow => ({ ...base, id, ...o })
const people: AgendaPerson[] = [
  { id: MAICO, full_name: 'Maico', role: 'field_assistant', branch_id: 5 },
  { id: ANA, full_name: 'Ana', role: 'field_assistant', branch_id: 5 },
]

const dueToday = row('hoy', { next_contact_at: '2026-11-23T09:00:00-04:00' })
const dueLater = row('hoy-tarde', { next_contact_at: '2026-11-23T17:00:00-04:00' })
const lateOne = row('ayer', { next_contact_at: '2026-11-22T09:00:00-04:00' })
const doneToday = row('llamado', { next_contact_at: '2026-11-24T09:00:00-04:00', last_contacted_at: '2026-11-23T10:00:00-04:00' })
const closedToday = row('cerrado', {
  stage: 'lost',
  contact_attempts: 3,
  next_contact_at: null,
  last_contacted_at: '2026-11-23T10:30:00-04:00',
})
const newToday = row('nuevo', {
  stage: 'capture',
  contact_attempts: 0,
  last_contacted_at: null,
  last_result: null,
  last_method: null,
  assigned_at: '2026-11-23T08:00:00-04:00',
})
const neverContactedOld = row('sin-llamar', { ...newToday, id: 'sin-llamar', assigned_at: '2026-11-20T08:00:00-04:00' })
const visitTomorrow = row('visita', {
  stage: 'followup',
  next_contact_at: '2026-11-24T10:00:00-04:00',
  visit_at: '2026-11-24T10:00:00-04:00',
})
const nextWeek = row('semana', { next_contact_at: '2026-11-30T09:00:00-04:00' })
// Se lo pasaron hoy a las 10:21 con la fecha que dejó vencida la persona anterior (caso Rene, 24/11).
const inheritedToday = row('heredado', {
  reassigned_from_name: 'Nayara',
  assigned_at: '2026-11-23T10:21:00-04:00',
  next_contact_at: '2026-11-15T09:00:00-04:00',
})

describe('bucketOf: misma regla que «Mis contactos»', () => {
  it('recibido hoy con fecha vencida de otra persona → pendiente, no atrasado (caso Rene)', () =>
    expect(bucketOf(inheritedToday, now)).toBe('pending'))

  // Spec 025 (caracterización): lo que la jefa reasigna desde «Atrasados» le llega a quien lo recibe como trabajo de hoy.
  it('nunca contactado recibido hoy de otra persona → pendiente, no atrasado', () => {
    const got = row('recibido', { ...neverContactedOld, id: 'recibido', reassigned_from_name: 'Nayara', assigned_at: '2026-11-23T10:21:00-04:00' })
    expect(bucketOf(got, now)).toBe('pending')
  })

  it('agendado hoy (aunque sea más tarde) → pendiente', () => {
    expect(bucketOf(dueToday, now)).toBe('pending')
    expect(bucketOf(dueLater, now)).toBe('pending')
  })
  it('agendado ayer sin contacto → atrasado', () => expect(bucketOf(lateOne, now)).toBe('late'))
  it('contactado hoy → contactó', () => expect(bucketOf(doneToday, now)).toBe('done'))
  it('cerrado hoy (3.er no contestó) → contactó', () => expect(bucketOf(closedToday, now)).toBe('done'))
  it('asignado hoy y nunca contactado → pendiente; asignado antes → atrasado', () => {
    expect(bucketOf(newToday, now)).toBe('pending')
    expect(bucketOf(neverContactedOld, now)).toBe('late')
  })
  it('visita de mañana (confirmar hoy) → pendiente', () => expect(bucketOf(visitTomorrow, now)).toBe('pending'))
  it('agendado para la otra semana → no cuenta', () => expect(bucketOf(nextWeek, now)).toBeNull())
  it('se quedó en volver a llamar más tarde hoy → sigue pendiente', () => {
    const later = row('rellamar', {
      next_contact_at: '2026-11-23T16:00:00-04:00',
      last_contacted_at: '2026-11-23T11:00:00-04:00',
    })
    expect(bucketOf(later, now)).toBe('pending')
  })
})

describe('agendaByPerson', () => {
  const rows = [dueToday, dueLater, lateOne, doneToday, closedToday, newToday, neverContactedOld, visitTomorrow, nextWeek]
  const view = agendaByPerson({ people, rows }, now)
  const maico = view.find((p) => p.id === MAICO)!

  it('cuenta por persona: Le tocaba hoy = Pendientes + Contactó', () => {
    expect(maico.pending.map((r) => r.id).sort()).toEqual(['hoy', 'hoy-tarde', 'nuevo', 'visita'])
    expect(maico.done.map((r) => r.id).sort()).toEqual(['cerrado', 'llamado'])
    expect(maico.late.map((r) => r.id).sort()).toEqual(['ayer', 'sin-llamar'])
    expect(maico.due).toBe(6)
  })
  it('el personal sin agenda aparece en cero', () => {
    const ana = view.find((p) => p.id === ANA)!
    expect([ana.due, ana.pending.length, ana.done.length, ana.late.length]).toEqual([0, 0, 0, 0])
  })
  it('ordena por lo que falta (pendientes + atrasados) y luego por nombre', () => {
    expect(view.map((p) => p.full_name)).toEqual(['Maico', 'Ana'])
  })
  it('filas de alguien que no está en people se agregan igual (no se pierden)', () => {
    const extra = agendaByPerson({ people, rows: [row('x', { assigned_to: 'u-otro', next_contact_at: '2026-11-23T09:00:00-04:00' })] }, now)
    expect(extra.find((p) => p.id === 'u-otro')?.pending.length).toBe(1)
  })
  it('totales', () => {
    expect(agendaTotals(view)).toEqual({ due: 6, done: 2, pending: 4, late: 2, assigned: null, recalls: 5, later: 0, passedOn: 0 })
  })
})

describe('paridad con las tarjetas de «Mis contactos»', () => {
  it('para clientes abiertos, Pendientes / Contactó / Atrasados = Para hoy / Contactados hoy / Atrasados', () => {
    const open = [dueToday, dueLater, lateOne, doneToday, newToday, neverContactedOld, visitTomorrow, nextWeek, inheritedToday]
    const asInbox: FollowupRow[] = open.map((r) => ({
      ...r,
      stage: r.stage as FollowupRow['stage'],
      phone_norm: r.phone_raw,
      interest: null,
      product_id: null,
      product_name: null,
      channel_name: null,
      created_by_name: 'Vol',
    }))
    const cards = summarize(asInbox, now)
    const maico = agendaByPerson({ people, rows: open }, now).find((p) => p.id === MAICO)!
    expect({ today: maico.pending.length, done: maico.done.length, late: maico.late.length }).toEqual(cards)
  })
})

// Spec 025: reasignar los atrasados desde el detalle de la agenda (reusa useAssignSelection + assign_prospects).
describe('reasignar atrasados', () => {
  const view = agendaByPerson({ people, rows: [dueToday, lateOne, neverContactedOld, doneToday] }, now)
  const maico = view.find((p) => p.id === MAICO)!

  it('solo ofrece los atrasados, a nombre de su responsable actual (para avisar a quién se le quitan)', () => {
    expect(lateAssignable(maico)).toEqual([
      { id: 'ayer', assigned_to: MAICO, assigned_to_name: 'Maico' },
      { id: 'sin-llamar', assigned_to: MAICO, assigned_to_name: 'Maico' },
    ])
  })
  it('sin atrasados no hay nada que reasignar', () => {
    expect(lateAssignable(view.find((p) => p.id === ANA)!)).toEqual([])
  })
  it('la sucursal sale de los atrasados cuando es una sola', () => {
    expect(lateBranch(maico)).toBe(5)
  })
  it('atrasados de varias sucursales → sin sucursal (no se puede elegir a quién)', () => {
    const mixed = agendaByPerson({ people, rows: [lateOne, row('otra', { ...lateOne, id: 'otra', branch_id: 7 })] }, now)
    expect(lateBranch(mixed.find((p) => p.id === MAICO)!)).toBeUndefined()
  })
  it('sin atrasados usa la sucursal de la persona', () => {
    expect(lateBranch(view.find((p) => p.id === ANA)!)).toBe(5)
  })
})

// Spec 026: desglose de Atrasados y prioridad de hoy.
describe('spec 026 · desglose de atrasados', () => {
  // now = 23/11. lateOne: tocaba el 22/11 (1 día) · neverContactedOld: asignado el 20/11 (3 días, nunca contactado).
  const old = row('viejo', { next_contact_at: '2026-11-10T09:00:00-04:00', assigned_at: '2026-11-01T10:00:00-04:00' })
  // Recibido el 21/11 con fecha heredada del 05/11: 2 días, no 18.
  const inherited = row('heredado-viejo', { next_contact_at: '2026-11-05T09:00:00-04:00', assigned_at: '2026-11-21T10:00:00-04:00' })
  const view = agendaByPerson({ people, rows: [lateOne, neverContactedOld, old, inherited, dueToday] }, now)
  const maico = view.find((p) => p.id === MAICO)!

  it('ageOf: 1 día / 2 a 7 / más de 7', () => {
    expect([1, 2, 7, 8, 30].map(ageOf)).toEqual(['d1', 'd2to7', 'd2to7', 'over7', 'over7'])
  })
  it('A7 · cuenta por antigüedad y por tipo; cada grupo suma el total de atrasados', () => {
    expect(maico.lateBy).toEqual({ age: { d1: 1, d2to7: 2, over7: 1 }, type: { never: 1, overdue: 3 } })
    const { age, type } = maico.lateBy
    expect(age.d1 + age.d2to7 + age.over7).toBe(maico.late.length)
    expect(type.never + type.overdue).toBe(maico.late.length)
  })
  it('filtra por antigüedad y por tipo (combinables)', () => {
    expect(filterLate(maico.late, { age: 'd2to7', type: null }, now).map((r) => r.id).sort()).toEqual(['heredado-viejo', 'sin-llamar'])
    expect(filterLate(maico.late, { age: 'd2to7', type: 'overdue' }, now).map((r) => r.id)).toEqual(['heredado-viejo'])
    expect(filterLate(maico.late, { age: null, type: null }, now)).toHaveLength(4)
  })
  it('A6 · el atraso justo no cambia en qué columna cae nadie', () => {
    expect({ pending: maico.pending.length, late: maico.late.length }).toEqual({ pending: 1, late: 4 })
  })
  it('la reasignación de la 025 puede usar solo los atrasados filtrados', () => {
    expect(lateAssignable(maico, filterLate(maico.late, { age: 'over7', type: null }, now)).map((a) => a.id)).toEqual(['viejo'])
  })
})

describe('spec 026 · prioridad de hoy en la agenda', () => {
  const view = agendaByPerson({ people, rows: [{ ...lateOne, priority_today: true }, neverContactedOld, dueToday] }, now)
  const maico = view.find((p) => p.id === MAICO)!

  it('B2 · el atrasado con prioridad pasa a Pendientes (no se pierde: cambia de columna)', () => {
    expect(maico.pending.map((r) => r.id).sort()).toEqual(['ayer', 'hoy'])
    expect(maico.late.map((r) => r.id)).toEqual(['sin-llamar'])
    expect(maico.priority).toBe(1)
  })
  it('agendado más adelante con prioridad también entra hoy', () => {
    const v = agendaByPerson({ people, rows: [{ ...nextWeek, priority_today: true }] }, now)
    expect(v.find((p) => p.id === MAICO)!.pending.map((r) => r.id)).toEqual(['semana'])
  })
})

describe('spec 026 · mensajes de «Poner para hoy»', () => {
  it('B1 · todos marcados', () => {
    expect(priorityMessage({ changed: 5, skipped: 0 }, 'Rene', true)).toBe('✓ 5 clientes quedan como prioridad de hoy para Rene')
    expect(priorityMessage({ changed: 1, skipped: 0 }, 'Rene', true)).toBe('✓ 1 cliente queda como prioridad de hoy para Rene')
  })
  it('P3 · algunos ya no eran suyos', () => {
    expect(priorityMessage({ changed: 3, skipped: 2 }, 'Rene', true)).toBe('✓ 3 de 5 marcados · 2 ya no estaban a cargo de Rene')
    expect(priorityMessage({ changed: 0, skipped: 1 }, 'Rene', true)).toBe('Ninguno marcado · 1 ya no estaba a cargo de Rene')
  })
  it('B8 · quitar', () => {
    expect(priorityMessage({ changed: 1, skipped: 0 }, 'Rene', false)).toBe('✓ Prioridad quitada')
  })
})

// Spec 028: la agenda refleja los asignados del día (caso Rene, 25/11: 15 en Actividad, 13 en «Le tocaba hoy»).
describe('spec 028 · asignados hoy, rellamadas y para más adelante', () => {
  // Isabel se lo pasó hoy desde Nayara con la visita que ya estaba pactada para el viernes (como Carlos Tonore).
  const laterVisit = row('carlos', {
    stage: 'followup',
    reassigned_from_name: 'Nayara',
    assigned_at: '2026-11-23T10:14:00-04:00',
    next_contact_at: '2026-11-27T10:00:00-04:00',
    visit_at: '2026-11-27T10:00:00-04:00',
  })
  const laterCall = row('saul', { ...laterVisit, id: 'saul', visit_at: null, next_contact_at: '2026-12-03T09:00:00-04:00' })
  // nextWeek: agendado para la otra semana, pero recibido antes de hoy → no entra a ninguna parte (como siempre).
  const rows = [dueToday, doneToday, newToday, inheritedToday, laterVisit, laterCall, nextWeek]
  const assigned = [
    { id: MAICO, assigned: 5, passed_on: 1 },
    { id: ANA, assigned: 0, passed_on: 0 },
  ]
  const view = agendaByPerson({ people, rows, assigned }, now)
  const maico = view.find((p) => p.id === MAICO)!

  it('C6 · recibido hoy y agendado más adelante → «Para más adelante», con su fecha', () => {
    expect(maico.later.map((r) => r.id)).toEqual(['carlos', 'saul'])
  })
  it('C7 · lo de más adelante no suma a Le tocaba hoy, Pendientes ni Atrasados', () => {
    expect(maico.pending.map((r) => r.id).sort()).toEqual(['heredado', 'hoy', 'nuevo'])
    expect(maico.done.map((r) => r.id)).toEqual(['llamado'])
    expect(maico.late).toEqual([])
    expect(maico.due).toBe(4)
  })
  it('agendado más adelante y recibido antes de hoy → no está en ninguna parte (como antes)', () => {
    expect([...maico.pending, ...maico.done, ...maico.late, ...maico.later].some((r) => r.id === 'semana')).toBe(false)
  })
  it('C1 · «Asignados hoy» viene del servidor (regla de Actividad) y C3 · cuántos pasaron a otra persona', () => {
    expect(maico.assignedToday).toBe(5)
    expect(maico.passedOn).toBe(1)
  })
  it('C4 · rellamadas: le tocaba hoy por algo que recibió antes de hoy', () => {
    // hoy y llamado son de días anteriores; nuevo y heredado los recibió hoy.
    expect(maico.recalls).toBe(2)
  })
  it('C5 · Le tocaba hoy = recibidos hoy que están en la agenda + rellamadas', () => {
    const fromToday = [...maico.pending, ...maico.done].filter((r) => r.assigned_at.startsWith('2026-11-23')).length
    expect(maico.due).toBe(fromToday + maico.recalls)
  })
  it('personal en cero: 0 asignados, 0 rellamadas, nada para más adelante', () => {
    const ana = view.find((p) => p.id === ANA)!
    expect([ana.assignedToday, ana.recalls, ana.later.length, ana.passedOn]).toEqual([0, 0, 0, 0])
  })
  it('totales con las columnas nuevas', () => {
    expect(agendaTotals(view)).toEqual({ due: 4, done: 1, pending: 3, late: 0, assigned: 5, recalls: 2, later: 2, passedOn: 1 })
  })
  it('C12 · sin la migración 028 (no llega `assigned`): asignados hoy = null y los totales lo dicen', () => {
    const old = agendaByPerson({ people, rows: [dueToday, newToday] }, now)
    expect(old.map((p) => p.assignedToday)).toEqual([null, null])
    expect(agendaTotals(old).assigned).toBeNull()
  })
  it('la prioridad de hoy le gana a «más adelante»: pasa a Pendientes (spec 026)', () => {
    const p = agendaByPerson({ people, rows: [{ ...laterVisit, priority_today: true }], assigned }, now)[0]!
    expect([p.pending.length, p.later.length]).toEqual([1, 0])
  })
})
