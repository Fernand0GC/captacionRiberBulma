import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Permission } from '@/features/auth/types'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { undoOne, withPermission, type PermissionRow } from './permissions'

const KEY = ['permissions'] as const

/** Encargadas que la persona puede gestionar, con sus permisos (permissions_list decide el alcance). */
export function usePermissionsList() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('permissions_list', { p_branch: null })
      if (error) throw toAppError(error)
      return data as PermissionRow[]
    },
  })
}

type SetVars = { id: string; permission: Permission; on: boolean }

/**
 * Marca o desmarca un permiso. La casilla cambia al instante; si el servidor falla, solo esa casilla vuelve
 * a como estaba (criterios 17 y 24) y quien llama muestra el error.
 */
export function useSetPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, permission, on }: SetVars) => {
      const { error } = await supabase.rpc('permission_set', { p_profile: id, p_permission: permission, p_on: on })
      if (error) throw toAppError(error)
    },
    onMutate: async ({ id, permission, on }: SetVars) => {
      await qc.cancelQueries({ queryKey: KEY })
      qc.setQueryData<PermissionRow[]>(KEY, (rows) => rows && withPermission(rows, id, permission, on))
    },
    onError: (_e, vars) => {
      qc.setQueryData<PermissionRow[]>(KEY, (rows) => rows && undoOne(rows, vars))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
