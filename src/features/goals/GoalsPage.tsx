import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { Card } from '@/features/dashboard/charts'
import { useBranches } from '@/features/prospects/api'
import { fmtDate } from '@/features/prospects/format'
import { laPazDate } from '@/lib/dates'
import { digits, NUMERIC_INPUT } from '@/lib/numeric'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import {
  GOAL_KEYS,
  GOAL_LABEL,
  LINE_LABEL,
  useDailyConfig,
  useGoalMutation,
  useGoalsForDay,
  useMonthly,
  type GoalKey,
  type GoalSet,
} from './api'
import { GoalProgress } from './GoalProgress'

const EMPTY: GoalSet = { captures: null, contacts: null, potential: null, sales: null }
const inputCls = 'min-h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-lg tabular-nums outline-none focus:border-gold focus:ring-4 focus:ring-gold/20'

function GoalInputs({ value, onChange, idPrefix }: { value: GoalSet; onChange: (v: GoalSet) => void; idPrefix: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {GOAL_KEYS.map((k: GoalKey) => (
        <label key={k} className="flex flex-col gap-1 text-sm font-semibold text-ink/70" htmlFor={`${idPrefix}-${k}`}>
          {GOAL_LABEL[k]}
          <input
            id={`${idPrefix}-${k}`}
            {...NUMERIC_INPUT}
            placeholder="Sin meta"
            value={value[k] ?? ''}
            onChange={(e) => {
              const n = digits(e.target.value)
              onChange({ ...value, [k]: n === '' ? null : Number(n) })
            }}
            className={inputCls}
          />
        </label>
      ))}
    </div>
  )
}

function DailyTab({ branch }: { branch: number }) {
  const toast = useToast()
  const today = laPazDate(new Date())
  const cfg = useDailyConfig(branch)
  const todayGoals = useGoalsForDay(branch)
  const setBase = useGoalMutation<GoalSet>('set_daily_base', (g) => ({ p_branch: branch, g }))
  const setOverride = useGoalMutation<{ day: string; g: (GoalSet & { note?: string }) | null }>('set_daily_override', (v) => ({
    p_branch: branch,
    p_day: v.day,
    g: v.g,
  }))

  const [base, setBaseVal] = useState<GoalSet | null>(null)
  const [day, setDay] = useState(today)
  const [adj, setAdj] = useState<GoalSet | null>(null)
  const [note, setNote] = useState('')
  const [adjFor, setAdjFor] = useState('')

  const savedBase: GoalSet = cfg.data?.base ? { ...EMPTY, ...cfg.data.base } : EMPTY
  const baseValue = base ?? savedBase
  const existing = cfg.data?.overrides.find((o) => o.day === day)
  // Al cambiar de día, el formulario del ajuste arranca con el ajuste guardado o con la base.
  if (cfg.data && adjFor !== `${day}|${existing?.day ?? ''}`) {
    setAdjFor(`${day}|${existing?.day ?? ''}`)
    setAdj(existing ? { ...EMPTY, ...existing } : savedBase)
    setNote(existing?.note ?? '')
  }

  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p
      toast(ok, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="Hoy" subtitle={todayGoals.data?.adjusted ? `Meta ajustada${todayGoals.data.note ? ` · ${todayGoals.data.note}` : ''}` : 'Meta base'}>
        {!todayGoals.data ? (
          <p className="text-ink/45">Cargando…</p>
        ) : GOAL_KEYS.some((k) => todayGoals.data!.goals[k] !== null) ? (
          <GoalProgress data={todayGoals.data} />
        ) : (
          <p className="text-ink/45">Todavía no hay metas. Carga la meta base abajo.</p>
        )}
      </Card>

      <Card title="Meta base" subtitle="Se aplica todos los días. Deja vacío lo que no tenga meta.">
        <GoalInputs idPrefix="base" value={baseValue} onChange={setBaseVal} />
        <div>
          <Button disabled={setBase.isPending} onClick={() => void run(setBase.mutateAsync(baseValue).then(() => setBaseVal(null)), '✓ Meta base guardada')}>
            Guardar meta base
          </Button>
        </div>
      </Card>

      <Card title="Ajustar un día" subtitle="Para un día puntual (feria, feriado, campaña). Reemplaza la base solo ese día.">
        <label className="flex max-w-xs flex-col gap-1 text-sm font-semibold text-ink/70">
          Día
          <input type="date" value={day} min={today} onChange={(e) => e.target.value && setDay(e.target.value)} className={inputCls} />
        </label>
        <GoalInputs idPrefix="adj" value={adj ?? EMPTY} onChange={setAdj} />
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
          Motivo <span className="font-normal text-ink/40">(opcional)</span>
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: Feria del barrio" className={inputCls} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={setOverride.isPending} onClick={() => void run(setOverride.mutateAsync({ day, g: { ...(adj ?? EMPTY), note } }), '✓ Ajuste guardado')}>
            Guardar ajuste
          </Button>
          {existing && (
            <Button variant="secondary" disabled={setOverride.isPending} onClick={() => void run(setOverride.mutateAsync({ day, g: null }), 'Ajuste quitado: vuelve la base')}>
              Quitar ajuste
            </Button>
          )}
        </div>
        {cfg.data && cfg.data.overrides.filter((o) => o.day >= today).length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-ink/5 pt-3 text-sm">
            {cfg.data.overrides
              .filter((o) => o.day >= today)
              .map((o) => (
                <li key={o.day}>
                  <button type="button" onClick={() => setDay(o.day)} className="text-left underline-offset-2 hover:underline">
                    <strong>{fmtDate(`${o.day}T12:00:00-04:00`)}</strong>
                    {o.note && ` · ${o.note}`} ·{' '}
                    {GOAL_KEYS.filter((k) => o[k] !== null)
                      .map((k) => `${GOAL_LABEL[k].split(' ')[0]} ${o[k]}`)
                      .join(', ')}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function MonthlyTab({ branch, isGlobal }: { branch: number | undefined; isGlobal: boolean }) {
  const toast = useToast()
  const [month, setMonth] = useState(laPazDate(new Date()).slice(0, 7))
  const rows = useMonthly(`${month}-01`, branch)
  const setGoal = useGoalMutation<{ branch: number; line: string; units: number | null }>('set_monthly_goal', (v) => ({
    p_branch: v.branch,
    p_line: v.line,
    p_month: `${month}-01`,
    p_units: v.units,
  }))
  const [draft, setDraft] = useState<Record<string, string>>({})

  async function save(branchId: number, line: string, key: string) {
    const raw = draft[key]
    if (raw === undefined) return
    try {
      await setGoal.mutateAsync({ branch: branchId, line, units: raw === '' ? null : Math.max(0, Number(raw)) })
      setDraft((d) => {
        const n = { ...d }
        delete n[key]
        return n
      })
      toast('✓ Meta mensual guardada', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <Card title="Ventas por línea (mensual)" subtitle="Unidades vendidas en el mes según la línea del producto">
      <label className="flex max-w-xs flex-col gap-1 text-sm font-semibold text-ink/70">
        Mes
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls} />
      </label>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-ink/50">
              {[...(isGlobal ? ['Sucursal'] : []), 'Línea', 'Meta', 'Vendidas', 'Saldo', 'Avance', 'Obj. por día'].map((h) => (
                <th key={h} scope="col" className="py-2 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.data?.map((r) => {
              const key = `${r.branch_id}|${r.line}`
              const pct = r.goal ? Math.round((r.sales / r.goal) * 100) : null
              return (
                <tr key={key} className="border-b border-ink/5 last:border-0">
                  {isGlobal && <td className="py-2 pr-3">{r.branch_name}</td>}
                  <td className="py-2 pr-3 font-semibold">{LINE_LABEL[r.line]}</td>
                  <td className="py-2 pr-3">
                    <input
                      {...NUMERIC_INPUT}
                      aria-label={`Meta ${LINE_LABEL[r.line]} ${r.branch_name}`}
                      placeholder="—"
                      value={draft[key] ?? (r.goal ?? '')}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: digits(e.target.value) }))}
                      onBlur={() => void save(r.branch_id, r.line, key)}
                      className="min-h-10 w-24 rounded-lg border border-ink/15 px-2 tabular-nums"
                    />
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{r.sales}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.goal !== null ? r.remaining : '—'}</td>
                  <td className="py-2 pr-3 tabular-nums">{pct !== null ? `${pct}%` : '—'}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.daily_target ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** Metas: diarias por sucursal y etapa (base + ajustes) y mensuales de ventas por línea. */
export function GoalsPage() {
  const { profile } = useAuth()
  const scope = useBranchScope()
  const isGlobal = scope.canPick
  const branches = useBranches()
  const [branchSel, setBranchSel] = useState<number | undefined>(undefined)
  const branch = isGlobal ? (branchSel ?? scope.fallback) : (profile?.branch_id ?? undefined)
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily')
  const branchName = branches.data?.find((b) => b.id === branch)?.name

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6">
      <PageTitle
        title="Metas"
        subtitle={branchName ?? (isGlobal ? 'Elige una sucursal' : undefined)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isGlobal && (
              <select aria-label="Sucursal" value={branch ?? ''} onChange={(e) => setBranchSel(e.target.value ? Number(e.target.value) : undefined)} className="min-h-10 rounded-full border border-ink/15 bg-white px-3 text-sm">
                {scope.allowAll && (<option value="">{tab === 'monthly' ? 'Todas las sucursales' : 'Elegir sucursal…'}</option>)}
                {scope.options?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex rounded-full bg-white p-1 ring-1 ring-ink/10" role="tablist" aria-label="Tipo de meta">
              {[
                { v: 'daily' as const, label: 'Diarias' },
                { v: 'monthly' as const, label: 'Mensuales' },
              ].map((t) => (
                <button key={t.v} type="button" role="tab" aria-selected={tab === t.v} onClick={() => setTab(t.v)} className={`min-h-9 rounded-full px-4 text-sm font-semibold ${tab === t.v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        }
      />
      {tab === 'daily' ? (
        branch ? (
          <DailyTab key={branch} branch={branch} />
        ) : (
          <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">Elige una sucursal para ver y poner sus metas diarias.</p>
        )
      ) : (
        <MonthlyTab branch={branch} isGlobal={isGlobal && branch === undefined} />
      )}
    </main>
  )
}
