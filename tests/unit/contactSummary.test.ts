import { describe, expect, it } from 'vitest'
import type { TimelineItem } from '@/features/client/api'
import { contactBreakdown, summarizeContacts } from '@/features/client/contactSummary'

const contact = (actor: string, method: 'call' | 'whatsapp_call' | 'message' | 'store'): TimelineItem => ({
  type: 'contact',
  at: '2026-11-13T12:00:00Z',
  actor,
  data: { result: 'no_answer', method, note: null, visit_at: null, callback_at: null },
})

describe('summarizeContacts', () => {
  it('sin contactos: lista vacía', () => {
    const t: TimelineItem[] = [{ type: 'capture', at: '2026-11-13T12:00:00Z', actor: 'Vol', data: { channel: null } }]
    expect(summarizeContacts(t)).toEqual([])
  })

  it('agrupa por persona y forma; ignora lo que no es contacto', () => {
    const t: TimelineItem[] = [
      contact('Ana', 'whatsapp_call'),
      contact('Luis', 'store'),
      contact('Ana', 'call'),
      { type: 'assignment', at: '2026-11-13T12:00:00Z', actor: 'Enc', data: { to: 'Ana', from: null } },
      contact('Ana', 'message'),
    ]
    expect(summarizeContacts(t)).toEqual([
      { actor: 'Ana', total: 3, calls: 2, messages: 1, store: 0 },
      { actor: 'Luis', total: 1, calls: 0, messages: 0, store: 1 },
    ])
  })

  it('empate en total: por nombre', () => {
    const s = summarizeContacts([contact('Zoe', 'message'), contact('Beto', 'message')])
    expect(s.map((x) => x.actor)).toEqual(['Beto', 'Zoe'])
  })
})

describe('contactBreakdown', () => {
  it('singular, plural y sin ceros', () => {
    expect(contactBreakdown({ actor: 'Ana', total: 4, calls: 3, messages: 1, store: 0 })).toBe('3 llamadas · 1 mensaje')
    expect(contactBreakdown({ actor: 'Luis', total: 1, calls: 0, messages: 0, store: 1 })).toBe('1 en tienda')
  })
})
