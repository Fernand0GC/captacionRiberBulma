import { describe, expect, it } from 'vitest'
import { laPazDate, shiftFor } from '@/lib/dates'

describe('shiftFor', () => {
  it('12:59 La Paz = mañana', () => expect(shiftFor(new Date('2026-10-28T12:59:00-04:00'))).toBe('morning'))
  it('13:00 La Paz = tarde', () => expect(shiftFor(new Date('2026-10-28T13:00:00-04:00'))).toBe('afternoon'))
  it('16:30 UTC = 12:30 La Paz = mañana', () => expect(shiftFor(new Date('2026-10-28T16:30:00Z'))).toBe('morning'))
  it('respeta un corte distinto', () => expect(shiftFor(new Date('2026-10-28T12:30:00-04:00'), '12:00')).toBe('afternoon'))
})

describe('laPazDate', () => {
  it('02:00 UTC es el día anterior en La Paz', () => expect(laPazDate(new Date('2026-10-28T02:00:00Z'))).toBe('2026-10-27'))
})
