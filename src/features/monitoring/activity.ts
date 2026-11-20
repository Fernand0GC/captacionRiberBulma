import type { AgentActivityRow, BranchActivityRow } from './api'
import type { ActivityMetric } from './labels'

// Cálculos puros de la vista Actividad (probados en tests/unit/activity.test.ts).

export type ActivityTotals = Record<ActivityMetric, number>

const KEYS: ActivityMetric[] = ['calls', 'messages', 'store', 'effective', 'no_answer', 'visits', 'sales', 'clients', 'assigned', 'total']

/** Fila Total: suma de cada columna (Clientes contactados suma por persona; un cliente tocado por dos cuenta dos veces). */
export function activityTotals(rows: Pick<AgentActivityRow, ActivityMetric>[]): ActivityTotals {
  const t = Object.fromEntries(KEYS.map((k) => [k, 0])) as ActivityTotals
  for (const r of rows) for (const k of KEYS) t[k] += r[k]
  return t
}

export type ActivitySortKey = ActivityMetric | 'full_name'
export type ActivitySort = { key: ActivitySortKey; desc: boolean }

const SORT_KEYS: ActivitySortKey[] = [...KEYS, 'full_name']

/** `orden` de la URL: "sales" (de mayor a menor), "-sales" (de menor a mayor), "full_name" (A→Z). Por defecto, total. */
export function parseActivitySort(orden: string | undefined): ActivitySort {
  const asc = orden?.startsWith('-') ?? false
  const key = (asc ? orden!.slice(1) : orden) as ActivitySortKey | undefined
  if (!key || !SORT_KEYS.includes(key)) return { key: 'total', desc: true }
  // El nombre va A→Z por defecto; los números, de mayor a menor.
  return { key, desc: key === 'full_name' ? asc : !asc }
}

export function sortParam(s: ActivitySort): string {
  const natural = s.key === 'full_name' ? !s.desc : s.desc
  return natural ? s.key : `-${s.key}`
}

/** Ordena sin mutar; desempate por nombre (A→Z) para que el orden sea estable. */
export function sortActivity(rows: AgentActivityRow[], s: ActivitySort): AgentActivityRow[] {
  const byName = (a: AgentActivityRow, b: AgentActivityRow) => a.full_name.localeCompare(b.full_name, 'es')
  return [...rows].sort((a, b) => {
    const c = s.key === 'full_name' ? byName(a, b) : a[s.key] - b[s.key]
    if (c !== 0) return s.desc ? -c : c
    return byName(a, b)
  })
}

// --- Resumen por sucursal (pestaña «Por sucursal») ---

export type BranchTotals = ActivityTotals & { staff: number; actors: number }

/**
 * Fila Total del resumen. Clientes sí se puede sumar acá: cada cliente es de una sola sucursal.
 * actors puede contar dos veces a quien contactó clientes de dos sucursales.
 */
export function branchTotals(rows: BranchActivityRow[]): BranchTotals {
  return { ...activityTotals(rows), staff: rows.reduce((a, r) => a + r.staff, 0), actors: rows.reduce((a, r) => a + r.actors, 0) }
}

/** Contactos por persona activa de la sucursal (null si no tiene personal). */
export const perStaff = (total: number, staff: number): number | null => (staff > 0 ? total / staff : null)

/** Mismo `orden` que la tabla por persona: "full_name" ordena por nombre de sucursal. */
export function sortBranches(rows: BranchActivityRow[], s: ActivitySort): BranchActivityRow[] {
  const byName = (a: BranchActivityRow, b: BranchActivityRow) => a.name.localeCompare(b.name, 'es')
  return [...rows].sort((a, b) => {
    const c = s.key === 'full_name' ? byName(a, b) : a[s.key] - b[s.key]
    if (c !== 0) return s.desc ? -c : c
    return byName(a, b)
  })
}
