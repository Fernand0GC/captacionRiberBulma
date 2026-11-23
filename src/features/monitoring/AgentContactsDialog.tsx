import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { fmtDate, fmtTime } from '@/features/prospects/format'
import type { MetricParam } from '@/features/prospects/search'
import { AssignedPanel } from './AssignedPanel'
import { useAgentAssigned, useAgentContacts, type AgentActivityFilters } from './api'
import { metricLabel, type ContactMetric } from './labels'

/**
 * Detalle de una persona en Actividad. Dos pestañas (spec 012):
 *  · «Asignados»: clientes que se le asignaron en el período, de qué etapa venían, si los contactó y a qué pasaron.
 *  · Contactos (FR-025): los contactos que forman el número tocado, marcados «Asignado hoy» o «Cartera».
 * `metric = 'assigned'` abre en la pestaña Asignados; cambiar de pestaña actualiza la URL con `onMetric`.
 */
export function AgentContactsDialog({
  filters,
  actorId,
  actorName,
  metric,
  periodLabel,
  assignedCount,
  onMetric,
  onClose,
}: {
  filters: AgentActivityFilters
  actorId: string
  actorName: string
  metric: MetricParam
  periodLabel: string
  /** De la fila de Actividad, para la pestaña antes de que cargue la lista. */
  assignedCount?: number
  onMetric: (m: MetricParam) => void
  onClose: () => void
}) {
  const tab: 'assigned' | 'contacts' = metric === 'assigned' ? 'assigned' : 'contacts'
  // Al pasar a Asignados se recuerda qué número de contactos se había tocado, para volver a él.
  const [contactMetric, setContactMetric] = useState<ContactMetric>(metric === 'assigned' ? 'all' : metric)
  const contacts = useAgentContacts(filters, actorId, metric === 'assigned' ? contactMetric : metric)
  const assigned = useAgentAssigned(filters, actorId)
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const rows = contacts.data?.pages.flatMap((p) => p.rows) ?? []
  const total = contacts.data?.pages[0]?.total
  const assignedTotal = contacts.data?.pages[0]?.assigned_total
  const nAssigned = assigned.data?.total ?? assignedCount
  const oneDay = filters.from === filters.to
  const shownMetric = metric === 'assigned' ? contactMetric : metric

  const goTab = (t: 'assigned' | 'contacts') => {
    if (t === tab) return
    if (t === 'assigned') setContactMetric(metric as ContactMetric)
    onMetric(t === 'assigned' ? 'assigned' : contactMetric)
  }

  async function exportAssigned() {
    if (!assigned.data) return
    setExporting(true)
    try {
      const { exportAssigned } = await import('./exportActivity')
      await exportAssigned(assigned.data.rows, filters, actorName)
      toast(`✓ Excel descargado: ${assigned.data.rows.length} clientes`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  const tabCls = (on: boolean) =>
    `-mb-px whitespace-nowrap border-b-[3px] px-2 py-2.5 text-sm font-semibold sm:px-3 sm:text-base ${on ? 'border-gold text-ink' : 'border-transparent text-ink/50 hover:text-ink'}`
  const count = (n: number | undefined, on: boolean) => (
    <span className={`ml-1 rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? 'bg-ink text-gold-light' : 'bg-sand'}`}>
      {n ?? '…'}
    </span>
  )

  return (
    <Dialog
      open
      size="xl"
      onOpenChange={(o) => !o && onClose()}
      title={`${actorName} · ${tab === 'assigned' ? 'Clientes asignados' : metricLabel(shownMetric)}`}
      description={periodLabel}
    >
      <div className="flex gap-1 overflow-x-auto border-b border-ink/10" role="tablist" aria-label="Detalle">
        <button type="button" role="tab" aria-selected={tab === 'assigned'} onClick={() => goTab('assigned')} className={tabCls(tab === 'assigned')}>
          {oneDay ? 'Asignados del día' : 'Asignados'}
          {count(nAssigned, tab === 'assigned')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'contacts'} onClick={() => goTab('contacts')} className={tabCls(tab === 'contacts')}>
          {metricLabel(shownMetric)}
          {count(total, tab === 'contacts')}
        </button>
      </div>

      <div className="max-h-[calc(100dvh-19rem)] overflow-y-auto pt-4">
        {tab === 'assigned' ? (
          assigned.isError ? (
            <p className="rounded-2xl bg-rb-red/10 p-3 text-rb-red">No se pudo cargar. {(assigned.error as Error).message}</p>
          ) : assigned.isPending ? (
            <p className="py-6 text-center text-ink/50">Cargando…</p>
          ) : (
            <AssignedPanel
              rows={assigned.data.rows}
              total={assigned.data.total}
              actor={{ id: actorId, name: actorName }}
              filters={filters}
              hiddenTotal={assigned.data.hidden_total ?? 0}
              contactedVisible={assigned.data.contacted_visible ?? 0}
            />
          )
        ) : contacts.isError ? (
          <p className="rounded-2xl bg-rb-red/10 p-3 text-rb-red">No se pudo cargar. {(contacts.error as Error).message}</p>
        ) : contacts.isPending ? (
          <p className="py-6 text-center text-ink/50">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-ink/50">Sin contactos.</p>
        ) : (
          <>
            {total !== undefined && assignedTotal !== undefined && (
              <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-white p-3 ring-1 ring-ink/10" data-testid="contacts-split">
                <p>
                  <b className="font-display text-2xl tabular-nums">{total}</b>{' '}
                  <span className="text-sm text-ink/55">{total === 1 ? 'contacto' : 'contactos'}</span>
                </p>
                <p>
                  <b className="font-display text-2xl tabular-nums">{assignedTotal}</b>{' '}
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold-dark">Asignado hoy</span>
                </p>
                <p>
                  <b className="font-display text-2xl tabular-nums">{total - assignedTotal}</b>{' '}
                  <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-bold text-ink/55">Cartera</span>{' '}
                  <span className="text-sm text-ink/55">clientes de días anteriores</span>
                </p>
              </div>
            )}
            <ul className="-mx-2 flex flex-col" aria-label="Contactos">
              {rows.map((c) => (
                <li key={c.followup_id}>
                  <Link
                    to="/cliente/$id"
                    params={{ id: c.prospect_id }}
                    className="block rounded-2xl px-2 py-2.5 hover:bg-white active:bg-sand"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">
                        {c.full_name}
                        {c.assigned !== undefined && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 align-middle text-[11px] font-bold ${c.assigned ? 'bg-gold/20 text-gold-dark' : 'bg-sand text-ink/50'}`}
                          >
                            {c.assigned ? 'Asignado hoy' : 'Cartera'}
                          </span>
                        )}
                      </span>
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
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2 border-t border-ink/10 pt-4">
        {tab === 'assigned' && !!assigned.data?.rows.length && (
          <Button variant="secondary" disabled={exporting} onClick={() => void exportAssigned()}>
            {exporting ? 'Descargando…' : 'Descargar Excel'}
          </Button>
        )}
        {tab === 'contacts' && contacts.hasNextPage && (
          <Button variant="secondary" className="flex-1" disabled={contacts.isFetchingNextPage} onClick={() => void contacts.fetchNextPage()}>
            {contacts.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </Button>
        )}
        <Button className="flex-1" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Dialog>
  )
}
