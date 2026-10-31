import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/features/auth/types'

export type Metrics = {
  kpis: {
    captures: number
    contacts: number
    effective: number
    potential: number
    sales: number
    visits: number
    captures_sold: number
    unassigned: number
  }
  funnel: Record<'capture' | 'recapture' | 'followup' | 'interested' | 'sale' | 'lost', number>
  by_day: { day: string; n: number }[]
  by_channel: { name: string; n: number }[]
  by_author: { name: string; role: AppRole; captures: number; contacted: number; sales: number }[]
  by_agent: { name: string; role: AppRole; contacts: number; effective: number; visits: number; sales: number }[]
  by_branch: { name: string; captures: number; sales: number }[] | null
}

export function useMetrics(f: { from: string; to: string; branch_id?: number }) {
  return useQuery({
    queryKey: ['metrics', f],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_metrics', { f })
      if (error) throw toAppError(error)
      return data as Metrics
    },
  })
}
