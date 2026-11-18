import { describe, expect, it } from 'vitest'
import { parseCi } from '../../supabase/functions/_shared/ci'

describe('parseCi', () => {
  it('pasa a mayúsculas el usuario de la cuenta única', () => {
    expect(parseCi('7788990-1b')).toBe('7788990-1B')
    expect(parseCi(' 4567890 ')).toBe('4567890')
  })
  it('rechaza lo que no es un CI', () => {
    for (const bad of ['', '123', '7788990-', '7788990-1B2C3', 'admin', '7788990_1b', '1234567890123']) {
      expect(parseCi(bad)).toBeNull()
    }
  })
})
