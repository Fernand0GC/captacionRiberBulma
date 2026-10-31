import { laPazDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import type { Activity } from './api'

// Actividad del plan que toca ahora, para la pantalla Registrar del volantero. Sin React Query (Registrar
// funciona sin señal): se pide al servidor cuando hay red y se guarda la última respuesta del día en el celular.
type Cached = { at: string; activities: Activity[] }
const key = (branch: number, day: string) => `captacion.plan.${branch}.${day}`

function readCache(branch: number, day: string): Cached | null {
  try {
    const v = localStorage.getItem(key(branch, day))
    return v ? (JSON.parse(v) as Cached) : null
  } catch {
    return null
  }
}

/** Plan del día: del servidor si hay señal, si no lo último guardado (o null si nunca se descargó). */
export async function loadTodayPlan(branch: number): Promise<Activity[] | null> {
  const day = laPazDate(new Date())
  try {
    const { data, error } = await supabase.rpc('agenda_day', { p_branch: branch, p_day: day })
    if (error) throw error
    const activities = (data as { activities: Activity[] }).activities
    try {
      localStorage.setItem(key(branch, day), JSON.stringify({ at: new Date().toISOString(), activities }))
    } catch {
      /* sin almacenamiento: solo se ve con señal */
    }
    return activities
  } catch {
    return readCache(branch, day)?.activities ?? null
  }
}

/** Hora local de La Paz "HH:MM". */
function nowHHMM(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
}

const shiftEnd = (a: Activity) => a.end_time ?? (a.shift === 'morning' ? '13:00' : '23:59')

/** La actividad en curso; si no hay, la próxima de hoy (para avisar qué viene). */
export function pickActivity(activities: Activity[], now: Date): { activity: Activity; current: boolean } | null {
  const t = nowHHMM(now)
  const current = activities.find((a) => a.start_time <= t && t < shiftEnd(a))
  if (current) return { activity: current, current: true }
  const next = activities.filter((a) => a.start_time > t).sort((a, b) => a.start_time.localeCompare(b.start_time))[0]
  return next ? { activity: next, current: false } : null
}
