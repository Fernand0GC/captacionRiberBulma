import { GLOBAL_ROLES, REFERRAL_ROLES, type AppRole, type Permission, type Profile } from './types'

// Reglas de acceso de la app (spec 029). Deciden qué se muestra; la barrera real es la base (constitución IV):
// has_permission, can_see_referrals, org_can_replan y permission_set dicen lo mismo en el servidor.

type Who = Pick<Profile, 'role' | 'permissions'>

/** Quienes otorgan y quitan permisos por persona. */
export const GRANT_ROLES: AppRole[] = ['admin', 'general_manager', 'sales_lead']

/** Un permiso solo vale para una encargada: si cambia de rol, lo guardado deja de valer (como en la base). */
export function hasPermission(p: Who, permission: Permission): boolean {
  return p.role === 'branch_manager' && (p.permissions ?? []).includes(permission)
}

/** Referidos: por el rol (jefe, gerencia, Sistemas) o por el permiso de la encargada. */
export function canSeeReferrals(p: Who): boolean {
  return REFERRAL_ROLES.includes(p.role) || hasPermission(p, 'referrals')
}

/** Pantalla «Permisos». Sistemas actuando como otra persona la conserva (criterio 8). */
export function canGrantPermissions(p: Who, acting: boolean): boolean {
  return acting || GRANT_ROLES.includes(p.role)
}

/** Sucursales que se le ofrecen: gerencia todas, el jefe las suyas, el resto solo la propia. */
export function branchOptions<B extends { id: number }>(
  p: Pick<Profile, 'role' | 'branch_id' | 'branch_ids'>,
  branches: B[] | undefined,
): B[] | undefined {
  if (!branches) return undefined
  if (GLOBAL_ROLES.includes(p.role)) return branches
  if (p.role === 'sales_lead') return branches.filter((b) => p.branch_ids?.includes(b.id))
  return branches.filter((b) => b.id === p.branch_id)
}

/** Si los permisos no están disponibles, el perfil carga sin permisos extra. */
export function permissionsFrom(r: { data: { permission: string }[] | null; error: unknown }): Permission[] {
  if (r.error || !r.data) return []
  return r.data.map((row) => row.permission).filter((p): p is Permission => p === 'replan_past' || p === 'referrals')
}
