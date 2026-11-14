import { useCallback, useState } from 'react'
import { MdCalendarToday, MdExpandLess, MdExpandMore } from 'react-icons/md'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { ROLE_LABEL } from '@/features/auth/types'
import { useBranches } from '@/features/prospects/api'
import { laPazDate } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { equalQuotas, useDistribute, usePreview, type Person } from './api'
import { DistributionCalendar, type CalendarMode } from './DistributionCalendar'

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "13 nov" (o "13 nov 2025" si no es del año en curso). */
function fmtDay(iso: string, currentYear: string, withMonth = true): string {
  const [y, m, d] = iso.split('-')
  const day = String(Number(d))
  if (!withMonth) return day
  return `${day} ${MONTHS_SHORT[Number(m) - 1]}${y === currentYear ? '' : ` ${y}`}`
}

/** Fecha única: "Hoy, 13 nov" / "Ayer, 12 nov" / "10 nov". Rango: "1–13 nov" o "28 oct – 13 nov". */
function fmtSelection(from: string, to: string, today: string, yesterday: string): string {
  const year = today.slice(0, 4)
  if (from === to) {
    const prefix = from === today ? 'Hoy, ' : from === yesterday ? 'Ayer, ' : ''
    return prefix + fmtDay(from, year)
  }
  if (from.slice(0, 7) === to.slice(0, 7)) return `${fmtDay(from, year, false)}–${fmtDay(to, year)}`
  return `${fmtDay(from, year)} – ${fmtDay(to, year)}`
}

function addDays(iso: string, d: number): string {
  const x = new Date(`${iso}T12:00:00Z`)
  x.setUTCDate(x.getUTCDate() + d)
  return x.toISOString().slice(0, 10)
}

const MODES: { v: CalendarMode; label: string }[] = [
  { v: 'single', label: 'Fecha única' },
  { v: 'range', label: 'Rango' },
  { v: 'all', label: 'Todo lo pendiente' },
]

function Stepper({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (n: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Menos a ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-10 w-10 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={`Recibirá ${label}`}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="h-10 w-16 rounded-xl border border-ink/15 text-center font-display text-xl font-bold tabular-nums"
      />
      <button
        type="button"
        aria-label={`Más a ${label}`}
        onClick={() => onChange(value + 1)}
        className="h-10 w-10 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand"
      >
        +
      </button>
    </div>
  )
}

/** Reparto de la tarde: vista previa con la carga de cada persona y cupos ajustables (FR-039b/d). */
export function DistributePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const scope = useBranchScope()
  const isGlobal = scope.canPick
  const branches = useBranches()
  const [branchSel, setBranchSel] = useState<number | undefined>(undefined)
  const branch = isGlobal ? (branchSel ?? scope.fallback) : (profile?.branch_id ?? undefined)
  const today = laPazDate(new Date())
  const yesterday = addDays(today, -1)

  // Qué repartir: un día, un rango o todo lo pendiente hasta hoy
  const [calMode, setCalMode] = useState<CalendarMode>('single')
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const closeCalendar = useCallback(() => setIsCalendarOpen(false), [setIsCalendarOpen])

  // Para modo fecha única (single)
  const [day, setDay] = useState(today)

  // Para modo rango
  const [rangeFrom, setRangeFrom] = useState(today)
  const [rangeTo, setRangeTo] = useState(today)

  // Argumentos de consulta según el modo seleccionado
  const from = calMode === 'single' ? day : calMode === 'range' ? rangeFrom : today
  const to = calMode === 'single' ? day : calMode === 'range' ? rangeTo : today
  const includeOlder = calMode === 'all'

  const args = branch ? { branch, from, to, includeOlder } : null
  const preview = usePreview(args)
  const distribute = useDistribute()

  // Cupos editables; se recalculan en partes iguales cuando cambia lo que hay para repartir.
  const [quotas, setQuotas] = useState<Record<string, number> | null>(null)
  const [quotasFor, setQuotasFor] = useState('')
  const key = preview.data ? `${branch}|${calMode}|${from}|${to}|${includeOlder}|${preview.data.total}` : ''
  if (preview.data && key !== quotasFor) {
    setQuotasFor(key)
    setQuotas(equalQuotas(preview.data.total, preview.data.people))
  }

  const total = preview.data?.total ?? 0
  const people: Person[] = preview.data?.people ?? []
  const sum = Object.values(quotas ?? {}).reduce((a, b) => a + b, 0)
  const over = sum - total
  const loading = branch !== undefined && preview.isPending
  const selectionLabel = fmtSelection(from, to, today, yesterday)

  async function confirm() {
    if (!args || !quotas) return
    try {
      const res = await distribute.mutateAsync({ ...args, quotas })
      toast(`✓ ${res.assigned} captaciones repartidas`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const branchName = branches.data?.find((b) => b.id === branch)?.name

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title="Repartir"
        subtitle={branchName ? `Captaciones sin asignar · ${branchName}` : 'Captaciones sin asignar'}
      />

      {/* Barra superior: Sucursal + Tabs inmediatamente a continuación + Selector flotante */}
      <section className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink/5">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="branch-select" className="text-xs font-bold uppercase tracking-wider text-ink/50">
            Sucursal:
          </label>
          {isGlobal ? (
            <select
              id="branch-select"
              aria-label="Sucursal"
              value={branch ?? ''}
              onChange={(e) => setBranchSel(e.target.value ? Number(e.target.value) : undefined)}
              className="h-10 rounded-xl border border-ink/15 bg-white px-3 text-sm font-semibold text-ink"
            >
              {scope.allowAll && <option value="">Elegir sucursal…</option>}
              {scope.options?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-bold text-ink">{branchName ?? 'Mi sucursal'}</span>
          )}
        </div>

        {/* Modo de reparto y botón del calendario */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-sand p-1" role="group" aria-label="Qué repartir">
            {MODES.map((m) => (
              <button
                key={m.v}
                type="button"
                aria-pressed={calMode === m.v}
                onClick={() => {
                  setCalMode(m.v)
                  setIsCalendarOpen(m.v !== 'all')
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  calMode === m.v ? 'bg-ink text-gold-light' : 'text-ink/65 hover:text-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Botón trigger para abrir el calendario flotante */}
          {calMode !== 'all' && (
            <button
              type="button"
              onClick={() => setIsCalendarOpen((o) => !o)}
              aria-expanded={isCalendarOpen}
              aria-haspopup="dialog"
              className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-xs transition-colors hover:bg-sand active:scale-95"
            >
              <MdCalendarToday className="h-4 w-4 text-gold-dark" aria-hidden />
              <span>{selectionLabel}</span>
              {isCalendarOpen ? (
                <MdExpandLess className="h-4 w-4 text-ink/40" aria-hidden />
              ) : (
                <MdExpandMore className="h-4 w-4 text-ink/40" aria-hidden />
              )}
            </button>
          )}
        </div>

        {/* Calendario flotante compacto (popover sobre el contenido) */}
        {isCalendarOpen && calMode !== 'all' && (
          <DistributionCalendar
            key={calMode}
            branch={branch}
            mode={calMode}
            onClose={closeCalendar}
            date={day}
            onDateChange={setDay}
            from={rangeFrom}
            to={rangeTo}
            onRangeChange={(f, t) => {
              setRangeFrom(f)
              setRangeTo(t)
            }}
            maxDate={today}
          />
        )}
      </section>

      {!branch ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          Elige una sucursal para repartir.
        </p>
      ) : preview.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">{(preview.error as Error).message}</p>
      ) : (
        <>
          <section className="bg-ink-gradient flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 text-white shadow-sm">
            <div>
              <p
                className="font-display text-5xl font-bold text-gold-light tabular-nums"
                data-testid="pool-total"
              >
                {loading ? '…' : total}
              </p>
              <p className="text-white/70 font-medium">sin asignar para repartir</p>
              <div className="mt-1 text-xs text-white/50">
                {calMode === 'all' ? <span>Todo lo pendiente hasta hoy</span> : <span>{selectionLabel}</span>}
              </div>
            </div>
            {preview.data && preview.data.by_author.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Por quién captó">
                {preview.data.by_author.map((a) => (
                  <li key={a.name} className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium">
                    {a.name} · <strong className="tabular-nums text-gold-light">{a.n}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2" aria-label="Quién recibe">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-lg font-semibold">¿Cuántas recibe cada uno?</h2>
              <button
                type="button"
                onClick={() => setQuotas(equalQuotas(total, people))}
                className="text-sm font-semibold text-gold-dark underline hover:text-gold"
              >
                Partes iguales
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {people.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5"
                  data-testid={`person-${p.full_name}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{p.full_name}</p>
                    <p className="text-sm text-ink/55">
                      {ROLE_LABEL[p.role]} · ya tiene <strong>{p.pending_today}</strong> para hoy
                      {` (${p.assigned_total} en total)`}
                    </p>
                  </div>
                  <Stepper
                    label={p.full_name}
                    value={quotas?.[p.id] ?? 0}
                    onChange={(n) => setQuotas((q) => ({ ...(q ?? {}), [p.id]: n }))}
                  />
                </li>
              ))}
              {people.length === 0 && (
                <li className="rounded-2xl bg-white p-4 text-ink/50">
                  No hay auxiliares activas en esta sucursal.
                </li>
              )}
            </ul>
          </section>

          <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-ink/10">
            <p className="text-ink/70" aria-live="polite">
              <strong className="tabular-nums text-ink">{sum}</strong> de{' '}
              <strong className="tabular-nums text-ink">{total}</strong>
              {over > 0 ? (
                <span className="ml-2 font-semibold text-rb-red">te pasaste por {over}</span>
              ) : over < 0 ? (
                <span className="ml-2 text-ink/50">quedan {-over} sin repartir</span>
              ) : null}
            </p>
            <Button
              disabled={loading || total === 0 || sum === 0 || over > 0 || distribute.isPending}
              onClick={() => void confirm()}
            >
              {distribute.isPending ? 'Repartiendo…' : `Repartir ${Math.min(sum, total)}`}
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
