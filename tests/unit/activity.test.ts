import { describe, expect, it } from 'vitest'
import { activityTotals, branchTotals, parseActivitySort, perStaff, sortActivity, sortBranches, sortParam } from '@/features/monitoring/activity'
import type { AgentActivityRow, BranchActivityRow } from '@/features/monitoring/api'

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
  assigned: 0,
  assigned_contacted: 0,
  total: 0,
  first_contacts: 0,
  recontacts: 0,
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

const branch = (name: string, n: Partial<BranchActivityRow> = {}): BranchActivityRow => ({
  branch_id: name.length,
  name,
  staff: 0,
  actors: 0,
  calls: 0,
  messages: 0,
  store: 0,
  effective: 0,
  no_answer: 0,
  visits: 0,
  sales: 0,
  clients: 0,
  assigned: 0,
  assigned_contacted: 0,
  total: 0,
  first_contacts: 0,
  recontacts: 0,
  ...n,
})

describe('resumen por sucursal', () => {
  const branches = [
    branch('TRINIDAD', { staff: 6, actors: 3, total: 12, clients: 9, effective: 5 }),
    branch('COBIJA', { staff: 2, actors: 1, total: 4, clients: 4 }),
    branch('REYES', { staff: 0, total: 0 }),
  ]

  it('branchTotals suma métricas, personal y quienes contactaron', () => {
    const t = branchTotals(branches)
    expect(t).toMatchObject({ total: 16, clients: 13, effective: 5, staff: 8, actors: 4 })
  })

  it('perStaff divide por el personal activo y da null sin personal', () => {
    expect(perStaff(12, 6)).toBe(2)
    expect(perStaff(5, 0)).toBeNull()
  })

  it('sortBranches usa el mismo orden que la tabla por persona', () => {
    expect(sortBranches(branches, { key: 'total', desc: true }).map((b) => b.name)).toEqual(['TRINIDAD', 'COBIJA', 'REYES'])
    expect(sortBranches(branches, { key: 'full_name', desc: false }).map((b) => b.name)).toEqual(['COBIJA', 'REYES', 'TRINIDAD'])
    expect(branches[0]?.name).toBe('TRINIDAD') // no muta
  })
})

// Spec 023: primer contacto y recontacto, con fila Total y orden como las demás columnas.
describe('primer contacto / recontacto', () => {
  const r = [row('Maico', { total: 5, first_contacts: 1, recontacts: 4 }), row('Ana', { total: 2, first_contacts: 2 })]
  it('la fila Total suma las dos columnas', () => {
    const t = activityTotals(r)
    expect([t.first_contacts, t.recontacts, t.total]).toEqual([3, 4, 7])
  })
  it('se puede ordenar por recontactos', () => {
    expect(sortActivity(r, parseActivitySort('recontacts')).map((x) => x.full_name)).toEqual(['Maico', 'Ana'])
    expect(sortParam(parseActivitySort('-recontacts'))).toBe('-recontacts')
  })
})
