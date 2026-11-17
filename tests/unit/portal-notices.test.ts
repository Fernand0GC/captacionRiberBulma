import { describe, expect, it, vi } from 'vitest'
import type { FollowupRow } from '@/features/followup/api'
import { buildNotices } from '@/features/portal/notices'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const base: FollowupRow = {
  id: '1',
  full_name: 'María Pérez',
  phone_raw: '70000000',
  phone_norm: '59170000000',
  stage: 'followup',
  contact_attempts: 0,
  next_contact_at: null,
  visit_at: null,
  client_created_at: '2026-11-10T10:00:00-04:00',
  interest: null,
  product_id: null,
  product_name: null,
  channel_name: null,
  created_by_name: 'Vol',
  last_result: 'call_later',
  last_method: 'message',
  last_note: null,
  last_contacted_at: '2026-11-12T10:00:00-04:00',
}
const now = new Date('2026-11-16T12:00:00-04:00')
const row = (o: Partial<FollowupRow>) => ({ ...base, ...o })

describe('avisos para el portal', () => {
  it('cuenta atrasados, de hoy y visitas de mañana, sin datos personales', () => {
    const notices = buildNotices(
      [
        row({ id: 'a', next_contact_at: '2026-11-14T09:00:00-04:00' }),
        row({ id: 'b', next_contact_at: '2026-11-15T09:00:00-04:00' }),
        row({ id: 'c', next_contact_at: '2026-11-16T15:00:00-04:00' }),
        row({ id: 'd', next_contact_at: '2026-11-17T10:00:00-04:00', visit_at: '2026-11-17T10:00:00-04:00' }),
        row({ id: 'e', next_contact_at: '2026-11-20T10:00:00-04:00' }),
      ],
      now,
    )
    expect(notices).toEqual([
      { id: 'captacion-late', texto: '2 contactos atrasados', sistema: 'captacion', fecha: '2026-11-16T00:00:00-04:00', url: '/seguimiento' },
      { id: 'captacion-now', texto: '1 contacto para hoy', sistema: 'captacion', fecha: '2026-11-16T00:00:00-04:00', url: '/seguimiento' },
      {
        id: 'captacion-soon',
        texto: '1 visita de mañana por confirmar',
        sistema: 'captacion',
        fecha: '2026-11-16T00:00:00-04:00',
        url: '/seguimiento',
      },
    ])
    expect(JSON.stringify(notices)).not.toMatch(/María|7000/)
  })

  it('sin pendientes no hay avisos', () => {
    expect(buildNotices([row({ next_contact_at: '2026-11-20T10:00:00-04:00' })], now)).toEqual([])
  })
})
