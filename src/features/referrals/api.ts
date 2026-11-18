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

export type Referrer = { id: number; branch_id: number; name: string; kind: ReferrerKind; sort: number; active: boolean }

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
        .select('id, branch_id, name, kind, sort, active')
        .eq('branch_id', branch ?? 0)
        .order('sort')
        .order('name')
      if (error) throw toAppError(error)
      return data as Referrer[]
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
