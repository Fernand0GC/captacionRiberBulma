import { laPazDate, shiftFor } from '@/lib/dates'
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
export function overlaps<T extends Slot>(candidate: Slot, others: T[]): T[] {
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

type Placed = Pick<Assignment, 'shift' | 'start_time' | 'end_time' | 'channel_id' | 'subchannel_id'>

/**
 * Asignación «igual» (spec 007, research R2): misma persona y día (lo da `overlaps`) y además mismo turno, horario,
 * canal y subcanal. Es la misma regla con la que la copia de días salta las que ya existen.
 */
export function sameSlot(a: Placed, b: Placed): boolean {
  return (
    a.shift === b.shift &&
    (a.start_time ?? '') === (b.start_time ?? '') &&
    (a.end_time ?? '') === (b.end_time ?? '') &&
    a.channel_id === b.channel_id &&
    (a.subchannel_id ?? null) === (b.subchannel_id ?? null)
  )
}

/** «Llamadas a clientes de pedidos (16:20–19:00)»: para encontrar la otra asignación del aviso de cruce (FR-008). */
export function clashLabel(o: Pick<Assignment, 'channel' | 'subchannel' | 'start_time' | 'end_time'>): string {
  return `${o.subchannel ?? o.channel} (${o.start_time ?? ''}–${o.end_time ?? ''})`
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

export type Totals = {
  goal: number
  result: number
  shareGoal: number
  shareResult: number
  count: number
  withResult: number
}

/**
 * Totales de las filas visibles, con captación y compartidas por separado (FR-008 de la 004). Sin resultado no suma
 * ni cuenta como 0. withResult = filas con algún resultado (captación o compartidas).
 */
export function totals(rows: Assignment[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({
      goal: t.goal + (r.goal ?? 0),
      result: t.result + (r.result ?? 0),
      shareGoal: t.shareGoal + (r.share_goal ?? 0),
      shareResult: t.shareResult + (r.share_result ?? 0),
      count: t.count + 1,
      withResult: t.withResult + (r.result === null && r.share_result === null ? 0 : 1),
    }),
    { goal: 0, result: 0, shareGoal: 0, shareResult: 0, count: 0, withResult: 0 },
  )
}

/** Cumplimiento en % (resultado ÷ meta), o null si falta alguno o la meta es 0 (FR-019). */
export function compliance(goal: number | null, result: number | null): number | null {
  if (goal === null || result === null || goal === 0) return null
  return Math.round((result / goal) * 100)
}

type Id = number | string | null | undefined
const same = (a: number, b: Id) => b !== null && b !== undefined && b !== '' && String(a) === String(b)

/** Metas que usa una asignación (spec 004, FR-002). */
export type GoalFlags = { goal: boolean; share: boolean }

/**
 * Marca efectiva de metas: la del subcanal si hay subcanal; si no, la del canal. Sin canal elegido se pide solo la
 * de captación (como antes de la 004). La base aplica la misma regla al guardar.
 */
export function goalFlags(cat: Pick<Catalog, 'channels' | 'subchannels'> | undefined, channelId: Id, subchannelId?: Id): GoalFlags {
  const sub = cat?.subchannels.find((x) => same(x.id, subchannelId))
  if (sub) return { goal: sub.uses_goal, share: sub.uses_share_goal }
  const c = cat?.channels.find((x) => same(x.id, channelId))
  return { goal: c?.uses_goal ?? true, share: c?.uses_share_goal ?? false }
}

/**
 * Qué campos opcionales pide el formulario según el catálogo. Sin estrategia elegida se muestra la ubicación
 * (no se esconde nada antes de saber); las metas siguen la marca efectiva (goalFlags).
 */
export function formFields(
  cat: Pick<Catalog, 'strategies' | 'channels' | 'subchannels'> | undefined,
  strategyId: string,
  channelId: string,
  subchannelId?: string,
): { place: boolean } & GoalFlags {
  const s = cat?.strategies.find((x) => String(x.id) === strategyId)
  return { place: s?.uses_place ?? true, ...goalFlags(cat, channelId, subchannelId) }
}

/**
 * Valida una meta escrita en el formulario. Vacía: falta (mensaje) o, si es opcional, null (spec 007: la de
 * compartidas). Devuelve el número, null o un mensaje de error.
 */
export function parseGoal(raw: string, label: string, optional = false): number | null | string {
  if (raw.trim() === '') return optional ? null : `Escribe la ${label}.`
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : `La ${label} tiene que ser un número entero entre 0 y 9999.`
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

/** El canal pide «Volanteras que van» (spec 006, FR-008). */
export function usesFlyers(cat: Pick<Catalog, 'channels'> | undefined, channelId: Id): boolean {
  return cat?.channels.find((x) => same(x.id, channelId))?.uses_flyers ?? false
}

type PersonRow = Pick<Assignment, 'work_date' | 'branch_id' | 'profile_id'>

/** Grupo de filas de una misma persona en un día y sucursal (spec 006, FR-003). */
export type PersonGroup<T extends PersonRow> = { key: string; rows: T[] }

/**
 * Agrupa por persona respetando el orden de llegada (la base ya ordena por fecha, sucursal, persona y hora). Si una
 * persona aparece separada (p. ej. tras filtrar), sus filas se juntan en el primer grupo donde apareció.
 */
export function groupByPerson<T extends PersonRow>(rows: T[]): PersonGroup<T>[] {
  const groups = new Map<string, PersonGroup<T>>()
  for (const r of rows) {
    const key = `${r.work_date}|${r.branch_id}|${r.profile_id}`
    const g = groups.get(key)
    if (g) g.rows.push(r)
    else groups.set(key, { key, rows: [r] })
  }
  return [...groups.values()]
}

/** Personas de una sucursal, con sus filas; una fila junta los subcanales de una misma carga (spec 007, FR-015). */
export type PersonBlock<T> = { key: string; person: string; work_date: string; count: number; lines: T[][] }
export type BranchBlock<T> = { key: string; branch_id: number; branch: string; lead: string | null; people: PersonBlock<T>[] }

type CompactRow = PersonRow & Pick<Assignment, 'branch' | 'person' | 'lead' | 'batch_id' | 'shift' | 'start_time' | 'end_time'>

/**
 * Tabla compacta (spec 007, research R8): sucursal → persona → filas. Las asignaciones de una misma carga con igual
 * turno y horario van en una sola fila; si a una se le cambió la hora después, queda en su propia fila. Respeta el
 * orden de llegada (la base ordena por fecha, sucursal, persona y hora).
 */
export function groupRows<T extends CompactRow & { id: string }>(rows: T[]): BranchBlock<T>[] {
  const branches = new Map<number, BranchBlock<T>>()
  for (const g of groupByPerson(rows)) {
    const first = g.rows[0]!
    let b = branches.get(first.branch_id)
    if (!b) {
      b = { key: String(first.branch_id), branch_id: first.branch_id, branch: first.branch, lead: null, people: [] }
      branches.set(first.branch_id, b)
    }
    b.lead ??= g.rows.find((r) => r.lead)?.lead ?? null
    const lines = new Map<string, T[]>()
    for (const r of g.rows) {
      const k = r.batch_id ? `${r.batch_id}|${r.shift}|${r.start_time ?? ''}|${r.end_time ?? ''}` : r.id
      const line = lines.get(k)
      if (line) line.push(r)
      else lines.set(k, [r])
    }
    b.people.push({ key: g.key, person: first.person, work_date: first.work_date, count: g.rows.length, lines: [...lines.values()] })
  }
  return [...branches.values()]
}

/**
 * Filtro Turno al abrir (spec 007, FR-010): el día de hoy, desde las 13:00 de La Paz y si hay asignaciones de la
 * tarde, «Tarde»; en otro caso, sin filtro.
 */
export function defaultShiftFilter(from: string, to: string, now: Date, rows: Pick<Assignment, 'shift'>[]): Shift | undefined {
  const today = laPazDate(now)
  return from === today && to === today && shiftFor(now) === 'afternoon' && rows.some((r) => r.shift === 'afternoon')
    ? 'afternoon'
    : undefined
}

/** «Capt 10 · Comp 30», o null si no tiene metas (spec 007, FR-014). */
export function goalsText(r: Pick<Assignment, 'goal' | 'share_goal'>): string | null {
  const parts = [r.goal !== null && `Capt ${r.goal}`, r.share_goal !== null && `Comp ${r.share_goal}`].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** «15 · verificadas 12» o null si no hay verificación (spec 006, FR-014). */
export function verifiedText(r: Pick<Assignment, 'share_verified'>): string | null {
  return r.share_verified === null ? null : `verificadas ${r.share_verified}`
}
