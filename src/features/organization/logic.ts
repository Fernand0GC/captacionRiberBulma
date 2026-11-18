import type { Assignment, Catalog, Shift, Subchannel } from './api'

// Lógica pura de la organización: sin React ni red, para probarla con Vitest.

/** Horario sugerido del subcanal para el turno, o null si no tiene (FR-011). */
export function suggestedTimes(sub: Subchannel | undefined, shift: Shift): { start: string; end: string } | null {
  if (!sub) return null
  const start = shift === 'morning' ? sub.morning_start : sub.afternoon_start
  const end = shift === 'morning' ? sub.morning_end : sub.afternoon_end
  return start && end ? { start: start.slice(0, 5), end: end.slice(0, 5) } : null
}

type Slot = Pick<Assignment, 'id' | 'profile_id' | 'work_date' | 'start_time' | 'end_time'>

/**
 * Otras asignaciones de la misma persona ese día con horario que se cruza (FR-015). Sin horario completo no se
 * puede saber si se cruzan, así que no cuentan. Que una termine justo cuando empieza la otra no es cruce.
 */
export function overlaps(candidate: Slot, others: Slot[]): Slot[] {
  const { start_time: s, end_time: e } = candidate
  if (!s || !e) return []
  return others.filter(
    (o) =>
      o.id !== candidate.id &&
      o.profile_id === candidate.profile_id &&
      o.work_date === candidate.work_date &&
      !!o.start_time &&
      !!o.end_time &&
      o.start_time < e &&
      s < o.end_time,
  )
}

/** Columnas por las que se filtra (FR-022). La fecha se filtra con el rango. */
export type FilterKey = 'lead' | 'branch' | 'shift' | 'person' | 'strategy' | 'channel' | 'subchannel'
export type Filters = Partial<Record<FilterKey, string>>

/** Valor de la fila para un filtro; vacío se muestra como «(sin dato)». */
export const NONE = '(sin dato)'
export function valueOf(r: Assignment, k: FilterKey): string {
  const v = r[k]
  return v === null || v === '' ? NONE : String(v)
}

export function applyFilters(rows: Assignment[], f: Filters): Assignment[] {
  const active = (Object.entries(f) as [FilterKey, string | undefined][]).filter(([, v]) => !!v)
  return active.length ? rows.filter((r) => active.every(([k, v]) => valueOf(r, k) === v)) : rows
}

/** Valores presentes en las filas para cada filtro, ordenados. */
export function filterOptions(rows: Assignment[], k: FilterKey): string[] {
  return [...new Set(rows.map((r) => valueOf(r, k)))].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Totales de las filas visibles (FR-023). Sin resultado no suma ni cuenta como 0. */
export function totals(rows: Assignment[]): { goal: number; result: number; count: number; withResult: number } {
  return rows.reduce(
    (t, r) => ({
      goal: t.goal + (r.goal ?? 0),
      result: t.result + (r.result ?? 0),
      count: t.count + 1,
      withResult: t.withResult + (r.result === null ? 0 : 1),
    }),
    { goal: 0, result: 0, count: 0, withResult: 0 },
  )
}

/** Cumplimiento en % (resultado ÷ meta), o null si falta alguno o la meta es 0 (FR-019). */
export function compliance(goal: number | null, result: number | null): number | null {
  if (goal === null || result === null || goal === 0) return null
  return Math.round((result / goal) * 100)
}

/**
 * Qué campos opcionales pide el formulario según el catálogo. Sin estrategia o canal elegidos se muestran
 * (no se esconde nada antes de saber). La base aplica la misma regla al guardar.
 */
export function formFields(
  cat: Pick<Catalog, 'strategies' | 'channels'> | undefined,
  strategyId: string,
  channelId: string,
): { place: boolean; goal: boolean } {
  const s = cat?.strategies.find((x) => String(x.id) === strategyId)
  const c = cat?.channels.find((x) => String(x.id) === channelId)
  return { place: s?.uses_place ?? true, goal: c?.uses_goal ?? true }
}

/** Días entre dos fechas ISO (inclusive el primero: mismo día = 0). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
