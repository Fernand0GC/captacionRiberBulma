/**
 * Calendario flotante de Reparticiones (FR-039d).
 * Días con captaciones sin repartir en rojo; días donde todo fue repartido en verde.
 * El padre lo monta solo mientras está abierto, así cada apertura arranca sin selección a medias.
 */
import { useEffect, useRef, useState } from 'react'
import { MdCheck, MdChevronLeft, MdChevronRight, MdClose } from 'react-icons/md'
import { useDatesSummary, type DayStatus } from './api'

export type CalendarMode = 'single' | 'range' | 'all'

interface Props {
  branch: number | undefined
  mode: 'single' | 'range'
  onClose: () => void
  date: string
  onDateChange: (d: string) => void
  from: string
  to: string
  onRangeChange: (from: string, to: string) => void
  maxDate?: string
}

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function isoToDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

function addMonths(isoMonth: string, delta: number): string {
  const d = isoToDate(isoMonth)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().slice(0, 7) + '-01'
}

function daysInMonth(year: number, month: number) {
  const days: { iso: string; dow: number }[] = []
  const d = new Date(Date.UTC(year, month - 1, 1))
  while (d.getUTCMonth() === month - 1) {
    days.push({ iso: d.toISOString().slice(0, 10), dow: (d.getUTCDay() + 6) % 7 })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

export function DistributionCalendar({
  branch,
  mode,
  onClose,
  date,
  onDateChange,
  from,
  to,
  onRangeChange,
  maxDate,
}: Props) {
  // Abre en el mes de la fecha elegida (en rango, el del final: lo más reciente).
  const [viewMonth, setViewMonth] = useState(() => (mode === 'single' ? date : to).slice(0, 7) + '-01')
  // Primer extremo del rango mientras se elige el segundo; el padre recién se entera al completar el rango.
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const year = isoToDate(viewMonth).getUTCFullYear()
  const month = isoToDate(viewMonth).getUTCMonth() + 1

  const summary = useDatesSummary(branch, year, month)
  const statusByDay: Record<string, DayStatus> = summary.data ?? {}
  const days = daysInMonth(year, month)

  function isDisabled(iso: string): boolean {
    return Boolean(maxDate && iso > maxDate)
  }

  function handleDayClick(iso: string) {
    if (isDisabled(iso)) return
    if (mode === 'single') {
      onDateChange(iso)
      onClose()
      return
    }
    if (!rangeStart) {
      setRangeStart(iso)
      return
    }
    const [f, t] = iso < rangeStart ? [iso, rangeStart] : [rangeStart, iso]
    onRangeChange(f, t)
    onClose()
  }

  function isSelected(iso: string): boolean {
    if (mode === 'single') return iso === date
    if (rangeStart) return iso === rangeStart || iso === hovered
    return iso === from || iso === to
  }

  function isInRange(iso: string): boolean {
    if (mode !== 'range') return false
    if (rangeStart) {
      if (!hovered) return false
      const [f, t] = hovered < rangeStart ? [hovered, rangeStart] : [rangeStart, hovered]
      return iso > f && iso < t
    }
    return iso > from && iso < to
  }

  const canGoNext = !maxDate || addMonths(viewMonth, 1).slice(0, 7) <= maxDate.slice(0, 7)
  const pendingDays = Object.values(statusByDay).filter((s) => s.pending > 0).length

  return (
    <>
      {/* Fondo transparente para cerrar al hacer clic afuera */}
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Calendario de repartición"
        className="absolute top-full right-0 z-40 mt-2 w-72 select-none rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-ink/10 outline-none animate-pop sm:w-80"
      >
        <div className="mb-2 flex items-center justify-between border-b border-ink/5 pb-2">
          <button
            type="button"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            aria-label="Mes anterior"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-sand"
          >
            <MdChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="font-display text-sm font-bold text-ink">
            {MONTHS_ES[month - 1]} {year}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => canGoNext && setViewMonth((m) => addMonths(m, 1))}
              disabled={!canGoNext}
              aria-label="Mes siguiente"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-sand disabled:opacity-20"
            >
              <MdChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar calendario"
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-sand hover:text-ink"
            >
              <MdClose className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-0.5 text-[11px] font-bold text-ink/40">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: days[0]?.dow ?? 0 }).map((_, i) => (
            <div key={`blank-${i}`} className="h-8 w-full sm:h-9" />
          ))}

          {days.map(({ iso }) => {
            const st = statusByDay[iso]
            const pending = st?.pending ?? 0
            const total = st?.total ?? 0
            const hasPending = pending > 0
            const isClean = total > 0 && pending === 0

            const sel = isSelected(iso)
            const inRange = isInRange(iso)
            const disabled = isDisabled(iso)

            let bgClass = 'text-ink/80 hover:bg-sand'
            if (hasPending) {
              bgClass = 'bg-red-50 text-rb-red border border-rb-red/50 font-bold hover:bg-red-100'
            } else if (isClean) {
              bgClass =
                'bg-emerald-50 text-emerald-800 border border-emerald-400 font-bold hover:bg-emerald-100'
            }
            if (inRange) bgClass = 'bg-gold/25 text-ink font-semibold'
            if (sel) bgClass = 'bg-ink text-gold-light font-bold ring-2 ring-gold'

            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                aria-label={`${iso}${hasPending ? `, ${pending} sin repartir` : isClean ? ', todo repartido' : ''}`}
                aria-pressed={sel}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => rangeStart && setHovered(iso)}
                onMouseLeave={() => rangeStart && setHovered(null)}
                className={`relative flex h-8 w-full items-center justify-center rounded-xl text-xs font-medium transition-all sm:h-9 ${bgClass} ${
                  disabled ? 'cursor-not-allowed opacity-25' : 'cursor-pointer active:scale-95'
                }`}
              >
                <span>{Number(iso.slice(8))}</span>
                {hasPending && !sel && (
                  <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-rb-red ring-1 ring-white" />
                )}
                {isClean && !sel && (
                  <MdCheck className="absolute bottom-0.5 h-2.5 w-2.5 text-emerald-700" aria-hidden />
                )}
                {hasPending && sel && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rb-red ring-1 ring-ink" />
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-ink/5 pt-2 text-[11px] text-ink/60">
          {summary.isError ? (
            <span className="text-rb-red">No se pudo cargar el estado de los días</span>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rb-red" />
                <span>Pendientes ({summary.isFetching ? '…' : pendingDays} días)</span>
              </div>
              <div className="flex items-center gap-1">
                <MdCheck className="h-3 w-3 text-emerald-700" aria-hidden />
                <span>Repartido</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
