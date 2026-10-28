import type { ReactNode } from 'react'

type Tone = 'neutral' | 'warning' | 'success' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink/5 text-ink/70',
  warning: 'bg-gold/15 text-gold-dark ring-1 ring-gold/30',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  danger: 'bg-rb-red/10 text-rb-red ring-1 ring-rb-red/20',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${TONES[tone]}`}>{children}</span>
  )
}
