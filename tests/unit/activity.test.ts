import { describe, expect, it } from 'vitest'
import { activityTotals, parseActivitySort, sortActivity, sortParam } from '@/features/monitoring/activity'
import type { AgentActivityRow } from '@/features/monitoring/api'

const row = (full_name: string, n: Partial<AgentActivityRow> = {}): AgentActivityRow => ({
  actor_id: full_name,
  full_name,
  role: 'field_assistant',
  active: true,
  calls: 0,
  messages: 0,
  store: 0,
  effective: 0,
  no_answer: 0,
  visits: 0,
  sales: 0,
  clients: 0,
  total: 0,
  ...n,
})

const rows = [
  row('Luis', { calls: 3, sales: 0, total: 3, clients: 2 }),
  row('Ana', { calls: 1, messages: 2, sales: 2, total: 3, clients: 3 }),
  row('Beto', { total: 0 }),
]

describe('activityTotals', () => {
  it('suma cada columna', () => {
    const t = activityTotals(rows)
    expect(t.calls).toBe(4)
    expect(t.messages).toBe(2)
    expect(t.sales).toBe(2)
    expect(t.total).toBe(6)
    expect(t.clients).toBe(5)
  })
  it('sin filas: todo en cero', () => expect(activityTotals([]).total).toBe(0))
})

describe('orden de Actividad', () => {
  it('por defecto: total de mayor a menor, empate por nombre', () => {
    expect(sortActivity(rows, parseActivitySort(undefined)).map((r) => r.full_name)).toEqual(['Ana', 'Luis', 'Beto'])
  })
  it('una columna numérica: de mayor a menor; con "-", al revés', () => {
    expect(sortActivity(rows, parseActivitySort('sales')).map((r) => r.full_name)).toEqual(['Ana', 'Beto', 'Luis'])
    expect(sortActivity(rows, parseActivitySort('-calls')).map((r) => r.full_name)).toEqual(['Beto', 'Ana', 'Luis'])
  })
  it('por nombre: A→Z; con "-", Z→A', () => {
    expect(sortActivity(rows, parseActivitySort('full_name')).map((r) => r.full_name)).toEqual(['Ana', 'Beto', 'Luis'])
    expect(sortActivity(rows, parseActivitySort('-full_name')).map((r) => r.full_name)).toEqual(['Luis', 'Beto', 'Ana'])
  })
  it('columna desconocida: vuelve al total', () => expect(parseActivitySort('xx')).toEqual({ key: 'total', desc: true }))
  it('sortParam es el inverso de parseActivitySort', () => {
    for (const p of ['sales', '-sales', 'full_name', '-full_name']) expect(sortParam(parseActivitySort(p))).toBe(p)
  })
  it('no muta el arreglo', () => {
    const copy = [...rows]
    sortActivity(rows, parseActivitySort('sales'))
    expect(rows).toEqual(copy)
  })
})
