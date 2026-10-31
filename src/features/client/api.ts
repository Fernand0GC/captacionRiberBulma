import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/features/auth/types'
import type { ContactMethod, ContactResult } from '@/features/followup/api'
import type { ProductGroup } from '@/features/capture/useCatalogs'

export type Client = {
  id: string
  full_name: string
  phone_raw: string
  phone_norm: string
  product_id: number | null
  product_name: string | null
  product_group: ProductGroup | null
  channel_id: number | null
  channel_name: string | null
  interest: 'high' | 'medium' | 'low' | null
  occupation: string | null
  address: string | null
  branch_id: number
  branch_name: string
  created_by_name: string
  created_by_role: AppRole
  client_created_at: string
  shift: 'morning' | 'afternoon'
  stage: 'capture' | 'recapture' | 'followup' | 'interested' | 'sale' | 'lost'
  stage_changed_at: string
  lost_reason: string | null
  sold_at: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  contact_attempts: number
  next_contact_at: string | null
  visit_at: string | null
  status: 'active' | 'voided' | 'duplicate_rejected'
  void_reason: string | null
  voided_at: string | null
}

export type TimelineItem =
  | { type: 'capture'; at: string; actor: string; data: { channel: string | null } }
  | { type: 'assignment'; at: string; actor: string; data: { to: string | null; from: string | null } }
  | {
      type: 'contact'
      at: string
      actor: string
      data: { result: ContactResult; method: ContactMethod; note: string | null; visit_at: string | null; callback_at: string | null }
    }
  | { type: 'stage'; at: string; actor: string; data: { from: string; to: string; reason: string | null; note: string | null } }
  | { type: 'edit'; at: string; actor: string | null; data: { old: Record<string, unknown>; new: Record<string, unknown> } }
  | { type: 'duplicate'; at: string; actor: string; data: { name: string; branch: string } }

export type ClientDetail = { prospect: Client; can_edit: boolean; can_void: boolean; can_contact: boolean; timeline: TimelineItem[] }

export const clientKey = (id: string) => ['prospects', 'detail', id]

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKey(id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_prospect', { p_id: id })
      if (error) throw toAppError(error)
      return data as ClientDetail
    },
  })
}

function useInvalidating<V>(fn: (v: V) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prospects'] })
      void qc.invalidateQueries({ queryKey: ['inbox'] })
    },
  })
}

export function useUpdateClient(id: string) {
  return useInvalidating(async (patch: Record<string, unknown>) => {
    const { error } = await supabase.rpc('update_prospect', { p_id: id, patch })
    if (error) throw toAppError(error)
  })
}

export function useVoidClient(id: string) {
  return useInvalidating(async (reason: string) => {
    const { error } = await supabase.rpc('void_prospect', { p_id: id, p_reason: reason })
    if (error) throw toAppError(error)
  })
}
