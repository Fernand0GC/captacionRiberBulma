import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminUsers } from '@/lib/adminUsers'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Member } from './team'

export function useTeam(branch: number | undefined) {
  return useQuery({
    queryKey: ['team', branch],
    enabled: branch !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_members', { p_branch: branch })
      if (error) throw toAppError(error)
      return data as Member[]
    },
  })
}

type TeamResult = { id: string; username?: string; password?: string; archived?: boolean }

/** Altas, bajas y claves de volanteras: pasan por la Edge Function (acciones team_*), que valida la sucursal. */
export function useTeamAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminUsers<TeamResult>(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team'] })
      void qc.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}
