import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export type Shift = 'morning' | 'afternoon'
export type ActivityStatus = 'pending' | 'done' | 'not_done'
export type Activity = {
  id: string
  shift: Shift
  start_time: string
  end_time: string | null
  strategy_id: number | null
  strategy: string | null
  description: string
  responsibles: string | null
  goal: string | null
  places: string | null
  status: ActivityStatus
  result: string | null
  channel_id: number | null
  channel: string | null
  /** Meta de captaciones (número) y cuántas cayeron en el horario (y canal) de la actividad. */
  goal_count: number | null
  captures: number
  /** Ya pasó su horario; con meta, `auto_status` dice si se cumplió (lo manual manda sobre lo automático). */
  ended: boolean
  auto_status: 'done' | 'not_done' | null
}

export type AgendaDay = {
  can_edit: boolean
  /** Meta de captaciones del día según Metas y lo captado en el día por la sucursal. */
  day_goal: number | null
  day_captures: number
  activities: Activity[]
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toAppError(error)
  return data as T
}

export function useAgendaDay(branch: number | undefined, day: string) {
  return useQuery({
    queryKey: ['agenda', branch, day],
    enabled: branch !== undefined,
    placeholderData: keepPreviousData,
    queryFn: () => rpc<AgendaDay>('agenda_day', { p_branch: branch, p_day: day }),
  })
}

export function useStrategies() {
  return useQuery({
    queryKey: ['agenda', 'strategies'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('agenda_strategies').select('id, name').eq('active', true).order('name')
      if (error) throw toAppError(error)
      return data as { id: number; name: string }[]
    },
  })
}

export function useAgendaMutation<V>(fn: string, toArgs: (v: V) => Record<string, unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: V) => rpc<unknown>(fn, toArgs(v)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agenda'] }),
  })
}
