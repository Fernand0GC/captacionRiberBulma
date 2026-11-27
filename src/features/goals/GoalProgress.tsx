import { SERIES } from '@/features/dashboard/charts'
import { GOAL_LABEL, type DayGoals } from './api'
import { shownGoalKeys } from './logic'

/** Avance contra la meta: barra (meta = 100%), "34 / 50" y %. Solo las etapas con meta. */
export function GoalProgress({ data, compact }: { data: DayGoals; compact?: boolean }) {
  const keys = shownGoalKeys(data)
  if (!keys.length) return null
  return (
    <ul className={`grid gap-4 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
      {keys.map((k) => {
        const goal = data.goals[k] ?? 0
        const done = data.actuals[k] ?? 0
        const pct = goal > 0 ? Math.round((done / goal) * 100) : 100
        const ok = done >= goal
        return (
          <li key={k} className="flex flex-col gap-2" data-testid={`goal-${k}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-ink/70">{GOAL_LABEL[k]}</span>
              <span className={`text-xs font-semibold ${ok ? 'text-emerald-700' : 'text-ink/45'}`}>{ok ? '✓ cumplida' : `${pct}%`}</span>
            </div>
            <p className="font-display text-3xl font-bold tabular-nums text-ink">
              {done} <span className="text-lg font-semibold text-ink/40">/ {goal}</span>
            </p>
            <div className="h-2.5 w-full rounded-full bg-ink/8" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={done} aria-label={GOAL_LABEL[k]}>
              <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: ok ? '#15803d' : SERIES }} />
            </div>
            {!ok && <p className="text-xs text-ink/45">faltan {goal - done}</p>}
          </li>
        )
      })}
    </ul>
  )
}
