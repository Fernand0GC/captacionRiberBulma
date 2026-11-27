import type { ChannelGoal, DayGoals, ShownGoalKey } from './api'

const SHOWN_GOAL_KEYS: ShownGoalKey[] = ['captures', 'contacts', 'potential', 'sales', 'shares']

export function shownGoalKeys(data: DayGoals): ShownGoalKey[] {
  return SHOWN_GOAL_KEYS.filter((key) => data.goals[key] !== null && data.goals[key] !== undefined)
}

export function todaySubtitle(data: DayGoals): string {
  let subtitle = data.adjusted ? 'Meta ajustada' : 'Meta base'
  if (data.note) subtitle += ` · ${data.note}`
  if (data.captures_from_plan) subtitle += ' · Captaciones desde la Planificación'
  return subtitle
}

export function channelBreakdown(rows: ChannelGoal[]) {
  if (rows.length === 0) return null

  const withPct = (row: ChannelGoal): ChannelGoal & { pct: string } => ({
    ...row,
    pct: row.goal === 0 ? '—' : `${Math.round(row.result / row.goal * 100)}%`,
  })
  const total = rows.reduce<ChannelGoal>((sum, row) => ({
    channel: 'Total',
    goal: sum.goal + row.goal,
    result: sum.result + row.result,
    share_goal: sum.share_goal + row.share_goal,
    share_result: sum.share_result + row.share_result,
  }), { channel: 'Total', goal: 0, result: 0, share_goal: 0, share_result: 0 })

  return {
    rows: rows.map((row) => withPct(row)),
    total: withPct(total),
    showShares: rows.some((row) => row.share_goal > 0),
  }
}
