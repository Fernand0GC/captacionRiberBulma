import { laPazDate } from '@/lib/dates'
import type { FollowupRow } from './api'
import { DUE_ORDER, dueStatus, type DueStatus } from './dueStatus'

/** Spec 022: filas por página que se pueden elegir; 25 de entrada (la auxiliar trabaja desde el celular). */
export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25

export type Page<T> = { rows: T[]; page: number; pages: number; from: number; to: number; total: number }

/** Una página (base 0). Si la lista se achicó, se queda en la última página que existe. */
export function pageOf<T>(list: T[], wanted: number, size: number): Page<T> {
  const pages = Math.max(1, Math.ceil(list.length / size))
  const page = Math.min(Math.max(0, wanted), pages - 1)
  const start = page * size
  const rows = list.slice(start, start + size)
  return { rows, page, pages, from: rows.length ? start + 1 : 0, to: start + rows.length, total: list.length }
}

/** Números del paginador: primera, última y vecinas de la actual; «gap» donde faltan dos o más (si falta una, se muestra). */
export function pageWindow(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i)
  const keep = [...new Set([0, page - 1, page, page + 1, pages - 1])].filter((n) => n >= 0 && n < pages).sort((x, y) => x - y)
  const out: (number | 'gap')[] = []
  keep.forEach((n, i) => {
    const prev = keep[i - 1]
    if (prev !== undefined && n - prev === 2) out.push(prev + 1)
    else if (prev !== undefined && n - prev > 2) out.push('gap')
    out.push(n)
  })
  return out
}

/** Al cambiar el tamaño, la página nueva que contiene la primera fila que se estaba viendo. */
export const keepPlace = (from: number, size: number) => (from > 0 ? Math.floor((from - 1) / size) : 0)

/** Tamaño guardado en el navegador; cualquier otra cosa (o nada) → 25. */
export function parsePageSize(raw: string | null): number {
  const n = Number(raw)
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE
}

/** Tarjetas del resumen. Grupos disjuntos: lo de «más adelante» (normal) no entra en ninguna. */
export type SummaryCard = 'today' | 'late' | 'done'

export function cardOf(s: DueStatus): SummaryCard | null {
  if (s.kind === 'late') return 'late'
  if (s.kind === 'done') return 'done'
  return s.kind === 'now' || s.kind === 'soon' ? 'today' : null
}

export function summarize(rows: FollowupRow[], now: Date): Record<SummaryCard, number> {
  const out: Record<SummaryCard, number> = { today: 0, late: 0, done: 0 }
  for (const r of rows) {
    const c = cardOf(dueStatus(r, now))
    if (c) out[c] += 1
  }
  return out
}

/** Contador de pestaña: el total y aparte el ⚠; si todos piden atención, ⚠ sin número (no «290 ⚠290»). */
export function tabCount(total: number, due: number): { total: number; due: number | 'all' | null } {
  return { total, due: due === 0 ? null : due === total ? 'all' : due }
}

const INTEREST_RANK = { high: 0, medium: 1, low: 2 } as const
export const interestRank = (r: FollowupRow) => (r.interest ? INTEREST_RANK[r.interest] : 3)

/** Cuándo se le asignó (o se captó, si la base no manda la fecha de asignación). */
export const assignedAt = (r: FollowupRow) => r.assigned_at ?? r.client_created_at

/** Reasignado desde otra persona y nunca contactado: ya esperaba. Primero, y entre ellos el que espera hace más. */
export const waitedBefore = (r: FollowupRow): r is FollowupRow & { waiting_since: string } =>
  !!r.reassigned_from_name && !!r.waiting_since
const waitRank = (r: FollowupRow) => (waitedBefore(r) ? Date.parse(r.waiting_since) : Number.MAX_SAFE_INTEGER)

const WEEKDAY =['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** «Hoy», «Ayer» o «Sáb 21» para un día YYYY-MM-DD. */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Hoy'
  const d = new Date(`${day}T12:00:00Z`)
  if (Date.parse(`${today}T12:00:00Z`) - d.getTime() === 86_400_000) return 'Ayer'
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()}`
}

export type DayGroup = { day: string; label: string; late: boolean; rows: FollowupRow[] }

/**
 * Captados agrupados por día de asignación (La Paz): hoy primero y después del más reciente al más viejo.
 * Dentro del día: estado, interés y lo asignado más recientemente arriba.
 */
export function groupByAssignedDay(rows: FollowupRow[], now: Date): DayGroup[] {
  const today = laPazDate(now)
  const byDay = new Map<string, FollowupRow[]>()
  for (const r of rows) {
    const day = laPazDate(new Date(assignedAt(r)))
    byDay.set(day, [...(byDay.get(day) ?? []), r])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, list]) => ({
      day,
      label: dayLabel(day, today),
      late: day < today,
      rows: list.sort(
        (a, b) =>
          DUE_ORDER[dueStatus(a, now).kind] - DUE_ORDER[dueStatus(b, now).kind] ||
          waitRank(a) - waitRank(b) ||
          interestRank(a) - interestRank(b) ||
          Date.parse(assignedAt(b)) - Date.parse(assignedAt(a)),
      ),
    }))
}

/** Recaptados: estado, interés y lo agendado (o asignado) antes primero. Sin cambios salvo la fecha de asignación. */
export function sortRecaptured(rows: FollowupRow[], now: Date): FollowupRow[] {
  return rows
    .slice()
    .sort(
      (a, b) =>
        DUE_ORDER[dueStatus(a, now).kind] - DUE_ORDER[dueStatus(b, now).kind] ||
        interestRank(a) - interestRank(b) ||
        (a.next_contact_at ?? assignedAt(a)).localeCompare(b.next_contact_at ?? assignedAt(b)),
    )
}
