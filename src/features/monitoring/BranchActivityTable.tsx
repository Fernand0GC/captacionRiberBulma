import { branchTotals, perStaff, type ActivitySortKey } from './activity'
import type { BranchActivityRow } from './api'
import { ACTIVITY_METRICS } from './labels'

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '')
const avg = (v: number | null) => (v === null ? '—' : v.toLocaleString('es-BO', { maximumFractionDigits: 1 }))

/**
 * Pestaña «Por sucursal» de Actividad: una fila por sucursal (la del cliente), con su personal y promedio.
 * Tocar una sucursal la elige en el filtro y pasa a ver a su personal.
 */
export function BranchActivityTable({
  rows,
  onSort,
  ariaSort,
  arrow,
  onPick,
  highlight,
}: {
  rows: BranchActivityRow[]
  onSort: (key: ActivitySortKey) => void
  ariaSort: (key: ActivitySortKey) => 'ascending' | 'descending' | 'none'
  arrow: (key: ActivitySortKey) => string
  onPick: (branchId: number) => void
  /** Sucursal que se acaba de ver: se resalta un momento al volver. */
  highlight?: number
}) {
  const t = branchTotals(rows)
  const max = Math.max(1, ...rows.map((r) => r.total))

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5">
        <table className="w-full min-w-[60rem] text-sm" aria-label="Actividad por sucursal">
          <thead className="bg-ink text-gold-light">
            <tr>
              <th scope="col" aria-sort={ariaSort('full_name')} className="sticky left-0 z-10 bg-ink px-3 py-3 text-left">
                <button type="button" onClick={() => onSort('full_name')} className="font-semibold">
                  Sucursal{arrow('full_name')}
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold" title="Personas que contactaron, de los auxiliares, supervisores y encargados activos">
                Personal
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold" title="Contactos por persona activa de la sucursal">
                Prom./persona
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
              <tr
                key={r.branch_id}
                data-testid="branch-row"
                data-highlight={r.branch_id === highlight || undefined}
                className="group border-t border-ink/5 [&[data-highlight]>*]:bg-gold/35 [&>*]:transition-colors [&>*]:duration-700"
              >
                <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-normal group-even:bg-cream">
                  <button
                    type="button"
                    onClick={() => onPick(r.branch_id)}
                    className="text-left font-semibold hover:text-gold-dark hover:underline"
                  >
                    {r.name}
                    <span aria-hidden className="ml-1 text-gold-dark">
                      ›
                    </span>
                  </button>
                  {/* Barrita: peso de la sucursal en el total del período */}
                  <span className="mt-1 block h-1 w-28 overflow-hidden rounded-full bg-sand" aria-hidden>
                    <span className="block h-full bg-gold" style={{ width: `${(r.total / max) * 100}%` }} />
                  </span>
                </th>
                <td className="px-3 py-2.5 text-right tabular-nums group-even:bg-cream/60">
                  {r.actors}
                  <span className="ml-1 text-xs text-ink/45">de {r.staff}</span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums group-even:bg-cream/60">
                  {r.total > 0 ? avg(perStaff(r.total, r.staff)) : <span className="text-ink/30">0</span>}
                </td>
                {ACTIVITY_METRICS.map((m) => (
                  <td
                    key={m.key}
                    className={`px-3 py-2.5 text-right tabular-nums group-even:bg-cream/60 ${m.key === 'total' ? 'font-semibold' : ''}`}
                  >
                    {r[m.key] > 0 ? (
                      <>
                        {r[m.key]}
                        {m.key === 'effective' && <span className="ml-1 text-xs text-ink/45">{pct(r.effective, r.total)}</span>}
                      </>
                    ) : (
                      <span className="text-ink/30">0</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink/15 bg-sand font-bold" data-testid="branch-total">
              <th scope="row" className="sticky left-0 z-10 bg-sand px-3 py-3 text-left">
                Total
              </th>
              <td className="px-3 py-3 text-right tabular-nums">
                {t.actors}
                <span className="ml-1 text-xs font-normal text-ink/45">de {t.staff}</span>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{avg(perStaff(t.total, t.staff))}</td>
              {ACTIVITY_METRICS.map((m) => (
                <td key={m.key} className="px-3 py-3 text-right tabular-nums">
                  {t[m.key]}
                  {m.key === 'effective' && <span className="ml-1 text-xs font-normal text-ink/45">{pct(t.effective, t.total)}</span>}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-1 text-xs text-ink/45">
        Cada contacto cuenta en la sucursal del cliente. «Personal»: quienes contactaron, de los auxiliares, supervisores y encargados
        activos. Toca una sucursal para ver a su personal.
      </p>
    </div>
  )
}
