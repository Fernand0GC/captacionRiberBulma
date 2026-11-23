import { describe, expect, it } from 'vitest'
import { dateBasisOf, defaultPeriod, MONITORING_KEYS, periodRange, validateManageSearch } from '@/features/prospects/search'

const UUID = '0190a1b2-0000-7000-8000-000000000001'

describe('validateManageSearch: vistas de monitoreo', () => {
  it('acepta las vistas conocidas y descarta las demás', () => {
    expect(validateManageSearch({ ver: 'seguimiento' }).ver).toBe('seguimiento')
    expect(validateManageSearch({ ver: 'actividad' }).ver).toBe('actividad')
    expect(validateManageSearch({ ver: 'visitas' }).ver).toBe('visitas')
    expect(validateManageSearch({ ver: 'otra' }).ver).toBeUndefined()
  })

  it('estado, interés e intentos solo con valores de la lista', () => {
    const ok = validateManageSearch({ estado: 'potencial', interes: 'sin', intentos: '3+' })
    expect(ok).toMatchObject({ estado: 'potencial', interes: 'sin', intentos: '3+' })
    const bad = validateManageSearch({ estado: 'capture', interes: 'high', intentos: '5' })
    expect(bad.estado).toBeUndefined()
    expect(bad.interes).toBeUndefined()
    expect(bad.intentos).toBeUndefined()
  })

  it('vencidos acepta true, 1 y "1"', () => {
    expect(validateManageSearch({ vencidos: true }).vencidos).toBe(true)
    expect(validateManageSearch({ vencidos: 1 }).vencidos).toBe(true)
    expect(validateManageSearch({ vencidos: '1' }).vencidos).toBe(true)
    expect(validateManageSearch({ vencidos: 0 }).vencidos).toBeUndefined()
  })

  it('sin_contacto solo 3, 7, 15 o 30', () => {
    expect(validateManageSearch({ sin_contacto: 7 }).sin_contacto).toBe(7)
    expect(validateManageSearch({ sin_contacto: '15' }).sin_contacto).toBe(15)
    expect(validateManageSearch({ sin_contacto: 5 }).sin_contacto).toBeUndefined()
  })

  it('motivo entero; orden con forma de columna', () => {
    expect(validateManageSearch({ motivo: 4 }).motivo).toBe(4)
    expect(validateManageSearch({ motivo: 'x' }).motivo).toBeUndefined()
    expect(validateManageSearch({ orden: '-sales' }).orden).toBe('-sales')
    expect(validateManageSearch({ orden: 'sales; drop' }).orden).toBeUndefined()
  })

  it('persona solo uuid; métrica de la lista', () => {
    expect(validateManageSearch({ persona: UUID, metrica: 'visits' })).toMatchObject({ persona: UUID, metrica: 'visits' })
    expect(validateManageSearch({ persona: 'Ana', metrica: 'clients' })).toMatchObject({ persona: undefined, metrica: undefined })
    expect(validateManageSearch({ agrupar: 'persona' }).agrupar).toBe('persona')
    expect(validateManageSearch({ agrupar: 'otro' }).agrupar).toBeUndefined()
  })
})

describe('período por defecto según la vista (spec 015)', () => {
  // 21/11/2026 10:00 en La Paz
  const now = new Date('2026-11-21T14:00:00Z')

  it('Seguimientos abre con «Este mes»; las demás vistas con «Hoy»', () => {
    expect(defaultPeriod('seguimiento')).toBe('mes')
    expect(defaultPeriod(undefined)).toBe('hoy')
    expect(defaultPeriod('actividad')).toBe('hoy')
    expect(periodRange({ ver: 'seguimiento' }, now)).toEqual({ from: '2026-11-01', to: '2026-11-21' })
    expect(periodRange({}, now)).toEqual({ from: '2026-11-21', to: '2026-11-21' })
  })

  it('un período elegido manda sobre el de la vista', () => {
    expect(periodRange({ ver: 'seguimiento', periodo: 'hoy' }, now)).toEqual({ from: '2026-11-21', to: '2026-11-21' })
    expect(periodRange({ ver: 'seguimiento', periodo: '7d' }, now)).toEqual({ from: '2026-11-15', to: '2026-11-21' })
  })
})

// Spec 023: «Contar por» de Seguimientos en la URL.
describe('contar (Seguimientos · Contar por)', () => {
  it('acepta asignacion, ultimo y proximo', () => {
    expect(validateManageSearch({ contar: 'asignacion' }).contar).toBe('asignacion')
    expect(validateManageSearch({ contar: 'ultimo' }).contar).toBe('ultimo')
    expect(validateManageSearch({ contar: 'proximo' }).contar).toBe('proximo')
  })
  it('cualquier otra cosa (o nada) es Registro', () => {
    expect(validateManageSearch({ contar: 'registro' }).contar).toBeUndefined()
    expect(validateManageSearch({ contar: 'x' }).contar).toBeUndefined()
    expect(validateManageSearch({}).contar).toBeUndefined()
  })
  it('se traduce al date_basis de la base', () => {
    expect(dateBasisOf(undefined)).toBeUndefined()
    expect(dateBasisOf('asignacion')).toBe('assigned')
    expect(dateBasisOf('ultimo')).toBe('last_contact')
    expect(dateBasisOf('proximo')).toBe('next_contact')
  })
  it('se limpia al cambiar de vista', () => expect(MONITORING_KEYS).toContain('contar'))
})
