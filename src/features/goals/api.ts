import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export type GoalKey = 'captures' | 'contacts' | 'potential' | 'sales'
export type ShownGoalKey = GoalKey | 'shares'
export type GoalSet = Record<GoalKey, number | null>
export type DayGoals = {
  day: string
  adjusted: boolean
  note: string | null
  captures_from_plan: boolean
  goals: GoalSet & { shares: number | null }
  actuals: Record<ShownGoalKey, number>
}
export type Override = GoalSet & { day: string; note: string | null }
export type MonthlyRow = {
  branch_id: number
  branch_name: string
  line: 'phones' | 'appliances'
  goal: number | null
  sales: number
  remaining: number
  days_left: number
  daily_target: number | null
}

export const GOAL_LABEL: Record<ShownGoalKey, string> = {
  captures: 'Captaciones',
  contacts: 'Contactos (recaptación)',
  potential: 'Clientes potenciales',
  sales: 'Ventas',
  shares: 'Compartidas',
}
export const GOAL_KEYS: GoalKey[] = ['captures', 'contacts', 'potential', 'sales']
export const LINE_LABEL = { phones: 'CELULARES', appliances: 'ELECTROS' } as const

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toAppError(error)
  return data as T
}

export function useGoalsForDay(branch: number | undefined, day?: string) {
  return useQuery({
    queryKey: ['goals', 'day', branch ?? null, day ?? 'today'],
    placeholderData: keepPreviousData,
    queryFn: () => rpc<DayGoals>('goals_for_day', { p_branch: branch ?? null, p_day: day ?? null }),
  })
}

export function useDailyConfig(branch: number | undefined) {
  return useQuery({
    queryKey: ['goals', 'config', branch],
    enabled: branch !== undefined,
    queryFn: () => rpc<{ base: (GoalSet & { updated_at: string }) | null; overrides: Override[] }>('daily_goals_config', { p_branch: branch }),
  })
}

export function useMonthly(month: string, branch: number | undefined) {
  return useQuery({
    queryKey: ['goals', 'monthly', month, branch ?? null],
    placeholderData: keepPreviousData,
    queryFn: () => rpc<MonthlyRow[]>('monthly_goals_progress', { p_month: month, p_branch: branch ?? null }),
  })
}

export function useGoalMutation<V>(fn: string, toArgs: (v: V) => Record<string, unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: V) => rpc<void>(fn, toArgs(v)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}
