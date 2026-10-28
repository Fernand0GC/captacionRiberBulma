import { laPazDate } from '@/lib/dates'
import { getMeta, setMeta } from './db'

// Conteo de captaciones confirmadas hoy (por usuario), persistido en IndexedDB.
// Lo actualiza el sincronizador al confirmar (aunque la pantalla principal no esté abierta)
// y lo corrige el servidor cuando hay señal. Dentro del día solo sube: se toma el máximo
// para que una respuesta del servidor calculada antes de una confirmación no lo baje.
export const todayKey = (userId: string, date: Date = new Date()) => `stats.${userId}.${laPazDate(date)}`

export async function bumpToday(userId: string, createdAt: string): Promise<void> {
  if (laPazDate(new Date(createdAt)) !== laPazDate(new Date())) return
  const key = todayKey(userId)
  await setMeta(key, ((await getMeta<number>(key)) ?? 0) + 1)
}

export async function applyServerToday(userId: string, serverCount: number): Promise<void> {
  const key = todayKey(userId)
  await setMeta(key, Math.max(serverCount, (await getMeta<number>(key)) ?? 0))
}
