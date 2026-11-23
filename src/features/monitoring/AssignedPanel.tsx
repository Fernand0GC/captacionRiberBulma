import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { SelectToggle, useAssignSelection, type AssignSelectionState, type Assignable } from '@/features/prospects/AssignSelection'
import { fmtDate, fmtTime, STAGE_LABEL } from '@/features/prospects/format'
import { useToast } from '@/ui/Toast'
import { useHideAssignedContacted, useSetAssignedHidden, type AgentActivityFilters, type AgentAssignedRow, type ProspectStage } from './api'
import {
  filterAssigned,
  keepKey,
  laPazDay,
  ORIGIN_STAGES,
  OUTCOME_GROUPS,
  outcomeOf,
  reassignable,
  shouldAskHide,
  singleBranch,
  summarizeAssigned,
  type AssignedFilter,
  type AssignedSummary,
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
export const OUTCOME_COLOR: Record<OutcomeGroup, string> = { ...STAGE_COLOR, same: '#b9b4a6', none: '#e31c25' }

const when = (iso: string) => `${fmtDate(iso).slice(0, 5)} ${fmtTime(iso)}`

export function StagePill({ stage, outline }: { stage: ProspectStage; outline?: boolean }) {
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

/** La persona del modal: los clientes reasignables siguen a su cargo (spec 020). */
export type AssignedActor = { id: string; name: string }

const NO_FILTER: AssignedFilter = { contact: 'all', origin: null, outcome: null, q: '', showHidden: false }

/** «Mantener» se recuerda en este navegador; si el almacenamiento falla, se vuelve a preguntar (spec 021). */
const readKeep = (k: string): string | null => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const writeKeep = (k: string, day: string): void => {
  try {
    localStorage.setItem(k, day)
  } catch {
    // Sin almacenamiento: el aviso solo se cierra por ahora.
  }
}
type ToggleKey = 'origin' | 'outcome'

/**
 * Pestaña «Asignados» del detalle de Actividad (spec 012): resumen, de dónde vienen, a qué pasaron y la lista.
 * Spec 020: lupa por nombre/celular y reasignar los sin contactar con la selección de Captaciones (`AssignSelection`).
 * Spec 021: aviso «¿ocultar los ya contactados?» (`HideNotice`), «Ver ocultos» y Ocultar/Mostrar por fila. Ocultar
 * es solo de esta vista: los indicadores de arriba cuentan todo el período, ocultos incluidos.
 * Cada bloque es una pieza aparte (`AssignedKpis`, `OriginSection`, `OutcomeSection`, `AssignedToolbar`,
 * `AssignedRowItem`) para sumar acciones sin reescribir la lista.
 */
export function AssignedPanel({
  rows,
  total,
  actor,
  filters,
  hiddenTotal,
  contactedVisible,
}: {
  rows: AgentAssignedRow[]
  total: number
  actor: AssignedActor
  /** Los de Actividad (período y sucursal): el «Ocultar» del aviso actúa sobre ese período. */
  filters: AgentActivityFilters
  hiddenTotal: number
  contactedVisible: number
}) {
  const [f, setF] = useState<AssignedFilter>(NO_FILTER)
  const list = filterAssigned(rows, f)
  const toast = useToast()
  const viewerId = useAuth().session?.user.id ?? ''
  const today = laPazDay()
  const kKey = keepKey(viewerId, actor.id)
  const [noticeClosed, setNoticeClosed] = useState(false)
  const askHide = !noticeClosed && shouldAskHide(contactedVisible, readKeep(kKey), today)
  const hideContacted = useHideAssignedContacted()
  const setHidden = useSetAssignedHidden()
  // Se ofrecen los reasignables visibles (respetan la lupa y los filtros); la sucursal sale de todos los del modal.
  const toAssignable = (r: AgentAssignedRow): Assignable => ({ id: r.prospect_id, assigned_to: actor.id, assigned_to_name: actor.name })
  const movable = reassignable(list).map(toAssignable)
  const branchId = singleBranch(reassignable(rows))
  const sel = useAssignSelection({
    filters: f,
    rows: movable,
    total: movable.length,
    branchId,
    fetchAll: () => Promise.resolve(movable),
    noun: 'clientes',
    layout: 'dialog',
    noBranchText: 'Clientes de varias sucursales: elige una sucursal en Actividad para reasignar.',
  })

  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-ink/50">
        No se le asignaron clientes en este período.
        <br />
        Sus contactos fueron a clientes de días anteriores (pestaña de contactos).
      </p>
    )

  const s = summarizeAssigned(rows)
  // «X de N»: N son los de la lista sin ocultos (o todos con «Ver ocultos»).
  const base = f.showHidden ? rows.length : rows.filter((r) => !r.hidden).length

  async function hideAllContacted() {
    try {
      const n = await hideContacted.mutateAsync({ filters, agentId: actor.id })
      setNoticeClosed(true)
      toast(`✓ ${n} ${n === 1 ? 'oculto' : 'ocultos'}`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  function keep() {
    writeKeep(kKey, today)
    setNoticeClosed(true)
  }
  async function setRowHidden(r: AgentAssignedRow, hidden: boolean) {
    try {
      await setHidden.mutateAsync({ agentId: actor.id, ids: [r.prospect_id], hidden })
      toast(hidden ? '✓ Oculto' : '✓ Visible de nuevo', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const toggle = <K extends ToggleKey>(k: K, v: AssignedFilter[K]) => setF((x) => ({ ...x, [k]: x[k] === v ? null : v }))
  const canMove = new Set(movable.map((m) => m.id))

  return (
    <div className="flex flex-col gap-4">
      {askHide && <HideNotice n={contactedVisible} busy={hideContacted.isPending} onHide={hideAllContacted} onKeep={keep} />}
      <AssignedKpis s={s} />
      <OriginSection s={s} active={f.origin} onToggle={(st) => toggle('origin', st)} />
      <OutcomeSection s={s} active={f.outcome} onToggle={(g) => toggle('outcome', g)} />
      <AssignedToolbar
        f={f}
        setF={setF}
        shown={list.length}
        base={base}
        s={s}
        hiddenTotal={hiddenTotal}
        loaded={rows.length}
        total={total}
        sel={sel}
        canSelect={reassignable(rows).length > 0}
      />

      <ul className="flex flex-col" aria-label="Clientes asignados">
        <li className="hidden grid-cols-[1.2fr_1fr_1.3fr_1.2fr] gap-3 px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink/45 sm:grid" aria-hidden>
          <span>Cliente</span>
          <span>Asignado</span>
          <span>Contacto</span>
          <span>Proceso</span>
        </li>
        {list.length === 0 && <li className="py-6 text-center text-ink/50">Ningún cliente con este filtro.</li>}
        {list.map((r) => (
          <AssignedRowItem
            key={r.prospect_id}
            r={r}
            sel={sel.selecting && canMove.has(r.prospect_id) ? sel : null}
            // En modo «Seleccionar» no se ofrece ocultar (una acción a la vez).
            onHidden={sel.selecting ? null : (hidden) => setRowHidden(r, hidden)}
            busy={setHidden.isPending}
          />
        ))}
      </ul>
      {sel.bar}
    </div>
  )
}

/** Spec 021: aviso al abrir el modal si hay contactados sin ocultar. Banda en línea (no un diálogo sobre el diálogo). */
function HideNotice({ n, busy, onHide, onKeep }: { n: number; busy: boolean; onHide: () => void; onKeep: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-gold/15 p-3 ring-1 ring-gold/40">
      <p className="min-w-0 flex-1 text-sm">
        <b className="tabular-nums">{n}</b> {n === 1 ? 'cliente ya fue contactado. ¿Ocultarlo de esta lista?' : 'clientes ya fueron contactados. ¿Ocultarlos de esta lista?'}
        <span className="block text-xs text-ink/55">No se borra nada ni cambian los números; se ven con «Ver ocultos».</span>
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onKeep} disabled={busy} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold ring-1 ring-ink/15 disabled:opacity-50">
          Mantener
        </button>
        <button type="button" onClick={onHide} disabled={busy} className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-gold-light disabled:opacity-50">
          Ocultar
        </button>
      </div>
    </div>
  )
}

function AssignedKpis({ s }: { s: AssignedSummary }) {
  const pending = s.total - s.contacted
  return (
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
  )
}

function OriginSection({ s, active, onToggle }: { s: AssignedSummary; active: ProspectStage | null; onToggle: (st: ProspectStage) => void }) {
  return (
    <section aria-label="De dónde vienen">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink/50">De dónde vienen</h3>
        <span className="text-xs text-ink/45">etapa del cliente al asignarse</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ORIGIN_STAGES.map((st) => {
          const o = s.byOrigin[st]
          const on = active === st
          return (
            <button
              key={st}
              type="button"
              disabled={o.n === 0}
              aria-pressed={on}
              onClick={() => onToggle(st)}
              className={`flex flex-col rounded-2xl border-t-4 p-2.5 text-left ring-1 disabled:opacity-45 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10 hover:bg-sand/60'}`}
              style={{ borderTopColor: STAGE_COLOR[st] }}
            >
              <span className="text-xs font-bold" style={{ color: on ? '#fff' : STAGE_COLOR[st] }}>
                {STAGE_LABEL[st]}
              </span>
              <span className="font-display text-2xl font-bold tabular-nums">{o.n}</span>
              <span className={`text-xs ${on ? 'text-white/70' : 'text-ink/50'}`}>{o.n ? `${o.contacted} contactados` : 'ninguno'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function OutcomeSection({ s, active, onToggle }: { s: AssignedSummary; active: OutcomeGroup | null; onToggle: (g: OutcomeGroup) => void }) {
  return (
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
          const on = active === g.key
          return (
            <button
              key={g.key}
              type="button"
              disabled={n === 0}
              aria-pressed={on}
              onClick={() => onToggle(g.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 disabled:opacity-45 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10'}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: OUTCOME_COLOR[g.key] }} />
              {g.label} <b className="tabular-nums">{n}</b>
            </button>
          )
        })}
      </div>
    </section>
  )
}

const CONTACT_TABS = [
  ['all', 'Todos'],
  ['done', 'Contactados'],
  ['none', 'Sin contactar'],
] as const

/** Contacto (Todos / Contactados / Sin contactar), lupa (spec 020), «Seleccionar», «Ver ocultos» (021) y «X de N». */
function AssignedToolbar({
  f,
  setF,
  shown,
  base,
  s,
  hiddenTotal,
  loaded,
  total,
  sel,
  canSelect,
}: {
  f: AssignedFilter
  setF: (fn: (x: AssignedFilter) => AssignedFilter) => void
  shown: number
  /** Total de la lista sin ocultos (o con ellos si «Ver ocultos» está encendido). */
  base: number
  s: AssignedSummary
  hiddenTotal: number
  loaded: number
  total: number
  sel: AssignSelectionState
  canSelect: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-sand p-1" role="group" aria-label="Contacto">
          {CONTACT_TABS.map(([k, label]) => (
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
        <input
          type="search"
          inputMode="search"
          aria-label="Buscar por nombre o celular"
          placeholder="Buscar nombre o celular…"
          value={f.q ?? ''}
          onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-ink/15 bg-white px-3 text-base outline-none placeholder:text-ink/35 focus:border-gold focus:ring-4 focus:ring-gold/20 sm:max-w-xs"
        />
        <SelectToggle sel={sel} disabled={!canSelect} />
      </div>
      {(hiddenTotal > 0 || f.showHidden) && (
        <label className="flex w-fit items-center gap-2 text-sm">
          <button
            type="button"
            role="switch"
            aria-checked={!!f.showHidden}
            aria-label="Ver ocultos"
            onClick={() => setF((x) => ({ ...x, showHidden: !x.showHidden }))}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 ${f.showHidden ? 'bg-ink' : 'bg-ink/20'}`}
          >
            <span aria-hidden className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${f.showHidden ? 'translate-x-5' : ''}`} />
          </button>
          <span className="font-semibold">Ver ocultos</span>
          <span className="text-ink/50" data-testid="hidden-count">
            {hiddenTotal} {hiddenTotal === 1 ? 'oculto' : 'ocultos'}
          </span>
        </label>
      )}
      <span className="text-sm text-ink/50" data-testid="assigned-showing">
        {shown} de {base}
        {s.contactedLater > 0 && ` · ${s.contactedLater} contactados al día siguiente o después`}
        {total > loaded && ` · se muestran los primeros ${loaded} de ${total}`}
      </span>
    </div>
  )
}

/**
 * Un cliente de la lista. `sel` solo llega si se puede reasignar y está el modo «Seleccionar».
 * Spec 021: `onHidden` (Ocultar / Mostrar) no llega en modo «Seleccionar».
 */
function AssignedRowItem({
  r,
  sel,
  onHidden,
  busy,
}: {
  r: AgentAssignedRow
  sel: AssignSelectionState | null
  onHidden: ((hidden: boolean) => void) | null
  busy: boolean
}) {
  const out = outcomeOf(r)
  return (
    <li
      data-testid="assigned-row"
      className="grid grid-cols-1 gap-1.5 rounded-2xl border-b border-ink/10 px-2 py-3 hover:bg-white sm:grid-cols-[1.2fr_1fr_1.3fr_1.2fr] sm:gap-3"
    >
      <div className="flex min-w-0 items-start gap-2">
        {sel && (
          <input
            type="checkbox"
            aria-label={`Seleccionar ${r.full_name}`}
            checked={sel.selected.has(r.prospect_id)}
            onChange={() => sel.toggle(r.prospect_id)}
            className="mt-0.5 size-5 shrink-0 accent-ink"
          />
        )}
        <div className="min-w-0">
          <Link to="/cliente/$id" params={{ id: r.prospect_id }} className="font-semibold hover:underline" data-testid="assigned-name">
            {r.full_name}
          </Link>
          {r.hidden && (
            <span className="ml-1.5 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink/60" data-testid="hidden-badge">
              Oculto
            </span>
          )}
          <span className="block text-xs tabular-nums text-ink/50" data-testid="assigned-phone">
            {r.phone_raw}
          </span>
          {r.reassigned && (
            <span className="mt-1 block w-fit rounded-full bg-rb-red/10 px-2 py-0.5 text-xs font-semibold text-rb-red">
              {r.reassigned_to ? `Reasignado a ${r.reassigned_to}` : 'Quedó sin responsable'}
              {r.reassigned_at && ` (${fmtDate(r.reassigned_at).slice(0, 5)})`}
            </span>
          )}
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <span className="tabular-nums">{when(r.assigned_at)}</span>
        <span className="block text-ink/50">{r.self_assigned ? 'Lo tomó por su cuenta' : `Asignó ${r.assigned_by ?? '—'}`}</span>
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
        {onHidden && (
          <button
            type="button"
            disabled={busy}
            aria-label={`${r.hidden ? 'Mostrar' : 'Ocultar'} ${r.full_name}`}
            onClick={() => onHidden(!r.hidden)}
            className="ml-auto min-h-9 rounded-lg px-2.5 text-xs font-semibold text-ink/60 ring-1 ring-ink/15 hover:bg-sand disabled:opacity-50"
          >
            {r.hidden ? 'Mostrar' : 'Ocultar'}
          </button>
        )}
      </div>
    </li>
  )
}
