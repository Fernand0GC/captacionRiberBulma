import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { fmtDate, fmtTime, STAGE_LABEL } from '@/features/prospects/format'
import type { AgentAssignedRow, ProspectStage } from './api'
import {
  filterAssigned,
  ORIGIN_STAGES,
  OUTCOME_GROUPS,
  outcomeOf,
  summarizeAssigned,
  type AssignedFilter,
  type OutcomeGroup,
} from './assigned'

/** Colores de etapa (los mismos en «De dónde vienen», la barra y las píldoras de cada cliente). */
export const STAGE_COLOR: Record<ProspectStage, string> = {
  capture: '#8a8780',
  recapture: '#c27a12',
  followup: '#2f6fb0',
  interested: '#7a4bb5',
  sale: '#1f8a4c',
  lost: '#e31c25',
}
const OUTCOME_COLOR: Record<OutcomeGroup, string> = { ...STAGE_COLOR, same: '#b9b4a6', none: '#e31c25' }

const when = (iso: string) => `${fmtDate(iso).slice(0, 5)} ${fmtTime(iso)}`

function StagePill({ stage, outline }: { stage: ProspectStage; outline?: boolean }) {
  const c = STAGE_COLOR[stage]
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={outline ? { color: c, boxShadow: `inset 0 0 0 1.5px ${c}` } : { background: c, color: '#fff' }}
    >
      {STAGE_LABEL[stage]}
    </span>
  )
}

/** Pestaña «Asignados» del detalle de Actividad (spec 012): resumen, de dónde vienen, a qué pasaron y la lista. */
export function AssignedPanel({ rows, total }: { rows: AgentAssignedRow[]; total: number }) {
  const [f, setF] = useState<AssignedFilter>({ contact: 'all', origin: null, outcome: null })
  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-ink/50">
        No se le asignaron clientes en este período.
        <br />
        Sus contactos fueron a clientes de días anteriores (pestaña de contactos).
      </p>
    )

  const s = summarizeAssigned(rows)
  const list = filterAssigned(rows, f)
  const toggle = <K extends 'origin' | 'outcome'>(k: K, v: AssignedFilter[K]) =>
    setF((x) => ({ ...x, [k]: x[k] === v ? null : v }))
  const pending = s.total - s.contacted

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2" data-testid="assigned-kpis">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-ink/10">
          <p className="text-[10px] font-semibold uppercase text-ink/50 sm:text-xs sm:tracking-wide">Asignados</p>
          <p className="font-display text-3xl font-bold tabular-nums">{s.total}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-ink/10">
          <p className="text-[10px] font-semibold uppercase text-ink/50 sm:text-xs sm:tracking-wide">Contactados</p>
          <p className="font-display text-3xl font-bold tabular-nums">
            {s.contacted} <span className="text-base text-ink/50">{s.pct}%</span>
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
            <div className="h-full rounded-full bg-gold" style={{ width: `${s.pct}%` }} />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-ink/10">
          <p className="text-[10px] font-semibold uppercase text-ink/50 sm:text-xs sm:tracking-wide">Sin contactar</p>
          <p className={`font-display text-3xl font-bold tabular-nums ${pending ? 'text-rb-red' : ''}`}>{pending}</p>
        </div>
      </div>

      <section aria-label="De dónde vienen">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink/50">De dónde vienen</h3>
          <span className="text-xs text-ink/45">etapa del cliente al asignarse</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {ORIGIN_STAGES.map((st) => {
            const o = s.byOrigin[st]
            const on = f.origin === st
            return (
              <button
                key={st}
                type="button"
                disabled={o.n === 0}
                aria-pressed={on}
                onClick={() => toggle('origin', st)}
                className={`flex flex-col rounded-2xl border-t-4 p-2.5 text-left ring-1 disabled:opacity-45 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10 hover:bg-sand/60'}`}
                style={{ borderTopColor: STAGE_COLOR[st] }}
              >
                <span className="text-xs font-bold" style={{ color: on ? '#fff' : STAGE_COLOR[st] }}>
                  {STAGE_LABEL[st]}
                </span>
                <span className="font-display text-2xl font-bold tabular-nums">{o.n}</span>
                <span className={`text-xs ${on ? 'text-white/70' : 'text-ink/50'}`}>
                  {o.n ? `${o.contacted} contactados` : 'ninguno'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section aria-label="A qué proceso pasaron">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">A qué proceso pasaron</h3>
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
                onClick={() => toggle('outcome', g.key)}
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
        <span className="text-sm text-ink/50" data-testid="assigned-showing">
          {list.length} de {s.total}
          {s.contactedLater > 0 && ` · ${s.contactedLater} contactados al día siguiente o después`}
          {total > rows.length && ` · se muestran los primeros ${rows.length} de ${total}`}
        </span>
      </div>

      <ul className="flex flex-col" aria-label="Clientes asignados">
        <li className="hidden grid-cols-[1.2fr_1fr_1.3fr_1.2fr] gap-3 px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink/45 sm:grid" aria-hidden>
          <span>Cliente</span>
          <span>Asignado</span>
          <span>Contacto</span>
          <span>Proceso</span>
        </li>
        {list.length === 0 && <li className="py-6 text-center text-ink/50">Ningún cliente con este filtro.</li>}
        {list.map((r) => {
          const out = outcomeOf(r)
          return (
            <li
              key={r.prospect_id}
              data-testid="assigned-row"
              className="grid grid-cols-1 gap-1.5 rounded-2xl border-b border-ink/10 px-2 py-3 hover:bg-white sm:grid-cols-[1.2fr_1fr_1.3fr_1.2fr] sm:gap-3"
            >
              <div className="min-w-0">
                <Link to="/cliente/$id" params={{ id: r.prospect_id }} className="font-semibold hover:underline">
                  {r.full_name}
                </Link>
                {r.reassigned && (
                  <span className="mt-1 block w-fit rounded-full bg-rb-red/10 px-2 py-0.5 text-xs font-semibold text-rb-red">
                    {r.reassigned_to ? `Reasignado a ${r.reassigned_to}` : 'Quedó sin responsable'}
                    {r.reassigned_at && ` (${fmtDate(r.reassigned_at).slice(0, 5)})`}
                  </span>
                )}
              </div>
              <div className="min-w-0 text-sm">
                <span className="tabular-nums">{when(r.assigned_at)}</span>
                <span className="block text-ink/50">
                  {r.self_assigned ? 'Lo tomó por su cuenta' : `Asignó ${r.assigned_by ?? '—'}`}
                </span>
              </div>
              <div className="min-w-0 text-sm">
                {r.contacts > 0 && r.last_method && r.last_result ? (
                  <>
                    {METHOD_LABEL[r.last_method]} · {RESULT_LABEL[r.last_result]}
                    {r.last_note && <span className="text-ink/55"> · {r.last_note}</span>}
                    <span className="block text-xs tabular-nums text-ink/50">
                      {r.contacts} {r.contacts === 1 ? 'contacto' : 'contactos'}
                      {r.first_at && ` · 1.º ${when(r.first_at)}`}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold text-rb-red">⚠ Sin contactar</span>
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {out === 'none' || out === 'same' ? (
                  <>
                    <StagePill stage={r.stage_now} />
                    <span className="text-xs text-ink/50">{out === 'none' ? 'sigue igual' : 'sin cambio'}</span>
                  </>
                ) : (
                  <>
                    <StagePill stage={r.stage_at} outline />
                    <span className="text-ink/45" aria-label="pasó a">
                      →
                    </span>
                    <StagePill stage={r.stage_now} />
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
