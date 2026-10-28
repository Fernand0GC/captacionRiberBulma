import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { supabase } from '@/lib/supabase'
import { db, getMeta, setMeta } from '@/features/sync/db'
import { applyServerToday, todayKey } from '@/features/sync/todayCount'

type Rejection = { id: string; phone_masked: string; at: string }

/** Conteo confirmado de hoy (IndexedDB, reactivo) + avisos de duplicado (FR-017). */
export function useCaptureStats(userId: string, refreshKey: number) {
  const [serverToday, setServerToday] = useState(0)
  const [rejections, setRejections] = useState<Rejection[]>([])

  useEffect(() => {
    const sub = liveQuery(() => db.meta.get(todayKey(userId))).subscribe({
      next: (row) => setServerToday(Number(row?.value ?? 0)),
    })
    return () => sub.unsubscribe()
  }, [userId])

  useEffect(() => {
    let alive = true
    const sinceKey = `rejections.${userId}.since`
    ;(async () => {
      if (!navigator.onLine) return
      const { data } = await supabase.rpc('my_capture_stats')
      if (data) await applyServerToday(userId, Number((data as { today: number }).today))
      const since = (await getMeta<string>(sinceKey)) ?? new Date(Date.now() - 7 * 864e5).toISOString()
      const { data: rej } = await supabase.rpc('my_rejections', { since })
      if (alive && Array.isArray(rej) && rej.length) {
        const list = rej as Rejection[]
        setRejections((xs) => [...xs, ...list.filter((r) => !xs.some((x) => x.id === r.id))])
        await setMeta(sinceKey, list.at(-1)!.at)
      }
    })()
    return () => {
      alive = false
    }
  }, [userId, refreshKey])

  const dismiss = (id: string) => setRejections((xs) => xs.filter((r) => r.id !== id))
  return { serverToday, rejections, dismiss }
}
