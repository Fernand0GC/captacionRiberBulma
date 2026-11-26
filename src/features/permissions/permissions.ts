import type { Permission } from '@/features/auth/types'

// Lógica pura de la pantalla «Permisos» (spec 029): sin React ni Supabase.

/** Una encargada tal como la devuelve permissions_list. */
export type PermissionRow = {
  id: string
  full_name: string
  username: string
  branch_id: number
  branch_name: string
  permissions: Permission[]
}

/** Orden de las columnas en pantalla y sus textos. */
export const PERMISSION_INFO: { key: Permission; label: string; help: string }[] = [
  {
    key: 'replan_past',
    label: 'Planificar días pasados',
    help: 'Editar y quitar asignaciones de días anteriores a hoy en su sucursal.',
  },
  {
    key: 'referrals',
    label: 'Referidos',
    help: 'Reporte, carga y seguimiento de referidos de su sucursal.',
  },
]

// Mismo orden que permissions_list (alfabético): lo marcado al instante coincide con lo que vuelve del servidor.
const ORDER = PERMISSION_INFO.map((p) => p.key).sort()

/** Lista nueva con el permiso marcado o desmarcado para esa persona. No toca la original (para volver si falla). */
export function withPermission(rows: PermissionRow[], id: string, permission: Permission, on: boolean): PermissionRow[] {
  return rows.map((r) => {
    if (r.id !== id) return r
    const set = new Set(r.permissions)
    if (on) set.add(permission)
    else set.delete(permission)
    return { ...r, permissions: ORDER.filter((k) => set.has(k)) }
  })
}

/** Deshace solo la casilla que falló, conservando los demás cambios de la lista actual. */
export function undoOne(rows: PermissionRow[], v: { id: string; permission: Permission; on: boolean }): PermissionRow[] {
  return withPermission(rows, v.id, v.permission, !v.on)
}
