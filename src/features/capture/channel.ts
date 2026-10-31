import { laPazDate } from '@/lib/dates'

// Canal de la jornada (FR-011b): se elige una vez por día en el dispositivo y se aplica a cada captación.
const key = (userId: string) => `captacion.channel.${userId}.${laPazDate(new Date())}`

export function getDayChannel(userId: string): number | null {
  try {
    const v = localStorage.getItem(key(userId))
    return v ? Number(v) : null
  } catch {
    return null
  }
}

// 'plan' = se tomó solo de la actividad en curso (puede seguir al plan); 'manual' = lo eligió la persona (se respeta).
export type ChannelSource = 'plan' | 'manual'

export function getDayChannelSource(userId: string): ChannelSource | null {
  try {
    return localStorage.getItem(`${key(userId)}.source`) === 'plan' ? 'plan' : getDayChannel(userId) === null ? null : 'manual'
  } catch {
    return null
  }
}

export function setDayChannel(userId: string, channelId: number, source: ChannelSource = 'manual'): void {
  try {
    localStorage.setItem(key(userId), String(channelId))
    localStorage.setItem(`${key(userId)}.source`, source)
  } catch {
    /* sin almacenamiento: se volverá a pedir */
  }
}
