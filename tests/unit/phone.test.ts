import { describe, expect, it } from 'vitest'
import { isValidPhone, maskPhone, normalizePhone } from '@/lib/phone'

// Mismos casos que supabase/tests/functions_test.sql.
describe('normalizePhone', () => {
  it.each([
    ['+591 7123-4567', '71234567'],
    ['591 71234567', '71234567'],
    ['071234567', '71234567'],
    ['7 1 2 3 4 5 6 7', '71234567'],
    ['3-462-1234', '34621234'],
  ])('%s → %s', (raw, norm) => expect(normalizePhone(raw)).toBe(norm))
})

describe('isValidPhone', () => {
  it.each(['71234567', '+591 61234567', '4621234'])('%s válido', (p) => expect(isValidPhone(p)).toBe(true))
  it.each(['81234567', '7123456', ''])('%s inválido', (p) => expect(isValidPhone(p)).toBe(false))
})

describe('maskPhone', () => {
  it('enmascara el centro', () => expect(maskPhone('71234567')).toBe('7123••67'))
})
