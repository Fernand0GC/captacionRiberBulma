import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { flushOutbox, pendingCount } from './sender'
import { submitCapture } from './submit'

/** Usuario dado de baja: sube lo pendiente (el servidor acepta lo anterior a la baja, R9) y avisa. */
export function InactiveFlush() {
  const { profile } = useAuth()
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!profile) return
    const uid = profile.id
    let alive = true
    const run = async () => {
      if (navigator.onLine) await flushOutbox({ userId: uid, submit: submitCapture })
      if (alive) setLeft(await pendingCount(uid))
    }
    void run()
    window.addEventListener('online', run)
    return () => {
      alive = false
      window.removeEventListener('online', run)
    }
  }, [profile])

  if (left === null || left === 0) return null
  return <p className="text-gold-light">Quedan {left} captaciones por subir. Conéctate a internet antes de salir.</p>
}
