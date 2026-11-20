import { describe, expect, it } from 'vitest'
import { validateManageSearch } from '@/features/prospects/search'

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
