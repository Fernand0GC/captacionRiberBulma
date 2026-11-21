import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Counts, ReferrerKind } from './logic'

// Referidos (spec 005). Contratos en specs/005-referidos/contracts/rpc.md.

export type Stage = 'capture' | 'recapture' | 'followup' | 'interested' | 'sale' | 'lost'

export type ReportRow = Counts & {
  id: number
  name: string
  kind: ReferrerKind
  active: boolean
  sort: number
  /** Meta vigente del mes (propia o arrastrada). null = sin meta. */
  goal: number | null
  /** Mes de la fila de meta usada ("2026-10-01"); distinto del mes del reporte = arrastrada. */
  goal_from: string | null
  /** Día del mes ("1".."31") → llegados y compras. Solo días con movimiento. */
  by_day: Record<string, { arrived: number; sold: number }>
}

export type ReportContact = {
  id: string
  referrer_id: number
  full_name: string
  phone: string
  product: string | null
  assigned_to: string | null
  stage: Stage
  arrived_at: string
  sold_at: string | null
}

export type ReferralReport = { branch: string; month: string; days: number; referrers: ReportRow[]; contacts: ReportContact[] }

export type Referrer = {
  id: number
  branch_id: number
  name: string
  kind: ReferrerKind
  sort: number
  active: boolean
  /** manager = cargado por un jefe; capture = escrito al registrar una captación (spec 010). */
  source?: 'manager' | 'capture'
  created_at?: string
  /** Quién lo agregó; null si quien consulta no puede ver ese perfil. */
  creator?: { full_name: string } | null
  /** Unido a otro referidor (spec 014): desactivado, no se edita. */
  merged_into?: number | null
}

const reportKey = (branch: number, month: string) => ['referrals', 'report', branch, month]

export function useReferralReport(branch: number | undefined, month: string) {
  return useQuery({
    queryKey: reportKey(branch ?? 0, month),
    enabled: branch !== undefined,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('referral_report', { p_branch: branch, p_month: month })
      if (error) throw toAppError(error)
      return data as ReferralReport
    },
  })
}

/** Todos los referidores de la sucursal, también los desactivados (para administrarlos). */
export function useReferrers(branch: number | undefined) {
  return useQuery({
    queryKey: ['referrals', 'referrers', branch],
    enabled: branch !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrers')
        .select('id, branch_id, name, kind, sort, active, source, created_at, merged_into, creator:profiles!referrers_created_by_fkey(full_name)')
        .eq('branch_id', branch ?? 0)
        .order('sort')
        .order('name')
      if (error) throw toAppError(error)
      return data as unknown as Referrer[]
    },
  })
}

const INVALID_DETAIL: Record<string, string> = {
  name: 'El nombre debe tener entre 2 y 60 caracteres.',
  name_taken: 'Ya hay un referidor con ese nombre en la sucursal.',
  kind: 'Elige el tipo de referidor.',
  branch_id: 'Elige una sucursal.',
  goal: 'La meta debe ser un número entre 0 y 9999.',
  month: 'Elige un mes válido.',
  referrer_id: 'El referidor no es de esta sucursal.',
  merged: 'Este referidor está unido a otro: ya no se edita.',
  into_id: 'Elige otro referidor de la misma sucursal (que no esté unido).',
  from_id: 'Este referidor ya está unido a otro.',
}

/** Error de la RPC → mensaje en español (con el campo de invalid_input cuando lo hay). */
function rpcError(error: { message: string; details?: string | null }): Error {
  const detail = error.details ?? ''
  if (error.message === 'invalid_input' && detail in INVALID_DETAIL) return new Error(INVALID_DETAIL[detail])
  return toAppError(error)
}

export type ReferrerInput = { id?: number; branch_id: number; name: string; kind: ReferrerKind; sort: number; active: boolean }

export async function saveReferrer(input: ReferrerInput): Promise<number> {
  const { data, error } = await supabase.rpc('referrer_save', { p: input })
  if (error) throw rpcError(error)
  return data as number
}

export type GoalsInput = { branch_id: number; month: string; referrers: { id: number; goal: number | null }[] }

export async function saveReferralGoals(input: GoalsInput): Promise<void> {
  const { error } = await supabase.rpc('referral_goals_save', { p: input })
  if (error) throw rpcError(error)
}

/** Mutación que refresca referidores, reporte y el catálogo del registro. */
export function useReferralMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['referrals'] })
    },
  })
}

// Spec 014: reporte por rango y sucursales, unir referidores --------------------------------------------

export type RangeRow = Counts & {
  id: number
  name: string
  kind: ReferrerKind
  active: boolean
  sort: number
  source: 'manager' | 'capture'
  /** Meta del rango (con un decimal si se prorrateó). null = sin meta. */
  goal: number | null
  /** Fecha ISO ("2026-11-04") → llegados y compras. Solo días con movimiento. */
  by_day: Record<string, { arrived: number; sold: number }>
}

export type BranchRow = Counts & { id: number; name: string; referrers: number; goal: number | null; captures: number }

export type RangeContact = {
  id: string
  branch_id: number
  branch_name: string
  referrer_id: number
  referrer_name: string
  full_name: string
  phone: string
  product: string | null
  assigned_to: string | null
  registered_by: string | null
  stage: Stage
  arrived_at: string
  sold_at: string | null
  last_contact_at: string | null
  /** Días desde que llegó, solo si sigue sin contactar. */
  days_waiting: number | null
}

export type Registrar = { id: string; name: string; role: string; branch_name: string; captures: number; referred: number }

export type RangeReport = {
  branch_id: number | null
  branch: string | null
  from: string
  to: string
  days: number
  goal_prorated: boolean
  totals: Counts & { goal: number | null; captures: number }
  by_branch: BranchRow[]
  referrers: RangeRow[]
  contacts: RangeContact[]
  registrars: Registrar[]
}

export type RangeFilters = { branch_id?: number; from: string; to: string; lists?: boolean }

export function useReferralRange(filters: RangeFilters, enabled = true) {
  return useQuery({
    queryKey: ['referrals', 'range', filters],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('referral_report_range', { p: filters })
      if (error) throw toAppError(error)
      return data as RangeReport
    },
  })
}

export async function mergeReferrer(input: { from_id: number; into_id: number }): Promise<void> {
  const { error } = await supabase.rpc('referrer_merge', { p: input })
  if (error) throw rpcError(error)
}

/** Metas propias de un mes (sin arrastre), para «Copiar metas del mes anterior» y la edición en bloque. */
export function useOwnGoals(branch: number | undefined, month: string) {
  return useQuery({
    queryKey: ['referrals', 'goals', branch, month],
    enabled: branch !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('referral_report', { p_branch: branch, p_month: month })
      if (error) throw toAppError(error)
      const report = data as ReferralReport
      return report.referrers.map((r) => ({ id: r.id, goal: r.goal, own: r.goal_from === report.month }))
    },
  })
}
