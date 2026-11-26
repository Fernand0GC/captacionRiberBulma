import { describe, expect, it } from 'vitest'
import { permissionsFrom } from '@/features/auth/access'
import { undoOne, type PermissionRow } from '@/features/permissions/permissions'

// Spec 029 · Correcciones de QA (criterios 19 y 24). Escrito por QA antes de la corrección: debe quedar en verde
// sin modificar este archivo.

describe('permissionsFrom (criterio 19: el perfil carga aunque fallen los permisos)', () => {
  it('con datos: la lista de permisos', () => {
    expect(permissionsFrom({ data: [{ permission: 'referrals' }, { permission: 'replan_past' }], error: null })).toEqual([
      'referrals',
      'replan_past',
    ])
  })
  it('si la consulta falla (tabla aún sin crear): vacía, sin lanzar', () => {
    expect(permissionsFrom({ data: null, error: { code: 'PGRST205', message: 'relation does not exist' } })).toEqual([])
  })
  it('sin datos: vacía', () => {
    expect(permissionsFrom({ data: null, error: null })).toEqual([])
  })
  it('ignora valores desconocidos (un permiso nuevo en la base que esta app no conoce)', () => {
    expect(permissionsFrom({ data: [{ permission: 'ver_todo' }, { permission: 'referrals' }], error: null })).toEqual([
      'referrals',
    ])
  })
})

describe('undoOne (criterio 24: si falla, solo esa casilla vuelve)', () => {
  const rows: PermissionRow[] = [
    { id: 'a', full_name: 'Ana', username: 'enc.a', branch_id: 5, branch_name: 'Verdolago', permissions: ['referrals'] },
    { id: 'b', full_name: 'Bea', username: 'enc.b', branch_id: 7, branch_name: 'Trinidad', permissions: ['replan_past'] },
  ]
  it('deshace solo la casilla que falló y conserva otro cambio que sí se guardó', () => {
    // Pantalla actual: se marcó «referrals» a Ana (falló) y luego «replan_past» a Bea (se guardó).
    const next = undoOne(rows, { id: 'a', permission: 'referrals', on: true })
    expect(next.find((r) => r.id === 'a')?.permissions).toEqual([])
    expect(next.find((r) => r.id === 'b')?.permissions).toEqual(['replan_past'])
  })
  it('si falló un «quitar», la casilla vuelve a quedar marcada', () => {
    const next = undoOne(rows, { id: 'b', permission: 'replan_past', on: false })
    expect(next.find((r) => r.id === 'b')?.permissions).toEqual(['replan_past'])
  })
})
