import { describe, expect, it, vi } from 'vitest'
import type { FollowupRow } from '@/features/followup/api'
import { dueStatus } from '@/features/followup/dueStatus'
import {
  cardOf,
  dayLabel,
  groupByAssignedDay,
  keepPlace,
  pageOf,
  pageWindow,
  parsePageSize,
  summarize,
  sortRecaptured,
  tabCount,
} from '@/features/followup/inboxView'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

// Spec 022: resumen del día, grupos por día de asignación y contador de pestaña de «Mis contactos».
const base: FollowupRow = {
  id: '1',
  full_name: 'Cliente',
  phone_raw: '70000000',
  phone_norm: '59170000000',
  stage: 'capture',
  contact_attempts: 0,
  next_contact_at: null,
  visit_at: null,
  client_created_at: '2026-11-18T10:00:00-04:00',
  interest: null,
  product_id: null,
  product_name: null,
  channel_name: null,
  created_by_name: 'Vol',
  last_result: null,
  last_method: null,
  last_note: null,
  last_contacted_at: null,
  contacts_count: 0,
}
const now = new Date('2026-11-23T12:00:00-04:00') // lunes
const row = (id: string, o: Partial<FollowupRow>) => ({ ...base, id, ...o })

describe('tabCount: nunca el mismo número dos veces', () => {
  it('todos piden atención: total y ⚠ sin número', () => expect(tabCount(290, 290)).toEqual({ total: 290, due: 'all' }))
  it('algunos: total y ⚠ con número', () => expect(tabCount(290, 40)).toEqual({ total: 290, due: 40 }))
  it('ninguno: solo el total', () => expect(tabCount(12, 0)).toEqual({ total: 12, due: null }))
  it('pestaña vacía: sin ⚠', () => expect(tabCount(0, 0)).toEqual({ total: 0, due: null }))
})

describe('resumen del día', () => {
  const rows = [
    row('late1', { assigned_at: '2026-11-21T10:00:00-04:00' }),
    row('late2', { assigned_at: '2026-11-22T10:00:00-04:00' }),
    row('today', { assigned_at: '2026-11-23T08:00:00-04:00' }),
    row('done', { contacts_count: 1, last_result: 'no_answer', last_contacted_at: '2026-11-23T09:00:00-04:00', next_contact_at: '2026-11-24T09:00:00-04:00' }),
    row('later', { contacts_count: 1, last_result: 'call_later', last_contacted_at: '2026-11-20T09:00:00-04:00', next_contact_at: '2026-11-26T09:00:00-04:00' }),
    row('soon', { contacts_count: 1, last_contacted_at: '2026-11-20T09:00:00-04:00', next_contact_at: '2026-11-24T10:00:00-04:00', visit_at: '2026-11-24T10:00:00-04:00' }),
  ]
  it('cuenta Para hoy (hoy + visita mañana), Atrasados y Contactados hoy; lo de más adelante no entra', () =>
    expect(summarize(rows, now)).toEqual({ today: 2, late: 2, done: 1 }))
  it('cada estado cae en una sola tarjeta', () => {
    expect(cardOf(dueStatus(rows[0]!, now))).toBe('late')
    expect(cardOf(dueStatus(rows[2]!, now))).toBe('today')
    expect(cardOf(dueStatus(rows[3]!, now))).toBe('done')
    expect(cardOf(dueStatus(rows[4]!, now))).toBeNull()
    expect(cardOf(dueStatus(rows[5]!, now))).toBe('today')
  })
})

describe('dayLabel', () => {
  it('hoy, ayer y día abreviado', () => {
    expect(dayLabel('2026-11-23', '2026-11-23')).toBe('Hoy')
    expect(dayLabel('2026-11-22', '2026-11-23')).toBe('Ayer')
    expect(dayLabel('2026-11-21', '2026-11-23')).toBe('Sáb 21')
    expect(dayLabel('2026-11-02', '2026-11-23')).toBe('Lun 2')
  })
})

describe('groupByAssignedDay', () => {
  const rows = [
    row('sab', { assigned_at: '2026-11-21T10:00:00-04:00' }),
    row('hoy-temprano', { assigned_at: '2026-11-23T08:00:00-04:00' }),
    row('dom', { assigned_at: '2026-11-22T23:50:00-04:00' }),
    row('hoy-tarde', { assigned_at: '2026-11-23T11:00:00-04:00' }),
    row('hoy-alto', { assigned_at: '2026-11-23T07:00:00-04:00', interest: 'high' }),
    row('viejo', { assigned_at: undefined, client_created_at: '2026-11-18T10:00:00-04:00' }),
  ]
  const groups = groupByAssignedDay(rows, now)
  it('hoy primero, después del día más reciente al más viejo (día de La Paz)', () =>
    expect(groups.map((g) => [g.label, g.late, g.rows.length])).toEqual([
      ['Hoy', false, 3],
      ['Ayer', true, 1],
      ['Sáb 21', true, 1],
      ['Mié 18', true, 1],
    ]))
  it('dentro del día: interés primero y después lo asignado más recientemente', () =>
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(['hoy-alto', 'hoy-tarde', 'hoy-temprano']))
  it('sin fecha de asignación usa la de captación', () => expect(groups[3]!.day).toBe('2026-11-18'))
  it('lista vacía: sin grupos', () => expect(groupByAssignedDay([], now)).toEqual([]))
})

// Decisión B: lo que el encargado le pasó desde otra persona y nadie llamó va primero en su día, el que más espera primero.
describe('reasignados sin contactar', () => {
  const rows = [
    row('nuevo-alto', { assigned_at: '2026-11-23T11:00:00-04:00', interest: 'high' }),
    row('reasig-reciente', { assigned_at: '2026-11-23T09:00:00-04:00', reassigned_from_name: 'Aux A', waiting_since: '2026-11-22T10:00:00-04:00' }),
    row('nuevo', { assigned_at: '2026-11-23T10:00:00-04:00' }),
    row('reasig-viejo', { assigned_at: '2026-11-23T08:00:00-04:00', reassigned_from_name: 'Aux A', waiting_since: '2026-11-20T10:00:00-04:00' }),
  ]
  it('van primero dentro del día, del que más espera al que menos; después el orden de siempre', () =>
    expect(groupByAssignedDay(rows, now)[0]!.rows.map((r) => r.id)).toEqual(['reasig-viejo', 'reasig-reciente', 'nuevo-alto', 'nuevo']))
  it('para quien lo recibe es trabajo de hoy, no atrasado', () => expect(dueStatus(rows[1]!, now).kind).toBe('now'))
})

// Paginación (pedido del usuario sobre la 022): 10 / 25 / 50 / 100 por página, 25 de entrada.
describe('pageOf', () => {
  const list = Array.from({ length: 98 }, (_, i) => i)
  it('primera página de 25', () => {
    const p = pageOf(list, 0, 25)
    expect(p).toMatchObject({ page: 0, pages: 4, from: 1, to: 25, total: 98 })
    expect(p.rows).toHaveLength(25)
  })
  it('última página con lo que sobra', () => expect(pageOf(list, 3, 25)).toMatchObject({ page: 3, from: 76, to: 98 }))
  it('con 100 por página entra todo', () => expect(pageOf(list, 0, 100)).toMatchObject({ pages: 1, from: 1, to: 98 }))
  it('si la lista se achica, se acomoda a la última página que existe', () =>
    expect(pageOf(list.slice(0, 30), 3, 25)).toMatchObject({ page: 1, pages: 2, from: 26, to: 30 }))
  it('lista vacía: una página sin filas', () => expect(pageOf([], 0, 25)).toMatchObject({ page: 0, pages: 1, from: 0, to: 0, rows: [] }))
})

describe('pageWindow: números del paginador', () => {
  it('pocas páginas: todas', () => expect(pageWindow(1, 4)).toEqual([0, 1, 2, 3]))
  it('muchas: primera, vecinas de la actual y última, con huecos', () =>
    expect(pageWindow(5, 12)).toEqual([0, 'gap', 4, 5, 6, 'gap', 11]))
  it('cerca del principio no deja un hueco de una sola página', () => expect(pageWindow(1, 12)).toEqual([0, 1, 2, 'gap', 11]))
  it('cerca del final', () => expect(pageWindow(11, 12)).toEqual([0, 'gap', 10, 11]))
})

describe('keepPlace: cambiar el tamaño no pierde el lugar', () => {
  it('filas 51–75 con 25 → página de 50 que contiene la 51', () => expect(keepPlace(51, 50)).toBe(1))
  it('filas 51–100 con 50 → página de 10 que empieza en la 51', () => expect(keepPlace(51, 10)).toBe(5))
  it('sin filas: primera página', () => expect(keepPlace(0, 25)).toBe(0))
})

describe('parsePageSize: lo guardado en el navegador', () => {
  it('valores válidos', () => expect(['10', '25', '50', '100'].map(parsePageSize)).toEqual([10, 25, 50, 100]))
  it('nada guardado o algo raro: 25', () => expect([null, '', '7', 'abc', '1000'].map(parsePageSize)).toEqual([25, 25, 25, 25, 25]))
})

// Spec 026: lo que la jefa marcó como prioridad de hoy va primero dentro de «Para hoy».
describe('spec 026 · prioridad primero', () => {
  const today = row('hoy', { stage: 'recapture', last_contacted_at: '2026-11-20T10:00:00-04:00', next_contact_at: '2026-11-23T09:00:00-04:00' })
  const prio = row('prio', {
    stage: 'recapture',
    last_contacted_at: '2026-11-20T10:00:00-04:00',
    next_contact_at: '2026-11-30T09:00:00-04:00',
    priority_today: true,
  })
  it('B3 · recaptados: la prioridad antes que lo agendado para hoy', () =>
    expect(sortRecaptured([today, prio], now).map((r) => r.id)).toEqual(['prio', 'hoy']))
  it('B3 · captados del mismo día: la prioridad antes que lo nuevo', () => {
    const fresh = row('nuevo', { assigned_at: '2026-11-23T08:00:00-04:00' })
    const p2 = row('prio2', { assigned_at: '2026-11-23T07:00:00-04:00', priority_today: true })
    expect(groupByAssignedDay([fresh, p2], now)[0]!.rows.map((r) => r.id)).toEqual(['prio2', 'nuevo'])
  })
})

// Spec 028: lo recibido hoy con fecha más adelante va primero dentro de su estado (no sube por encima de lo de hoy).
describe('spec 028 · «Nuevo para ti» primero dentro de su lista', () => {
  const old = row('viejo', { stage: 'followup', last_contacted_at: '2026-11-20T10:00:00-04:00', next_contact_at: '2026-11-25T09:00:00-04:00' })
  const fresh = row('nuevo-para-ti', {
    stage: 'followup',
    last_contacted_at: '2026-11-20T10:00:00-04:00',
    assigned_at: '2026-11-23T10:14:00-04:00',
    next_contact_at: '2026-11-29T10:00:00-04:00',
  })
  const today = row('hoy', { stage: 'recapture', last_contacted_at: '2026-11-20T10:00:00-04:00', next_contact_at: '2026-11-23T09:00:00-04:00' })
  it('C9 · antes que lo agendado de otros días, después de lo que toca hoy', () =>
    expect(sortRecaptured([old, fresh, today], now).map((r) => r.id)).toEqual(['hoy', 'nuevo-para-ti', 'viejo']))
  it('no cuenta en «Para hoy»', () => expect(summarize([fresh], now)).toEqual({ today: 0, late: 0, done: 0 }))
})
