import { Badge } from '@/ui/Badge'
import type { SyncStatus } from './useSyncStatus'

export function SyncBadge({ status }: { status: SyncStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {!status.online && <Badge tone="neutral">● Sin conexión</Badge>}
      {status.pending > 0 ? (
        <Badge tone="warning">↑ {status.pending === 1 ? '1 por subir' : `${status.pending} por subir`}</Badge>
      ) : (
        status.online && <Badge tone="success">✓ Todo subido</Badge>
      )}
      {status.blocked > 0 && <Badge tone="danger">{status.blocked} con problema — avisa a tu encargado</Badge>}
    </div>
  )
}
