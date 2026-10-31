import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { laPazDate } from '@/lib/dates'
import { db } from './db'

export type SyncStatus = { pending: number; pendingToday: number; pendingTodayIds: string[]; blocked: number; online: boolean }

export function useSyncStatus(userId: string | undefined): SyncStatus {
  const [counts, setCounts] = useState({ pending: 0, pendingToday: 0, pendingTodayIds: [] as string[], blocked: 0 })
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    if (!userId) return
    const sub = liveQuery(async () => {
      const rows = await db.outbox.where('userId').equals(userId).toArray()
      const today = laPazDate(new Date())
      const todayIds = rows.filter((r) => r.state !== 'blocked' && laPazDate(new Date(r.createdAt)) === today).map((r) => r.id)
      return {
        pending: rows.filter((r) => r.state !== 'blocked').length,
        pendingToday: todayIds.length,
        pendingTodayIds: todayIds,
        blocked: rows.filter((r) => r.state === 'blocked').length,
      }
    }).subscribe({ next: setCounts })
    return () => sub.unsubscribe()
  }, [userId])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return { ...counts, online }
}
