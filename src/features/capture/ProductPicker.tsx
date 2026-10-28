import { useMemo, useState } from 'react'
import { matchesAll } from '@/lib/search'
import { GROUP_LABEL, type Catalogs, type ProductGroup } from './useCatalogs'

const GROUPS: ProductGroup[] = ['phones', 'major_appliances', 'small_appliances']

export function ProductPicker({
  catalogs,
  value,
  onChange,
}: {
  catalogs: Catalogs
  value: number | null
  onChange: (productId: number | null) => void
}) {
  const [group, setGroup] = useState<ProductGroup | null>(null)
  const [query, setQuery] = useState('')

  const byGroup = useMemo(() => {
    const m = new Map<ProductGroup, Catalogs['products']>()
    for (const p of catalogs.products) m.set(p.group, [...(m.get(p.group) ?? []), p])
    return m
  }, [catalogs.products])

  const results = useMemo(
    () => (query.trim().length >= 2 ? catalogs.products.filter((p) => matchesAll(p.search, query)) : null),
    [query, catalogs.products],
  )

  const pick = (id: number) => {
    onChange(id)
    setQuery('')
    setGroup(null)
  }

  if (value !== null) {
    const product = catalogs.products.find((p) => p.id === value)
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white">
        <div className="min-w-0">
          {product && product.group !== 'phones' && (
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-light/80">{GROUP_LABEL[product.group]}</p>
          )}
          <p className="text-lg font-semibold leading-snug" data-testid="product-choice">
            {product?.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold text-gold-light ring-1 ring-gold/40 active:bg-white/10"
        >
          Cambiar
        </button>
      </div>
    )
  }

  function onGroup(g: ProductGroup) {
    const items = byGroup.get(g) ?? []
    if (items.length === 1) return pick(items[0]!.id) // Celulares: una sola opción
    setGroup(group === g ? null : g)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/35">
          ⌕
        </span>
        <input
          type="search"
          inputMode="search"
          aria-label="Buscar producto"
          placeholder="Buscar: televisor, licuadora…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-13 w-full rounded-2xl border border-ink/15 bg-white pl-10 pr-4 text-lg outline-none transition placeholder:text-ink/30 focus:border-gold focus:ring-4 focus:ring-gold/20"
        />
      </div>

      {results ? (
        <div aria-label="Resultados" className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              className="min-h-11 rounded-full border border-ink/15 bg-white px-4 text-base active:border-gold active:bg-gold/10"
            >
              {p.name}
              {p.group !== 'phones' && <span className="text-ink/40"> · {GROUP_LABEL[p.group]}</span>}
            </button>
          ))}
          {results.length === 0 && <p className="px-1 text-ink/50">Sin resultados. Prueba con otra palabra.</p>}
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Grupo de producto" className="grid grid-cols-3 gap-2">
            {GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={group === g}
                onClick={() => onGroup(g)}
                className={`min-h-12 rounded-2xl border px-1 text-sm font-semibold leading-tight transition ${
                  group === g ? 'border-ink bg-ink text-gold-light' : 'border-ink/15 bg-white text-ink/75 active:bg-sand'
                }`}
              >
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          {group && (
            <div role="tabpanel" aria-label={GROUP_LABEL[group]} className="flex flex-wrap gap-2">
              {(byGroup.get(group) ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.id)}
                  className="min-h-11 rounded-full border border-ink/15 bg-white px-4 text-base active:border-gold active:bg-gold/10"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
