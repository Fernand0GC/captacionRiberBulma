import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/features/auth/types'
import type { ChannelGroup } from '@/features/capture/channelGroups'
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
  channel_detail: string | null
  product_name: string | null
  product_group: ProductGroup | null
  assigned_to: string | null
  assigned_to_name: string | null
  contact_attempts: number
  visit_at: string | null
}

export type ProspectFilters = {
  from: string
  to: string
  branch_id?: number
  created_by?: string
  channel_id?: number | 'none'
  q?: string
  assigned?: string
  stage?: string
  product_id?: number
  view?: 'visits'
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
      return data as { total: number; by_channel: { channel_id: number | null; name: string; n: number }[]; rows: ProspectRow[] }
    },
  })
}

/** Trae todas las captaciones del filtro (de a 200, el máximo que acepta list_prospects). Excel y "seleccionar todas". */
export async function fetchAllProspects(filters: ProspectFilters): Promise<ProspectRow[]> {
  const rows: ProspectRow[] = []
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabase.rpc('list_prospects', {
      f: filters,
      p_limit: 200,
      p_offset: offset,
    })
    if (error) throw toAppError(error)
    const page = data as { total: number; rows: ProspectRow[] }
    rows.push(...page.rows)
    if (page.rows.length < 200 || rows.length >= page.total) return rows
  }
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
      const { data, error } = await supabase.from('channels').select('id, name, channel_group').eq('active', true).order('sort')
      if (error) throw toAppError(error)
      return data.map((c) => ({ id: c.id as number, name: c.name as string, group: c.channel_group as ChannelGroup | null }))
    },
  })
}

export type ProductOption = { id: number; name: string; group: ProductGroup }

/** Productos activos del catálogo, para el filtro de la columna Producto. */
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    staleTime: Infinity,
    queryFn: async (): Promise<ProductOption[]> => {
      const { data, error } = await supabase.from('products').select('id, name, product_group').eq('active', true).order('sort')
      if (error) throw toAppError(error)
      return data.map((p) => ({ id: p.id as number, name: p.name as string, group: p.product_group as ProductGroup }))
    },
  })
}

export type Assignee = { id: string; full_name: string; role: AppRole }

/** Auxiliares, supervisores y encargado activos de la sucursal (a quién se puede asignar). */
export function useAssignees(branchId: number | undefined) {
  return useQuery({
    queryKey: ['assignees', branchId],
    enabled: branchId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('assignee_options', { p_branch: branchId })
      if (error) throw toAppError(error)
      return data as Assignee[]
    },
  })
}

export function useAssign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { ids: string[]; to: string | null }) => {
      const { data, error } = await supabase.rpc('assign_prospects', { p_ids: v.ids, p_to: v.to })
      if (error) throw toAppError(error)
      return data as number
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}
