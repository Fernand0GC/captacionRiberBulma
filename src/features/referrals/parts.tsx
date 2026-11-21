import { useNavigate, useSearch } from '@tanstack/react-router'
import { MdArrowDownward, MdArrowUpward } from 'react-icons/md'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { defaultDir, isSortKey, type SortKey } from './logic'
import { referralRange, validateReferralSearch, type ReferralSearch } from './search'

// Piezas compartidas de Referidos (spec 014): alcance de la URL, pestañas y títulos ordenables.

export const inputCls =
  'min-h-10 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/20'
export const th = 'py-2 pr-3 font-semibold'
export const td = 'py-2 pr-3 tabular-nums'

export type SetReferralSearch = (patch: Partial<ReferralSearch>, opts?: { push?: boolean }) => void

/** Filtros de la URL + sucursal efectiva. `branch` undefined = varias sucursales (todas las del alcance). */
export function useReferralScope() {
  const scope = useBranchScope()
  const search = validateReferralSearch(useSearch({ strict: false }) as Record<string, unknown>)
  const navigate = useNavigate()
  const setSearch: SetReferralSearch = (patch, opts) =>
    void navigate({ to: '/referidos', search: { ...search, ...patch }, replace: !opts?.push })
  const range = referralRange(search)
  const options = scope.options ?? []
  // Gerencia: sin elegir = todas. Jefe: sin elegir = la primera; «todas» solo si tiene varias.
  const canAll = scope.allowAll || options.length > 1
  const multiLead = !scope.allowAll && options.length > 1
  const chosen = search.sucursal !== undefined && options.some((b) => b.id === search.sucursal) ? search.sucursal : undefined
  const branch = scope.allowAll ? chosen : search.todas && multiLead ? undefined : (chosen ?? scope.fallback ?? options[0]?.id)
  const allLabel = scope.allowAll ? 'Todas las sucursales' : 'Todas mis sucursales'
  const branchName = branch === undefined ? allLabel : options.find((b) => b.id === branch)?.name
  const ready = scope.options !== undefined
  return { search, setSearch, range, options, canAll, multiLead, branch, branchName, allLabel, ready, allowAll: scope.allowAll }
}

export type ReferralScope = ReturnType<typeof useReferralScope>

/** Cambia de sucursal (undefined = todas). Limpia los filtros que dependen de la sucursal. */
export function pickBranch(s: ReferralScope, id: number | undefined, opts?: { push?: boolean }) {
  s.setSearch(
    {
      sucursal: id,
      todas: id === undefined && s.multiLead ? true : undefined,
      referidor: undefined,
      responsable: undefined,
      autor: undefined,
    },
    opts,
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T
  onChange: (v: T) => void
  items: { v: T; label: string }[]
  label: string
}) {
  return (
    <div className="flex flex-wrap rounded-full bg-white p-1 ring-1 ring-ink/10" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.v}
          type="button"
          role="tab"
          aria-selected={value === t.v}
          onClick={() => onChange(t.v)}
          className={`min-h-9 rounded-full px-4 text-sm font-semibold ${value === t.v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Título de columna que ordena (FR-007): un toque ordena, otro invierte. El orden vive en la URL. */
export function SortHeader({ k, label, s }: { k: SortKey; label: string; s: ReferralScope }) {
  const active = isSortKey(s.search.orden) && s.search.orden === k
  const dir = active ? (s.search.dir ?? defaultDir(k)) : undefined
  const next = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir(k)
  return (
    <th scope="col" className={th} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button
        type="button"
        onClick={() => s.setSearch({ orden: k, dir: next })}
        className={`inline-flex items-center gap-0.5 text-left hover:text-ink ${active ? 'text-ink' : ''}`}
      >
        {label}
        {dir === 'asc' && <MdArrowUpward aria-hidden />}
        {dir === 'desc' && <MdArrowDownward aria-hidden />}
      </button>
    </th>
  )
}
