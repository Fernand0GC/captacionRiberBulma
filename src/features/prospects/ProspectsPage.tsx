import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABEL } from '@/features/auth/types'
import { SHIFT_LABEL } from '@/lib/dates'
import { Badge } from '@/ui/Badge'
import { PAGE_SIZE, useBranches, useChannels, useProspects, useStaff, type ProspectRow } from './api'
import { fmtDate, fmtTime, INTEREST_LABEL } from './format'
import { PageTitle } from '@/app/ManageLayout'
import { periodRange, validateManageSearch, type ManageSearch, type Period } from './search'

const PERIOD_LABEL: Record<Period, string> = { hoy: 'Hoy', ayer: 'Ayer', '7d': '7 días', mes: 'Este mes', rango: 'Rango' }

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
  const isGlobal = profile?.role === 'general_manager' || profile?.role === 'admin'
  const search = validateManageSearch(useSearch({ strict: false }) as Record<string, unknown>)
  const navigate = useNavigate()
  const setSearch = (patch: Partial<ManageSearch>) =>
    void navigate({ to: '/gestion', search: { ...search, pagina: undefined, ...patch }, replace: true })

  // La búsqueda por nombre/celular vive solo en el estado de la pantalla, nunca en la URL (constitución IV).
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q.trim())

  const { from, to } = periodRange(search)
  const page = search.pagina ?? 1
  const branchId = isGlobal ? search.sucursal : (profile?.branch_id ?? undefined)
  // React Query compara la clave por valor: no hace falta memoizar.
  const filters = {
    from,
    to,
    branch_id: isGlobal ? search.sucursal : undefined,
    created_by: search.autor,
    channel_id: search.canal,
    q: qDebounced.length >= 2 ? qDebounced : undefined,
  }

  const prospects = useProspects(filters, page)
  const staff = useStaff()
  const branches = useBranches()
  const channels = useChannels()

  const branchName = branches.data?.find((b) => b.id === profile?.branch_id)?.name
  const staffInScope = (staff.data ?? []).filter((s) => branchId === undefined || s.branch_id === branchId)
  const total = prospects.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <PageTitle title="Captaciones" subtitle={isGlobal ? 'Todas las sucursales' : branchName} />
        {/* Filtros */}
        <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5" aria-label="Filtros">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="search"
              aria-label="Buscar por nombre o celular"
              placeholder="Buscar nombre o celular…"
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
                value={search.sucursal ?? ''}
                onChange={(e) => setSearch({ sucursal: e.target.value ? Number(e.target.value) : undefined, autor: undefined })}
              >
                <option value="">Todas las sucursales</option>
                {branches.data?.map((b) => (
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
              aria-label="Canal"
              className={selectCls}
              value={search.canal ?? ''}
              onChange={(e) => setSearch({ canal: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Canal: todos</option>
              {channels.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Resumen */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <p className="text-ink/60">
            <span className="font-display text-3xl font-bold text-ink" data-testid="total">
              {total}
            </span>{' '}
            {total === 1 ? 'captación' : 'captaciones'} · {from === to ? fmtDay(from) : `${fmtDay(from)} al ${fmtDay(to)}`}
          </p>
          {prospects.isFetching && <span className="text-sm text-ink/40">Actualizando…</span>}
        </div>

        {prospects.isError ? (
          <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">No se pudo cargar. {(prospects.error as Error).message}</p>
        ) : prospects.data && prospects.data.rows.length === 0 ? (
          <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">No hay captaciones con estos filtros.</p>
        ) : (
          <>
            <ProspectsTable rows={prospects.data?.rows ?? []} showBranch={isGlobal} />
            <ProspectsCards rows={prospects.data?.rows ?? []} showBranch={isGlobal} />
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
  return <Badge tone={v === 'high' ? 'success' : v === 'medium' ? 'warning' : 'neutral'}>{INTEREST_LABEL[v]}</Badge>
}

function ProspectsTable({ rows, showBranch }: { rows: ProspectRow[]; showBranch: boolean }) {
  return (
    <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 md:block">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="bg-ink text-gold-light">
          <tr>
            {['Fecha', 'Hora', 'Cliente', 'Celular', 'Producto', 'Interés', 'Canal', ...(showBranch ? ['Sucursal'] : []), 'Registrado por', 'Turno'].map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold first:rounded-tl-3xl last:rounded-tr-3xl">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-ink/5 even:bg-cream/60">
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fmtDate(r.client_created_at)}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fmtTime(r.client_created_at)}</td>
              <td className="px-4 py-3 font-semibold">{r.full_name}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.phone_raw}</td>
              <td className="px-4 py-3">{r.product_name ?? <span className="text-ink/30">—</span>}</td>
              <td className="px-4 py-3">
                <Interest v={r.interest} />
              </td>
              <td className="px-4 py-3">{r.channel_name ?? <span className="text-ink/30">—</span>}</td>
              {showBranch && <td className="px-4 py-3">{r.branch_name}</td>}
              <td className="px-4 py-3">
                <span className="font-medium">{r.created_by_name}</span>
                <span className="block text-xs text-ink/45">{ROLE_LABEL[r.created_by_role]}</span>
              </td>
              <td className="px-4 py-3">{SHIFT_LABEL[r.shift]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProspectsCards({ rows, showBranch }: { rows: ProspectRow[]; showBranch: boolean }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((r) => (
        <li key={r.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{r.full_name}</p>
              <p className="tabular-nums text-ink/70">{r.phone_raw}</p>
            </div>
            <Interest v={r.interest} />
          </div>
          <p className="mt-2 text-sm text-ink/60">
            {[r.product_name, r.channel_name, showBranch ? r.branch_name : null].filter(Boolean).join(' · ') || 'Sin producto ni canal'}
          </p>
          <p className="mt-2 border-t border-ink/5 pt-2 text-sm text-ink/55">
            <span className="tabular-nums">
              {fmtDate(r.client_created_at)} {fmtTime(r.client_created_at)}
            </span>{' '}
            · {r.created_by_name} ({ROLE_LABEL[r.created_by_role]})
          </p>
        </li>
      ))}
    </ul>
  )
}
