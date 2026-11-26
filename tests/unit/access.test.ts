import { describe, expect, it } from 'vitest'
import { branchOptions, canGrantPermissions, canSeeReferrals, hasPermission } from '@/features/auth/access'
import type { AppRole, Permission, Profile } from '@/features/auth/types'

// Spec 029 · Reglas de acceso de la app (la barrera real está en la base; esto decide qué se muestra).
const person = (role: AppRole, permissions: Permission[] = [], extra: Partial<Profile> = {}): Profile => ({
  id: 'p',
  username: 'u',
  full_name: 'Persona',
  role,
  branch_id: 5,
  contract_type: 'permanent',
  active: true,
  deactivated_at: null,
  permissions,
  ...extra,
})

describe('hasPermission', () => {
  it('la encargada con el permiso lo tiene', () => {
    expect(hasPermission(person('branch_manager', ['referrals']), 'referrals')).toBe(true)
  })
  it('sin el permiso, no', () => {
    expect(hasPermission(person('branch_manager', ['replan_past']), 'referrals')).toBe(false)
  })
  it('un perfil sin la lista (caché vieja) no tiene permisos', () => {
    expect(hasPermission(person('branch_manager', [], { permissions: undefined }), 'referrals')).toBe(false)
  })
  it('si ya no es encargada, el permiso guardado no vale (criterio 15)', () => {
    expect(hasPermission(person('field_assistant', ['referrals']), 'referrals')).toBe(false)
  })
})

describe('canSeeReferrals', () => {
  it('encargada sin permiso: no (criterio 12)', () => {
    expect(canSeeReferrals(person('branch_manager'))).toBe(false)
  })
  it('encargada con permiso: sí (criterio 13)', () => {
    expect(canSeeReferrals(person('branch_manager', ['referrals']))).toBe(true)
  })
  it('jefe, gerente y Sistemas: sí, sin permisos (criterio 18)', () => {
    for (const r of ['sales_lead', 'general_manager', 'admin'] as AppRole[]) expect(canSeeReferrals(person(r))).toBe(true)
  })
  it('supervisor, auxiliar, volantera y Cobros: no', () => {
    for (const r of ['field_supervisor', 'field_assistant', 'field_volunteer', 'collections'] as AppRole[]) {
      expect(canSeeReferrals(person(r))).toBe(false)
    }
  })
})

describe('canGrantPermissions', () => {
  it('Sistemas, gerente y jefe de ventas otorgan', () => {
    for (const r of ['admin', 'general_manager', 'sales_lead'] as AppRole[]) expect(canGrantPermissions(person(r), false)).toBe(true)
  })
  it('los demás no (criterio 6), aunque tengan permisos', () => {
    for (const r of ['branch_manager', 'field_supervisor', 'field_assistant', 'field_volunteer', 'collections'] as AppRole[]) {
      expect(canGrantPermissions(person(r, ['referrals', 'replan_past']), false)).toBe(false)
    }
  })
  it('Sistemas actuando como cualquiera: sí (criterio 8)', () => {
    expect(canGrantPermissions(person('field_assistant'), true)).toBe(true)
  })
})

describe('branchOptions', () => {
  const branches = [
    { id: 1, name: 'Uno' },
    { id: 5, name: 'Verdolago' },
    { id: 7, name: 'Trinidad' },
  ]
  it('gerencia: todas', () => {
    expect(branchOptions(person('general_manager', [], { branch_id: null }), branches)).toEqual(branches)
  })
  it('jefe: solo las suyas', () => {
    expect(branchOptions(person('sales_lead', [], { branch_id: null, branch_ids: [5, 7] }), branches)?.map((b) => b.id)).toEqual([5, 7])
  })
  it('encargada: solo la suya (Referidos no le ofrece otras, criterio 14)', () => {
    expect(branchOptions(person('branch_manager', ['referrals']), branches)?.map((b) => b.id)).toEqual([5])
  })
  it('sin sucursales cargadas: undefined', () => {
    expect(branchOptions(person('branch_manager'), undefined)).toBeUndefined()
  })
})
