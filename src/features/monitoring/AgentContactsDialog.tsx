import { Link } from '@tanstack/react-router'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { fmtDate, fmtTime } from '@/features/prospects/format'
import { useAgentContacts, type AgentActivityFilters } from './api'
import { metricLabel, type ContactMetric } from './labels'

/** Detalle de un número de Actividad (FR-025): los contactos que lo forman; cada uno lleva a la ficha del cliente. */
export function AgentContactsDialog({
  filters,
  actorId,
  actorName,
  metric,
  periodLabel,
  onClose,
}: {
  filters: AgentActivityFilters
  actorId: string
  actorName: string
  metric: ContactMetric
  periodLabel: string
  onClose: () => void
}) {
  const q = useAgentContacts(filters, actorId, metric)
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? []
  const total = q.data?.pages[0]?.total

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${actorName} · ${metricLabel(metric)}`}
      description={`${periodLabel}${total !== undefined ? ` · ${total} ${total === 1 ? 'contacto' : 'contactos'}` : ''}`}
    >
      {q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-3 text-rb-red">No se pudo cargar. {(q.error as Error).message}</p>
      ) : q.isPending ? (
        <p className="py-6 text-center text-ink/50">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-ink/50">Sin contactos.</p>
      ) : (
        <ul className="-mx-2 flex max-h-[60vh] flex-col overflow-y-auto" aria-label="Contactos">
          {rows.map((c) => (
            <li key={c.followup_id}>
              <Link
                to="/cliente/$id"
                params={{ id: c.prospect_id }}
                className="block rounded-2xl px-2 py-2.5 hover:bg-white active:bg-sand"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{c.full_name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink/50">
                    {fmtDate(c.contacted_at).slice(0, 5)} {fmtTime(c.contacted_at)}
                  </span>
                </span>
                <span className="block text-sm text-ink/60">
                  {METHOD_LABEL[c.method]} · {RESULT_LABEL[c.result]}
                </span>
                {c.note && <span className="mt-0.5 block text-sm text-ink/80">{c.note}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        {q.hasNextPage && (
          <Button variant="secondary" className="flex-1" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
            {q.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </Button>
        )}
        <Button className="flex-1" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Dialog>
  )
}
