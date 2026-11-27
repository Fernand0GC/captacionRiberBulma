import { describe, expect, it } from 'vitest'
import { resultsPendingMessage } from '@/features/organization/logic'

// Spec 032, criterio 13: mensaje cuando la base rechaza con `results_pending` y detalle «AAAA-MM-DD|N».
describe('resultsPendingMessage', () => {
  it('varias asignaciones', () => {
    expect(resultsPendingMessage('2026-11-26|3')).toBe(
      'Faltan resultados del 26/11 (3 asignaciones). Cárgalos antes de planificar un día nuevo.',
    )
  })

  it('una sola asignación, en singular', () => {
    expect(resultsPendingMessage('2026-11-05|1')).toBe(
      'Faltan resultados del 05/11 (1 asignación). Cárgalos antes de planificar un día nuevo.',
    )
  })

  it('detalle vacío o raro: mensaje general sin fecha', () => {
    for (const d of ['', 'algo', '2026-11-26'])
      expect(resultsPendingMessage(d)).toBe(
        'Faltan resultados del último día trabajado. Cárgalos antes de planificar un día nuevo.',
      )
  })
})
