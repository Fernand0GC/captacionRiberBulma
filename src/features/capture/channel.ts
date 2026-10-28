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

export function setDayChannel(userId: string, channelId: number): void {
  try {
    localStorage.setItem(key(userId), String(channelId))
  } catch {
    /* sin almacenamiento: se volverá a pedir */
  }
}
