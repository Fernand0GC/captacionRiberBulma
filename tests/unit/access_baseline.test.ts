import { describe, expect, it } from 'vitest'
import { MANAGER_ROLES, ORG_MANAGE_ROLES, REFERRAL_ROLES, type AppRole } from '@/features/auth/types'

// Spec 029 · Caracterización: qué secciones ve hoy cada rol en el menú (AppShell) y en las rutas (RequireRole).
// Sin permisos otorgados, esto debe seguir igual después (criterios 12, 16 y 18).
const ALL: AppRole[] = [
  'field_volunteer',
  'field_assistant',
  'field_supervisor',
  'branch_manager',
  'sales_lead',
  'general_manager',
  'admin',
  'collections',
]
const who = (list: AppRole[]) => ALL.filter((r) => list.includes(r))

describe('acceso por rol antes de la spec 029', () => {
  it('Referidos: solo jefe de ventas, gerente y Sistemas', () => {
    expect(who(REFERRAL_ROLES)).toEqual(['sales_lead', 'general_manager', 'admin'])
  })

  it('el encargado no ve Referidos', () => {
    expect(REFERRAL_ROLES).not.toContain('branch_manager')
  })

  it('gestión (Panel, Repartir, Planificación, Metas, Mi equipo): encargado, jefe, gerente y Sistemas', () => {
    expect(who(MANAGER_ROLES)).toEqual(['branch_manager', 'sales_lead', 'general_manager', 'admin'])
  })

  it('organización: además el supervisor', () => {
    expect(who(ORG_MANAGE_ROLES)).toEqual(['field_supervisor', 'branch_manager', 'sales_lead', 'general_manager', 'admin'])
  })
})
