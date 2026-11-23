import { useEffect, useRef, useState } from 'react'
import { MdClose } from 'react-icons/md'
import { ROLE_LABEL } from '@/features/auth/types'
import { PageTitle } from '@/ui/PageTitle'
import {
  fmtDay,
  ManageFilterBar,
  ViewSwitch,
  type ManageScope,
} from '@/features/prospects/ManageFilterBar'
import { activityTotals, parseActivitySort, sortActivity, sortBranches, sortParam, type ActivitySortKey } from './activity'
import { AgentContactsDialog } from './AgentContactsDialog'
import { BranchActivityTable } from './BranchActivityTable'
import { BranchDrillBar } from './BranchDrillBar'
import { useAgentActivity, type AgentActivityFilters } from './api'
import { ExportButton } from './ExportButton'
import { ACTIVITY_METRICS, contactMetricOf, type ActivityMetric } from './labels'

/** Vista Actividad de /gestion (FR-020…FR-026): cuántos contactos hizo cada persona en el período. */
export function ActivityView({ scope }: { scope: ManageScope }) {
  const { search, setSearch, from, to, isGlobal, sucursal, scopeName, branchScope } = scope
  const filters: AgentActivityFilters = { from, to, branch_id: isGlobal ? sucursal : undefined }
  const activity = useAgentActivity(filters)
  const sort = parseActivitySort(search.orden)
  const rows = sortActivity(activity.data?.rows ?? [], sort)
  const totals = activityTotals(rows)
  const periodLabel = from === to ? fmtDay(from) : `${fmtDay(from)} al ${fmtDay(to)}`
  const person = search.persona ? rows.find((r) => r.actor_id === search.persona) : undefined
  // Pestañas solo con «Todas las sucursales» y si el servidor mandó el resumen (Gerencia/Sistemas).
  const byBranch = activity.data?.by_branch
  const showTabs = isGlobal && sucursal === undefined && Array.isArray(byBranch)
  const tab: 'sucursal' | 'persona' = showTabs && search.agrupar !== 'persona' ? 'sucursal' : 'persona'
  const branchRows = sortBranches(byBranch ?? [], sort)

  // Dentro de una sucursal (Gerencia/Sistemas): el resumen de todas da el orden para Anterior/Siguiente y los
  // datos clave. Es la misma consulta que la pestaña «Por sucursal», así que si se viene de ahí sale del caché.
  const inBranch = isGlobal && branchScope.allowAll && search.sucursal !== undefined
  const overview = useAgentActivity({ from, to }, inBranch)
  const order = inBranch ? (overview.data?.by_branch ?? null) : null
  const current = order?.find((b) => b.branch_id === search.sucursal)
  const tabsVisible = showTabs || (inBranch && Array.isArray(order))

  // Al volver al resumen, la sucursal que se estaba viendo queda resaltada un momento.
  const [flash, setFlash] = useState<number | undefined>(undefined)
  const prevBranch = useRef(search.sucursal)
  useEffect(() => {
    const prev = prevBranch.current
    prevBranch.current = search.sucursal
    if (prev === undefined || search.sucursal !== undefined) return
    setFlash(prev)
    const t = setTimeout(() => setFlash(undefined), 1800)
    return () => clearTimeout(t)
  }, [search.sucursal])

  const clearDetail = { agrupar: undefined, orden: undefined, persona: undefined, metrica: undefined } as const
  // Entrar agrega un paso al historial: el «atrás» del celular vuelve al resumen en vez de salir de Gestión.
  const enterBranch = (id: number) => setSearch({ ...clearDetail, sucursal: id }, { push: true })
  // Anterior/Siguiente y volver reemplazan: no llenan el historial y conservan el período elegido.
  const stepBranch = (id: number) => setSearch({ ...clearDetail, sucursal: id })
  const backToSummary = () => setSearch({ ...clearDetail, sucursal: undefined })

  const onSort = (key: ActivitySortKey) => {
    const next = sort.key === key ? { key, desc: !sort.desc } : { key, desc: key !== 'full_name' }
    const param = sortParam(next)
    setSearch({ orden: param === 'total' ? undefined : param })
  }
  const ariaSort = (key: ActivitySortKey) =>
    sort.key === key ? (sort.desc ? 'descending' : 'ascending') : ('none' as const)
  const arrow = (key: ActivitySortKey) => (sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : '')
  const open = (actorId: string, m: ActivityMetric | 'all') =>
    setSearch({ persona: actorId, metrica: m === 'assigned' ? 'assigned' : m === 'all' ? 'all' : contactMetricOf(m) })
  const assignedContacted = rows.reduce((a, r) => a + r.assigned_contacted, 0)

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title="Actividad"
        subtitle={scopeName}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <ExportButton
              disabled={tab === 'sucursal' ? !branchRows.length : !rows.length}
              run={async () => {
                // Exporta lo que se está viendo: la pestaña activa.
                if (tab === 'sucursal') {
                  const { exportBranchActivity } = await import('./exportActivity')
                  await exportBranchActivity(branchRows, filters, scopeName)
                  return `✓ Excel descargado: ${branchRows.length} sucursales`
                }
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

      {inBranch && search.sucursal !== undefined && (
        <BranchDrillBar
          order={order ?? []}
          current={search.sucursal}
          name={scopeName}
          onBack={backToSummary}
          onStep={stepBranch}
        />
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-ink/60">
          <span className="font-display text-3xl font-bold text-ink" data-testid="total">
            {totals.total}
          </span>{' '}
          {totals.total === 1 ? 'contacto' : 'contactos'} · {periodLabel}
        </p>
        {current && (
          <div className="flex flex-wrap gap-1.5 text-sm text-ink/55" data-testid="branch-kpis">
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-ink/10">
              <b className="text-ink">
                {current.actors} de {current.staff}
              </b>{' '}
              personas contactaron
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-ink/10">
              <b className="text-ink">{current.total ? Math.round((current.effective / current.total) * 100) : 0}%</b> efectivos
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-ink/10">
              <b className="text-ink">{current.sales}</b> {current.sales === 1 ? 'venta' : 'ventas'}
            </span>
          </div>
        )}
        {activity.isFetching && <span className="text-sm text-ink/40">Actualizando…</span>}
      </div>

      {activity.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">No se pudo cargar. {(activity.error as Error).message}</p>
      ) : activity.data && (rows.length === 0 || totals.total === 0) ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          Nadie registró contactos en este período.
        </p>
      ) : null}

      {tabsVisible && (
        // Las pestañas siguen visibles dentro de una sucursal: «Por sucursal» (o la ✕) vuelve al resumen.
        <div className="flex items-end gap-1 border-b-2 border-ink px-2" role="tablist" aria-label="Agrupar por">
          <button
            type="button"
            role="tab"
            aria-selected={!inBranch && tab === 'sucursal'}
            onClick={() => (inBranch ? backToSummary() : setSearch({ agrupar: undefined, orden: undefined }))}
            className={`min-h-11 whitespace-nowrap rounded-t-2xl px-4 font-semibold sm:px-5 ${!inBranch && tab === 'sucursal' ? 'bg-ink text-gold-light' : 'bg-sand text-ink/60'}`}
          >
            Por sucursal
          </button>
          <div
            className={`flex min-h-11 items-center rounded-t-2xl font-semibold ${inBranch || tab === 'persona' ? 'bg-ink text-gold-light' : 'bg-sand text-ink/60'}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={inBranch || tab === 'persona'}
              onClick={() => !inBranch && setSearch({ agrupar: 'persona', orden: undefined })}
              className="min-h-11 whitespace-nowrap px-4 sm:px-5"
            >
              Por persona
              {/* En el celular el nombre ya está en la barra de arriba */}
              {inBranch && <span className="hidden sm:inline"> · {scopeName}</span>}
            </button>
            {inBranch && (
              <button
                type="button"
                onClick={backToSummary}
                aria-label="Quitar sucursal y volver al resumen"
                className="mr-2 grid h-7 w-7 place-items-center rounded-full bg-white/15 hover:bg-white/25"
              >
                <MdClose aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'sucursal' && (
        <BranchActivityTable
          rows={branchRows}
          onSort={onSort}
          ariaSort={ariaSort}
          arrow={arrow}
          onPick={enterBranch}
          highlight={flash}
        />
      )}

      {tab === 'persona' && rows.length > 0 && (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5">
          <table className="w-full min-w-[66rem] text-sm" aria-label="Actividad por persona">
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
                    <td
                      key={m.key}
                      className={`px-3 py-2.5 text-right tabular-nums group-even:bg-cream/60 ${m.key === 'total' ? 'font-semibold' : ''} ${m.key === 'assigned' ? 'bg-gold/5' : ''}`}
                    >
                      {m.key === 'assigned' && r.assigned > 0 ? (
                        // Asignados (spec 012): el número abre la pestaña Asignados; debajo, cuántos contactó.
                        <>
                          <button
                            type="button"
                            onClick={() => open(r.actor_id, 'assigned')}
                            aria-label={`${m.label} de ${r.full_name}: ${r.assigned}`}
                            className="min-w-8 rounded-lg px-1.5 py-0.5 font-semibold hover:bg-gold/15 hover:text-gold-dark hover:underline"
                          >
                            {r.assigned}
                          </button>
                          <AssignedPct n={r.assigned} done={r.assigned_contacted} />
                        </>
                      ) : r[m.key] > 0 ? (
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
                    {m.key === 'assigned' && totals.assigned > 0 && <AssignedPct n={totals.assigned} done={assignedContacted} />}
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
          assignedCount={person?.assigned}
          onMetric={(m) => setSearch({ metrica: m })}
          onClose={() => setSearch({ persona: undefined, metrica: undefined })}
        />
      )}
    </main>
  )
}

/** «9 contactados · 75%» bajo el número de Asignados; en rojo si contactó a menos del 70%. */
function AssignedPct({ n, done }: { n: number; done: number }) {
  const pct = Math.round((done * 100) / n)
  return (
    <span className={`block whitespace-nowrap text-[11px] font-medium ${pct < 70 ? 'text-rb-red' : 'text-ink/45'}`}>
      {done} contactados · {pct}%
    </span>
  )
}

export default ActivityView
