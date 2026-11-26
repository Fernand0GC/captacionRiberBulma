import { describe, expect, it } from 'vitest'
import { PERMISSION_INFO, withPermission, type PermissionRow } from '@/features/permissions/permissions'

// Spec 029 · La casilla cambia la fila al instante y, si el servidor falla, se vuelve a la lista anterior (criterio 17).
const rows: PermissionRow[] = [
  { id: 'a', full_name: 'Ana', username: 'enc.a', branch_id: 5, branch_name: 'Verdolago', permissions: [] },
  { id: 'b', full_name: 'Bea', username: 'enc.b', branch_id: 7, branch_name: 'Trinidad', permissions: ['referrals'] },
]

describe('withPermission', () => {
  it('marcar agrega el permiso solo a esa persona', () => {
    const next = withPermission(rows, 'a', 'replan_past', true)
    expect(next.find((r) => r.id === 'a')?.permissions).toEqual(['replan_past'])
    expect(next.find((r) => r.id === 'b')?.permissions).toEqual(['referrals'])
  })
  it('desmarcar lo quita', () => {
    expect(withPermission(rows, 'b', 'referrals', false).find((r) => r.id === 'b')?.permissions).toEqual([])
  })
  it('marcar dos veces no duplica (criterio 4)', () => {
    expect(withPermission(rows, 'b', 'referrals', true).find((r) => r.id === 'b')?.permissions).toEqual(['referrals'])
  })
  it('no cambia la lista original: se puede volver a ella si falla', () => {
    withPermission(rows, 'a', 'referrals', true)
    expect(rows[0]?.permissions).toEqual([])
  })
  it('deja los permisos en orden fijo', () => {
    const next = withPermission(withPermission(rows, 'a', 'replan_past', true), 'a', 'referrals', true)
    expect(next[0]?.permissions).toEqual(['referrals', 'replan_past'])
  })
})

describe('PERMISSION_INFO', () => {
  it('cada permiso tiene nombre y explicación en español', () => {
    expect(PERMISSION_INFO.map((p) => p.key)).toEqual(['replan_past', 'referrals'])
    for (const p of PERMISSION_INFO) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.help.length).toBeGreaterThan(0)
    }
  })
})
