import { useBranches } from '@/features/prospects/api'
import { branchOptions } from './access'
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
  // Encargada: solo la suya (spec 029: con Referidos ya no ve un selector con sucursales que no puede abrir).
  const options = profile ? branchOptions(profile, branches.data) : branches.data
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
