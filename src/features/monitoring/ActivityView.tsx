import { ROLE_LABEL } from '@/features/auth/types'
import { PageTitle } from '@/ui/PageTitle'
import {
  fmtDay,
  ManageFilterBar,
  ViewSwitch,
  type ManageScope,
} from '@/features/prospects/ManageFilterBar'
import { activityTotals, parseActivitySort, sortActivity, sortParam, type ActivitySortKey } from './activity'
import { AgentContactsDialog } from './AgentContactsDialog'
import { useAgentActivity, type AgentActivityFilters } from './api'
import { ExportButton } from './ExportButton'
import { ACTIVITY_METRICS, contactMetricOf, type ActivityMetric } from './labels'

/** Vista Actividad de /gestion (FR-020…FR-026): cuántos contactos hizo cada persona en el período. */
export function ActivityView({ scope }: { scope: ManageScope }) {
  const { search, setSearch, from, to, isGlobal, sucursal, scopeName } = scope
  const filters: AgentActivityFilters = { from, to, branch_id: isGlobal ? sucursal : undefined }
  const activity = useAgentActivity(filters)
  const sort = parseActivitySort(search.orden)
  const rows = sortActivity(activity.data?.rows ?? [], sort)
  const totals = activityTotals(rows)
  const periodLabel = from === to ? fmtDay(from) : `${fmtDay(from)} al ${fmtDay(to)}`
  const person = search.persona ? rows.find((r) => r.actor_id === search.persona) : undefined

  const onSort = (key: ActivitySortKey) => {
    const next = sort.key === key ? { key, desc: !sort.desc } : { key, desc: key !== 'full_name' }
    const param = sortParam(next)
    setSearch({ orden: param === 'total' ? undefined : param })
  }
  const ariaSort = (key: ActivitySortKey) =>
    sort.key === key ? (sort.desc ? 'descending' : 'ascending') : ('none' as const)
  const arrow = (key: ActivitySortKey) => (sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : '')
  const open = (actorId: string, m: ActivityMetric | 'all') =>
    setSearch({ persona: actorId, metrica: m === 'all' ? 'all' : contactMetricOf(m) })

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title="Actividad"
        subtitle={scopeName}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <ExportButton
              disabled={!rows.length}
              run={async () => {
                const { exportActivity } = await import('./exportActivity')
                await exportActivity(rows, filters, scopeName)
                return `✓ Excel descargado: ${rows.length} personas`
              }}
            />
            <ViewSwitch search={search} setSearch={setSearch} />
          </div>
        }
      />

      <ManageFilterBar scope={scope} />

      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-ink/60">
          <span className="font-display text-3xl font-bold text-ink" data-testid="total">
            {totals.total}
          </span>{' '}
          {totals.total === 1 ? 'contacto' : 'contactos'} · {periodLabel}
        </p>
        {activity.isFetching && <span className="text-sm text-ink/40">Actualizando…</span>}
      </div>

      {activity.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">No se pudo cargar. {(activity.error as Error).message}</p>
      ) : activity.data && (rows.length === 0 || totals.total === 0) ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          Nadie registró contactos en este período.
        </p>
      ) : null}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5">
          <table className="w-full min-w-[56rem] text-sm" aria-label="Actividad por persona">
            <thead className="bg-ink text-gold-light">
              <tr>
                <th scope="col" aria-sort={ariaSort('full_name')} className="sticky left-0 z-10 bg-ink px-3 py-3 text-left">
                  <button type="button" onClick={() => onSort('full_name')} className="font-semibold">
                    Personal{arrow('full_name')}
                  </button>
                </th>
                {ACTIVITY_METRICS.map((m) => (
                  <th key={m.key} scope="col" aria-sort={ariaSort(m.key)} className="px-3 py-3 text-right">
                    <button type="button" onClick={() => onSort(m.key)} className="font-semibold" title={m.label}>
                      {m.short}
                      {arrow(m.key)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.actor_id} data-testid="activity-row" className="group border-t border-ink/5">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-normal group-even:bg-cream"
                  >
                    <button
                      type="button"
                      onClick={() => open(r.actor_id, 'all')}
                      className="text-left font-semibold hover:text-gold-dark hover:underline"
                    >
                      {r.full_name}
                    </button>
                    <span className="block text-xs text-ink/45">
                      {ROLE_LABEL[r.role]}
                      {!r.active && <span className="ml-1 font-semibold text-rb-red">· Inactiva</span>}
                    </span>
                  </th>
                  {ACTIVITY_METRICS.map((m) => (
                    <td key={m.key} className={`px-3 py-2.5 text-right tabular-nums group-even:bg-cream/60 ${m.key === 'total' ? 'font-semibold' : ''}`}>
                      {r[m.key] > 0 ? (
                        <button
                          type="button"
                          onClick={() => open(r.actor_id, m.key)}
                          aria-label={`${m.label} de ${r.full_name}: ${r[m.key]}`}
                          className="min-w-8 rounded-lg px-1.5 py-0.5 hover:bg-gold/15 hover:text-gold-dark hover:underline"
                        >
                          {r[m.key]}
                        </button>
                      ) : (
                        <span className="text-ink/30">0</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink/15 bg-sand font-bold" data-testid="activity-total">
                <th scope="row" className="sticky left-0 z-10 bg-sand px-3 py-3 text-left">
                  Total
                </th>
                {ACTIVITY_METRICS.map((m) => (
                  <td key={m.key} className="px-3 py-3 text-right tabular-nums">
                    {totals[m.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {search.persona && (
        <AgentContactsDialog
          filters={filters}
          actorId={search.persona}
          actorName={person?.full_name ?? 'Contactos'}
          metric={search.metrica ?? 'all'}
          periodLabel={periodLabel}
          onClose={() => setSearch({ persona: undefined, metrica: undefined })}
        />
      )}
    </main>
  )
}

export default ActivityView
