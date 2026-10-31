import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/features/auth/types'

export type Person = { id: string; full_name: string; role: AppRole; pending_today: number; assigned_total: number }
export type Preview = { total: number; by_author: { name: string; n: number }[]; people: Person[] }
export type PoolArgs = { branch: number; from: string; to: string; includeOlder: boolean }

export function usePreview(a: PoolArgs | null) {
  return useQuery({
    queryKey: ['distribution', a],
    enabled: a !== null,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('distribution_preview', {
        p_branch: a!.branch,
        p_from: a!.from,
        p_to: a!.to,
        p_include_older: a!.includeOlder,
      })
      if (error) throw toAppError(error)
      return data as Preview
    },
  })
}

export function useDistribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: PoolArgs & { quotas: Record<string, number> }) => {
      const { data, error } = await supabase.rpc('distribute_prospects', {
        p_branch: v.branch,
        p_from: v.from,
        p_to: v.to,
        p_include_older: v.includeOlder,
        p_quotas: v.quotas,
      })
      if (error) throw toAppError(error)
      return data as { assigned: number; by_person: Record<string, number> }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['distribution'] })
      void qc.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

/** Partes iguales entre las auxiliares (o entre todos si no hay auxiliares); el resto va a quien tiene menos pendientes. */
export function equalQuotas(total: number, people: Person[]): Record<string, number> {
  const aux = people.filter((p) => p.role === 'field_assistant')
  const targets = (aux.length ? aux : people).slice().sort((a, b) => a.pending_today - b.pending_today)
  const q: Record<string, number> = Object.fromEntries(people.map((p) => [p.id, 0]))
  if (!targets.length) return q
  const base = Math.floor(total / targets.length)
  targets.forEach((p, i) => (q[p.id] = base + (i < total % targets.length ? 1 : 0)))
  return q
}
