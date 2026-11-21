import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { OUTCOME_COLOR, StagePill } from '@/features/monitoring/AssignedPanel'
import { fmtDate, fmtTime } from '@/features/prospects/format'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import type { RangeContact } from './api'
import { ReferrerAsks } from './ReferrerAsks'
import { contactsOf, filterReferrals, OUTCOME_GROUPS, referralOutcome, summarizeReferrals, type ReferralFilter } from './detail'

// Detalle de un referidor (spec 016, US3), con el diseño de «Asignados del día» (spec 012): resumen, quién los
// atiende, a qué proceso pasaron y la lista con el último contacto.

const when = (iso: string) => `${fmtDate(iso).slice(0, 5)} ${fmtTime(iso)}`
const waitLabel = (d: number | null) => (d === null ? '' : d === 0 ? 'llegó hoy' : `espera ${d} día${d === 1 ? '' : 's'}`)

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-ink/10">
      <p className="text-[10px] font-semibold uppercase text-ink/50 sm:text-xs sm:tracking-wide">{label}</p>
      {children}
    </div>
  )
}

export function ReferrerDetailDialog({
  name,
  subtitle,
  list,
  onClose,
  referrerId,
  branchId,
}: {
  name: string
  subtitle: string
  list: RangeContact[]
  onClose: () => void
  /** Spec 017: con el id se muestra el historial de pedidos y el botón «Pedir referidos». */
  referrerId?: number
  branchId?: number
}) {
  const toast = useToast()
  const [f, setF] = useState<ReferralFilter>({ contact: 'all', outcome: null })
  const [exporting, setExporting] = useState(false)
  const s = summarizeReferrals(list)
  const shown = filterReferrals(list, f)

  const onExport = async () => {
    setExporting(true)
    try {
      const { exportContacts } = await import('./exportReferrals')
      await exportContacts(shown, { title: `Referidos de ${name}` })
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open size="xl" onOpenChange={(o) => !o && onClose()} title={`${name} · Referidos`} description={subtitle}>
      {list.length === 0 ? (
        <p className="py-6 text-center text-ink/50">No tiene referidos en este período.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="referrer-detail-kpis">
            <Kpi label="Llegaron">
              <p className="font-display text-3xl font-bold tabular-nums">{s.total}</p>
            </Kpi>
            <Kpi label="Contactados">
              <p className="font-display text-3xl font-bold tabular-nums">
                {s.contacted} <span className="text-base text-ink/50">{s.pct}%</span>
              </p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
                <div className="h-full rounded-full bg-gold" style={{ width: `${s.pct}%` }} />
              </div>
            </Kpi>
            <Kpi label="Sin contactar">
              <p className={`font-display text-3xl font-bold tabular-nums ${s.pending ? 'text-rb-red' : ''}`}>{s.pending}</p>
              {s.maxWait !== null && s.maxWait > 0 && (
                <p className="text-xs text-ink/50">
                  el que más espera: {s.maxWait} día{s.maxWait === 1 ? '' : 's'}
                </p>
              )}
            </Kpi>
            <Kpi label="Compraron">
              <p className="font-display text-3xl font-bold tabular-nums">
                {s.sold} <span className="text-base text-ink/50">{s.soldPct}%</span>
              </p>
            </Kpi>
          </div>

          <section aria-label="Quién los atiende">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink/50">Quién los atiende</h3>
              <span className="text-xs text-ink/45">responsable actual · toca para filtrar</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {s.byAssignee.map((g) => {
                const on = f.assignee === g.name
                const missing = g.n - g.contacted
                return (
                  <button
                    key={g.name ?? '__none'}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setF((x) => ({ ...x, assignee: x.assignee === g.name ? undefined : g.name }))}
                    className={`flex flex-col rounded-2xl border-t-4 p-2.5 text-left ring-1 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10 hover:bg-sand/60'}`}
                    style={{ borderTopColor: g.name === null ? '#e31c25' : '#c9a227' }}
                  >
                    <span className={`truncate text-xs font-bold ${g.name === null && !on ? 'text-rb-red' : ''}`}>{g.name ?? 'Sin asignar'}</span>
                    <span className="font-display text-2xl font-bold tabular-nums">{g.n}</span>
                    <span className={`text-xs ${on ? 'text-white/70' : missing ? 'text-rb-red' : 'text-ink/50'}`}>
                      {g.contacted} contactados{missing ? ` · ${missing} sin contactar` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section aria-label="A qué proceso pasaron">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink/50">A qué proceso pasaron</h3>
              <span className="text-xs text-ink/45">etapa de hoy</span>
            </div>
            <div className="flex h-3.5 overflow-hidden rounded-full bg-sand" aria-hidden>
              {OUTCOME_GROUPS.filter((g) => s.byOutcome[g.key]).map((g) => (
                <i key={g.key} style={{ width: `${(s.byOutcome[g.key] * 100) / s.total}%`, background: OUTCOME_COLOR[g.key] }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OUTCOME_GROUPS.map((g) => {
                const n = s.byOutcome[g.key]
                const on = f.outcome === g.key
                return (
                  <button
                    key={g.key}
                    type="button"
                    disabled={n === 0}
                    aria-pressed={on}
                    onClick={() => setF((x) => ({ ...x, outcome: x.outcome === g.key ? null : g.key }))}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 disabled:opacity-45 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10'}`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: OUTCOME_COLOR[g.key] }} />
                    {g.label} <b className="tabular-nums">{n}</b>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-xl bg-sand p-1" role="group" aria-label="Contacto">
              {(
                [
                  ['all', 'Todos'],
                  ['done', 'Contactados'],
                  ['none', 'Sin contactar'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={f.contact === k}
                  onClick={() => setF((x) => ({ ...x, contact: k }))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${f.contact === k ? 'bg-white text-ink shadow-sm' : 'text-ink/55'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-sm text-ink/50" data-testid="referrer-detail-showing">
              {shown.length} de {s.total}
            </span>
          </div>

          <ul className="flex flex-col" aria-label="Referidos">
            <li className="hidden grid-cols-[1.2fr_1fr_1.4fr_1fr_0.9fr] gap-3 px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink/45 sm:grid" aria-hidden>
              <span>Cliente</span>
              <span>Llegó</span>
              <span>Contacto</span>
              <span>Proceso</span>
              <span>Responsable</span>
            </li>
            {shown.length === 0 && <li className="py-6 text-center text-ink/50">Ningún referido con este filtro.</li>}
            {shown.map((c) => {
              const out = referralOutcome(c)
              const n = contactsOf(c)
              return (
                <li
                  key={c.id}
                  data-testid="referrer-detail-row"
                  className="grid grid-cols-1 gap-1.5 rounded-2xl border-b border-ink/10 px-2 py-3 hover:bg-white sm:grid-cols-[1.2fr_1fr_1.4fr_1fr_0.9fr] sm:gap-3"
                >
                  <div className="min-w-0">
                    <Link to="/cliente/$id" params={{ id: c.id }} className="font-semibold hover:underline">
                      {c.full_name}
                    </Link>
                    <span className="block text-xs tabular-nums text-ink/50">
                      {c.phone}
                      {c.product && ` · ${c.product}`}
                    </span>
                  </div>
                  <div className="min-w-0 text-sm">
                    <span className="tabular-nums">{when(c.arrived_at)}</span>
                    {c.registered_by && <span className="block text-ink/50">Registró {c.registered_by}</span>}
                  </div>
                  <div className="min-w-0 text-sm">
                    {n > 0 ? (
                      <>
                        {c.last_method && c.last_result ? (
                          <>
                            {METHOD_LABEL[c.last_method]} · {RESULT_LABEL[c.last_result]}
                            {c.last_note && <span className="text-ink/55"> · {c.last_note}</span>}
                          </>
                        ) : (
                          'Contactado'
                        )}
                        <span className="block text-xs tabular-nums text-ink/50">
                          {n} {n === 1 ? 'contacto' : 'contactos'}
                          {c.first_contact_at && ` · 1.º ${when(c.first_contact_at)}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-rb-red">⚠ Sin contactar</span>
                        {c.days_waiting !== null && <span className="block text-xs font-semibold text-rb-red">{waitLabel(c.days_waiting)}</span>}
                      </>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <StagePill stage={c.stage} outline={out === 'none' || out === 'same'} />
                    {out === 'same' && <span className="text-xs text-ink/50">sin cambio</span>}
                    {c.sold_at && <span className="text-xs text-ink/50">compró {fmtDate(c.sold_at).slice(0, 5)}</span>}
                  </div>
                  <div className="min-w-0 text-sm">{c.assigned_to ?? <span className="text-rb-red">Sin asignar</span>}</div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {referrerId !== undefined && <ReferrerAsks referrerId={referrerId} branchId={branchId} />}
      <div className="mt-4 flex gap-2 border-t border-ink/10 pt-4">
        {shown.length > 0 && (
          <Button variant="secondary" disabled={exporting} onClick={() => void onExport()}>
            {exporting ? 'Descargando…' : 'Descargar Excel'}
          </Button>
        )}
        <Button className="flex-1" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Dialog>
  )
}
