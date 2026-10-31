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
