import type { SummaryCard } from './inboxView'

const CARDS: { v: SummaryCard; label: string; on: string; off: string }[] = [
  { v: 'today', label: 'Para hoy', on: 'bg-amber-300 text-ink ring-amber-400', off: 'bg-amber-50 text-amber-950 ring-amber-200' },
  { v: 'late', label: 'Atrasados', on: 'bg-rb-red text-white ring-rb-red', off: 'bg-rb-red/5 text-rb-red ring-rb-red/30' },
  { v: 'done', label: 'Contactados hoy', on: 'bg-emerald-600 text-white ring-emerald-600', off: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
]

/** Spec 022: resumen del día de «Mis contactos». Cada tarjeta filtra la lista; tocarla de nuevo quita el filtro. */
export function SummaryCards({
  counts,
  active,
  onToggle,
}: {
  counts: Record<SummaryCard, number>
  active: SummaryCard | null
  onToggle: (v: SummaryCard) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:max-w-xl" role="group" aria-label="Resumen del día">
      {CARDS.map((c) => {
        const on = active === c.v
        return (
          <button
            key={c.v}
            type="button"
            aria-pressed={on}
            disabled={counts[c.v] === 0 && !on}
            onClick={() => onToggle(c.v)}
            className={`flex min-h-16 flex-col items-start justify-between rounded-2xl px-3 py-2 text-left ring-1 transition disabled:opacity-40 ${on ? c.on : c.off}`}
          >
            <span className="text-xs font-semibold leading-tight">{c.label}</span>
            <span className="text-2xl font-bold tabular-nums leading-none">{counts[c.v]}</span>
          </button>
        )
      })}
    </div>
  )
}
