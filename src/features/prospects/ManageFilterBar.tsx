import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { ROLE_LABEL } from '@/features/auth/types'
import { groupChannels } from '@/features/capture/channelGroups'
import { useChannels, useStaff, type Staff } from './api'
import { STAGE_LABEL } from './format'
import {
  MONITORING_KEYS,
  periodRange,
  validateManageSearch,
  type ManageSearch,
  type ManageView,
  type Period,
} from './search'

// Piezas comunes de /gestion: alcance de sucursal, filtros y selector de vista (Captaciones, Visitas, Seguimientos, Actividad).

export const PERIOD_LABEL: Record<Period, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  '7d': '7 días',
  mes: 'Este mes',
  rango: 'Rango',
}

export const selectCls =
  'min-h-11 w-full appearance-none rounded-xl border border-ink/15 bg-white px-3 text-base outline-none focus:border-gold focus:ring-4 focus:ring-gold/20'

/** Debounce simple para la búsqueda (no dispara una consulta por tecla). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** push: agrega un paso al historial (el «atrás» del celular vuelve acá). Por defecto reemplaza la URL. */
export type SetManageSearch = (patch: Partial<ManageSearch>, opts?: { push?: boolean }) => void

/** Filtros de la URL, período y sucursal efectiva de quien gestiona. */
export function useManageScope() {
  const { profile } = useAuth()
  const branchScope = useBranchScope()
  const isGlobal = branchScope.canPick
  const search = validateManageSearch(useSearch({ strict: false }) as Record<string, unknown>)
  const navigate = useNavigate()
  const setSearch: SetManageSearch = (patch, opts) =>
    void navigate({ to: '/gestion', search: { ...search, pagina: undefined, ...patch }, replace: !opts?.push })
  const { from, to } = periodRange(search)
  const sucursal = search.sucursal ?? branchScope.fallback
  const branchId = isGlobal ? sucursal : (profile?.branch_id ?? undefined)
  const branches = branchScope.branches.data
  const branchName = branches?.find((b) => b.id === profile?.branch_id)?.name
  /** Nombre del alcance para títulos y Excel. */
  const scopeName = isGlobal
    ? (branches?.find((b) => b.id === sucursal)?.name ?? 'Todas las sucursales')
    : (branchName ?? 'sucursal')
  return { profile, branchScope, isGlobal, search, setSearch, from, to, sucursal, branchId, branchName, scopeName }
}

export type ManageScope = ReturnType<typeof useManageScope>

const VIEW_OPTIONS: { v: ManageView | undefined; label: string }[] = [
  { v: undefined, label: 'Captaciones' },
  { v: 'visitas', label: 'Visitas pactadas' },
  { v: 'seguimiento', label: 'Seguimientos' },
  { v: 'actividad', label: 'Actividad' },
  { v: 'dia', label: 'Del día' },
]

export const VIEW_TITLE: Record<ManageView | 'captaciones', string> = {
  captaciones: 'Captaciones',
  visitas: 'Visitas pactadas',
  seguimiento: 'Seguimientos',
  actividad: 'Actividad',
  dia: 'Del día',
}

/** Selector de vista. Conserva período y sucursal; limpia lo propio de cada vista. */
export function ViewSwitch({ search, setSearch }: { search: ManageSearch; setSearch: SetManageSearch }) {
  const change = (v: ManageView | undefined) => {
    const cleared = Object.fromEntries(MONITORING_KEYS.map((k) => [k, undefined])) as Partial<ManageSearch>
    // La etapa de Captaciones no aplica en Seguimientos (la reemplazan las pestañas) ni en Actividad.
    setSearch({ ...cleared, etapa: undefined, ver: v })
  }
  return (
    <div className="-mx-1 max-w-[calc(100vw-2rem)] overflow-x-auto px-1 sm:max-w-full">
      <div className="flex w-max rounded-full bg-white p-1 ring-1 ring-ink/10" role="group" aria-label="Ver">
        {VIEW_OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={search.ver === o.v}
            onClick={() => change(o.v)}
            className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${search.ver === o.v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export type FilterBarShow = {
  search?: boolean
  author?: boolean
  assignee?: boolean
  stage?: boolean
  channel?: boolean
}

/** Barra de filtros de /gestion. `show` elige qué controles aparecen además de período y sucursal. */
export function ManageFilterBar({
  scope,
  q,
  setQ,
  show = {},
  children,
}: {
  scope: ManageScope
  q?: string
  setQ?: (v: string) => void
  show?: FilterBarShow
  children?: ReactNode
}) {
  const { search, setSearch, from, to, isGlobal, sucursal, branchScope, branchId } = scope
  const staff = useStaff()
  const channels = useChannels()
  const staffInScope: Staff[] = (staff.data ?? []).filter((s) => branchId === undefined || s.branch_id === branchId)

  return (
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {show.search && setQ && (
          <input
            type="search"
            aria-label="Buscar por nombre o celular"
            placeholder="Buscar nombre, celular o lugar…"
            value={q ?? ''}
            onChange={(e) => {
              setQ(e.target.value)
              if (search.pagina) setSearch({})
            }}
            className="min-h-11 rounded-xl border border-ink/15 bg-white px-3 text-base outline-none placeholder:text-ink/35 focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
        )}
        {isGlobal && (
          <select
            aria-label="Sucursal"
            className={selectCls}
            value={sucursal ?? ''}
            onChange={(e) =>
              setSearch({
                sucursal: e.target.value ? Number(e.target.value) : undefined,
                autor: undefined,
                responsable: undefined,
                persona: undefined,
                metrica: undefined,
              })
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
        {show.author && (
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
        )}
        {show.assignee && (
          <select
            aria-label="Responsable"
            className={selectCls}
            value={search.responsable ?? ''}
            onChange={(e) => setSearch({ responsable: e.target.value || undefined })}
          >
            <option value="">Responsable: todos</option>
            <option value="sin">Sin asignar</option>
            {staffInScope
              .filter((s) => s.role === 'field_assistant' || s.role === 'field_supervisor' || s.role === 'branch_manager')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
          </select>
        )}
        {show.stage && (
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
        )}
        {show.channel && (
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
        )}
        {children}
      </div>
    </section>
  )
}
