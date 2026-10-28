import { describe, expect, it } from 'vitest'
import { uuidv7 } from '@/lib/uuidv7'

describe('uuidv7', () => {
  it('tiene formato UUID con versión 7 y variante RFC', () => {
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('ordena por tiempo', () => {
    const a = uuidv7(1_700_000_000_000)
    const b = uuidv7(1_700_000_000_001)
    expect(a < b).toBe(true)
  })

  it('codifica el timestamp en los primeros 48 bits', () => {
    const id = uuidv7(0x0123456789ab)
    expect(id.startsWith('01234567-89ab')).toBe(true)
  })

  it('no repite', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(1)))
    expect(ids.size).toBe(1000)
  })
})
