import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/features/auth/types'
import type { ContactMethod, ContactResult } from '@/features/followup/api'
import type { DailyTotals } from './daily'
import type { ContactMetric, FollowupTab } from './labels'

// Lecturas de monitoreo (specs/002-monitoreo-seguimiento/contracts/rpc.md). Todo por POST: la búsqueda no viaja en la URL.

export const MONITORING_PAGE = 50

// --- Seguimientos -------------------------------------------------------------------------------

export type FollowupStatusFilters = {
  from: string
  to: string
  branch_id?: number
  created_by?: string
  channel_id?: number | 'none'
  assigned?: string
  q?: string
  tab?: FollowupTab
  interest?: 'high' | 'medium' | 'low' | 'none'
  attempts?: '0' | '1-2' | '3+'
  overdue?: boolean
  stale_days?: number
  lost_reason_id?: number
  /** Spec 014: 'any' = solo referidos; número = un referidor. */
  referrer?: 'any' | number
  /** Spec 015: solo clientes con ese producto. */
  product_id?: number
}

export type FollowupStatusRow = {
  id: string
  full_name: string
  phone_raw: string
  branch_name: string
  assigned_to: string | null
  assigned_to_name: string | null
  stage: string
  interest: 'high' | 'medium' | 'low' | null
  no_answer_streak: number
  contacts_total: number
  last_contacted_at: string | null
  last_method: ContactMethod | null
  last_result: ContactResult | null
  last_note: string | null
  last_actor_name: string | null
  next_contact_at: string | null
  overdue: boolean
  days_without_contact: number
  lost_reason: string | null
  client_created_at: string
  channel_name: string | null
  created_by_name: string
  /** Spec 014: de quién vino (null = no es referido). */
  referrer_name?: string | null
  /** Spec 015: contexto por fila (opcionales: la base anterior no los manda). */
  product_name?: string | null
  channel_detail?: string | null
  created_by_role?: AppRole
}

export type FollowupStatusPage = {
  total: number
  by_tab: Record<FollowupTab | 'todos', number>
  rows: FollowupStatusRow[]
}

async function followupStatus(f: FollowupStatusFilters, limit: number, offset: number): Promise<FollowupStatusPage> {
  const { data, error } = await supabase.rpc('list_followup_status', { f, p_limit: limit, p_offset: offset })
  if (error) throw toAppError(error)
  return data as FollowupStatusPage
}

export function useFollowupStatus(filters: FollowupStatusFilters, page: number) {
  return useQuery({
    queryKey: ['monitoring', 'followup-status', filters, page],
    placeholderData: keepPreviousData,
    queryFn: () => followupStatus(filters, MONITORING_PAGE, (page - 1) * MONITORING_PAGE),
  })
}

/** Todas las filas del filtro (de a 200, el máximo de la RPC). Para el Excel. */
export async function fetchAllFollowupStatus(filters: FollowupStatusFilters): Promise<FollowupStatusRow[]> {
  const rows: FollowupStatusRow[] = []
  for (let offset = 0; ; offset += 200) {
    const page = await followupStatus(filters, 200, offset)
    rows.push(...page.rows)
    if (page.rows.length < 200 || rows.length >= page.total) return rows
  }
}

export function useLostReasons() {
  return useQuery({
    queryKey: ['lost-reasons'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('lost_reasons').select('id, name').order('id')
      if (error) throw toAppError(error)
      return data as { id: number; name: string }[]
    },
  })
}

// --- Actividad ----------------------------------------------------------------------------------

export type AgentActivityFilters = { from: string; to: string; branch_id?: number }

export type AgentActivityRow = {
  actor_id: string
  full_name: string
  role: AppRole
  active: boolean
  calls: number
  messages: number
  store: number
  effective: number
  no_answer: number
  visits: number
  sales: number
  clients: number
  /** Clientes que se le asignaron en el período (spec 012). */
  assigned: number
  /** De esos, a cuántos contactó desde que se le asignaron. */
  assigned_contacted: number
  total: number
}

/** Resumen por sucursal (sucursal del cliente). Solo llega cuando la consulta abarca todas las sucursales. */
export type BranchActivityRow = Omit<AgentActivityRow, 'actor_id' | 'full_name' | 'role' | 'active'> & {
  branch_id: number
  name: string
  /** Auxiliares y supervisores activos de la sucursal. */
  staff: number
  /** Personas distintas que contactaron a clientes de la sucursal. */
  actors: number
}

export function useAgentActivity(filters: AgentActivityFilters, enabled = true) {
  return useQuery({
    queryKey: ['monitoring', 'activity', filters],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('agent_activity', { f: filters })
      if (error) throw toAppError(error)
      // by_branch: null con una sucursal elegida; undefined si la base aún no tiene la migración 20261120000100.
      const res = data as { rows: AgentActivityRow[]; by_branch?: BranchActivityRow[] | null }
      // assigned: undefined si la base aún no tiene la migración 20261121000200 → se muestra 0.
      const fill = <T extends { assigned?: number; assigned_contacted?: number }>(r: T): T => ({
        ...r,
        assigned: r.assigned ?? 0,
        assigned_contacted: r.assigned_contacted ?? 0,
      })
      return { rows: res.rows.map(fill), by_branch: res.by_branch?.map(fill) ?? res.by_branch }
    },
  })
}

export type AgentContactRow = {
  followup_id: string
  prospect_id: string
  full_name: string
  contacted_at: string
  method: ContactMethod
  result: ContactResult
  effective: boolean
  note: string | null
  /** El cliente se le asignó en el período (antes del contacto): «Asignado hoy»; si no, «Cartera» (spec 012). */
  assigned?: boolean
}

export function useAgentContacts(filters: AgentActivityFilters, actorId: string | undefined, metric: ContactMetric) {
  return useInfiniteQuery({
    queryKey: ['monitoring', 'agent-contacts', filters, actorId, metric],
    enabled: !!actorId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('list_agent_contacts', {
        f: { ...filters, actor_id: actorId, metric },
        p_limit: MONITORING_PAGE,
        p_offset: pageParam,
      })
      if (error) throw toAppError(error)
      return data as { total: number; assigned_total?: number; rows: AgentContactRow[] }
    },
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.rows.length, 0)
      return loaded < last.total && last.rows.length > 0 ? loaded : undefined
    },
  })
}

// --- Asignados del día (spec 012) ---------------------------------------------------------------------------------

export type ProspectStage = 'capture' | 'recapture' | 'followup' | 'interested' | 'sale' | 'lost'

/** Un cliente asignado a la persona en el período (list_agent_assigned). Contactos = los suyos desde la asignación. */
export type AgentAssignedRow = {
  prospect_id: string
  full_name: string
  assigned_at: string
  /** true = lo tomó la propia persona («Hacer seguimiento» o lo captó con interés alto). */
  self_assigned: boolean
  assigned_by: string | null
  stage_at: ProspectStage
  stage_now: ProspectStage
  contacts: number
  first_at: string | null
  last_at: string | null
  last_method: ContactMethod | null
  last_result: ContactResult | null
  last_note: string | null
  /** Ya no está a su cargo; reassigned_to null = quedó sin responsable. */
  reassigned: boolean
  reassigned_to: string | null
  reassigned_at: string | null
}

export function useAgentAssigned(filters: AgentActivityFilters, actorId: string | undefined) {
  return useQuery({
    queryKey: ['monitoring', 'agent-assigned', filters, actorId],
    enabled: !!actorId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_agent_assigned', { f: { ...filters, actor_id: actorId } })
      if (error) throw toAppError(error)
      return data as { total: number; rows: AgentAssignedRow[] }
    },
  })
}

// --- Reporte del día (specs/009-reporte-del-dia/contracts/rpc.md) ----------------------------------

export type DailyFilters = {
  from: string
  to?: string
  branch_id?: number
  origin?: 'all' | 'referred'
  referrer_id?: number
  /** false: solo números (Panel). */
  lists?: boolean
}

export type DailyNewRow = {
  id: string
  registered_at: string
  full_name: string
  phone: string
  channel: string | null
  channel_detail: string | null
  referrer: string | null
  created_by: string
  assigned_to: string | null
  stage: string
  branch: string
}

export type DailyFollowedRow = {
  id: string
  full_name: string
  phone: string
  contacts: number
  effective: boolean
  last_at: string
  last_method: ContactMethod
  last_result: ContactResult
  last_actor: string
  registered_at: string
  channel: string | null
  referrer: string | null
  stage: string
  branch: string
}

export type DailyReport = {
  from: string
  to: string
  totals: DailyTotals
  new_rows: DailyNewRow[]
  followed_rows: DailyFollowedRow[]
  truncated: boolean
}

export async function dailyReport(f: DailyFilters): Promise<DailyReport> {
  const { data, error } = await supabase.rpc('daily_report', { f })
  if (error) throw toAppError(error)
  return data as DailyReport
}

export function useDailyReport(f: DailyFilters, enabled = true) {
  return useQuery({
    queryKey: ['monitoring', 'daily', f],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => dailyReport(f),
  })
}
