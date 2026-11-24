import { describe, expect, it, vi } from 'vitest'
import type { FollowupRow } from '@/features/followup/api'
import { dueStatus, visitPassed } from '@/features/followup/dueStatus'

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
  it('al día siguiente sin contactarlo: atrasado y ya es suyo', () =>
    expect(dueStatus(inherited(), new Date('2026-10-31T09:00:00-04:00'))).toEqual({
      kind: 'late',
      label: 'Atrasado 16 días · tocaba el 15/10',
    }))
  it('sin fecha de asignación (base vieja): como antes', () =>
    expect(dueStatus(inherited({ assigned_at: undefined }), now).label).toBe('Atrasado 15 días · tocaba el 15/10'))
})
