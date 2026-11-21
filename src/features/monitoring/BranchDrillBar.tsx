import { MdArrowBack, MdChevronLeft, MdChevronRight } from 'react-icons/md'

/**
 * Barra de ubicación al ver una sucursal desde el resumen (Actividad): dice dónde se está, vuelve a todas las
 * sucursales y recorre las demás en el orden del resumen (más contactos primero). También la usa Referidos (spec 014).
 */
export function BranchDrillBar({
  order,
  current,
  name,
  onBack,
  onStep,
}: {
  order: { branch_id: number; name: string }[]
  current: number
  name: string
  onBack: () => void
  onStep: (branchId: number) => void
}) {
  const i = order.findIndex((b) => b.branch_id === current)
  const prev = i > 0 ? order[i - 1] : undefined
  const next = i >= 0 ? order[i + 1] : undefined
  const stepCls =
    'inline-flex min-h-10 max-w-[40vw] items-center gap-0.5 truncate rounded-full bg-white/10 px-3 text-sm font-semibold text-white disabled:opacity-30'

  return (
    <nav
      aria-label="Ubicación"
      className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-ink px-3 py-2.5 text-white"
      data-testid="branch-drill"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gold px-4 font-bold text-ink"
        >
          <MdArrowBack aria-hidden /> Todas las sucursales
        </button>
        <span className="text-sm text-white/60">
          Viendo <b className="font-display text-lg text-gold-light">{name}</b>
        </span>
      </div>
      {i >= 0 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && onStep(prev.branch_id)}
            aria-label={prev ? `Sucursal anterior: ${prev.name}` : 'Sin sucursal anterior'}
            className={stepCls}
          >
            <MdChevronLeft aria-hidden className="shrink-0" />
            <span className="truncate">{prev?.name}</span>
          </button>
          <span className="text-xs tabular-nums text-white/55">
            {i + 1} de {order.length}
          </span>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && onStep(next.branch_id)}
            aria-label={next ? `Sucursal siguiente: ${next.name}` : 'Sin sucursal siguiente'}
            className={stepCls}
          >
            <span className="truncate">{next?.name}</span>
            <MdChevronRight aria-hidden className="shrink-0" />
          </button>
        </div>
      )}
    </nav>
  )
}
