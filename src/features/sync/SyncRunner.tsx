import { useEffect } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { startSyncLoop } from './syncLoop'

/** Mantiene el loop de envío activo solo para el usuario con sesión (nunca sube pendientes de otro). */
export function SyncRunner() {
  const { profile } = useAuth()
  const userId = profile?.id
  useEffect(() => (userId ? startSyncLoop(userId) : undefined), [userId])
  return null
}
