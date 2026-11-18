// Avisos para la barra del portal (puente.md → `avisos`). Se carga con import() solo en modo portal:
// trae dueStatus → followup/api (React Query), que no debe pesar en el bundle inicial (constitución II).
import { dueStatus, type DueKind } from '@/features/followup/dueStatus'
import type { FollowupRow } from '@/features/followup/api'
import { laPazDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import type { Aviso } from './contract'

const NOTICE_TEXT: Partial<Record<DueKind, (n: number) => string>> = {
  late: (n) => (n === 1 ? '1 contacto atrasado' : `${n} contactos atrasados`),
  now: (n) => (n === 1 ? '1 contacto para hoy' : `${n} contactos para hoy`),
  soon: (n) => (n === 1 ? '1 visita de mañana por confirmar' : `${n} visitas de mañana por confirmar`),
}

/**
 * Mis contactos que piden atención (misma regla que el contador del menú), como conteos: sin nombres ni teléfonos
 * (constitución IV: los datos de prospectos no salen de las tablas con RLS). Fecha = inicio del día en La Paz
 * (UTC−4 fijo): estable todo el día, así la lista no "cambia" sola cada minuto.
 */
export function buildNotices(rows: FollowupRow[], now: Date): Aviso[] {
  const counts = new Map<DueKind, number>()
  for (const r of rows) {
    const kind = dueStatus(r, now).kind
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  const fecha = `${laPazDate(now)}T00:00:00-04:00`
  return (['late', 'now', 'soon'] as const).flatMap((kind) => {
    const n = counts.get(kind) ?? 0
    const text = NOTICE_TEXT[kind]
    return n && text ? [{ id: `captacion-${kind}`, texto: text(n), sistema: 'captacion' as const, fecha, url: '/seguimiento' }] : []
  })
}

/** Lee Mis contactos del servidor; sin red o con error devuelve null (se conserva lo último enviado). */
export async function loadNotices(now = new Date()): Promise<Aviso[] | null> {
  if (!navigator.onLine) return null
  const { data, error } = await supabase.rpc('my_contacts')
  if (error) return null
  return buildNotices((data ?? []) as FollowupRow[], now)
}
