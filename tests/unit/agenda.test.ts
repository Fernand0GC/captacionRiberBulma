import { describe, expect, it, vi } from 'vitest'
import type { FollowupRow } from '@/features/followup/api'
import { summarize } from '@/features/followup/inboxView'
import type { AgendaPerson, AgendaRow } from '@/features/monitoring/api'
import { agendaByPerson, agendaTotals, bucketOf } from '@/features/monitoring/agenda'

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

describe('bucketOf: misma regla que «Mis contactos»', () => {
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
    expect(agendaTotals(view)).toEqual({ due: 6, done: 2, pending: 4, late: 2 })
  })
})

describe('paridad con las tarjetas de «Mis contactos»', () => {
  it('para clientes abiertos, Pendientes / Contactó / Atrasados = Para hoy / Contactados hoy / Atrasados', () => {
    const open = [dueToday, dueLater, lateOne, doneToday, newToday, neverContactedOld, visitTomorrow, nextWeek]
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
