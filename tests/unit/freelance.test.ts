import { describe, expect, it } from 'vitest'
import { isFreelanceChannel } from '@/features/capture/freelance'

// Spec 033, criterio 1: el registro corto se activa con el canal de la jornada «Freelance» (catálogo de registro)
// y la cantidad de la Planificación con el canal «Freelancers» (catálogo de la organización).
describe('isFreelanceChannel', () => {
  it('reconoce Freelance y Freelancers, sin importar mayúsculas, tildes ni espacios', () => {
    for (const name of ['Freelance', 'FREELANCE', '  freelance ', 'Freelancers', 'freelancers', 'Fréelance'])
      expect(isFreelanceChannel(name)).toBe(true)
  })

  it('los demás canales y sin canal no', () => {
    for (const name of ['Activación', 'Marketplace', 'Referidos', 'Free lance', '', undefined])
      expect(isFreelanceChannel(name)).toBe(false)
  })
})
