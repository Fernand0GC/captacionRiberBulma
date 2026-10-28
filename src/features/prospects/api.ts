import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/features/auth/types'
import type { ProductGroup } from '@/features/capture/useCatalogs'

export const PAGE_SIZE = 50

export type ProspectRow = {
  id: string
  full_name: string
  phone_raw: string
  interest: 'high' | 'medium' | 'low' | null
  occupation: string | null
  address: string | null
  client_created_at: string
  shift: 'morning' | 'afternoon'
  stage: string
  late_after_deactivation: boolean
  branch_id: number
  branch_name: string
  created_by: string
  created_by_name: string
  created_by_role: AppRole
  channel_name: string | null
  product_name: string | null
  product_group: ProductGroup | null
}

export type ProspectFilters = {
  from: string
  to: string
  branch_id?: number
  created_by?: string
  channel_id?: number
  q?: string
}

export function useProspects(filters: ProspectFilters, page: number) {
  return useQuery({
    queryKey: ['prospects', filters, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_prospects', {
        f: filters,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      })
      if (error) throw toAppError(error)
      return data as { total: number; rows: ProspectRow[] }
    },
  })
}

export type Staff = { id: string; full_name: string; role: AppRole; branch_id: number | null; active: boolean }

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('staff_options')
      if (error) throw toAppError(error)
      return data as Staff[]
    },
  })
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('id, name').eq('active', true).order('id')
      if (error) throw toAppError(error)
      return data as { id: number; name: string }[]
    },
  })
}


export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('channels').select('id, name').eq('active', true).order('sort')
      if (error) throw toAppError(error)
      return data as { id: number; name: string }[]
    },
  })
}
