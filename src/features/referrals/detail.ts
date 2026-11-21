import { OUTCOME_GROUPS, type OutcomeGroup } from '@/features/monitoring/assigned'
import type { RangeContact } from './api'

// Ventana de detalle de un referidor (spec 016, US3): los mismos grupos de «A qué proceso pasaron» que
// «Asignados del día» (spec 012). Un referido siempre entra en Captación, así que el origen no se muestra.
// Probado en tests/unit/referral_detail.test.ts.

export { OUTCOME_GROUPS }

/** Contactos registrados; con la base anterior a la 016 se deduce del último contacto. */
export const contactsOf = (c: RangeContact) => c.contacts ?? (c.last_contact_at ? 1 : 0)

/** Grupo del referido hoy: Sin contactar, Sin cambio (contactado y sigue en Captación) o su etapa. */
export function referralOutcome(c: RangeContact): OutcomeGroup {
  if (contactsOf(c) === 0) return 'none'
  if (c.stage === 'capture') return 'same'
  return c.stage
}

/** «Quién los atiende»: null = sin responsable. */
export type AssigneeGroup = { name: string | null; n: number; contacted: number }

export type ReferralSummary = {
  total: number
  contacted: number
  pct: number
  pending: number
  /** Días que espera el referido sin contactar más antiguo (null si no hay). */
  maxWait: number | null
  sold: number
  soldPct: number
  byAssignee: AssigneeGroup[]
  byOutcome: Record<OutcomeGroup, number>
}

const pct = (n: number, total: number) => (total ? Math.round((n * 100) / total) : 0)

export function summarizeReferrals(list: RangeContact[]): ReferralSummary {
  const byOutcome = Object.fromEntries(OUTCOME_GROUPS.map((g) => [g.key, 0])) as Record<OutcomeGroup, number>
  const groups = new Map<string | null, AssigneeGroup>()
  let contacted = 0
  let sold = 0
  let maxWait: number | null = null
  for (const c of list) {
    const done = contactsOf(c) > 0
    if (done) contacted++
    else if (c.days_waiting !== null && (maxWait === null || c.days_waiting > maxWait)) maxWait = c.days_waiting
    if (c.sold_at || c.stage === 'sale') sold++
    byOutcome[referralOutcome(c)]++
    const g = groups.get(c.assigned_to) ?? { name: c.assigned_to, n: 0, contacted: 0 }
    g.n++
    if (done) g.contacted++
    groups.set(c.assigned_to, g)
  }
  const byAssignee = [...groups.values()].sort(
    (a, b) => b.n - a.n || (a.name === null ? 1 : b.name === null ? -1 : a.name.localeCompare(b.name, 'es')),
  )
  return {
    total: list.length,
    contacted,
    pct: pct(contacted, list.length),
    pending: list.length - contacted,
    maxWait,
    sold,
    soldPct: pct(sold, list.length),
    byAssignee,
    byOutcome,
  }
}

/** `assignee`: undefined = todos; null = «Sin asignar»; texto = ese responsable. */
export type ReferralFilter = { contact: 'all' | 'done' | 'none'; assignee?: string | null; outcome: OutcomeGroup | null }

/** Filtra y ordena: primero los sin contactar (el que más espera arriba), luego del más reciente al más antiguo. */
export function filterReferrals(list: RangeContact[], f: ReferralFilter): RangeContact[] {
  return list
    .filter(
      (c) =>
        (f.contact === 'all' || (f.contact === 'done' ? contactsOf(c) > 0 : contactsOf(c) === 0)) &&
        (f.assignee === undefined || c.assigned_to === f.assignee) &&
        (f.outcome === null || referralOutcome(c) === f.outcome),
    )
    .sort((a, b) => {
      const wa = contactsOf(a) === 0
      const wb = contactsOf(b) === 0
      if (wa !== wb) return wa ? -1 : 1
      if (wa && wb && a.days_waiting !== b.days_waiting) return (b.days_waiting ?? -1) - (a.days_waiting ?? -1)
      return b.arrived_at.localeCompare(a.arrived_at)
    })
}
