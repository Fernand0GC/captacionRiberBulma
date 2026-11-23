import { matchesNameOrPhone } from '@/lib/search'
import type { AgentAssignedRow, ProspectStage } from './api'

// Cálculos puros de la pestaña «Asignados» del detalle de Actividad (spec 012; probados en tests/unit/assigned.test.ts).

/** Etapas de origen que se muestran («De dónde vienen»): las del filtro Etapa, sin «Sin interés». */
export const ORIGIN_STAGES: ProspectStage[] = ['capture', 'recapture', 'followup', 'interested', 'sale']

/** Grupo de «A qué proceso pasaron»: la etapa de hoy, «Sin cambio» (la contactó y sigue igual) o «Sin contactar». */
export type OutcomeGroup = 'sale' | 'interested' | 'followup' | 'recapture' | 'lost' | 'same' | 'none'

/** En orden de avance, como la barra de la pantalla. */
export const OUTCOME_GROUPS: { key: OutcomeGroup; label: string }[] = [
  { key: 'sale', label: 'Venta' },
  { key: 'interested', label: 'Cliente potencial' },
  { key: 'followup', label: 'Seguimiento' },
  { key: 'recapture', label: 'Recaptación (no contestó)' },
  { key: 'lost', label: 'Sin interés' },
  { key: 'same', label: 'Sin cambio' },
  { key: 'none', label: 'Sin contactar' },
]

export function outcomeOf(r: Pick<AgentAssignedRow, 'contacts' | 'stage_at' | 'stage_now'>): OutcomeGroup {
  if (r.contacts === 0) return 'none'
  // Venta de un cliente que ya venía en Venta, o Captación que sigue en Captación: no cambió.
  if (r.stage_now === r.stage_at || r.stage_now === 'capture') return 'same'
  return r.stage_now
}

export type AssignedSummary = {
  total: number
  contacted: number
  /** Porcentaje entero de contactados (0 sin asignados). */
  pct: number
  byOrigin: Record<ProspectStage, { n: number; contacted: number }>
  byOutcome: Record<OutcomeGroup, number>
  /** Contactados recién después del día en que se le asignaron. */
  contactedLater: number
}

const dayOf = (iso: string) => new Date(new Date(iso).getTime() - 4 * 3600_000).toISOString().slice(0, 10) // La Paz

export function summarizeAssigned(rows: AgentAssignedRow[]): AssignedSummary {
  const stages: ProspectStage[] = ['capture', 'recapture', 'followup', 'interested', 'sale', 'lost']
  const byOrigin = Object.fromEntries(stages.map((s) => [s, { n: 0, contacted: 0 }])) as AssignedSummary['byOrigin']
  const byOutcome = Object.fromEntries(OUTCOME_GROUPS.map((g) => [g.key, 0])) as AssignedSummary['byOutcome']
  let contacted = 0
  let contactedLater = 0
  for (const r of rows) {
    const o = byOrigin[r.stage_at]
    o.n++
    if (r.contacts > 0) {
      contacted++
      o.contacted++
      if (r.first_at && dayOf(r.first_at) > dayOf(r.assigned_at)) contactedLater++
    }
    byOutcome[outcomeOf(r)]++
  }
  return {
    total: rows.length,
    contacted,
    pct: rows.length ? Math.round((contacted * 100) / rows.length) : 0,
    byOrigin,
    byOutcome,
    contactedLater,
  }
}

export type AssignedFilter = {
  contact: 'all' | 'done' | 'none'
  origin: ProspectStage | null
  outcome: OutcomeGroup | null
  /** Spec 020: lupa por nombre o celular (solo en pantalla, nunca en la URL). */
  q?: string
  /** Spec 021: «Ver ocultos». Apagado, la lista, la lupa, los filtros y la selección ignoran los ocultos. */
  showHidden?: boolean
}

export const filterAssigned = (rows: AgentAssignedRow[], f: AssignedFilter): AgentAssignedRow[] =>
  rows.filter(
    (r) =>
      (f.showHidden || !r.hidden) &&
      (f.contact === 'all' || (f.contact === 'done' ? r.contacts > 0 : r.contacts === 0)) &&
      (f.origin === null || r.stage_at === f.origin) &&
      (f.outcome === null || outcomeOf(r) === f.outcome) &&
      matchesNameOrPhone(r, f.q ?? ''),
  )

/** Spec 020: los que se pueden reasignar desde el modal: sin contactar, todavía a cargo de la persona y (021) no ocultos. */
export const reassignable = (rows: AgentAssignedRow[]): AgentAssignedRow[] =>
  rows.filter((r) => r.contacts === 0 && !r.reassigned && !r.hidden)

/** Spec 020: la sucursal de todas las filas, o `undefined` si son de varias (o no hay): se asigna por sucursal. */
export function singleBranch(rows: AgentAssignedRow[]): number | undefined {
  const ids = new Set(rows.map((r) => r.branch_id))
  return ids.size === 1 ? [...ids][0] : undefined
}

// --- Spec 021: aviso «¿ocultar los ya contactados?» -----------------------------------------------------------------

/** Día de hoy en La Paz (AAAA-MM-DD), para recordar «Mantener» solo por hoy. */
export const laPazDay = (d: Date = new Date()): string => dayOf(d.toISOString())

/** Clave de `localStorage` de «Mantener»: por quien mira y por persona del modal (solo ids de personal). */
export const keepKey = (viewerId: string, agentId: string): string => `rb.assigned-keep.${viewerId}.${agentId}`

/** Se pregunta si hay contactados sin ocultar y hoy no eligió «Mantener» para esa persona. */
export const shouldAskHide = (contactedVisible: number, keptDay: string | null, today: string): boolean =>
  contactedVisible > 0 && keptDay !== today
