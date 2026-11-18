import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Shift } from '@/lib/dates'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

// Verificación de compartidas por Cobros (spec 006, US4). Contratos en specs/006-ajustes-ventas-2/contracts/rpc.md.

export type ShareRow = {
  id: string
  branch_id: number
  branch: string
  work_date: string
  shift: Shift
  start_time: string | null
  end_time: string | null
  person: string
  channel: string
  subchannel: string | null
  share_goal: number | null
  /** Lo que reportó ventas. null = sin resultado. */
  share_result: number | null
  /** Lo que verificó Cobros. null = sin verificar. */
  share_verified: number | null
  share_verified_note: string | null
  share_verified_by_name: string | null
  share_verified_at: string | null
}

/** branches: las sucursales que puede verificar quien consulta (vacío = Cobros sin sucursales). */
export type ShareList = { branches: { id: number; name: string }[]; rows: ShareRow[] }

const INVALID_DETAIL: Record<string, string> = {
  range: 'Elige un rango de hasta 31 días.',
  share_verified: 'Las verificadas tienen que ser un número entero entre 0 y 9999.',
  notes: 'El comentario admite hasta 300 caracteres.',
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const detail = (error as { details?: string | null }).details ?? ''
    if (error.message === 'invalid_input' && detail in INVALID_DETAIL) throw new Error(INVALID_DETAIL[detail])
    throw toAppError(error)
  }
  return data as T
}

/** Siempre pide todas sus sucursales: el filtro por sucursal se hace en pantalla. */
export function useShareList(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['shares', from, to],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => rpc<ShareList>('org_share_list', { p_from: from, p_to: to, p_branches: null }),
  })
}

/** Guarda (o borra, con null) la cantidad verificada y el comentario. */
export function useVerifyShares() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; verified: number | null; note: string }) =>
      rpc<null>('org_verify_shares', { p_id: v.id, p_verified: v.verified, p_note: v.note }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shares'] }),
  })
}
