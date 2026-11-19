import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { MdFileDownload, MdHistory, MdNightsStay, MdWbSunny } from 'react-icons/md'
import { useAuth } from '@/features/auth/AuthProvider'
import { GLOBAL_ROLES } from '@/features/auth/types'
import { useBranches } from '@/features/prospects/api'
import { laPazDate } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { AssignmentDialog } from './AssignmentDialog'
import {
  copyDay,
  deleteAssignment,
  SHIFT_LABEL,
  useOrgList,
  useOrgMutation,
  type Assignment,
  type Shift,
} from './api'
import { ResultDialog } from './ResultDialog'
import {
  addDays,
  applyFilters,
  compliance,
  daysBetween,
  defaultShiftFilter,
  filterOptions,
  goalsText,
  groupByPerson,
  groupRows,
  totals,
  verifiedText,
  type FilterKey,
  type Filters,
} from './logic'

const FILTERS: { k: FilterKey; label: string }[] = [
  { k: 'lead', label: 'Gerente' },
  { k: 'branch', label: 'Sucursal' },
  { k: 'shift', label: 'Turno' },
  { k: 'person', label: 'Personal' },
  { k: 'strategy', label: 'Estrategia' },
  { k: 'channel', label: 'Canal' },
  { k: 'subchannel', label: 'Subcanal' },
]
const MAX_DAYS = 31

const dm = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
const hours = (r: Assignment) => (r.start_time ? `${r.start_time}${r.end_time ? `–${r.end_time}` : ''}` : '—')
/** «jue 19/11» para el encabezado de la tabla compacta (spec 007, FR-012). */
const weekdayDm = (iso: string) =>
  `${new Intl.DateTimeFormat('es-BO', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)).replace('.', '')} ${dm(iso)}`
/**
 * Tabla compacta (spec 007, FR-013/FR-014): 6 títulos más las acciones. «Canal › Subcanal» abarca dos celdas: el canal
 * (una vez por carga) y su subcanal (una fila por subcanal).
 */
const COMPACT_HEAD: [string, number][] = [
  ['Horario', 1],
  ['Canal › Subcanal', 2],
  ['Lugar', 1],
  ['Metas', 1],
  ['Resultado', 1],
  ['Observaciones', 1],
  ['', 1],
]
/** Ancho de cada celda (8): iguales en todas las sucursales para que se lean alineadas; el subcanal toma el resto. */
const COMPACT_WIDTHS = ['w-32', 'w-[13%]', '', 'w-[9%]', 'w-[8%]', 'w-[12%]', 'w-[11%]', 'w-48']
const COMPACT_SPAN = COMPACT_WIDTHS.length

/** Marca de turno junto al horario: sol a la mañana, luna a la tarde (FR-014). */
function ShiftMark({ shift }: { shift: Shift }) {
  const Icon = shift === 'morning' ? MdWbSunny : MdNightsStay
  return (
    <span title={SHIFT_LABEL[shift]} className={shift === 'morning' ? 'text-amber-600' : 'text-indigo-700'}>
      <Icon aria-hidden className="mr-1 inline h-4 w-4 align-[-2px]" />
      <span className="sr-only">{SHIFT_LABEL[shift]} </span>
    </span>
  )
}

/** «15 de 30 · 50 %», «15» sin meta, o «Pendiente» (sin resultado no es 0). */
function Score({ goal, result, label }: { goal: number | null; result: number | null; label?: string }) {
  const pct = compliance(goal, result)
  return (
    <span className="block tabular-nums">
      {label && <span className="text-ink/50">{label} </span>}
      {result === null ? (
        <span className="text-ink/45">{goal !== null ? `pendiente de ${goal}` : 'pendiente'}</span>
      ) : (
        <>
          <strong>{result}</strong>
          {goal !== null && <span className="text-ink/50"> de {goal}</span>}
          {pct !== null && (
            <span className={pct >= 100 ? 'font-semibold text-emerald-700' : 'text-ink/60'}>
              {' '}
              · {pct}&nbsp;%
            </span>
          )}
        </>
      )}
    </span>
  )
}

/** Captación y compartidas por separado, cada una con su cumplimiento (FR-007 de la 004). */
function ResultCell({ r }: { r: Assignment }) {
  if (r.result === null && r.share_result === null)
    return (
      <span>
        <span className="text-ink/45">Pendiente</span>
        <Verified r={r} />
      </span>
    )
  const share = r.uses_share_goal || r.share_goal !== null || r.share_result !== null
  const capture = r.uses_goal || r.goal !== null || r.result !== null || !share
  return (
    <span data-testid="assignment-result">
      {capture && <Score goal={r.goal} result={r.result} label={share ? 'Captados' : undefined} />}
      {share && <Score goal={r.share_goal} result={r.share_result} label="Compartidas" />}
      <Verified r={r} />
    </span>
  )
}

/** Compartidas verificadas por Cobros, junto al resultado; ventas no las cambia (spec 006, FR-014). */
function Verified({ r }: { r: Assignment }) {
  const text = verifiedText(r)
  if (text === null) return null
  // Si el resultado cambió después de verificar, la verificación se mantiene y se ve la diferencia (ámbar).
  const differs = r.share_result !== null && r.share_result !== r.share_verified
  const by = [r.share_verified_by_name && `Verificó ${r.share_verified_by_name}`, r.share_verified_note]
    .filter(Boolean)
    .join(' · ')
  return (
    <span
      data-testid="share-verified"
      title={by}
      className={`block text-xs font-semibold tabular-nums ${differs ? 'text-amber-700' : 'text-emerald-700'}`}
    >
      ✓ {text}
      {r.share_verified_note && <span className="font-normal text-ink/60"> · {r.share_verified_note}</span>}
    </span>
  )
}

const flyerNames = (r: Assignment) => r.flyers.map((f) => f.name).join(', ')
const countText = (n: number) => (n === 1 ? '1 asignación' : `${n} asignaciones`)

const BATCH_TONES = [
  'ring-sky-300 bg-sky-50 text-sky-900',
  'ring-violet-300 bg-violet-50 text-violet-900',
  'ring-teal-300 bg-teal-50 text-teal-900',
  'ring-rose-300 bg-rose-50 text-rose-900',
]

/** Etiqueta de las asignaciones creadas en una misma carga (FR-011); el color distingue cargas vecinas. */
function BatchTag({ info }: { info: { n: number; tone: number } | undefined }) {
  if (!info) return null
  return (
    <span
      data-testid="batch-tag"
      title="Creadas juntas en una misma carga"
      className={`ml-1 inline-block whitespace-nowrap rounded-full px-2 text-xs font-semibold ring-1 ${BATCH_TONES[info.tone % BATCH_TONES.length]}`}
    >
      carga de {info.n}
    </span>
  )
}

/**
 * Una carga de la tabla compacta (spec 007, FR-014/FR-015): una fila por subcanal. Lo común a la carga (horario,
 * canal, lugar y observaciones) va una sola vez y abarca todas sus filas; metas, resultado y acciones van por subcanal.
 * Las filas de una misma carga se separan con línea punteada.
 */
function CompactLine({
  line,
  actions,
}: {
  line: Assignment[]
  actions: (r: Assignment, compact?: boolean) => ReactNode
}) {
  const r = line[0]!
  const n = line.length
  const notes = [...new Set(line.map((x) => x.notes).filter(Boolean))].join(' · ')
  return (
    <>
      {line.map((x, i) => (
        <tr
          key={x.id}
          data-testid={i === 0 ? 'assignment' : 'assignment-sub'}
          data-count={i === 0 ? n : undefined}
          className={i > 0 ? 'border-dashed' : undefined}
        >
          {i === 0 && (
            <>
              <td rowSpan={n} className="whitespace-nowrap px-3 py-2 align-top tabular-nums">
                <ShiftMark shift={r.shift} />
                {hours(r)}
              </td>
              <td rowSpan={n} className="break-words px-3 py-2 align-top text-ink/60">
                {r.channel}&nbsp;<span className="text-ink/40">›</span>
                {r.flyers.length > 0 && <span className="block text-xs">Volanteras: {flyerNames(r)}</span>}
              </td>
            </>
          )}
          <td className="break-words px-3 py-2 font-semibold">{x.subchannel ?? '—'}</td>
          {i === 0 && (
            <td rowSpan={n} className="break-words px-3 py-2 align-top">
              {r.place ?? '—'}
            </td>
          )}
          <td className="px-3 py-2 tabular-nums">{goalsText(x) ?? '—'}</td>
          <td className="px-3 py-2">
            <ResultCell r={x} />
          </td>
          {i === 0 && (
            <td rowSpan={n} className="break-words px-3 py-2 align-top text-ink/70">
              {notes}
            </td>
          )}
          <td className="px-3 py-2">{actions(x, true)}</td>
        </tr>
      ))}
    </>
  )
}

/** Organización comercial por sucursal (spec 003): reemplaza la planilla de ventas. */
export function OrganizationPage() {
  const { profile } = useAuth()
  const role = profile!.role
  const ownOnly = role === 'field_assistant'
  const global = GLOBAL_ROLES.includes(role)
  const branchesQ = useBranches()
  const toast = useToast()
  const today = laPazDate(new Date())

  // Sucursales que puede elegir: gerencia todas, jefe las suyas, el resto la propia (fija).
  const scopeBranches = useMemo(() => {
    const all = branchesQ.data ?? []
    if (global) return all
    if (role === 'sales_lead') return all.filter((b) => profile!.branch_ids?.includes(b.id))
    return all.filter((b) => b.id === profile!.branch_id)
  }, [branchesQ.data, global, role, profile])
  const [picked, setPicked] = useState<number[]>([]) // vacío = todas las de su alcance
  const branchIds = picked.length ? picked : scopeBranches.map((b) => b.id)

  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const rangeOk = daysBetween(from, to) >= 0 && daysBetween(from, to) < MAX_DAYS
  const q = useOrgList(from, to, picked, rangeOk && (global || scopeBranches.length > 0))
  const rows = useMemo(() => q.data?.rows ?? [], [q.data])

  const [chosen, setFilters] = useState<Filters>({})
  // Filtro Turno al abrir (spec 007, FR-010): hoy por la tarde arranca en «Tarde» hasta que la persona lo toca.
  const [shiftTouched, setShiftTouched] = useState(false)
  const autoShift = shiftTouched ? undefined : defaultShiftFilter(from, to, new Date(), rows)
  const filters = useMemo<Filters>(
    () => (shiftTouched ? chosen : { ...chosen, shift: autoShift }),
    [chosen, shiftTouched, autoShift],
  )
  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters])
  // Organizada por persona (spec 006, FR-003): la base ya ordena por fecha, sucursal, persona y hora.
  const groups = useMemo(() => groupByPerson(visible), [visible])
  // Tabla compacta (spec 007, US5): sucursal → persona → filas, con la misma carga en una fila.
  const blocks = useMemo(() => groupRows(visible), [visible])
  const t = totals(visible)
  // Cargas con más de una asignación: cuántas son y un color por carga, sin cambiar el orden de la tabla.
  const batches = useMemo(() => {
    const m = new Map<string, { n: number; tone: number }>()
    for (const r of rows) if (r.batch_id) m.set(r.batch_id, { n: (m.get(r.batch_id)?.n ?? 0) + 1, tone: 0 })
    let tone = 0
    for (const [k, b] of m)
      if (b.n < 2) m.delete(k)
      else b.tone = tone++
    return m
  }, [rows])
  const batchOf = (r: Assignment) => (r.batch_id ? batches.get(r.batch_id) : undefined)
  const anyFilter = Object.values(filters).some(Boolean)

  const singleDay = from === to
  const [addBranch, setAddBranch] = useState<number | undefined>(undefined)
  // Con varias sucursales a la vista no se elige ninguna por defecto: así no se carga ni se copia en otra sin querer
  // (spec 007). Si la elegida deja de estar a la vista, vuelve a «Elegir sucursal…».
  const targetBranch =
    branchIds.length === 1
      ? branchIds[0]
      : addBranch !== undefined && branchIds.includes(addBranch)
        ? addBranch
        : undefined
  const canManage = !!q.data?.can_manage && !ownOnly
  const [edit, setEdit] = useState<{ shift: Shift; assignment?: Assignment; branch: number } | null>(null)
  const [resultOf, setResultOf] = useState<Assignment | null>(null)
  const del = useOrgMutation(deleteAssignment)
  const copy = useOrgMutation(copyDay)
  const [exporting, setExporting] = useState(false)

  const scopeName =
    branchIds.length === 1
      ? (scopeBranches.find((b) => b.id === branchIds[0])?.name ?? 'Sucursal')
      : picked.length === 0 && global
        ? 'Todas las sucursales'
        : `${branchIds.length} sucursales`

  function setDay(d: string) {
    setFrom(d)
    setTo(d)
  }

  /** Copia sin duplicar, con confirmación y conteo de copiadas y saltadas (spec 007, US1). */
  async function doCopy(fromDay: string, toDay: string, msg: string) {
    if (targetBranch === undefined) return
    const name = scopeBranches.find((b) => b.id === targetBranch)?.name ?? 'la sucursal'
    if (
      !window.confirm(
        `¿Copiar las asignaciones de ${name} del ${weekdayDm(fromDay)} al ${weekdayDm(toDay)}?\nLas que ya estén cargadas no se repiten.`,
      )
    )
      return
    try {
      const { copied, skipped } = await copy.mutateAsync({ branch: targetBranch, from: fromDay, to: toDay })
      const text =
        copied + skipped === 0
          ? 'No había asignaciones para copiar'
          : copied === 0
            ? `Ya estaban todas: no se copió nada (${skipped})`
            : `✓ ${copied} ${msg}${skipped ? ` · ${skipped} ya estaban` : ''}`
      toast(text, copied ? 'success' : 'info')
      if (copied + skipped > 0) setDay(toDay)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function doDelete(r: Assignment) {
    if (!window.confirm(`¿Quitar la asignación de ${r.person} (${r.channel})?`)) return
    try {
      await del.mutateAsync(r.id)
      toast('Asignación quitada', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function doExport() {
    setExporting(true)
    try {
      const n = await exportOrganization(
        groups.flatMap((g) => g.rows),
        scopeName,
        from,
        to,
      )
      toast(n ? `✓ Excel con ${n} asignaciones` : 'No hay asignaciones para exportar', n ? 'success' : 'info')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  // En la tabla compacta los botones son más chicos para que entren en un renglón (spec 007).
  const actions = (r: Assignment, compact = false) => {
    const btn = compact
      ? 'min-h-8 rounded-full px-2.5 text-xs font-semibold'
      : 'min-h-9 rounded-full px-3 text-sm font-semibold'
    return (
      <div className={`flex gap-1.5 ${compact ? 'flex-nowrap' : 'flex-wrap'}`}>
        {r.can_set_result && !ownOnly && (
          <button
            type="button"
            onClick={() => setResultOf(r)}
            className={`${btn} ring-1 ring-ink/15 active:bg-sand`}
          >
            Resultado
          </button>
        )}
        {r.can_replan && !ownOnly && (
          <>
            <button
              type="button"
              onClick={() => setEdit({ shift: r.shift, assignment: r, branch: r.branch_id })}
              className={`${btn} ring-1 ring-ink/15 active:bg-sand`}
            >
              Editar
            </button>
            <button
              type="button"
              aria-label={`Quitar asignación de ${r.person}`}
              onClick={() => void doDelete(r)}
              className={`${btn} text-rb-red ring-1 ring-rb-red/30`}
            >
              ✕
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title={ownOnly ? 'Mi plan' : 'Planificación'}
        subtitle={ownOnly ? 'Tus asignaciones' : scopeName}
        actions={
          !ownOnly && (
            <Link
              to="/planificacion/historial"
              className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-ink/70 ring-1 ring-ink/15"
            >
              <MdHistory aria-hidden className="h-5 w-5" /> Planificación anterior
            </Link>
          )
        }
      />

      {/* Rango y sucursales */}
      <section
        className="flex flex-wrap items-end gap-2 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-ink/5"
        aria-label="Período"
      >
        {singleDay && (
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => setDay(addDays(from, -1))}
            className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand"
          >
            ‹
          </button>
        )}
        <label className="flex flex-col text-xs font-semibold text-ink/60">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className="min-h-11 rounded-xl border border-ink/15 px-2 text-base"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-ink/60">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className="min-h-11 rounded-xl border border-ink/15 px-2 text-base"
          />
        </label>
        {singleDay && (
          <button
            type="button"
            aria-label="Día siguiente"
            onClick={() => setDay(addDays(from, 1))}
            className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand"
          >
            ›
          </button>
        )}
        <div className="flex gap-1">
          <Button variant="ghost" className="min-h-11 text-sm" onClick={() => setDay(today)}>
            Hoy
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 text-sm"
            onClick={() => {
              setFrom(addDays(today, -6))
              setTo(today)
            }}
          >
            7 días
          </Button>
        </div>
        {scopeBranches.length > 1 && !ownOnly && (
          <fieldset className="flex flex-wrap items-center gap-1.5" aria-label="Sucursales">
            {scopeBranches.map((b) => {
              const on = picked.includes(b.id)
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== b.id) : [...p, b.id]))}
                  className={`min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ${on ? 'bg-ink text-gold-light ring-ink' : 'ring-ink/15'}`}
                >
                  {b.name}
                </button>
              )
            })}
            {picked.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked([])}
                className="min-h-9 px-2 text-sm text-ink/60 underline"
              >
                Todas
              </button>
            )}
          </fieldset>
        )}
      </section>
      {!rangeOk && (
        <p className="rounded-2xl bg-rb-red/10 p-3 text-rb-red">
          Elige un rango de hasta {MAX_DAYS} días, con «Hasta» después de «Desde».
        </p>
      )}

      {/* Filtros por columna */}
      {!ownOnly && rows.length > 0 && (
        <section className="flex flex-wrap items-end gap-2" aria-label="Filtros">
          {FILTERS.map(({ k, label }) => {
            const opts = filterOptions(rows, k)
            return (
              <label key={k} className="flex flex-col text-xs font-semibold text-ink/60">
                {label}
                <select
                  aria-label={label}
                  value={filters[k] ?? ''}
                  onChange={(e) => {
                    if (k === 'shift') setShiftTouched(true)
                    setFilters((f) => ({ ...f, [k]: e.target.value || undefined }))
                  }}
                  className={`min-h-10 max-w-48 rounded-xl border bg-white px-2 text-sm ${filters[k] ? 'border-ink' : 'border-ink/15'}`}
                >
                  <option value="">Todos</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {k === 'shift' ? SHIFT_LABEL[o as Shift] : o}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
          {anyFilter && (
            <Button
              variant="ghost"
              className="min-h-10 text-sm"
              onClick={() => {
                setShiftTouched(true)
                setFilters({})
              }}
            >
              Quitar filtros
            </Button>
          )}
        </section>
      )}

      {/* Totales según el filtro */}
      <section
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        aria-label="Totales"
        data-testid="org-totals"
      >
        {[
          ['Meta de captación', t.goal],
          ['Captados', t.result],
          ['Meta de compartidas', t.shareGoal],
          ['Compartidas', t.shareResult],
          ['Asignaciones', t.count],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
            <p className="font-display text-2xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </section>

      {/* Encabezado (sucursal, gerente y fecha una sola vez, spec 007 FR-012) y acciones de carga */}
      {(canManage || (!ownOnly && blocks.length === 1)) && (
        <div className="flex flex-wrap items-center gap-2">
          {!ownOnly && blocks.length === 1 && (
            <p
              className="mr-2 font-display text-lg font-semibold uppercase tracking-wide"
              data-testid="scope-header"
            >
              {blocks[0]!.branch}
              <span className="font-sans text-sm font-semibold normal-case tracking-normal text-ink/60">
                {' '}
                · Gerente: {blocks[0]!.lead ?? 'Sin gerente'}
                {singleDay && ` · ${weekdayDm(from)}`}
              </span>
            </p>
          )}
          {!canManage ? null : singleDay ? (
            <>
              {branchIds.length > 1 && (
                <select
                  aria-label="Cargar en"
                  value={targetBranch ?? ''}
                  onChange={(e) => setAddBranch(e.target.value ? Number(e.target.value) : undefined)}
                  className={`min-h-11 rounded-xl border bg-white px-2 ${targetBranch === undefined ? 'border-gold text-ink/60' : 'border-ink/15'}`}
                >
                  <option value="">Elegir sucursal para cargar…</option>
                  {scopeBranches
                    .filter((b) => branchIds.includes(b.id))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        Cargar en {b.name}
                      </option>
                    ))}
                </select>
              )}
              {(['morning', 'afternoon'] as Shift[]).map((s) => (
                <Button
                  key={s}
                  className="min-h-11 text-sm"
                  disabled={targetBranch === undefined}
                  onClick={() => targetBranch !== undefined && setEdit({ shift: s, branch: targetBranch })}
                >
                  ＋ {SHIFT_LABEL[s]}
                </Button>
              ))}
              <Button
                variant="secondary"
                className="min-h-11 text-sm"
                disabled={copy.isPending || targetBranch === undefined}
                onClick={() => void doCopy(addDays(from, -1), from, 'copiadas del día anterior')}
              >
                Copiar del día anterior
              </Button>
              {targetBranch !== undefined && rows.some((r) => r.branch_id === targetBranch) && (
                <Button
                  variant="secondary"
                  className="min-h-11 text-sm"
                  disabled={copy.isPending}
                  onClick={() => void doCopy(from, addDays(from, 1), 'copiadas al día siguiente')}
                >
                  Copiar al día siguiente
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-ink/55">Para cargar asignaciones, elige un solo día.</p>
          )}
          {canManage && (
            <Button
              variant="secondary"
              className="ml-auto min-h-11 text-sm"
              disabled={exporting || visible.length === 0}
              onClick={() => void doExport()}
            >
              <MdFileDownload aria-hidden className="mr-1 inline h-5 w-5" />{' '}
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </Button>
          )}
        </div>
      )}

      {/* Asignaciones */}
      {q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">{(q.error as Error).message}</p>
      ) : q.isLoading ? (
        <p className="p-6 text-center text-ink/50">Cargando…</p>
      ) : visible.length === 0 ? (
        <p
          className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5"
          data-testid="org-empty"
        >
          {rows.length === 0
            ? ownOnly
              ? 'No tienes asignaciones en estas fechas.'
              : 'Sin asignaciones en estas fechas.'
            : 'Sin resultados para estos filtros.'}
        </p>
      ) : (
        <>
          {/* Pantalla ancha: un bloque por sucursal (nombre y gerente arriba, luego los títulos de columna) (spec 007, FR-012) */}
          <div className="hidden flex-col gap-4 lg:flex">
            {blocks.map((b) => (
              <section
                key={b.key}
                aria-label={`Planificación de ${b.branch}`}
                className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5"
              >
                {/* Con una sola sucursal, el nombre y la gerente ya están en la barra de arriba */}
                {blocks.length > 1 && (
                  <h2
                    className="flex items-baseline gap-2 px-4 pb-2 pt-3 font-display text-lg font-semibold uppercase tracking-wide"
                    data-testid="branch-band"
                  >
                    {b.branch}
                    <span className="font-sans text-sm font-semibold normal-case tracking-normal text-ink/60">
                      · Gerente: {b.lead ?? 'Sin gerente'}
                    </span>
                  </h2>
                )}
                {/* Anchos fijos: las columnas quedan alineadas entre sucursales */}
                <table className="w-full min-w-[960px] table-fixed text-left text-sm">
                  <colgroup>
                    {COMPACT_WIDTHS.map((w, i) => (
                      <col key={i} className={w} />
                    ))}
                  </colgroup>
                  <thead className="bg-ink-gradient text-xs uppercase tracking-wide text-gold-light">
                    <tr>
                      {COMPACT_HEAD.map(([h, span]) => (
                        <th key={h} colSpan={span} className="whitespace-nowrap px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5">
                    {b.people.map((p) => (
                      <Fragment key={p.key}>
                        {/* Inicio de cada persona (006 FR-003); la fecha solo si se ven varios días */}
                        <tr className="bg-sand/70" data-testid="person-group">
                          <td
                            colSpan={COMPACT_SPAN}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink/70"
                          >
                            {p.person}
                            {!singleDay && ` · ${weekdayDm(p.work_date)}`} · {countText(p.count)}
                          </td>
                        </tr>
                        {p.lines.map((line) => (
                          <CompactLine key={line[0]!.id} line={line} actions={actions} />
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>

          {/* Celular: una tarjeta por asignación */}
          <div className="flex flex-col gap-3 lg:hidden">
            {groups.map((g) => (
              <section
                key={g.key}
                aria-label={`Asignaciones de ${g.rows[0]!.person}`}
                data-testid="person-group-card"
              >
                {!ownOnly && (
                  <p className="mb-1 px-2 text-sm font-semibold text-ink/70">
                    {g.rows[0]!.person}
                    <span className="font-normal text-ink/45">
                      {' '}
                      · {countText(g.rows.length)}
                      {singleDay ? '' : ` · ${dm(g.rows[0]!.work_date)}`}
                    </span>
                  </p>
                )}
                <ul className="flex flex-col gap-2">
                  {g.rows.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5"
                      data-testid="assignment-card"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-display text-lg font-semibold tabular-nums">
                          {hours(r)}{' '}
                          <span className="text-sm font-normal text-ink/50">
                            · {SHIFT_LABEL[r.shift]}
                            {singleDay ? '' : ` · ${dm(r.work_date)}`}
                          </span>
                        </p>
                        <ResultCell r={r} />
                      </div>
                      {/* La persona va en el encabezado del grupo; en la tarjeta queda para lectores de pantalla y búsquedas. */}
                      {!ownOnly && <p className="sr-only">{r.person}</p>}
                      <p className="text-xs font-semibold uppercase tracking-wide text-gold-dark">
                        {r.strategy} · {r.channel}
                      </p>
                      {(r.subchannel || batchOf(r)) && (
                        <p className="text-sm">
                          {r.subchannel}
                          <BatchTag info={batchOf(r)} />
                        </p>
                      )}
                      <p className="text-sm text-ink/60">
                        {[
                          r.place,
                          r.goal !== null && `Meta captación ${r.goal}`,
                          r.share_goal !== null && `Meta compartidas ${r.share_goal}`,
                          branchIds.length > 1 && r.branch,
                          r.lead && `Gerente: ${r.lead}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {r.flyers.length > 0 && (
                        <p className="text-sm text-ink/70">Volanteras: {flyerNames(r)}</p>
                      )}
                      {r.notes && <p className="mt-1 text-sm italic text-ink/70">“{r.notes}”</p>}
                      <div className="mt-2">{actions(r)}</div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {edit && (
        <AssignmentDialog
          branch={edit.branch}
          day={edit.assignment?.work_date ?? from}
          shift={edit.shift}
          assignment={edit.assignment}
          sameDay={rows.filter(
            (r) => r.branch_id === edit.branch && r.work_date === (edit.assignment?.work_date ?? from),
          )}
          onClose={() => setEdit(null)}
        />
      )}
      {resultOf && <ResultDialog assignment={resultOf} onClose={() => setResultOf(null)} />}
    </main>
  )
}

/** El Excel se carga solo al exportar (exceljs pesa; constitución II). */
async function exportOrganization(
  ...args: Parameters<typeof import('./exportOrganization').exportOrganization>
) {
  const m = await import('./exportOrganization')
  return m.exportOrganization(...args)
}
