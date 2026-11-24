import { describe, expect, it } from 'vitest'
import { filterFollowed, hasLens } from '@/features/monitoring/daily'
import { MONITORING_KEYS, validateManageSearch } from '@/features/prospects/search'

// Lupas de la lista «Clientes con seguimiento» de «Del día»: solo achican la tabla, no tocan los números.
const DAY = '2026-11-24'
const row = (over: Partial<Parameters<typeof filterFollowed>[0][number]>) => ({
  full_name: 'Cliente',
  phone_norm: '70000000',
  effective: false,
  last_result: 'no_answer' as const,
  registered_at: '2026-11-10T14:00:00Z',
  stage: 'followup',
  ...over,
})
const francis = row({
  full_name: 'Francis',
  phone_norm: '69386518',
  effective: true,
  last_result: 'looking_product',
})
const reny = row({
  full_name: 'Reny Fernández',
  phone_norm: '73997311',
  effective: true,
  last_result: 'sold',
  stage: 'sale',
})
const rossy = row({ full_name: 'Rossy', phone_norm: '73997608' })
// Registrado el 24/11 a las 23:30 de La Paz (03:30 UTC del 25): para Bolivia es «ese día».
const nueva = row({ full_name: 'Ninoska', phone_norm: '67364238', registered_at: '2026-11-25T03:30:00Z' })
const rows = [francis, reny, rossy, nueva]
const names = (r: typeof rows) => r.map((x) => x.full_name)

describe('filterFollowed', () => {
  it('sin lupas devuelve todo, en el mismo orden', () => {
    expect(filterFollowed(rows, {}, DAY)).toEqual(rows)
    expect(hasLens({})).toBe(false)
  })
  it('Resultado: efectivos, no efectivos o uno exacto (sobre el último resultado)', () => {
    expect(names(filterFollowed(rows, { resultado: 'efectivos' }, DAY))).toEqual([
      'Francis',
      'Reny Fernández',
    ])
    expect(names(filterFollowed(rows, { resultado: 'no_efectivos' }, DAY))).toEqual(['Rossy', 'Ninoska'])
    expect(names(filterFollowed(rows, { resultado: 'sold' }, DAY))).toEqual(['Reny Fernández'])
  })
  it('Tipo: registrado ese día o antes, en hora de Bolivia', () => {
    expect(names(filterFollowed(rows, { tipo: 'nuevos' }, DAY))).toEqual(['Ninoska'])
    expect(names(filterFollowed(rows, { tipo: 'antes' }, DAY))).toEqual([
      'Francis',
      'Reny Fernández',
      'Rossy',
    ])
  })
  it('Etapa', () => {
    expect(names(filterFollowed(rows, { etapa: 'sale' }, DAY))).toEqual(['Reny Fernández'])
  })
  it('Buscar: nombre sin tildes o celular con espacios', () => {
    expect(names(filterFollowed(rows, { buscar: 'fernandez' }, DAY))).toEqual(['Reny Fernández'])
    expect(names(filterFollowed(rows, { buscar: '7399 7608' }, DAY))).toEqual(['Rossy'])
  })
  it('las lupas se combinan', () => {
    expect(names(filterFollowed(rows, { resultado: 'efectivos', etapa: 'followup' }, DAY))).toEqual([
      'Francis',
    ])
    expect(hasLens({ buscar: '  ' })).toBe(false)
    expect(hasLens({ tipo: 'antes' })).toBe(true)
  })
})

describe('parámetros de la URL de las lupas', () => {
  it('resultado y tipo solo con valores de la lista; buscar como texto', () => {
    expect(validateManageSearch({ resultado: 'efectivos', tipo: 'nuevos', buscar: 'ana' })).toMatchObject({
      resultado: 'efectivos',
      tipo: 'nuevos',
      buscar: 'ana',
    })
    expect(validateManageSearch({ resultado: 'sold' }).resultado).toBe('sold')
    expect(validateManageSearch({ resultado: 'x', tipo: 'y', buscar: 5 })).toMatchObject({
      resultado: undefined,
      tipo: undefined,
      buscar: undefined,
    })
  })
  it('se limpian al cambiar de vista', () => {
    expect(MONITORING_KEYS).toEqual(expect.arrayContaining(['resultado', 'tipo', 'buscar']))
  })
})
