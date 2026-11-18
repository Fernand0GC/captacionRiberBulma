import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminUsers } from '@/lib/adminUsers'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { toProfile } from '@/features/auth/AuthProvider'
import type { Profile } from '@/features/auth/types'

export type UserRow = Profile & { created_at: string }

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, role, branch_id, contract_type, active, deactivated_at, created_at, ci, profile_branches(branch_id)')
        .order('full_name')
      if (error) throw toAppError(error)
      return data.map((u) => toProfile(u) as UserRow)
    },
  })
}

export function useUserAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminUsers(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      void qc.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}
