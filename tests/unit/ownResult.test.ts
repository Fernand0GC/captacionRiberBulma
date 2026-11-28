import { describe, expect, it } from 'vitest'
import { registeredBy, resultState } from '@/features/organization/logic'

// Spec 039 (RF-05): estado del resultado y «Registrado por» en la tarjeta de la Planificación / «Mi plan».
describe('resultState', () => {
  it('sin nada registrado es pendiente', () => {
    expect(resultState({ result: null, share_result: null, done: null })).toBe('pending')
  })
  it('con captados o compartidas muestra el puntaje, aunque haya done', () => {
    expect(resultState({ result: 0, share_result: null, done: null })).toBe('score')
    expect(resultState({ result: null, share_result: 4, done: false })).toBe('score')
  })
  it('sin números usa Hecho / No hecho', () => {
    expect(resultState({ result: null, share_result: null, done: true })).toBe('done')
    expect(resultState({ result: null, share_result: null, done: false })).toBe('not_done')
  })
})

describe('registeredBy', () => {
  it('nombra a quien registró si no es la persona de la tarea', () => {
    expect(registeredBy({ profile_id: 'aux', result_by: 'enc', result_by_name: 'Ana Encargada' })).toBe(
      'Registrado por Ana Encargada',
    )
  })
  it('no dice nada si registró la propia persona o nadie', () => {
    expect(registeredBy({ profile_id: 'aux', result_by: 'aux', result_by_name: 'Aux' })).toBeNull()
    expect(registeredBy({ profile_id: 'aux', result_by: null, result_by_name: null })).toBeNull()
  })
  it('sin nombre conocido no inventa uno', () => {
    expect(registeredBy({ profile_id: 'aux', result_by: 'enc', result_by_name: null })).toBeNull()
  })
})
