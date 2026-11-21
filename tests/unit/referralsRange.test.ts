import { describe, expect, it } from 'vitest'
import {
  contactStage,
  dayColumns,
  filterContacts,
  fmtDelta,
  fmtGoal,
  previousMonth,
  rangeLabel,
  sortRegistrars,
  sortRows,
  sumDays,
  type CountsWithGoal,
} from '@/features/referrals/logic'
import { inView } from '@/features/referrals/logic'
import { previousRange, referralRange, spanDays, validateReferralSearch } from '@/features/referrals/search'
import { referrerFilter } from '@/features/prospects/search'
import type { Referrer } from '@/features/referrals/api'

// Spec 014: referidos por rango, orden, «Por día» y contactos.

const NOW = new Date('2026-11-21T15:00:00Z') // 11:00 en La Paz

describe('período de referidos', () => {
  it('por defecto «Este mes»: del 1 a hoy', () => {
    expect(referralRange({}, NOW)).toEqual({ from: '2026-11-01', to: '2026-11-21' })
  })
  it('mes pasado completo (también al cruzar el año)', () => {
    expect(referralRange({ periodo: 'mes_pasado' }, NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(referralRange({ periodo: 'mes_pasado' }, new Date('2027-01-10T15:00:00Z'))).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })
  it('hoy y 7 días', () => {
    expect(referralRange({ periodo: 'hoy' }, NOW)).toEqual({ from: '2026-11-21', to: '2026-11-21' })
    expect(referralRange({ periodo: '7d' }, NOW)).toEqual({ from: '2026-11-15', to: '2026-11-21' })
  })
  it('rango: «hasta» antes de «desde» se corrige y más de 366 días se recorta', () => {
    expect(referralRange({ periodo: 'rango', desde: '2026-11-10', hasta: '2026-11-01' }, NOW)).toEqual({ from: '2026-11-10', to: '2026-11-10' })
    const long = referralRange({ periodo: 'rango', desde: '2025-01-01', hasta: '2026-11-01' }, NOW)
    expect(spanDays(long.from, long.to)).toBe(367)
  })
  it('período anterior del mismo largo, justo antes', () => {
    expect(previousRange({ from: '2026-11-01', to: '2026-11-15' })).toEqual({ from: '2026-10-17', to: '2026-10-31' })
    expect(previousRange({ from: '2026-11-21', to: '2026-11-21' })).toEqual({ from: '2026-11-20', to: '2026-11-20' })
  })
  it('la URL descarta valores inválidos y nunca acepta textos largos', () => {
    const s = validateReferralSearch({ periodo: 'siempre', desde: '2026-13', sucursal: '5', seccion: 'contactos', tipo: 'bonus', orden: 'DROP', responsable: 'x'.repeat(81) })
    expect(s).toMatchObject({ periodo: undefined, desde: undefined, sucursal: 5, seccion: 'contactos', tipo: undefined, orden: undefined, responsable: undefined })
    expect(validateReferralSearch({ todas: 'true', agrupar: true, etapa: 'sold', mes: '2026-10' })).toMatchObject({ todas: true, agrupar: true, etapa: 'sold', mes: '2026-10' })
  })
})

const row = (name: string, over: Partial<CountsWithGoal> = {}) => ({
  name,
  arrived: 0,
  uncontacted: 0,
  in_followup: 0,
  sold: 0,
  lost: 0,
  goal: null,
  ...over,
})

describe('orden de la tabla', () => {
  const rows = [row('Beto', { arrived: 10, sold: 1 }), row('ana', { arrived: 4, sold: 2, goal: 8 }), row('Caro')]
  it('sin columna deja el orden del servidor', () => {
    expect(sortRows(rows, undefined).map((r) => r.name)).toEqual(['Beto', 'ana', 'Caro'])
  })
  it('por conversión de mayor a menor; los sin dato al final en los dos sentidos', () => {
    expect(sortRows(rows, 'conversion', 'desc').map((r) => r.name)).toEqual(['ana', 'Beto', 'Caro'])
    expect(sortRows(rows, 'conversion', 'asc').map((r) => r.name)).toEqual(['Beto', 'ana', 'Caro'])
    expect(sortRows(rows, 'goal', 'asc').map((r) => r.name)).toEqual(['ana', 'Beto', 'Caro'])
  })
  it('por nombre sin distinguir mayúsculas', () => {
    expect(sortRows(rows, 'name', 'asc').map((r) => r.name)).toEqual(['ana', 'Beto', 'Caro'])
  })
})

describe('formatos', () => {
  it('meta prorrateada con coma decimal', () => {
    expect(fmtGoal(3.2)).toBe('3,2')
    expect(fmtGoal(10)).toBe('10')
    expect(fmtGoal(null)).toBe('—')
  })
  it('diferencia contra el período anterior', () => {
    expect(fmtDelta(5, 2)).toBe('+3 vs. período anterior')
    expect(fmtDelta(1, 3)).toBe('−2 vs. período anterior')
    expect(fmtDelta(2, 2)).toBe('igual que el período anterior')
  })
  it('mes anterior y títulos de rango', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
    expect(previousMonth('2026-11')).toBe('2026-10')
    expect(rangeLabel('2026-11-01', '2026-11-15')).toBe('01/11–15/11/2026')
    expect(rangeLabel('2026-11-21', '2026-11-21')).toBe('21/11/2026')
  })
})

describe('«Por día»', () => {
  it('una columna por día hasta 62 días', () => {
    const cols = dayColumns('2026-10-01', '2026-11-30')
    expect(cols).toHaveLength(61)
    expect(cols[0]).toMatchObject({ key: '2026-10-01', label: '1' })
  })
  it('con más de 62 días, una columna por mes', () => {
    const cols = dayColumns('2026-08-15', '2026-11-21')
    expect(cols.map((c) => c.key)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
    expect(cols[0]?.days).toHaveLength(17)
  })
  it('suma llegados y compras de la columna', () => {
    const [aug] = dayColumns('2026-08-15', '2026-11-21')
    const byDay = { '2026-08-20': { arrived: 2, sold: 0 }, '2026-08-31': { arrived: 1, sold: 1 }, '2026-09-01': { arrived: 5, sold: 0 } }
    expect(aug && sumDays(byDay, aug)).toEqual({ arrived: 3, sold: 1 })
  })
})

describe('contactos', () => {
  const c = (id: number, over: Partial<Parameters<typeof filterContacts>[0][number]> = {}) => ({
    referrer_id: 1,
    stage: 'followup',
    sold_at: null,
    assigned_to: 'Ana',
    product: 'Moto',
    registered_by: 'Luis',
    arrived_at: `2026-11-0${id}T10:00:00Z`,
    days_waiting: null,
    id,
    ...over,
  })
  const list = [c(1), c(2, { stage: 'capture', days_waiting: 3 }), c(3, { stage: 'capture', days_waiting: 9 }), c(4, { stage: 'sale', sold_at: '2026-11-10T10:00:00Z', referrer_id: 2 })]
  it('sin contactar primero, del que más espera; después el más nuevo', () => {
    expect(filterContacts(list, {}).map((x) => x.id)).toEqual([3, 2, 4, 1])
  })
  it('etapa «compró» y por referidor', () => {
    expect(filterContacts(list, { stage: 'sold' }).map((x) => x.id)).toEqual([4])
    expect(filterContacts(list, { stage: 'capture', referrerId: 1 }).map((x) => x.id)).toEqual([3, 2])
  })
  it('compró manda sobre la etapa actual', () => {
    expect(contactStage({ stage: 'lost', sold_at: '2026-11-10T10:00:00Z' })).toBe('Compró')
    expect(contactStage({ stage: 'capture', sold_at: null })).toBe('Sin contactar')
  })
  it('quién registra: más referidas primero, los que no marcan abajo', () => {
    const rows = [
      { name: 'B', captures: 10, referred: 0 },
      { name: 'A', captures: 3, referred: 2 },
      { name: 'C', captures: 20, referred: 0 },
    ]
    expect(sortRegistrars(rows).map((r) => r.name)).toEqual(['A', 'C', 'B'])
  })
})

describe('filtro «Referido por» y lista de referidores', () => {
  it('Captaciones/Seguimientos: solo referidos o un referidor', () => {
    expect(referrerFilter({})).toBeUndefined()
    expect(referrerFilter({ origen: 'referidos' })).toBe('any')
    expect(referrerFilter({ origen: 'referidos', referidor: 7 })).toBe(7)
    expect(referrerFilter({ referidor: 7 })).toBeUndefined()
  })
  it('filtros de la lista de referidores', () => {
    const r = (over: Partial<Referrer>): Referrer => ({ id: 1, branch_id: 5, name: 'X', kind: 'staff', sort: 0, active: true, source: 'manager', merged_into: null, ...over })
    expect(inView(r({}), 'todos')).toBe(true)
    expect(inView(r({ merged_into: 2, active: false }), 'todos')).toBe(false)
    expect(inView(r({ merged_into: 2, active: false }), 'unidos')).toBe(true)
    expect(inView(r({ merged_into: 2, active: false }), 'desactivados')).toBe(false)
    expect(inView(r({ source: 'capture' }), 'registro')).toBe(true)
    expect(inView(r({ active: false }), 'desactivados')).toBe(true)
  })
})
