import { ROLE_LABEL } from '@/features/auth/types'
import { groupChannels } from '@/features/capture/channelGroups'
import { GROUP_LABEL, type ProductGroup } from '@/features/capture/useCatalogs'
import { useReferrers } from '@/features/referrals/api'
import { ColumnFilter, FilterOptions, type FilterOption } from '@/ui/ColumnFilter'
import { useChannels, useProducts } from './api'
import { STAGE_LABEL } from './format'
import { fmtDay, PERIOD_LABEL, useScopedStaff, type ManageScope } from './ManageFilterBar'
import type { Period } from './search'

// Títulos de la tabla de Captaciones con filtro. Escriben los mismos parámetros de la URL que la barra de arriba
// (una sola fuente), así que las dos siempre muestran lo mismo y el Excel respeta el filtro.

const th = 'p-0 font-semibold'

export function CaptureHeaders({
  scope,
  q,
  setQ,
  showBranch,
}: {
  scope: ManageScope
  q: string
  setQ: (v: string) => void
  showBranch: boolean
}) {
  const { search, setSearch, from, to, branchScope, branchId } = scope
  const staff = useScopedStaff(branchId)
  const channels = useChannels()
  const products = useProducts()
  // Referidores de la sucursal elegida (son de cada sucursal); con «Todas» solo «Solo referidos».
  const referrers = useReferrers(branchId)

  const period = search.periodo ?? 'hoy'
  const periodLabel = period === 'rango' ? (from === to ? fmtDay(from) : `${fmtDay(from)}–${fmtDay(to)}`) : PERIOD_LABEL[period]

  const channelOptions: FilterOption[] = [
    { value: 'sin', label: 'Sin canal', special: true },
    ...groupChannels(channels.data ?? []).flatMap((b) => b.items.map((c) => ({ value: String(c.id), label: c.name, group: b.label }))),
  ]
  const productOptions: FilterOption[] = (Object.keys(GROUP_LABEL) as ProductGroup[]).flatMap((g) =>
    (products.data ?? []).filter((p) => p.group === g).map((p) => ({ value: String(p.id), label: p.name, group: GROUP_LABEL[g] })),
  )
  const branchOptions: FilterOption[] = (branchScope.options ?? []).map((b) => ({ value: String(b.id), label: b.name }))
  const authorOptions: FilterOption[] = staff.all.map((s) => ({
    value: s.id,
    label: `${s.full_name} (${ROLE_LABEL[s.role]})${s.active ? '' : ' · baja'}`,
  }))
  const assigneeOptions: FilterOption[] = [
    { value: 'sin', label: 'Sin asignar', special: true },
    ...staff.assignees.map((s) => ({ value: s.id, label: s.full_name })),
  ]
  const referrerOptions: FilterOption[] = [
    { value: 'any', label: 'Solo referidos', special: true },
    ...(branchId === undefined ? [] : (referrers.data ?? []).filter((r) => r.merged_into == null).map((r) => ({ value: String(r.id), label: r.name }))),
  ]
  const referrerValue = search.origen !== 'referidos' ? undefined : search.referidor === undefined ? 'any' : String(search.referidor)
  const stageOptions: FilterOption[] = Object.entries(STAGE_LABEL).map(([value, label]) => ({ value, label }))
  const labelOf = (opts: FilterOption[], v: string | number | undefined) =>
    v === undefined ? undefined : opts.find((o) => o.value === String(v))?.label

  // Cambiar de sucursal limpia a las personas: son de la sucursal anterior (igual que la barra).
  const pickBranch = (v: string | undefined) => {
    if (v === undefined && !branchScope.allowAll) return
    setSearch({ sucursal: v ? Number(v) : undefined, autor: undefined, responsable: undefined, persona: undefined, metrica: undefined, referidor: undefined })
  }

  return (
    <>
      <th scope="col" className={th}>
        <ColumnFilter
          label="Fecha"
          active={period !== 'hoy'}
          valueLabel={periodLabel}
          onClear={() => setSearch({ periodo: undefined, desde: undefined, hasta: undefined })}
        >
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setSearch({ periodo: p })}
                className={`min-h-9 rounded-full px-3 font-semibold ${period === p ? 'bg-ink text-gold-light' : 'bg-sand text-ink/70'}`}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          {period === 'rango' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Desde"
                value={from}
                onChange={(e) => setSearch({ desde: e.target.value || undefined })}
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-ink/15 px-2"
              />
              <span className="text-ink/40">a</span>
              <input
                type="date"
                aria-label="Hasta"
                value={to}
                min={from}
                onChange={(e) => setSearch({ hasta: e.target.value || undefined })}
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-ink/15 px-2"
              />
            </div>
          )}
        </ColumnFilter>
      </th>
      <th scope="col" className={th}>
        <ColumnFilter label="Cliente" active={q.trim() !== ''} valueLabel={q.trim()} onClear={() => setQ('')}>
          <ClientSearch q={q} setQ={setQ} onChange={() => search.pagina && setSearch({})} />
        </ColumnFilter>
      </th>
      <th scope="col" className={th}>
        <ColumnFilter
          label="Producto"
          active={search.producto !== undefined}
          valueLabel={labelOf(productOptions, search.producto)}
          onClear={() => setSearch({ producto: undefined })}
        >
          <FilterOptions
            noun="producto"
            options={productOptions}
            value={search.producto === undefined ? undefined : String(search.producto)}
            onPick={(v) => setSearch({ producto: v ? Number(v) : undefined })}
          />
        </ColumnFilter>
      </th>
      <th scope="col" className={th}>
        <ColumnFilter
          label="Canal"
          active={search.canal !== undefined}
          valueLabel={labelOf(channelOptions, search.canal)}
          onClear={() => setSearch({ canal: undefined })}
        >
          <FilterOptions
            noun="canal"
            options={channelOptions}
            value={search.canal === undefined ? undefined : String(search.canal)}
            onPick={(v) => setSearch({ canal: v === 'sin' ? 'sin' : v ? Number(v) : undefined })}
          />
        </ColumnFilter>
      </th>
      <th scope="col" className={th}>
        <ColumnFilter
          label="Referido por"
          active={referrerValue !== undefined}
          valueLabel={labelOf(referrerOptions, referrerValue)}
          onClear={() => setSearch({ origen: undefined, referidor: undefined })}
        >
          <FilterOptions
            noun="referidor"
            options={referrerOptions}
            value={referrerValue}
            onPick={(v) =>
              setSearch({
                origen: v ? 'referidos' : undefined,
                referidor: v && v !== 'any' ? Number(v) : undefined,
              })
            }
          />
        </ColumnFilter>
      </th>
      {showBranch && (
        <th scope="col" className={th}>
          <ColumnFilter
            label="Sucursal"
            active={scope.sucursal !== undefined}
            valueLabel={labelOf(branchOptions, scope.sucursal)}
            onClear={branchScope.allowAll ? () => pickBranch(undefined) : undefined}
          >
            <FilterOptions
              noun="sucursal"
              options={branchOptions}
              value={scope.sucursal === undefined ? undefined : String(scope.sucursal)}
              onPick={pickBranch}
            />
          </ColumnFilter>
        </th>
      )}
      <th scope="col" className={th}>
        <ColumnFilter
          label="Registrado por"
          active={search.autor !== undefined}
          valueLabel={staff.all.find((s) => s.id === search.autor)?.full_name}
          onClear={() => setSearch({ autor: undefined })}
        >
          <FilterOptions noun="persona" options={authorOptions} value={search.autor} onPick={(v) => setSearch({ autor: v })} />
        </ColumnFilter>
      </th>
      <th scope="col" className={th}>
        <ColumnFilter
          label="Etapa"
          active={search.etapa !== undefined}
          valueLabel={labelOf(stageOptions, search.etapa)}
          onClear={() => setSearch({ etapa: undefined })}
        >
          <FilterOptions noun="etapa" options={stageOptions} value={search.etapa} onPick={(v) => setSearch({ etapa: v })} />
        </ColumnFilter>
      </th>
      <th scope="col" className={th}>
        <ColumnFilter
          label="Responsable"
          active={search.responsable !== undefined}
          valueLabel={labelOf(assigneeOptions, search.responsable)}
          onClear={() => setSearch({ responsable: undefined })}
        >
          <FilterOptions
            noun="responsable"
            options={assigneeOptions}
            value={search.responsable}
            onPick={(v) => setSearch({ responsable: v })}
          />
        </ColumnFilter>
      </th>
    </>
  )
}

/** Búsqueda del cliente: la misma de la barra (vive en el estado de la pantalla, nunca en la URL). */
function ClientSearch({ q, setQ, onChange }: { q: string; setQ: (v: string) => void; onChange: () => void }) {
  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          onChange()
        }}
        placeholder="Nombre, celular o lugar…"
        aria-label="Buscar cliente"
        className="min-h-10 rounded-xl border border-ink/15 px-3 text-base outline-none placeholder:text-ink/35 focus:border-gold focus:ring-4 focus:ring-gold/20"
      />
      <p className="text-xs text-ink/50">Desde 2 letras o números.</p>
    </>
  )
}
