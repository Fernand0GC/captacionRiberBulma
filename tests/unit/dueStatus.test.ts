import { describe, expect, it, vi } from 'vitest'
import type { FollowupRow } from '@/features/followup/api'
import { dueStatus, lateInfo, receivedLater, visitPassed } from '@/features/followup/dueStatus'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const base: FollowupRow = {
  id: '1',
  full_name: 'Cliente',
  phone_raw: '70000000',
  phone_norm: '59170000000',
  stage: 'followup',
  contact_attempts: 0,
  next_contact_at: null,
  visit_at: null,
  client_created_at: '2026-10-25T10:00:00-04:00',
  interest: null,
  product_id: null,
  product_name: null,
  channel_name: null,
  created_by_name: 'Vol',
  last_result: 'call_later',
  last_method: 'message',
  last_note: null,
  last_contacted_at: '2026-10-28T10:00:00-04:00',
}
const now = new Date('2026-10-30T12:00:00-04:00')
const row = (o: Partial<FollowupRow>) => ({ ...base, ...o })

describe('dueStatus', () => {
  it('llamar más tarde hoy: cuánto falta', () =>
    expect(dueStatus(row({ next_contact_at: '2026-10-30T14:30:00-04:00' }), now)).toEqual({
      kind: 'now',
      label: 'Contactar en 2 h 30 min (14:30)',
    }))
  it('hora ya pasada hoy', () =>
    expect(dueStatus(row({ stage: 'recapture', next_contact_at: '2026-10-30T09:00:00-04:00' }), now).label).toBe(
      'Volver a llamar ya · desde las 09:00',
    ))
  it('atrasado', () =>
    expect(dueStatus(row({ next_contact_at: '2026-10-28T09:00:00-04:00' }), now)).toEqual({
      kind: 'late',
      label: 'Atrasado 2 días · tocaba el 28/10',
    }))
  it('visita mañana: confirmar hoy', () => {
    const at = '2026-10-31T10:00:00-04:00'
    expect(dueStatus(row({ next_contact_at: at, visit_at: at }), now)).toEqual({ kind: 'soon', label: 'Visita mañana 10:00 · confirmar hoy' })
  })
  it('visita de ayer: ¿vino?', () => {
    const at = '2026-10-29T10:00:00-04:00'
    expect(dueStatus(row({ next_contact_at: at, visit_at: at }), now)).toEqual({ kind: 'late', label: 'Visita era ayer · ¿vino?' })
  })
  it('visita vieja no cuenta si después se agendó otra cosa', () =>
    expect(
      dueStatus(row({ visit_at: '2026-10-20T10:00:00-04:00', next_contact_at: '2026-11-03T09:00:00-04:00' }), now).label,
    ).toBe('En 4 días · 03/11 09:00'))
  it('llamar mañana no pide atención', () =>
    expect(dueStatus(row({ next_contact_at: '2026-10-31T09:00:00-04:00' }), now)).toEqual({ kind: 'normal', label: 'Mañana 09:00' }))
  it('resuelto hoy', () =>
    expect(dueStatus(row({ last_contacted_at: '2026-10-30T08:00:00-04:00', next_contact_at: '2026-10-28T09:00:00-04:00' }), now).kind).toBe('done'))
  it('contactado hoy pero quedó en volver a hablar más tarde hoy', () =>
    expect(
      dueStatus(row({ last_contacted_at: '2026-10-30T11:00:00-04:00', next_contact_at: '2026-10-30T18:00:00-04:00' }), now),
    ).toEqual({ kind: 'now', label: 'Contactar en 6 h (18:00)' }))
  it('resuelto hoy muestra igual cuándo es la visita', () => {
    const at = '2026-10-31T18:45:00-04:00'
    expect(dueStatus(row({ last_contacted_at: '2026-10-30T11:00:00-04:00', next_contact_at: at, visit_at: at }), now)).toEqual({
      kind: 'done',
      label: 'Resuelto hoy · Volver a contactar',
      next: { kind: 'normal', label: 'Visita mañana 18:45' },
    })
  })
})

describe('visitPassed', () => {
  it('visita de hace 1 h sin registrar nada: preguntar ¿vino?', () => {
    const at = '2026-10-30T11:00:00-04:00'
    expect(visitPassed(row({ next_contact_at: at, visit_at: at }), now)).toBe(true)
  })
  it('visita todavía no llega', () => {
    const at = '2026-10-30T15:00:00-04:00'
    expect(visitPassed(row({ next_contact_at: at, visit_at: at }), now)).toBe(false)
  })
  it('después de la visita ya se registró otra cosa', () =>
    expect(visitPassed(row({ visit_at: '2026-10-29T10:00:00-04:00', next_contact_at: '2026-11-02T09:00:00-04:00' }), now)).toBe(false))
})

describe('asignado y nunca contactado', () => {
  it('cuenta como trabajo de hoy', () =>
    expect(dueStatus(row({ next_contact_at: null, last_contacted_at: null, last_result: null }), now)).toEqual({
      kind: 'now',
      label: 'Nuevo · contactar hoy',
    }))
})

// Spec 022: lo nunca contactado que se asignó antes de hoy (día de La Paz) está atrasado.
describe('asignado antes de hoy y nunca contactado', () => {
  const fresh = (assigned_at?: string) => row({ next_contact_at: null, last_contacted_at: null, last_result: null, assigned_at })
  it('hace 3 días', () =>
    expect(dueStatus(fresh('2026-10-27T15:00:00-04:00'), now)).toEqual({ kind: 'late', label: 'Atrasado · asignado hace 3 días' }))
  it('ayer: singular', () =>
    expect(dueStatus(fresh('2026-10-29T09:00:00-04:00'), now)).toEqual({ kind: 'late', label: 'Atrasado · asignado hace 1 día' }))
  it('ayer 23:50 visto hoy 00:10: cuenta por día calendario, no por 24 h', () =>
    expect(dueStatus(fresh('2026-10-29T23:50:00-04:00'), new Date('2026-10-30T00:10:00-04:00')).label).toBe(
      'Atrasado · asignado hace 1 día',
    ))
  it('hoy a las 00:05 sigue siendo nuevo', () =>
    expect(dueStatus(fresh('2026-10-30T00:05:00-04:00'), now)).toEqual({ kind: 'now', label: 'Nuevo · contactar hoy' }))
  it('sin fecha de asignación (servidor sin la 022): como antes', () =>
    expect(dueStatus(fresh(undefined), now)).toEqual({ kind: 'now', label: 'Nuevo · contactar hoy' }))
  it('contactado antes y sin nada agendado: sigue «Por contactar»', () =>
    expect(dueStatus(row({ next_contact_at: null, assigned_at: '2026-10-20T09:00:00-04:00' }), now)).toEqual({
      kind: 'normal',
      label: 'Por contactar',
    }))
  it('con contacto agendado vencido: conserva su regla', () =>
    expect(
      dueStatus(row({ next_contact_at: '2026-10-28T09:00:00-04:00', assigned_at: '2026-10-20T09:00:00-04:00' }), now).label,
    ).toBe('Atrasado 2 días · tocaba el 28/10'))
})

// Fecha vencida heredada: se lo pasaron hoy desde otra persona con la fecha que ella dejó vencida (caso Rene, 24/11).
// Es trabajo de hoy de quien lo recibe; el atraso queda como dato. Desde mañana vuelve la regla normal.
describe('recibido hoy con fecha vencida heredada', () => {
  const inherited = (o: Partial<FollowupRow> = {}) =>
    row({
      stage: 'recapture',
      next_contact_at: '2026-10-15T09:00:00-04:00',
      last_contacted_at: '2026-10-14T10:07:00-04:00',
      assigned_at: '2026-10-30T10:21:00-04:00',
      ...o,
    })
  it('cuenta como trabajo de hoy, con la fecha vencida como dato', () =>
    expect(dueStatus(inherited(), now)).toEqual({ kind: 'now', label: 'Recibido hoy · venció el 15/10' }))
  it('visita vencida: pregunta ¿vino?', () =>
    expect(dueStatus(inherited({ visit_at: '2026-10-15T09:00:00-04:00' }), now)).toEqual({
      kind: 'now',
      label: 'Recibido hoy · visita era el 15/10 · ¿vino?',
    }))
  it('si lo contacta hoy, queda resuelto', () =>
    expect(
      dueStatus(inherited({ last_contacted_at: '2026-10-30T11:00:00-04:00', next_contact_at: '2026-11-02T09:00:00-04:00' }), now)
        .kind,
    ).toBe('done'))
  // Spec 026: antes decía «Atrasado 16 días · tocaba el 15/10» (los días de la persona anterior); ahora cuenta desde que lo recibió.
  it('al día siguiente sin contactarlo: atrasado 1 día desde que lo recibió', () =>
    expect(dueStatus(inherited(), new Date('2026-10-31T09:00:00-04:00'))).toEqual({
      kind: 'late',
      label: 'Atrasado 1 día · recibido el 30/10 (tocaba el 15/10)',
    }))
  it('sin fecha de asignación (base vieja): como antes', () =>
    expect(dueStatus(inherited({ assigned_at: undefined }), now).label).toBe('Atrasado 15 días · tocaba el 15/10'))
})

// Spec 026: el atraso se cuenta desde la fecha más reciente entre lo agendado y el día en que lo recibió el responsable
// actual; y la prioridad del día (la marca la jefa) lo vuelve trabajo de hoy sin esconder el atraso.
describe('spec 026 · atraso justo', () => {
  const never = row({ last_contacted_at: null, last_result: null, last_method: null })

  it('A1 · recibido ayer con fecha heredada vieja: 1 día, no 10', () => {
    const r = row({ next_contact_at: '2026-10-20T09:00:00-04:00', assigned_at: '2026-10-29T10:00:00-04:00', reassigned_from_name: 'Nayara' })
    expect(dueStatus(r, now)).toEqual({ kind: 'late', label: 'Atrasado 1 día · recibido el 29/10 (tocaba el 20/10)' })
    expect(lateInfo(r, now)).toEqual({ days: 1, type: 'overdue' })
  })
  it('A2 · agendado por la misma persona: cuenta desde la fecha agendada (igual que antes)', () => {
    const r = row({ next_contact_at: '2026-10-26T09:00:00-04:00', assigned_at: '2026-10-01T10:00:00-04:00' })
    expect(dueStatus(r, now)).toEqual({ kind: 'late', label: 'Atrasado 4 días · tocaba el 26/10' })
    expect(lateInfo(r, now)).toEqual({ days: 4, type: 'overdue' })
  })
  it('A3 · nunca contactado, asignado hace 10 días', () => {
    const r = { ...never, assigned_at: '2026-10-20T08:00:00-04:00' }
    expect(dueStatus(r, now)).toEqual({ kind: 'late', label: 'Atrasado · asignado hace 10 días' })
    expect(lateInfo(r, now)).toEqual({ days: 10, type: 'never' })
  })
  it('A4 · visita vencida cuenta como fecha vencida', () => {
    const at = '2026-10-29T10:00:00-04:00'
    expect(lateInfo(row({ next_contact_at: at, visit_at: at }), now)).toEqual({ days: 1, type: 'overdue' })
  })
  it('A4 · visita vencida recibida después: cuenta desde que la recibió', () => {
    const at = '2026-10-20T10:00:00-04:00'
    const r = row({ next_contact_at: at, visit_at: at, assigned_at: '2026-10-28T10:00:00-04:00' })
    expect(dueStatus(r, now)).toEqual({ kind: 'late', label: 'Recibido el 28/10 · visita era el 20/10 · ¿vino?' })
    expect(lateInfo(r, now)).toEqual({ days: 2, type: 'overdue' })
  })
  it('A5 · recibido hoy con fecha vencida sigue siendo trabajo de hoy', () => {
    const r = row({ next_contact_at: '2026-10-20T09:00:00-04:00', assigned_at: '2026-10-30T08:00:00-04:00' })
    expect(dueStatus(r, now).kind).toBe('now')
    expect(lateInfo(r, now)).toBeNull()
  })
  it('lo que no está atrasado no tiene atraso', () => {
    expect(lateInfo(row({ next_contact_at: '2026-10-31T09:00:00-04:00' }), now)).toBeNull()
    expect(lateInfo(row({ last_contacted_at: '2026-10-30T08:00:00-04:00', next_contact_at: '2026-10-28T09:00:00-04:00' }), now)).toBeNull()
  })
})

describe('spec 026 · prioridad de hoy', () => {
  const late = row({ next_contact_at: '2026-10-28T09:00:00-04:00', priority_today: true })

  it('B2 · atrasado con prioridad: trabajo de hoy y el atraso queda a la vista', () =>
    expect(dueStatus(late, now)).toEqual({ kind: 'now', label: 'Prioridad de hoy · atrasado 2 días' }))
  it('B2 · nunca contactado con prioridad', () =>
    expect(
      dueStatus(row({ last_contacted_at: null, assigned_at: '2026-10-20T08:00:00-04:00', priority_today: true }), now),
    ).toEqual({ kind: 'now', label: 'Prioridad de hoy · atrasado 10 días' }))
  it('agendado más adelante con prioridad: entra hoy', () =>
    expect(dueStatus(row({ next_contact_at: '2026-11-03T09:00:00-04:00', priority_today: true }), now)).toEqual({
      kind: 'now',
      label: 'Prioridad de hoy',
    }))
  it('agendado para hoy con prioridad: conserva la hora', () =>
    expect(dueStatus(row({ next_contact_at: '2026-10-30T14:30:00-04:00', priority_today: true }), now).label).toBe(
      'Prioridad de hoy · Contactar en 2 h 30 min (14:30)',
    ))
  it('B4 · contactado hoy: resuelto, aunque tenga prioridad', () =>
    expect(dueStatus({ ...late, last_contacted_at: '2026-10-30T09:00:00-04:00' }, now).kind).toBe('done'))
  it('B5 · sin prioridad (otro día) vuelve a atrasado con sus días reales', () =>
    expect(dueStatus({ ...late, priority_today: false }, now)).toEqual({ kind: 'late', label: 'Atrasado 2 días · tocaba el 28/10' }))
})

// Spec 028: recibido hoy con fecha agendada más adelante. Se ve hoy como nuevo, pero no pide atención.
describe('spec 028 · «Nuevo para ti» (recibido hoy, agendado más adelante)', () => {
  const got = row({ assigned_at: '2026-10-30T10:14:00-04:00', next_contact_at: '2026-11-03T10:00:00-04:00', visit_at: '2026-11-03T10:00:00-04:00' })
  it('C9 · visita más adelante: etiqueta con la fecha, sin pedir atención', () =>
    expect(dueStatus(got, now)).toEqual({ kind: 'normal', label: 'Nuevo para ti · visita 03/11 10:00' }))
  it('llamada más adelante', () =>
    expect(dueStatus({ ...got, visit_at: null, next_contact_at: '2026-11-05T09:00:00-04:00' }, now).label).toBe(
      'Nuevo para ti · contactar 05/11 09:00',
    ))
  it('llamada mañana también es «más adelante» (no le toca hoy)', () =>
    expect(dueStatus({ ...got, visit_at: null, next_contact_at: '2026-10-31T09:00:00-04:00' }, now)).toEqual({
      kind: 'normal',
      label: 'Nuevo para ti · contactar 31/10 09:00',
    }))
  it('visita mañana: sigue siendo «confirmar hoy» (le toca hoy)', () =>
    expect(dueStatus({ ...got, next_contact_at: '2026-10-31T10:00:00-04:00', visit_at: '2026-10-31T10:00:00-04:00' }, now).kind).toBe('soon'))
  it('C8 · recibido otro día: la etiqueta de siempre', () =>
    expect(dueStatus({ ...got, assigned_at: '2026-10-29T10:14:00-04:00' }, now).label).toBe('Visita en 4 días · 03/11 10:00'))
  it('si ya lo contactó hoy, es «resuelto hoy» como siempre', () =>
    expect(dueStatus({ ...got, last_contacted_at: '2026-10-30T11:00:00-04:00' }, now).kind).toBe('done'))
  it('con prioridad de hoy (026) pasa a trabajo de hoy', () =>
    expect(dueStatus({ ...got, priority_today: true }, now).kind).toBe('now'))
  it('receivedLater: solo lo recibido hoy, abierto y agendado más adelante', () => {
    expect(receivedLater(got, now)).toBe(true)
    expect(receivedLater({ ...got, assigned_at: '2026-10-29T10:14:00-04:00' }, now)).toBe(false)
    expect(receivedLater({ ...got, next_contact_at: '2026-10-30T15:00:00-04:00', visit_at: null }, now)).toBe(false)
    expect(receivedLater({ ...got, stage: 'sale' }, now)).toBe(false)
    expect(receivedLater({ ...got, next_contact_at: null, visit_at: null }, now)).toBe(false)
  })
})
