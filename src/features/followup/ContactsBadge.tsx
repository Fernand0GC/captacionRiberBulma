import { QueryProvider } from '@/app/QueryProvider'
import { useMyContacts } from './api'
import { dueStatus, needsAttention } from './dueStatus'

function Count({ className }: { className: string }) {
  const q = useMyContacts()
  const now = new Date()
  const n = (q.data ?? []).filter((r) => needsAttention(dueStatus(r, now))).length
  if (!n) return null
  return (
    <span
      className={`rounded-full bg-amber-300 px-1.5 text-xs font-bold tabular-nums text-ink ${className}`}
      aria-label={`${n} por atender`}
    >
      {n}
    </span>
  )
}

/** Cuántos de Mis contactos piden atención (atrasados, de hoy o visita mañana). Se carga aparte del menú. */
export function ContactsBadge({ className }: { className: string }) {
  return (
    <QueryProvider>
      <Count className={className} />
    </QueryProvider>
  )
}
