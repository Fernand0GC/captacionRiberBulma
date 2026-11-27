import type { DayGoals, ShownGoalKey } from './api'

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
