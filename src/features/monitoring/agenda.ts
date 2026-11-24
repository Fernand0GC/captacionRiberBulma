import { dueStatus } from '@/features/followup/dueStatus'
import { cardOf } from '@/features/followup/inboxView'
import type { Assignable } from '@/features/prospects/AssignSelection'
import type { AgendaPerson, AgendaReport, AgendaRow } from './api'

// Agenda de recontacto (spec 023): lógica pura, sin React ni red (tests/unit/agenda.test.ts).
// La clasificación es la de «Mis contactos» (dueStatus + cardOf), así los números de la jefa y de la auxiliar coinciden.

/** pending = «Para hoy» de la auxiliar · done = «Contactados hoy» · late = «Atrasados». */
export type AgendaBucket = 'pending' | 'done' | 'late'

export type AgendaPersonView = AgendaPerson & {
  pending: AgendaRow[]
  done: AgendaRow[]
  late: AgendaRow[]
  /** Le tocaba hoy = pendientes + contactados hoy. */
  due: number
}

const BUCKET_OF_CARD = { today: 'pending', done: 'done', late: 'late' } as const

/** En qué columna cae un cliente; null si no cuenta (agendado más adelante). */
export function bucketOf(r: AgendaRow, now: Date): AgendaBucket | null {
  const card = cardOf(dueStatus(r, now))
  return card ? BUCKET_OF_CARD[card] : null
}

const missing = (p: AgendaPersonView) => p.pending.length + p.late.length

/** Una fila por persona (con ceros), ordenadas por lo que falta (pendientes + atrasados) y luego por nombre. */
export function agendaByPerson(report: Pick<AgendaReport, 'people' | 'rows'>, now: Date): AgendaPersonView[] {
  const byId = new Map<string, AgendaPersonView>()
  const ensure = (id: string, p?: AgendaPerson) => {
    let v = byId.get(id)
    if (!v) {
      v = { ...(p ?? { id, full_name: 'Sin nombre', role: 'field_assistant', branch_id: null }), pending: [], done: [], late: [], due: 0 }
      byId.set(id, v)
    }
    return v
  }
  for (const p of report.people) ensure(p.id, p)
  for (const r of report.rows) {
    const b = bucketOf(r, now)
    if (b) ensure(r.assigned_to)[b].push(r)
  }
  return [...byId.values()]
    .map((v) => ({ ...v, due: v.pending.length + v.done.length }))
    .sort((a, b) => missing(b) - missing(a) || a.full_name.localeCompare(b.full_name, 'es'))
}

export type AgendaTotals = { due: number; done: number; pending: number; late: number }

export function agendaTotals(people: AgendaPersonView[]): AgendaTotals {
  return people.reduce<AgendaTotals>(
    (t, p) => ({ due: t.due + p.due, done: t.done + p.done.length, pending: t.pending + p.pending.length, late: t.late + p.late.length }),
    { due: 0, done: 0, pending: 0, late: 0 },
  )
}

// --- Spec 025: reasignar los atrasados desde el detalle --------------------------------------------------------------

/** Los atrasados de la persona, listos para useAssignSelection (el dueño actual es ella: se avisa a quién se le quitan). */
export function lateAssignable(p: AgendaPersonView): Assignable[] {
  return p.late.map((r) => ({ id: r.id, assigned_to: p.id, assigned_to_name: p.full_name }))
}

/**
 * Sucursal para elegir a quién reasignar: la de sus atrasados si es una sola; si son de varias, ninguna (la barra pide
 * elegir sucursal en «Del día»). Sin atrasados, la de la persona.
 */
export function lateBranch(p: AgendaPersonView): number | undefined {
  if (p.late.length === 0) return p.branch_id ?? undefined
  const ids = new Set(p.late.map((r) => r.branch_id))
  return ids.size === 1 ? [...ids][0] : undefined
}
