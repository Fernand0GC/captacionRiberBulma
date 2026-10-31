import { laPazDate } from '@/lib/dates'
import { getMeta, setMeta } from './db'

// Conteo de captaciones de hoy por usuario, sin repetir ni perder ninguna:
//   ids del servidor (incluye otros dispositivos) ∪ ids confirmados en este dispositivo ∪ pendientes del outbox.
// Contar por id (y no sumar números) evita el doble conteo cuando el servidor ya tiene una captación que el
// dispositivo todavía ve como pendiente, y el faltante cuando el servidor ya contaba captaciones de otro lado.
export const acceptedKey = (userId: string, date: Date = new Date()) => `accepted.${userId}.${laPazDate(date)}`
export const serverIdsKey = (userId: string, date: Date = new Date()) => `serverIds.${userId}.${laPazDate(date)}`

export async function bumpToday(userId: string, createdAt: string, id: string): Promise<void> {
  if (laPazDate(new Date(createdAt)) !== laPazDate(new Date())) return
  const key = acceptedKey(userId)
  const ids = (await getMeta<string[]>(key)) ?? []
  if (!ids.includes(id)) await setMeta(key, [...ids, id])
}

export async function applyServerToday(userId: string, ids: string[]): Promise<void> {
  await setMeta(serverIdsKey(userId), ids)
}

/** Ids confirmados hoy (servidor ∪ dispositivo). */
export function confirmedIds(serverIds: string[] | undefined, acceptedIds: string[] | undefined): Set<string> {
  return new Set([...(serverIds ?? []), ...(acceptedIds ?? [])])
}

/** Total de hoy: confirmadas + pendientes que todavía no figuran como confirmadas. */
export function todayTotal(confirmed: Set<string>, pendingTodayIds: string[]): number {
  return confirmed.size + pendingTodayIds.filter((id) => !confirmed.has(id)).length
}
