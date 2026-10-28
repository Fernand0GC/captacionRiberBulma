import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { InactivePage } from '@/features/auth/InactivePage'
import { InactiveFlush } from '@/features/sync/InactiveFlush'
import { homePath, type AppRole } from '@/features/auth/types'

export function FullScreenMessage({ text }: { text: string }) {
  return <div className="bg-ink-gradient flex min-h-dvh items-center justify-center p-4 font-display text-gold-light">{text}</div>
}

/** Guard de UI. La barrera real de permisos es la RLS en la base (constitución IV). */
export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { status, profile } = useAuth()
  if (status === 'loading') return <FullScreenMessage text="Cargando…" />
  if (status === 'anonymous' || !profile) return <Navigate to="/login" replace />
  if (status === 'inactive') return <InactivePage pendingSlot={<InactiveFlush />} />
  if (!roles.includes(profile.role)) return <Navigate to={homePath(profile.role)} replace />
  return <>{children}</>
}

export function HomeRedirect() {
  const { status, profile } = useAuth()
  if (status === 'loading') return <FullScreenMessage text="Cargando…" />
  if (!profile || status === 'anonymous') return <Navigate to="/login" replace />
  if (status === 'inactive') return <InactivePage pendingSlot={<InactiveFlush />} />
  return <Navigate to={homePath(profile.role)} replace />
}
