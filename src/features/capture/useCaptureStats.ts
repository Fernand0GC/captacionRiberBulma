import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { supabase } from '@/lib/supabase'
import { db, getMeta, setMeta } from '@/features/sync/db'
import { acceptedKey, applyServerToday, confirmedIds, serverIdsKey } from '@/features/sync/todayCount'

type Rejection = { id: string; phone_masked: string; at: string }

/** Ids confirmados hoy (servidor ∪ dispositivo, reactivo) + avisos de duplicado (FR-017). */
export function useCaptureStats(userId: string, refreshKey: number) {
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [rejections, setRejections] = useState<Rejection[]>([])

  useEffect(() => {
    const sub = liveQuery(async () => {
      const [server, accepted] = await Promise.all([db.meta.get(serverIdsKey(userId)), db.meta.get(acceptedKey(userId))])
      return confirmedIds(server?.value as string[] | undefined, accepted?.value as string[] | undefined)
    }).subscribe({ next: setConfirmed })
    return () => sub.unsubscribe()
  }, [userId])

  useEffect(() => {
    let alive = true
    const sinceKey = `rejections.${userId}.since`
    ;(async () => {
      if (!navigator.onLine) return
      const { data } = await supabase.rpc('my_capture_stats')
      if (data) await applyServerToday(userId, ((data as { ids?: string[] }).ids ?? []).map(String))
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
  return { confirmed, rejections, dismiss }
}
