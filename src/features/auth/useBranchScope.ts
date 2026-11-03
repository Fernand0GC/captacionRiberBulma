import { useBranches } from '@/features/prospects/api'
import { useAuth } from './AuthProvider'
import { GLOBAL_ROLES } from './types'

/**
 * Qué sucursales puede elegir quien gestiona.
 * - Gerencia/Sistemas: todas, y "todas a la vez" (sin elegir).
 * - Jefe de ventas: solo las suyas, siempre una (sin elegir = la primera).
 * - Encargado: la suya, sin selector.
 */
export function useBranchScope() {
  const { profile } = useAuth()
  const branches = useBranches()
  const global = !!profile && GLOBAL_ROLES.includes(profile.role)
  const multi = profile?.role === 'sales_lead'
  const options = multi ? branches.data?.filter((b) => profile.branch_ids?.includes(b.id)) : branches.data
  return {
    /** Muestra el selector de sucursal. */
    canPick: global || multi,
    /** Puede ver todas a la vez (opción "Todas las sucursales"). */
    allowAll: global,
    options,
    /** Sucursal que se usa si no eligió ninguna (jefe: la primera de las suyas). */
    fallback: multi ? options?.[0]?.id : undefined,
    branches,
  }
}
