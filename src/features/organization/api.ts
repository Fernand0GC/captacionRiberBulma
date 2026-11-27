import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { resultsPendingMessage } from './logic'

// Organización comercial (spec 003, ajustes de la 004 y la 006). Contratos en specs/003-organizacion-comercial/contracts/rpc.md,
// specs/004-ajustes-organizacion-ventas/contracts/rpc.md y specs/006-ajustes-ventas-2/contracts/rpc.md.

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
  /** Meta de captación (contactos). */
  goal: number | null
  /** Resultado de captación. null = sin resultado (distinto de 0). */
  result: number | null
  share_goal: number | null
  /** Resultado de compartidas. null = sin resultado. */
  share_result: number | null
  /** Igual en las asignaciones creadas en una misma carga múltiple (spec 004). */
  batch_id: string | null
  /** Marcas efectivas vigentes del subcanal (o del canal si no hay subcanal). */
  uses_goal: boolean
  uses_share_goal: boolean
  /** El canal pide volanteras que acompañan (spec 006). */
  uses_flyers: boolean
  flyer_ids: string[]
  /** Volanteras que van, con su nombre (también las dadas de baja). */
  flyers: { id: string; name: string }[]
  /** Compartidas verificadas por Cobros (spec 006). null = sin verificar. */
  share_verified: number | null
  share_verified_note: string | null
  share_verified_by_name: string | null
  share_verified_at: string | null
  notes: string | null
  lead_id: string | null
  lead: string | null
  /** Puede cambiar meta, persona, horario, catálogo o lugar (límite por fecha, FR-029). */
  can_replan: boolean
  /** Puede registrar resultado y observaciones. */
  can_set_result: boolean
}

export type OrgList = { can_manage: boolean; rows: Assignment[] }

/** uses_place: pide «Ubicación / lugar» (Calle sí, Tienda no). */
export type Strategy = { id: number; name: string; sort: number; active: boolean; uses_place: boolean }
/** Metas para asignaciones sin subcanal y valor inicial de los subcanales nuevos. */
export type Channel = {
  id: number
  strategy_id: number
  name: string
  sort: number
  active: boolean
  uses_goal: boolean
  uses_share_goal: boolean
  /** Pide «Volanteras que van» (spec 006). */
  uses_flyers: boolean
}
export type Subchannel = {
  id: number
  channel_id: number
  name: string
  sort: number
  active: boolean
  /** Pide meta de captación (contactos). */
  uses_goal: boolean
  /** Pide meta de compartidas. */
  uses_share_goal: boolean
  /** Quién lo agregó desde el formulario (null = catálogo de Sistemas). */
  added_by: string | null
  added_at: string | null
  morning_start: string | null
  morning_end: string | null
  afternoon_start: string | null
  afternoon_end: string | null
}
export type Catalog = { strategies: Strategy[]; channels: Channel[]; subchannels: Subchannel[] }

export type StaffMember = { id: string; full_name: string; role: string }

/** Datos que se mandan al crear o editar (sin resultado). Desde la 006, con observaciones y volanteras. */
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
  share_goal: number | null
  /** Hasta 300 caracteres; vacío = sin observaciones. */
  notes: string
  /** Volanteras que acompañan; la base las vacía si el canal no las pide. */
  flyer_ids: string[]
}

/** Una carga con varios subcanales: datos comunes + metas de cada subcanal (org_save_many). */
export type AssignmentBatchInput = Omit<AssignmentInput, 'id' | 'subchannel_id' | 'goal' | 'share_goal'> & {
  /** Vacío = una asignación solo con el canal, con las metas de goal/share_goal. */
  items: { subchannel_id: number; goal: number | null; share_goal: number | null }[]
  goal: number | null
  share_goal: number | null
}

/** Detalle que devuelve la base con invalid_input → mensaje para la persona. */
const INVALID_DETAIL: Record<string, string> = {
  profile: 'La persona tiene que estar activa y ser de esta sucursal.',
  catalog: 'Elige un canal y un subcanal que correspondan a la estrategia (y que estén activos).',
  time: 'La hora de fin tiene que ser después de la de inicio.',
  goal: 'Escribe la meta de captación: un número entre 0 y 9999.',
  share_goal: 'Escribe la meta de compartidas: un número entre 0 y 9999.',
  share_result: 'Las compartidas tienen que ser un número entre 0 y 9999.',
  name: 'El nombre tiene que tener entre 2 y 80 caracteres.',
  inactive_subchannel: 'Ese subcanal existe pero está desactivado. Pide a Sistemas que lo reactive.',
  result: 'El resultado tiene que ser un número entre 0 y 9999.',
  notes: 'Las observaciones admiten hasta 300 caracteres.',
  range: 'Elige un rango de hasta 31 días.',
  day: 'Elige otro día.',
  place: 'El lugar admite hasta 200 caracteres.',
  flyers: 'Las volanteras tienen que estar activas y ser de esta sucursal.',
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const detail = (error as { details?: string | null }).details ?? ''
    // spec 032, obs. 8: conservar el mensaje de pendientes en el formulario y al copiar el día.
    if (error.message === 'results_pending') throw new Error(resultsPendingMessage(detail))
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

/** Nombres de personas (para «Agregado por …» en el Catálogo; Sistemas lee todos los perfiles por RLS). */
export function useProfileNames(ids: string[]) {
  const sorted = [...new Set(ids)].sort()
  return useQuery({
    queryKey: ['org', 'profile-names', sorted],
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', sorted)
      if (error) throw toAppError(error)
      return Object.fromEntries((data as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))
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
/** Crea una asignación por subcanal, todas o ninguna (spec 004, FR-010 y FR-012). */
export const saveAssignments = (p: AssignmentBatchInput) => rpc<string[]>('org_save_many', { p })
/** Siempre manda p_share_result (aunque sea null) para usar la versión de 4 argumentos. */
export const setAssignmentResult = (v: { id: string; result: number | null; share_result: number | null; notes: string }) =>
  rpc<null>('org_set_result', { p_id: v.id, p_result: v.result, p_notes: v.notes, p_share_result: v.share_result })
/** Agrega el subcanal que falta (o devuelve el existente con el mismo nombre). */
export const addSubchannel = (v: { branch: number; channel: number; name: string }) =>
  rpc<{ id: number; existed: boolean }>('org_add_subchannel', { p_branch: v.branch, p_channel: v.channel, p_name: v.name })
export const deleteAssignment = (id: string) => rpc<null>('org_delete', { p_id: id })
/** Copia un día sin duplicar: salta las asignaciones iguales que ya están en el destino (spec 007, FR-001/FR-002). */
export const copyDay = (v: { branch: number; from: string; to: string }) =>
  rpc<{ copied: number; skipped: number }>('org_copy_day_v2', { p_branch: v.branch, p_from: v.from, p_to: v.to })

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

/** Spec 033: padrón activo de freelancers de la sucursal elegida. */
export function useFreelancerCount(branch: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['org', 'freelancer-count', branch],
    enabled: enabled && branch !== undefined,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('referrers')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branch!)
        .eq('kind', 'freelance')
        .eq('active', true)
        .is('merged_into', null)
      if (error) throw toAppError(error)
      return count ?? 0
    },
  })
}
