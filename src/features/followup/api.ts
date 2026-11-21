import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { uuidv7 } from '@/lib/uuidv7'

export type ContactResult =
  | 'no_answer'
  | 'looking_product'
  | 'visit_store'
  | 'call_later'
  | 'very_interested'
  | 'sold'
  | 'not_interested'
  | 'wrong_number'
export type ContactMethod = 'call' | 'whatsapp_call' | 'message' | 'store'

export type FollowupRow = {
  id: string
  full_name: string
  phone_raw: string
  phone_norm: string
  stage: 'capture' | 'recapture' | 'followup' | 'interested'
  contact_attempts: number
  next_contact_at: string | null
  visit_at: string | null
  client_created_at: string
  /** Nivel de interés que anotó quien captó (para atender primero a los de interés alto). */
  interest: 'high' | 'medium' | 'low' | null
  product_id: number | null
  product_name: string | null
  channel_name: string | null
  created_by_name: string
  last_result: ContactResult | null
  last_method: ContactMethod | null
  last_note: string | null
  last_contacted_at: string | null
  contacts_count?: number
  /** Spec 016: quién lo recomendó y quién me lo asignó (si fue otra persona). Faltan si la base no tiene la 016. */
  referrer_name?: string | null
  assigned_by_name?: string | null
}

/** Cerrado que se puede volver a contactar (check "Ver cerrados anteriores" de Mis contactos). */
export type ClosedRow = Omit<FollowupRow, 'stage'> & {
  stage: 'sale' | 'lost'
  stage_changed_at: string
  sold_at: string | null
  lost_reason: string | null
}


export const RESULT_LABEL: Record<ContactResult, string> = {
  no_answer: 'No contestó',
  looking_product: 'Busca un producto',
  visit_store: 'Visitará la tienda',
  call_later: 'Volver a contactar',
  very_interested: 'Muy interesado',
  sold: 'Compró',
  not_interested: 'No le interesa',
  wrong_number: 'Número equivocado',
}

export const METHOD_LABEL: Record<ContactMethod, string> = {
  call: 'Llamada',
  whatsapp_call: 'Llamada WhatsApp',
  message: 'Mensaje',
  store: 'En tienda',
}

export function useAddFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      prospect_id: string
      result: ContactResult
      method: ContactMethod
      note?: string
      visit_at?: string
      callback_at?: string
      product_id?: number
    }) => {
      const { data, error } = await supabase.rpc('add_followup', { p: { id: uuidv7(), ...v } })
      if (error) throw toAppError(error)
      return data as { stage: string; contact_attempts: number }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] })
      void qc.invalidateQueries({ queryKey: ['prospects'] })
      // Seguimientos (spec 015) registra contactos desde la fila.
      void qc.invalidateQueries({ queryKey: ['monitoring'] })
    },
  })
}

/** Todos mis asignados abiertos (Mis contactos): la app los agrupa y marca el estado de cada fila. */
export function useMyContacts() {
  return useQuery({
    queryKey: ['inbox', 'all'],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_contacts')
      if (error) throw toAppError(error)
      return data as FollowupRow[]
    },
  })
}

/** Mis cerrados (no le interesó, no contestó 3 veces o ya compró): solo se piden si se marca el check. */
export function useMyClosedContacts(enabled: boolean) {
  return useQuery({
    queryKey: ['inbox', 'closed'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_closed_contacts')
      if (error) throw toAppError(error)
      return data as ClosedRow[]
    },
  })
}
