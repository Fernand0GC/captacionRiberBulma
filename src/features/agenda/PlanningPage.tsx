import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { useBranches } from '@/features/prospects/api'
import { laPazDate } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { ActivityDialog } from './ActivityDialog'
import { useAgendaDay, useAgendaMutation, type Activity, type ActivityStatus, type Shift } from './api'

const SHIFTS: { v: Shift; label: string }[] = [
  { v: 'morning', label: 'Mañana' },
  { v: 'afternoon', label: 'Tarde' },
]
const STATUS: Record<ActivityStatus, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-ink/5 text-ink/60 ring-ink/10' },
  done: { label: '✓ Cumplida', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  not_done: { label: '✕ No cumplida', cls: 'bg-rb-red/10 text-rb-red ring-rb-red/20' },
}

/** Estado que se muestra: el que puso el encargado; si sigue pendiente, el automático al terminar el horario. */
function effective(a: Activity): {
  status: ActivityStatus | 'running' | 'ended'
  auto: boolean
  result: string | null
} {
  const counted = `${a.captures} captaciones${a.goal_count !== null ? ` de ${a.goal_count}` : ''}`
  if (a.status !== 'pending') return { status: a.status, auto: false, result: a.result }
  if (a.auto_status) return { status: a.auto_status, auto: true, result: counted }
  return { status: a.ended ? 'ended' : 'running', auto: false, result: a.ended ? counted : null }
}

const LIVE: Record<'running' | 'ended', { label: string; cls: string }> = {
  running: { label: 'En curso', cls: 'bg-sky-50 text-sky-800 ring-sky-200' },
  ended: { label: 'Terminada', cls: 'bg-ink/5 text-ink/60 ring-ink/10' },
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function dayLabel(iso: string, today: string) {
  const [y, m, d] = iso.split('-')
  const rel =
    iso === today ? 'Hoy' : iso === addDays(today, 1) ? 'Mañana' : iso === addDays(today, -1) ? 'Ayer' : ''
  // Corto para que entre en una línea en el celular; el año se ve en el selector de fecha.
  const wd = new Date(`${iso}T12:00:00Z`)
    .toLocaleDateString('es-BO', { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '')
  return `${rel ? `${rel} · ` : ''}${wd} ${d}/${m}${iso.slice(0, 4) === today.slice(0, 4) ? '' : `/${y}`}`
}

/** Captaciones que cayeron en la actividad contra su meta (se cuentan solas por horario y canal). */
function CaptureProgress({ a }: { a: Activity }) {
  const pct = a.goal_count ? Math.min(100, Math.round((a.captures / a.goal_count) * 100)) : null
  const reached = a.goal_count !== null && a.captures >= a.goal_count
  return (
    <div className="mt-2 max-w-sm" data-testid="activity-captures">
      <p className="text-sm">
        <strong className="font-display text-lg tabular-nums">{a.captures}</strong>
        {a.goal_count !== null && <span className="tabular-nums text-ink/50"> / {a.goal_count}</span>}{' '}
        captaciones
        {a.channel && <span className="text-ink/50"> · {a.channel}</span>}
        {reached && <span className="ml-1 font-semibold text-emerald-700">✓ meta</span>}
      </p>
      {pct !== null && (
        <div
          className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-valuenow={a.captures}
          aria-valuemax={a.goal_count ?? undefined}
          aria-label="Avance de captaciones"
        >
          <div
            className={`h-full rounded-full ${reached ? 'bg-emerald-500' : 'bg-gold-gradient'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

/** Planificación diaria por sucursal y turno (US4 simple). */
export function PlanningPage() {
  const { profile } = useAuth()
  const scope = useBranchScope()
  const isGlobal = scope.canPick
  const branches = useBranches()
  const [branchSel, setBranchSel] = useState<number | undefined>(undefined)
  const branch = isGlobal ? (branchSel ?? scope.fallback) : (profile?.branch_id ?? undefined)
  const today = laPazDate(new Date())
  const [day, setDay] = useState(today)
  const q = useAgendaDay(branch, day)
  const toast = useToast()
  const [edit, setEdit] = useState<{ shift: Shift; activity?: Activity } | null>(null)
  const [closing, setClosing] = useState<Activity | null>(null)
  const [closeStatus, setCloseStatus] = useState<ActivityStatus>('done')
  const [closeResult, setCloseResult] = useState('')
  const setResult = useAgendaMutation<{ id: string; status: ActivityStatus; result: string }>(
    'set_activity_result',
    (v) => ({
      p_id: v.id,
      p_status: v.status,
      p_result: v.result,
    }),
  )
  const del = useAgendaMutation<string>('delete_activity', (id) => ({ p_id: id }))
  const copy = useAgendaMutation<{ from: string; to: string }>('copy_agenda', (v) => ({
    p_branch: branch,
    p_from: v.from,
    p_to: v.to,
  }))

  const canEdit = !!q.data?.can_edit
  const acts = q.data?.activities ?? []
  const done = acts.filter((a) => effective(a).status === 'done').length
  const dayGoal = q.data?.day_goal ?? null
  const dayCaptures = q.data?.day_captures ?? 0
  const planned = acts.reduce((n, a) => n + (a.goal_count ?? 0), 0)
  const suggestedGoal = dayGoal !== null && dayGoal > planned ? dayGoal - planned : undefined
  const branchName = branches.data?.find((b) => b.id === branch)?.name

  async function doCopy(from: string, to: string, msg: string) {
    try {
      const n = (await copy.mutateAsync({ from, to })) as number
      toast(n ? `✓ ${n} actividades ${msg}` : 'No había actividades para copiar', n ? 'success' : 'info')
      if (n) setDay(to)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title="Planificación"
        subtitle={branchName ?? (isGlobal ? 'Elige una sucursal' : undefined)}
        actions={
          isGlobal && (
            <select
              aria-label="Sucursal"
              value={branch ?? ''}
              onChange={(e) => setBranchSel(e.target.value ? Number(e.target.value) : undefined)}
              className="min-h-10 rounded-full border border-ink/15 bg-white px-3 text-sm"
            >
              {scope.allowAll && (<option value="">Elegir sucursal…</option>)}
              {scope.options?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )
        }
      />

      <section
        className="flex flex-wrap items-center gap-2 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-ink/5"
        aria-label="Día"
      >
        <button
          type="button"
          aria-label="Día anterior"
          onClick={() => setDay(addDays(day, -1))}
          className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand"
        >
          ‹
        </button>
        <p
          className="min-w-0 flex-1 text-center font-display text-lg font-semibold capitalize"
          data-testid="plan-day"
        >
          {dayLabel(day, today)}
        </p>
        <button
          type="button"
          aria-label="Día siguiente"
          onClick={() => setDay(addDays(day, 1))}
          className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand"
        >
          ›
        </button>
        <input
          type="date"
          aria-label="Fecha"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="min-h-11 rounded-xl border border-ink/15 px-2"
        />
        {day !== today && (
          <Button variant="ghost" className="min-h-11" onClick={() => setDay(today)}>
            Hoy
          </Button>
        )}
      </section>

      {!branch ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          Elige una sucursal para ver su planificación.
        </p>
      ) : q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">{(q.error as Error).message}</p>
      ) : (
        <>
          {dayGoal !== null && (
            <section
              className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5"
              aria-label="Meta del día"
              data-testid="day-goal"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span className="text-sm font-semibold uppercase tracking-wide text-ink/50">
                    Meta del día (Metas)
                  </span>{' '}
                  <strong className="font-display text-2xl tabular-nums">{dayCaptures}</strong>
                  <span className="tabular-nums text-ink/50"> / {dayGoal} captaciones</span>
                </p>
                {canEdit && (
                  <p
                    className={`text-sm ${planned === dayGoal ? 'text-ink/50' : 'font-semibold text-amber-800'}`}
                  >
                    {planned === dayGoal
                      ? 'Las actividades cubren toda la meta'
                      : planned < dayGoal
                        ? `Falta repartir ${dayGoal - planned} entre las actividades`
                        : `Las actividades suman ${planned}, más que la meta`}
                  </p>
                )}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
                <div
                  className={`h-full rounded-full ${dayCaptures >= dayGoal ? 'bg-emerald-500' : 'bg-gold-gradient'}`}
                  style={{
                    width: `${dayGoal ? Math.min(100, Math.round((dayCaptures / dayGoal) * 100)) : 0}%`,
                  }}
                />
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-ink/60">
              <strong className="text-ink">{acts.length}</strong> actividades
              {acts.length > 0 && ` · ${done} cumplidas`}
            </p>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="min-h-10 text-sm"
                  disabled={copy.isPending}
                  onClick={() => void doCopy(addDays(day, -1), day, 'copiadas del día anterior')}
                >
                  Copiar del día anterior
                </Button>
                {acts.length > 0 && (
                  <Button
                    variant="secondary"
                    className="min-h-10 text-sm"
                    disabled={copy.isPending}
                    onClick={() => void doCopy(day, addDays(day, 1), 'copiadas al día siguiente')}
                  >
                    Copiar al día siguiente
                  </Button>
                )}
              </div>
            )}
          </div>

          {SHIFTS.map((s) => {
            const rows = acts.filter((a) => a.shift === s.v)
            return (
              <section
                key={s.v}
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/5"
                aria-label={`Turno ${s.label}`}
              >
                <header className="bg-ink-gradient flex items-center justify-between px-5 py-3">
                  <h2 className="font-display text-lg font-semibold text-gold-light">
                    Turno {s.label.toLowerCase()}
                  </h2>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEdit({ shift: s.v })}
                      className="bg-gold-gradient min-h-9 rounded-full px-4 text-sm font-semibold text-ink"
                    >
                      ＋ Agregar
                    </button>
                  )}
                </header>
                {rows.length === 0 ? (
                  <p className="px-5 py-6 text-ink/45">
                    Sin actividades{canEdit ? '. Agrega la primera.' : '.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-ink/5">
                    {rows.map((a) => {
                      const e = effective(a)
                      const badge =
                        e.status === 'running' || e.status === 'ended' ? LIVE[e.status] : STATUS[e.status]
                      return (
                        <li
                          key={a.id}
                          className="grid gap-2 px-5 py-4 md:grid-cols-[7rem_1fr_auto] md:items-start"
                          data-testid="activity"
                        >
                          <p className="font-display text-lg font-semibold tabular-nums">
                            {a.start_time}
                            {a.end_time && <span className="text-ink/40">–{a.end_time}</span>}
                          </p>
                          <div className="min-w-0">
                            {a.strategy && (
                              <p className="text-xs font-semibold uppercase tracking-wide text-gold-dark">
                                {a.strategy}
                              </p>
                            )}
                            <p className="font-semibold">{a.description}</p>
                            <p className="text-sm text-ink/60">
                              {[a.responsibles && `👤 ${a.responsibles}`, a.goal && `🎯 ${a.goal}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {a.places && <p className="text-sm text-ink/55">📍 {a.places}</p>}
                            <CaptureProgress a={a} />
                            {e.result && (
                              <p className="mt-1 text-sm italic text-ink/70">Logrado: “{e.result}”</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badge.cls}`}
                              data-testid="activity-status"
                            >
                              {badge.label}
                              {e.auto && ' · automático'}
                            </span>
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setClosing(a)
                                    // Al cerrar se sugiere el resultado con las captaciones contadas.
                                    const suggested =
                                      a.goal_count === null || a.captures >= a.goal_count
                                        ? 'done'
                                        : 'not_done'
                                    setCloseStatus(a.status === 'pending' ? suggested : a.status)
                                    setCloseResult(
                                      a.result ??
                                        `${a.captures} captaciones${a.goal_count !== null ? ` de ${a.goal_count}` : ''}`,
                                    )
                                  }}
                                  className="min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand"
                                >
                                  {a.ended || a.status !== 'pending' ? 'Corregir' : 'Cerrar ya'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEdit({ shift: a.shift, activity: a })}
                                  className="min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Quitar ${a.description}`}
                                  onClick={async () => {
                                    try {
                                      await del.mutateAsync(a.id)
                                      toast('Actividad quitada', 'success')
                                    } catch (e) {
                                      toast((e as Error).message, 'error')
                                    }
                                  }}
                                  className="min-h-9 rounded-full px-3 text-sm font-semibold text-rb-red ring-1 ring-rb-red/30"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </>
      )}

      {edit && branch && (
        <ActivityDialog
          branch={branch}
          day={day}
          shift={edit.shift}
          activity={edit.activity}
          suggestedGoal={suggestedGoal}
          onClose={() => setEdit(null)}
        />
      )}
      {closing && (
        <Dialog
          open
          onOpenChange={(o) => !o && setClosing(null)}
          title="Cerrar o corregir actividad"
          description={closing.description}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Resultado">
              {(['done', 'not_done', 'pending'] as ActivityStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={closeStatus === st}
                  onClick={() => setCloseStatus(st)}
                  className={`min-h-12 rounded-2xl border text-sm font-semibold ${closeStatus === st ? 'border-ink bg-ink text-gold-light' : 'border-ink/15 bg-white'}`}
                >
                  {st === 'pending' ? 'Automático' : STATUS[st].label.replace(/^[✓✕] /, '')}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80">
              ¿Qué se logró?{' '}
              <span className="font-normal text-ink/40">
                {[
                  closing.goal_count !== null && `meta: ${closing.goal_count} captaciones`,
                  closing.goal && `otra meta: ${closing.goal}`,
                ]
                  .filter(Boolean)
                  .join(' · ') || '(opcional)'}
              </span>
              <input
                value={closeResult}
                onChange={(e) => setCloseResult(e.target.value)}
                placeholder="Ej.: 3 ventas, 12 visitas pactadas"
                className="min-h-12 rounded-xl border border-ink/15 bg-white px-3 text-base font-normal"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setClosing(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={setResult.isPending}
                onClick={async () => {
                  try {
                    await setResult.mutateAsync({ id: closing.id, status: closeStatus, result: closeResult })
                    toast('✓ Actividad cerrada', 'success')
                    setClosing(null)
                  } catch (e) {
                    toast((e as Error).message, 'error')
                  }
                }}
              >
                Guardar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </main>
  )
}
