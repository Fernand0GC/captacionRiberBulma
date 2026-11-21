import { useState } from 'react'
import { fmtDate, fmtTime } from '@/features/prospects/format'
import { laPazDate } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { useReferrerFollowup, useReferrerHistory } from './api'
import { AskDialog } from './AskDialog'
import { ASK_METHOD_LABEL, ASK_RESULT_LABEL, shortDate, type AskResult } from './asks'

// Historial de pedidos de un referidor en su ventana de detalle (spec 017, US4) con el botón «Pedir referidos».

/** Color del chip de cada resultado; también lo usa «En qué quedó» en la tabla de Seguimiento. */
export const ASK_RESULT_TONE: Record<AskResult, string> = {
  passed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  promised: 'bg-gold/15 text-gold-dark ring-gold/30',
  none_now: 'bg-gold/15 text-gold-dark ring-gold/30',
  no_answer: 'bg-ink/5 text-ink/60 ring-ink/10',
  waiting: 'bg-ink/5 text-ink/60 ring-ink/10',
  quit: 'bg-rb-red/10 text-rb-red ring-rb-red/20',
}

export function ReferrerAsks({ referrerId, branchId }: { referrerId: number; branchId: number | undefined }) {
  const history = useReferrerHistory(referrerId)
  const today = laPazDate(new Date())
  // El referidor con su último pedido y celular (para la ventana «Pedir»).
  const followup = useReferrerFollowup({ branch_id: branchId, from: today, to: today })
  const referrer = followup.data?.referrers.find((r) => r.id === referrerId)
  const [asking, setAsking] = useState(false)
  const items = history.data ?? []
  const asks = items.filter((a) => !a.auto).length

  return (
    <section aria-label="Pedidos de referidos" className="mt-4 flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-ink/10" data-testid="referrer-asks">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink/50">
          Pedidos de referidos <span className="tabular-nums">· {asks}</span>
        </h3>
        {referrer && (
          <Button variant="dark" className="min-h-10 px-3 text-sm" onClick={() => setAsking(true)}>
            Pedir referidos
          </Button>
        )}
      </div>
      {history.isError ? (
        <p className="text-sm text-rb-red">{history.error.message}</p>
      ) : !history.data ? (
        <p className="text-sm text-ink/45">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/50">Todavía nadie le pidió referidos.</p>
      ) : (
        <ol className="flex max-h-72 flex-col overflow-y-auto">
          {items.map((a, i) => (
            <li key={`${a.at}-${i}`} className="grid grid-cols-[4.5rem_1fr] gap-3 border-b border-ink/5 py-2 last:border-b-0" data-testid="referrer-ask-row">
              <span className="text-sm tabular-nums text-ink/55">
                {fmtDate(a.at).slice(0, 5)}
                <span className="block text-xs">{fmtTime(a.at)}</span>
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${ASK_RESULT_TONE[a.result]}`}>{ASK_RESULT_LABEL[a.result]}</span>
                  <span className="text-sm">
                    {a.auto ? 'Al cargar referidos' : a.method ? ASK_METHOD_LABEL[a.method] : ''}
                    {a.actor_name && ` · ${a.actor_name}`}
                  </span>
                  {a.result === 'promised' && a.kept !== null && (
                    <span className={`text-xs font-semibold ${a.kept ? 'text-emerald-700' : 'text-ink/45'}`}>{a.kept ? '✓ cumplió' : 'sin cumplir'}</span>
                  )}
                </span>
                {a.note && <span className="mt-0.5 block text-sm text-ink/60">{a.note}</span>}
                {a.next_on && <span className="block text-xs text-ink/45">Volver a pedir el {shortDate(a.next_on)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {asking && referrer && followup.data && (
        <AskDialog candidates={[referrer]} initial={[referrer.id]} today={followup.data.today} onClose={() => setAsking(false)} />
      )}
    </section>
  )
}
