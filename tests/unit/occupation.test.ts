import { describe, expect, it } from 'vitest'
import { asksOccupation } from '@/features/capture/occupation'

// Spec 031: el formulario de registro no pide «Ocupación del cliente» si el canal de la jornada es Messenger o
// Marketplace.
describe('asksOccupation', () => {
  it('Messenger y Marketplace no piden ocupación (criterio 1)', () => {
    expect(asksOccupation('Messenger')).toBe(false)
    expect(asksOccupation('Marketplace')).toBe(false)
  })

  it('ignora mayúsculas, tildes y espacios de más (criterio 2)', () => {
    expect(asksOccupation('MARKETPLACE')).toBe(false)
    expect(asksOccupation('  messenger ')).toBe(false)
    expect(asksOccupation('Márketplace')).toBe(false)
    expect(asksOccupation('Market  place')).toBe(true) // otro nombre: no se adivina
  })

  it('los demás canales y sin canal sí la piden (criterio 3)', () => {
    for (const name of ['Activación', 'Volanteo', 'Freelance', 'Facebook', 'WhatsApp', 'TikTok', 'Tienda'])
      expect(asksOccupation(name)).toBe(true)
    expect(asksOccupation(undefined)).toBe(true)
    expect(asksOccupation('')).toBe(true)
  })
})
