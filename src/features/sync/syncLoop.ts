import { flushOutbox, recoverInterrupted, type FlushEvent } from './sender'
import { submitCapture } from './submit'
import { bumpToday } from './todayCount'

const INTERVAL_MS = 30_000

type Listener = (e: FlushEvent) => void
const listeners = new Set<Listener>()
let currentUser: string | null = null

export function onSyncEvent(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Pide un envío ya (después de Guardar, al volver la red, etc.). Sin señal no hace nada. */
export function requestFlush(): void {
  if (!currentUser || !navigator.onLine) return
  const userId = currentUser
  void flushOutbox({
    userId,
    submit: submitCapture,
    onEvent: async (e) => {
      if (e.type === 'accepted') await bumpToday(userId, e.row.createdAt)
      listeners.forEach((l) => l(e))
    },
  })
}

/** Disparadores de contracts/sync.md: inicio, online, visible, después de Guardar, cada 30 s. */
export function startSyncLoop(userId: string): () => void {
  currentUser = userId
  void recoverInterrupted(userId).then(requestFlush)
  const onVisible = () => document.visibilityState === 'visible' && requestFlush()
  window.addEventListener('online', requestFlush)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(requestFlush, INTERVAL_MS)
  return () => {
    if (currentUser === userId) currentUser = null
    window.removeEventListener('online', requestFlush)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}
