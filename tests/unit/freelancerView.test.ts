import { describe, expect, it } from 'vitest'
import { freelancerView } from '@/features/organization/freelancerView'

// Spec 036: buscar, ordenar (marcados primero) y cuándo ofrecer «Agregar «texto»».
const options = [
  { id: 3, name: 'Luis Peña' },
  { id: 1, name: 'Ana María' },
  { id: 2, name: 'Ángel Ruiz' },
  { id: 4, name: 'Beto' },
]
const names = (v: ReturnType<typeof freelancerView>) => v.items.map((i) => i.name)

describe('freelancerView', () => {
  it('sin búsqueda: marcados primero y cada grupo por nombre (criterio 2)', () => {
    const v = freelancerView(options, [3, 4], '')
    expect(names(v)).toEqual(['Beto', 'Luis Peña', 'Ana María', 'Ángel Ruiz'])
    expect(v.items.map((i) => i.checked)).toEqual([true, true, false, false])
  })

  it('contador de marcados (criterio 3)', () => {
    expect(freelancerView(options, [], '').pickedText).toBeNull()
    expect(freelancerView(options, [1], '').pickedText).toBe('1 marcado')
    expect(freelancerView(options, [1, 2], '').pickedText).toBe('2 marcados')
  })

  it('filtra sin importar mayúsculas, tildes ni espacios; los marcados se ven siempre (criterio 1)', () => {
    expect(names(freelancerView(options, [], '  ANGEL '))).toEqual(['Ángel Ruiz'])
    expect(names(freelancerView(options, [], 'an'))).toEqual(['Ana María', 'Ángel Ruiz'])
    expect(names(freelancerView(options, [4], 'luis'))).toEqual(['Beto', 'Luis Peña'])
  })

  it('ofrece agregar lo buscado si tiene 2+ letras y no existe igual (criterio 6)', () => {
    expect(freelancerView(options, [], 'a').addName).toBeNull()
    expect(freelancerView(options, [], 'ana maria').addName).toBeNull() // ya existe (sin tildes ni mayúsculas)
    expect(freelancerView(options, [], 'ana').addName).toBe('ana') // coincide parcial, pero no igual
    expect(freelancerView(options, [], '  Carla   Soto ').addName).toBe('Carla Soto')
  })

  it('sin resultados lo dice (criterio 7)', () => {
    const v = freelancerView(options, [], 'zz')
    expect(v.items).toEqual([])
    expect(v.emptyText).toBe('Ningún freelancer coincide con «zz».')
    expect(freelancerView(options, [], '').emptyText).toBeNull()
  })
})
