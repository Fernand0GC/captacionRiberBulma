import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { groupChannels } from '@/features/capture/channelGroups'
import { ROLE_LABEL } from '@/features/auth/types'
import { Badge } from '@/ui/Badge'
import { useToast } from '@/ui/Toast'
import {
  PAGE_SIZE,
  useAssign,
  useAssignees,
  useBranches,
  useChannels,
  useProspects,
  useStaff,
  type ProspectRow,
} from './api'
import { fmtDate, fmtTime, INTEREST_LABEL, STAGE_LABEL } from './format'
import { MdFileDownload } from 'react-icons/md'
import { PageTitle } from '@/ui/PageTitle'
import { periodRange, validateManageSearch, type ManageSearch, type Period } from './search'

const PERIOD_LABEL: Record<Period, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  '7d': '7 días',
  mes: 'Este mes',
  rango: 'Rango',
}

const selectCls =
  'min-h-11 w-full appearance-none rounded-xl border border-ink/15 bg-white px-3 text-base outline-none focus:border-gold focus:ring-4 focus:ring-gold/20'

/** Debounce simple para la búsqueda (no dispara una consulta por tecla). */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function ProspectsPage() {
  const { profile } = useAuth()
  const branchScope = useBranchScope()
  const isGlobal = branchScope.canPick
  const search = validateManageSearch(useSearch({ strict: false }) as Record<string, unknown>)
  const navigate = useNavigate()
  const setSearch = (patch: Partial<ManageSearch>) =>
    void navigate({ to: '/gestion', search: { ...search, pagina: undefined, ...patch }, replace: true })

  // La búsqueda por nombre/celular vive solo en el estado de la pantalla, nunca en la URL (constitución IV).
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q.trim())

  const { from, to } = periodRange(search)
  const page = search.pagina ?? 1
  const sucursal = search.sucursal ?? branchScope.fallback
  const branchId = isGlobal ? sucursal : (profile?.branch_id ?? undefined)
  // React Query compara la clave por valor: no hace falta memoizar.
  const filters = {
    from,
    to,
    branch_id: isGlobal ? sucursal : undefined,
    created_by: search.autor,
    channel_id: search.canal === 'sin' ? ('none' as const) : search.canal,
    q: qDebounced.length >= 2 ? qDebounced : undefined,
    assigned: search.responsable === 'sin' ? 'none' : search.responsable,
    stage: search.etapa,
    view: search.ver === 'visitas' ? ('visits' as const) : undefined,
  }

  const prospects = useProspects(filters, page)
  const staff = useStaff()
  const branches = useBranches()
  const channels = useChannels()

  const branchName = branches.data?.find((b) => b.id === profile?.branch_id)?.name
  const staffInScope = (staff.data ?? []).filter((s) => branchId === undefined || s.branch_id === branchId)
  const total = prospects.data?.total ?? 0

  // Selección para asignar responsable (FR-035). Se asigna dentro de una sucursal.
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  async function onExport() {
    setExporting(true)
    try {
      const { exportProspects } = await import('@/features/export/exportProspects')
      const scope = isGlobal
        ? (branches.data?.find((b) => b.id === sucursal)?.name ?? 'TODAS')
        : (branchName ?? 'sucursal')
      const n = await exportProspects(filters, scope)
      toast(`✓ Excel descargado: ${n} captaciones`, 'success')
    } catch (e) {
      toast((e as Error).message || 'No se pudo exportar', 'error')
    } finally {
      setExporting(false)
    }
  }
  const assign = useAssign()
  const assignees = useAssignees(branchId)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTo, setAssignTo] = useState('')
  const rowsOnPage = prospects.data?.rows ?? []
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allOnPage = rowsOnPage.length > 0 && rowsOnPage.every((r) => selected.has(r.id))
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(rowsOnPage.map((r) => r.id)))
  // Reparto de la tarde (FR-039b): en partes iguales entre las auxiliares de la sucursal.
  const auxiliaries = (assignees.data ?? []).filter((a) => a.role === 'field_assistant')
  async function doAssign() {
    try {
      if (assignTo === 'split') {
        const ids = [...selected]
        const buckets = auxiliaries.map((a, i) => ({
          to: a.id,
          ids: ids.filter((_, j) => j % auxiliaries.length === i),
        }))
        for (const b of buckets) if (b.ids.length) await assign.mutateAsync({ ids: b.ids, to: b.to })
        toast(`✓ ${ids.length} repartidas entre ${auxiliaries.length} auxiliares`, 'success')
        setSelected(new Set())
        setAssignTo('')
        return
      }
      const n = await assign.mutateAsync({ ids: [...selected], to: assignTo === 'none' ? null : assignTo })
      toast(assignTo === 'none' ? `✓ ${n} sin responsable` : `✓ ${n} asignadas`, 'success')
      setSelected(new Set())
      setAssignTo('')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title={search.ver === 'visitas' ? 'Visitas pactadas' : 'Captaciones'}
        subtitle={isGlobal ? (branches.data?.find((b) => b.id === sucursal)?.name ?? 'Todas las sucursales') : branchName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onExport()}
              disabled={exporting || !prospects.data?.total}
              className="bg-gold-gradient flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink shadow-sm disabled:opacity-50"
            >
              <MdFileDownload className="text-lg" aria-hidden />
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </button>
            <div className="flex rounded-full bg-white p-1 ring-1 ring-ink/10" role="group" aria-label="Ver">
              {[
                { v: undefined, label: 'Captaciones' },
                { v: 'visitas' as const, label: 'Visitas pactadas' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={search.ver === o.v}
                  onClick={() => setSearch({ ver: o.v })}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold ${search.ver === o.v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        }
      />
      {/* Filtros */}
      <section
        className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5"
        aria-label="Filtros"
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => {
            const active = (search.periodo ?? 'hoy') === p
            return (
              <button
                key={p}
                type="button"
                aria-pressed={active}
                onClick={() => setSearch({ periodo: p })}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
                  active ? 'bg-ink text-gold-light' : 'bg-sand text-ink/70 active:bg-ink/10'
                }`}
              >
                {PERIOD_LABEL[p]}
              </button>
            )
          })}
          {search.periodo === 'rango' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Desde"
                value={from}
                onChange={(e) => setSearch({ desde: e.target.value || undefined })}
                className="min-h-10 rounded-xl border border-ink/15 px-2"
              />
              <span className="text-ink/40">a</span>
              <input
                type="date"
                aria-label="Hasta"
                value={to}
                min={from}
                onChange={(e) => setSearch({ hasta: e.target.value || undefined })}
                className="min-h-10 rounded-xl border border-ink/15 px-2"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input
            type="search"
            aria-label="Buscar por nombre o celular"
            placeholder="Buscar nombre, celular o lugar…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              if (search.pagina) setSearch({})
            }}
            className="min-h-11 rounded-xl border border-ink/15 bg-white px-3 text-base outline-none placeholder:text-ink/35 focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
          {isGlobal && (
            <select
              aria-label="Sucursal"
              className={selectCls}
              value={sucursal ?? ''}
              onChange={(e) =>
                setSearch({ sucursal: e.target.value ? Number(e.target.value) : undefined, autor: undefined })
              }
            >
              {branchScope.allowAll && <option value="">Todas las sucursales</option>}
              {branchScope.options?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Registrado por"
            className={selectCls}
            value={search.autor ?? ''}
            onChange={(e) => setSearch({ autor: e.target.value || undefined })}
          >
            <option value="">Registrado por: todos</option>
            {staffInScope.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({ROLE_LABEL[s.role]}){s.active ? '' : ' · baja'}
              </option>
            ))}
          </select>
          <select
            aria-label="Responsable"
            className={selectCls}
            value={search.responsable ?? ''}
            onChange={(e) => setSearch({ responsable: e.target.value || undefined })}
          >
            <option value="">Responsable: todos</option>
            <option value="sin">Sin asignar</option>
            {staffInScope
              .filter(
                (s) =>
                  s.role === 'field_assistant' ||
                  s.role === 'field_supervisor' ||
                  s.role === 'branch_manager',
              )
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
          </select>
          <select
            aria-label="Etapa"
            className={selectCls}
            value={search.etapa ?? ''}
            onChange={(e) => setSearch({ etapa: e.target.value || undefined })}
          >
            <option value="">Etapa: todas</option>
            {Object.entries(STAGE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Canal"
            className={selectCls}
            value={search.canal ?? ''}
            onChange={(e) =>
              setSearch({
                canal: e.target.value === 'sin' ? 'sin' : e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">Canal: todos</option>
            <option value="sin">Sin canal</option>
            {groupChannels(channels.data ?? []).map((block) => (
              <optgroup key={block.label} label={block.label}>
                {block.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </section>

      {selected.size > 0 && (
        <div
          className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-ink p-3 text-white shadow-xl"
          role="region"
          aria-label="Asignar"
        >
          <span className="font-semibold">{selected.size} seleccionadas</span>
          {branchId === undefined ? (
            <span className="text-sm text-white/70">Elige una sucursal en el filtro para asignar.</span>
          ) : (
            <>
              <select
                aria-label="Asignar a"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="min-h-10 rounded-xl bg-white px-3 text-ink"
              >
                <option value="">Asignar a…</option>
                {auxiliaries.length > 1 && (
                  <option value="split">Repartir entre las {auxiliaries.length} auxiliares</option>
                )}
                {assignees.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({ROLE_LABEL[a.role]})
                  </option>
                ))}
                <option value="none">— Quitar responsable</option>
              </select>
              <button
                type="button"
                disabled={!assignTo || assign.isPending}
                onClick={() => void doAssign()}
                className="bg-gold-gradient min-h-10 rounded-xl px-4 font-semibold text-ink disabled:opacity-50"
              >
                {assign.isPending ? 'Asignando…' : 'Asignar'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-sm text-white/70 underline"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Cantidad por canal: chips que además filtran (con todos los demás filtros aplicados). */}
      {prospects.data && prospects.data.by_channel.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Por canal">
          <button
            type="button"
            aria-pressed={search.canal === undefined}
            onClick={() => setSearch({ canal: undefined })}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
              search.canal === undefined
                ? 'bg-ink text-gold-light'
                : 'bg-white text-ink/70 ring-1 ring-ink/10'
            }`}
          >
            Todos{' '}
            <span className="tabular-nums opacity-70">
              {prospects.data.by_channel.reduce((a, c) => a + c.n, 0)}
            </span>
          </button>
          {groupChannels(
            prospects.data.by_channel.map((c) => ({
              ...c,
              group: channels.data?.find((x) => x.id === c.channel_id)?.group ?? null,
            })),
          ).map((block) => (
            <span key={block.label} className="contents" data-testid={`group-${block.label}`}>
              <span className="flex min-h-10 items-center pl-2 text-xs font-bold uppercase tracking-widest text-ink/55">
                {block.label}{' '}
                <span className="ml-1 tabular-nums">{block.items.reduce((a, c) => a + c.n, 0)}</span>
              </span>
              {block.items.map((c) => {
                const value = c.channel_id ?? ('sin' as const)
                const active = search.canal === value
                return (
                  <button
                    key={c.name}
                    type="button"
                    aria-pressed={active}
                    data-testid={`chip-${c.name}`}
                    onClick={() => setSearch({ canal: active ? undefined : value })}
                    className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
                      active
                        ? 'bg-gold-gradient text-ink shadow-gold'
                        : 'bg-white text-ink/70 ring-1 ring-ink/10 active:bg-sand'
                    }`}
                  >
                    {c.name} <span className="tabular-nums opacity-70">{c.n}</span>
                  </button>
                )
              })}
            </span>
          ))}
        </div>
      )}

      {/* Resumen */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-ink/60">
          <span className="font-display text-3xl font-bold text-ink" data-testid="total">
            {total}
          </span>{' '}
          {total === 1 ? 'captación' : 'captaciones'} ·{' '}
          {from === to ? fmtDay(from) : `${fmtDay(from)} al ${fmtDay(to)}`}
        </p>
        {prospects.isFetching && <span className="text-sm text-ink/40">Actualizando…</span>}
      </div>

      {prospects.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">
          No se pudo cargar. {(prospects.error as Error).message}
        </p>
      ) : prospects.data && prospects.data.rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          No hay captaciones con estos filtros.
        </p>
      ) : (
        <>
          <ProspectsTable
            rows={rowsOnPage}
            showBranch={isGlobal}
            selected={selected}
            onToggle={toggle}
            allSelected={allOnPage}
            onToggleAll={toggleAll}
          />
          <ProspectsCards rows={rowsOnPage} showBranch={isGlobal} selected={selected} onToggle={toggle} />
        </>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Páginas">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setSearch({ pagina: page - 1 > 1 ? page - 1 : undefined })}
            className="min-h-11 rounded-full px-5 font-semibold ring-1 ring-ink/15 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-ink/60">
            Página {page} de {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setSearch({ pagina: page + 1 })}
            className="min-h-11 rounded-full px-5 font-semibold ring-1 ring-ink/15 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </nav>
      )}
    </main>
  )
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function Interest({ v }: { v: ProspectRow['interest'] }) {
  if (!v) return <span className="text-ink/30">—</span>
  return (
    <Badge tone={v === 'high' ? 'success' : v === 'medium' ? 'warning' : 'neutral'}>
      {INTEREST_LABEL[v]}
    </Badge>
  )
}

type SelectProps = { selected: Set<string>; onToggle: (id: string) => void }

function Assigned({ r }: { r: ProspectRow }) {
  return r.assigned_to_name ? (
    <span>{r.assigned_to_name}</span>
  ) : (
    <span className="text-ink/35">Sin asignar</span>
  )
}

function StageCell({ r }: { r: ProspectRow }) {
  return (
    <span className="whitespace-nowrap">
      {STAGE_LABEL[r.stage] ?? r.stage}
      {r.contact_attempts > 0 && r.stage !== 'lost' && (
        <span className="text-xs text-ink/45"> · {r.contact_attempts}/3</span>
      )}
      {r.visit_at && (
        <span className="block text-xs font-semibold text-gold-dark">
          Pasará {fmtDate(r.visit_at)} {fmtTime(r.visit_at)}
        </span>
      )}
    </span>
  )
}

function ProspectsTable({
  rows,
  showBranch,
  selected,
  onToggle,
  allSelected,
  onToggleAll,
}: {
  rows: ProspectRow[]
  showBranch: boolean
  allSelected: boolean
  onToggleAll: () => void
} & SelectProps) {
  return (
    <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 md:block">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="bg-ink text-gold-light">
          <tr>
            <th scope="col" className="w-10 rounded-tl-3xl px-4 py-3">
              <input
                type="checkbox"
                aria-label="Seleccionar todas"
                checked={allSelected}
                onChange={onToggleAll}
                className="h-4 w-4 accent-gold"
              />
            </th>
            {[
              'Fecha',
              'Hora',
              'Cliente',
              'Celular',
              'Producto',
              'Interés',
              'Canal',
              ...(showBranch ? ['Sucursal'] : []),
              'Registrado por',
              'Etapa',
              'Responsable',
            ].map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold last:rounded-tr-3xl">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-t border-ink/5 ${selected.has(r.id) ? 'bg-gold/10' : 'even:bg-cream/60'}`}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar ${r.full_name}`}
                  checked={selected.has(r.id)}
                  onChange={() => onToggle(r.id)}
                  className="h-4 w-4 accent-gold"
                />
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fmtDate(r.client_created_at)}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fmtTime(r.client_created_at)}</td>
              <td className="px-4 py-3 font-semibold">
                <Link
                  to="/cliente/$id"
                  params={{ id: r.id }}
                  className="hover:text-gold-dark hover:underline"
                >
                  {r.full_name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.phone_raw}</td>
              <td className="px-4 py-3">{r.product_name ?? <span className="text-ink/30">—</span>}</td>
              <td className="px-4 py-3">
                <Interest v={r.interest} />
              </td>
              <td className="px-4 py-3">
                {r.channel_name ?? <span className="text-ink/30">—</span>}
                {r.channel_detail && <span className="block text-sm text-ink/55">{r.channel_detail}</span>}
              </td>
              {showBranch && <td className="px-4 py-3">{r.branch_name}</td>}
              <td className="px-4 py-3">
                <span className="font-medium">{r.created_by_name}</span>
                <span className="block text-xs text-ink/45">{ROLE_LABEL[r.created_by_role]}</span>
              </td>
              <td className="px-4 py-3">
                <StageCell r={r} />
              </td>
              <td className="px-4 py-3">
                <Assigned r={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProspectsCards({
  rows,
  showBranch,
  selected,
  onToggle,
}: { rows: ProspectRow[]; showBranch: boolean } & SelectProps) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((r) => (
        <li
          key={r.id}
          className={`rounded-3xl p-4 shadow-sm ring-1 ${selected.has(r.id) ? 'bg-gold/10 ring-gold/40' : 'bg-white ring-ink/5'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <input
              type="checkbox"
              aria-label={`Seleccionar ${r.full_name}`}
              checked={selected.has(r.id)}
              onChange={() => onToggle(r.id)}
              className="mt-1 h-5 w-5 shrink-0 accent-gold"
            />
            <div className="min-w-0 flex-1">
              <Link
                to="/cliente/$id"
                params={{ id: r.id }}
                className="font-semibold hover:text-gold-dark hover:underline"
              >
                {r.full_name}
              </Link>
              <p className="tabular-nums text-ink/70">{r.phone_raw}</p>
            </div>
            <Interest v={r.interest} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/60">
            <span
              className={`rounded-full px-3 py-0.5 font-semibold ${r.channel_name ? 'bg-ink text-gold-light' : 'bg-sand text-ink/45'}`}
            >
              Canal: {r.channel_name ?? 'sin canal'}
            </span>
            {r.channel_detail && <span className="text-ink/70">{r.channel_detail}</span>}
            {[r.product_name, showBranch ? r.branch_name : null].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-2 border-t border-ink/5 pt-2 text-sm text-ink/55">
            <span className="tabular-nums">
              {fmtDate(r.client_created_at)} {fmtTime(r.client_created_at)}
            </span>{' '}
            · {r.created_by_name} ({ROLE_LABEL[r.created_by_role]})
          </p>
          <p className="mt-1 flex flex-wrap justify-between gap-2 text-sm">
            <StageCell r={r} />
            <Assigned r={r} />
          </p>
        </li>
      ))}
    </ul>
  )
}
