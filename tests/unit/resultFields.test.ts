import { describe, expect, it } from 'vitest'
import { resultFields } from '@/features/organization/logic'

// Spec 040 (obs. 14 de ventas): qué campos pide el diálogo «Resultado» de la Planificación.
// Una tarea por cumplimiento (sin meta de captación ni de compartidas) solo pregunta «¿Se hizo?».
const row = {
  uses_goal: false,
  uses_share_goal: false,
  goal: null as number | null,
  share_goal: null as number | null,
  result: null as number | null,
  share_result: null as number | null,
}

describe('resultFields · comportamiento que no cambia', () => {
  it('con marca de captación pide Captados y no «¿Se hizo?»', () => {
    expect(resultFields({ ...row, uses_goal: true, goal: 20 })).toEqual({ done: false, capture: true, share: false })
  })
  it('con solo marca de compartidas pide solo Compartidas', () => {
    expect(resultFields({ ...row, uses_share_goal: true, share_goal: 15 })).toEqual({
      done: false,
      capture: false,
      share: true,
    })
  })
  it('con las dos marcas pide los dos números', () => {
    expect(resultFields({ ...row, uses_goal: true, uses_share_goal: true, goal: 10, share_goal: 5 })).toEqual({
      done: false,
      capture: true,
      share: true,
    })
  })
  it('una meta ya cargada manda aunque el catálogo haya apagado la marca', () => {
    expect(resultFields({ ...row, goal: 20 })).toEqual({ done: false, capture: true, share: false })
    expect(resultFields({ ...row, share_goal: 8 })).toEqual({ done: false, capture: false, share: true })
  })
})

describe('resultFields · tarea por cumplimiento (spec 040)', () => {
  it('sin meta y sin resultado solo pregunta «¿Se hizo?»: ningún número', () => {
    expect(resultFields(row)).toEqual({ done: true, capture: false, share: false })
  })
  it('si ya tiene captados guardados, el campo sigue a la vista para corregirlo o borrarlo', () => {
    expect(resultFields({ ...row, result: 3 })).toEqual({ done: true, capture: true, share: false })
    expect(resultFields({ ...row, result: 0 })).toEqual({ done: true, capture: true, share: false })
  })
  it('si ya tiene compartidas guardadas, solo ese campo sigue a la vista', () => {
    expect(resultFields({ ...row, share_result: 2 })).toEqual({ done: true, capture: false, share: true })
  })
})
