import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

// Organización comercial (spec 003). Contratos en specs/003-organizacion-comercial/contracts/rpc.md.

export type Shift = 'morning' | 'afternoon'

export const SHIFT_LABEL: Record<Shift, string> = { morning: 'Mañana', afternoon: 'Tarde' }

export type Assignment = {
  id: string
  branch_id: number
  branch: string
  work_date: string
  shift: Shift
  start_time: string | null
  end_time: string | null
  profile_id: string
  person: string
  strategy_id: number
  strategy: string
  channel_id: number
  channel: string
  subchannel_id: number | null
  subchannel: string | null
  place: string | null
  goal: number | null
  /** null = sin resultado (distinto de 0). */
  result: number | null
  notes: string | null
  lead_id: string | null
  lead: string | null
  /** Puede cambiar meta, persona, horario, catálogo o lugar (límite por fecha, FR-029). */
  can_replan: boolean
  /** Puede registrar resultado y observaciones. */
  can_set_result: boolean
}

export type OrgList = { can_manage: boolean; rows: Assignment[] }

export type Strategy = { id: number; name: string; sort: number; active: boolean }
export type Channel = { id: number; strategy_id: number; name: string; sort: number; active: boolean }
export type Subchannel = {
  id: number
  channel_id: number
  name: string
  sort: number
  active: boolean
  morning_start: string | null
  morning_end: string | null
  afternoon_start: string | null
  afternoon_end: string | null
}
export type Catalog = { strategies: Strategy[]; channels: Channel[]; subchannels: Subchannel[] }

export type StaffMember = { id: string; full_name: string; role: string }

/** Datos que se mandan al crear o editar (sin resultado ni observaciones). */
export type AssignmentInput = {
  id?: string
  branch_id: number
  work_date: string
  shift: Shift
  start_time: string
  end_time: string
  profile_id: string
  strategy_id: number
  channel_id: number
  subchannel_id: number | null
  place: string
  goal: number | null
}

/** Detalle que devuelve la base con invalid_input → mensaje para la persona. */
const INVALID_DETAIL: Record<string, string> = {
  profile: 'La persona tiene que estar activa y ser de esta sucursal.',
  catalog: 'Elige un canal y un subcanal que correspondan a la estrategia (y que estén activos).',
  time: 'La hora de fin tiene que ser después de la de inicio.',
  goal: 'La meta tiene que ser un número entre 0 y 9999.',
  result: 'El resultado tiene que ser un número entre 0 y 9999.',
  notes: 'Las observaciones admiten hasta 300 caracteres.',
  range: 'Elige un rango de hasta 31 días.',
  day: 'Elige otro día.',
  place: 'El lugar admite hasta 200 caracteres.',
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

export function useOrgList(from: string, to: string, branches: number[], enabled = true) {
  return useQuery({
    queryKey: ['org', 'list', from, to, branches],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => rpc<OrgList>('org_list', { p_from: from, p_to: to, p_branches: branches.length ? branches : null }),
  })
}

async function selectAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order('sort').order('name')
  if (error) throw toAppError(error)
  return data as T[]
}

/** Catálogo completo (activos e inactivos); las asignaciones viejas muestran también lo desactivado. */
export function useOrgCatalog() {
  return useQuery({
    queryKey: ['org', 'catalog'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Catalog> => {
      const [strategies, channels, subchannels] = await Promise.all([
        selectAll<Strategy>('org_strategies'),
        selectAll<Channel>('org_channels'),
        selectAll<Subchannel>('org_subchannels'),
      ])
      return { strategies, channels, subchannels }
    },
  })
}

export function useOrgStaff(branch: number | undefined) {
  return useQuery({
    queryKey: ['org', 'staff', branch],
    enabled: branch !== undefined,
    staleTime: 60_000,
    queryFn: () => rpc<StaffMember[]>('org_staff', { p_branch: branch }),
  })
}

/** Mutaciones de la organización; al terminar refresca las listas. */
export function useOrgMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['org'] }),
  })
}

export const saveAssignment = (p: AssignmentInput) => rpc<string>('org_save', { p })
export const setAssignmentResult = (v: { id: string; result: number | null; notes: string }) =>
  rpc<null>('org_set_result', { p_id: v.id, p_result: v.result, p_notes: v.notes })
export const deleteAssignment = (id: string) => rpc<null>('org_delete', { p_id: id })
export const copyDay = (v: { branch: number; from: string; to: string }) =>
  rpc<number>('org_copy_day', { p_branch: v.branch, p_from: v.from, p_to: v.to })

// Escritura del catálogo (solo Sistemas; la base lo exige con RLS) ---------------------------------------

export type CatalogLevel = 'org_strategies' | 'org_channels' | 'org_subchannels'

/** Crea (sin id) o actualiza un elemento del catálogo. Nombre repetido → mensaje claro. */
export async function saveCatalogItem(level: CatalogLevel, item: Record<string, unknown> & { id?: number }) {
  const { id, ...fields } = item
  const q = id ? supabase.from(level).update(fields).eq('id', id) : supabase.from(level).insert(fields)
  const { error } = await q
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe un elemento con ese nombre en el mismo nivel.')
    if (error.code === '23514') throw new Error('Revisa los datos: el horario tiene que tener inicio y fin, y el fin ser después del inicio.')
    throw toAppError(error)
  }
}
