import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ROLE_LABEL } from '@/features/auth/types'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { dueStatus } from '@/features/followup/dueStatus'
import { pageOf } from '@/features/followup/inboxView'
import { SelectToggle, useAssignSelection, type AssignSelectionState } from '@/features/prospects/AssignSelection'
import { fmtDate, fmtTime, STAGE_LABEL } from '@/features/prospects/format'
import { Dialog } from '@/ui/Dialog'
import type { LateType } from '@/features/followup/dueStatus'
import {
  agendaByPerson,
  agendaTotals,
  filterLate,
  lateAssignable,
  lateBranch,
  type AgendaBucket,
  type AgendaPersonView,
  type LateAge,
  type LateFilter,
} from './agenda'
import { PriorityBadge, PriorityButton } from './PriorityAction'
import { useRecontactAgenda, type AgendaRow } from './api'

const PAGE = 25

const BUCKETS: { key: AgendaBucket; label: string; empty: string }[] = [
  { key: 'pending', label: 'Pendientes', empty: 'No le queda nada pendiente para hoy.' },
  { key: 'done', label: 'Contactados hoy', empty: 'Todavía no contactó a nadie hoy.' },
  { key: 'late', label: 'Atrasados', empty: 'No tiene atrasados.' },
]

/** Spec 026: filtros del desglose de Atrasados. */
const AGES: { key: LateAge; label: string }[] = [
  { key: 'd1', label: '1 día' },
  { key: 'd2to7', label: '2 a 7 días' },
  { key: 'over7', label: 'Más de 7 días' },
]
const TYPES: { key: LateType; label: string }[] = [
  { key: 'never', label: 'Nunca contactado' },
  { key: 'overdue', label: 'Fecha vencida' },
]
const NO_LATE_FILTER: LateFilter = { age: null, type: null }

/**
 * Agenda de recontacto de «Del día» (spec 023): por persona, lo que le tocaba hoy, a cuántos contactó, cuántos le
 * quedan y cuántos arrastra de días anteriores. Misma regla que «Mis contactos» (agenda.ts), solo para hoy.
 */
export function AgendaSection({
  branchId,
  isToday,
  referred,
  onGoToday,
}: {
  branchId: number | undefined
  isToday: boolean
  /** «Solo referidos» activo en «Del día»: la agenda igual incluye todos los orígenes. */
  referred: boolean
  onGoToday: () => void
}) {
  const q = useRecontactAgenda(branchId, isToday)
  const [openId, setOpenId] = useState<string | null>(null)
  // La regla depende de la hora: se fija al recibir los datos para que la tabla y el detalle digan lo mismo.
  const people = useMemo(() => (q.data ? agendaByPerson(q.data, new Date(q.dataUpdatedAt)) : []), [q.data, q.dataUpdatedAt])
  const totals = agendaTotals(people)
  const open = people.find((p) => p.id === openId)

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5" aria-labelledby="agenda-title" data-testid="agenda">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="agenda-title" className="font-display text-xl font-bold">
          Agenda de recontacto
        </h2>
        <p className="text-sm text-ink/55">
          Clientes que cada persona tenía que contactar hoy (rellamadas, recaptación y asignados nuevos), igual que su «Mis contactos».
          {referred && <span className="ml-1 font-semibold text-ink/70">Incluye todos los orígenes.</span>}
        </p>
      </div>

      {!isToday ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sand/60 p-3" data-testid="agenda-only-today">
          <p className="text-ink/70">La agenda de recontacto solo está disponible para hoy.</p>
          <button type="button" onClick={onGoToday} className="min-h-11 rounded-full bg-ink px-4 font-semibold text-gold-light">
            Ir a hoy
          </button>
        </div>
      ) : q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-3 text-rb-red">No se pudo cargar la agenda. {(q.error as Error).message}</p>
      ) : q.isPending ? (
        <p className="py-4 text-center text-ink/50">Cargando agenda…</p>
      ) : people.length === 0 ? (
        <p className="py-4 text-center text-ink/50">No hay personal ni clientes en la agenda de hoy.</p>
      ) : (
        <>
          {q.data.truncated && (
            <p className="rounded-2xl bg-gold/15 p-3 text-sm text-gold-dark">
              Hay demasiados clientes para mostrarlos todos: elige una sucursal para ver la agenda completa.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm" aria-label="Agenda de recontacto por persona">
              <thead className="bg-ink text-gold-light">
                <tr>
                  <th scope="col" className="rounded-l-2xl px-3 py-3 text-left">Persona</th>
                  <th scope="col" className="px-3 py-3 text-right" title="Pendientes + contactados hoy">Le tocaba hoy</th>
                  <th scope="col" className="px-3 py-3 text-right">Contactó</th>
                  <th scope="col" className="px-3 py-3 text-right">Pendientes</th>
                  <th scope="col" className="rounded-r-2xl px-3 py-3 text-right" title="De días anteriores, todavía sin contacto">Atrasados</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} data-testid="agenda-row" className="border-t border-ink/5 even:bg-cream/60">
                    <th scope="row" className="px-3 py-2.5 text-left font-normal">
                      <button
                        type="button"
                        onClick={() => setOpenId(p.id)}
                        className="text-left font-semibold hover:text-gold-dark hover:underline"
                      >
                        {p.full_name}
                      </button>
                      <span className="block text-xs text-ink/45">{ROLE_LABEL[p.role]}</span>
                    </th>
                    <Num n={p.due} />
                    <Num n={p.done.length} />
                    <Num n={p.pending.length} warn note={p.priority ? `★ ${p.priority} prioridad` : undefined} />
                    <Num n={p.late.length} alert />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink/10 bg-sand font-semibold" data-testid="agenda-total">
                  <th scope="row" className="px-3 py-3 text-left">Total</th>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.due}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.done}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.pending}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.late}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {open && q.data && <AgendaDialog person={open} at={new Date(q.dataUpdatedAt)} onClose={() => setOpenId(null)} />}
    </section>
  )
}

function Num({ n, warn, alert, note }: { n: number; warn?: boolean; alert?: boolean; note?: string }) {
  const tone = n === 0 ? 'text-ink/30' : alert ? 'font-semibold text-rb-red' : warn ? 'font-semibold text-gold-dark' : ''
  return (
    <td className={`px-3 py-2.5 text-right tabular-nums ${tone}`}>
      {n}
      {note && <span className="block text-xs font-normal text-ink/50">{note}</span>}
    </td>
  )
}

function AgendaDialog({ person, at, onClose }: { person: AgendaPersonView; at: Date; onClose: () => void }) {
  const first = BUCKETS.find((b) => person[b.key].length > 0)?.key ?? 'pending'
  const [tab, setTab] = useState<AgendaBucket>(first)
  const [page, setPage] = useState(0)
  // Spec 026: en Atrasados se filtra por antigüedad y tipo; la selección y «Poner para hoy» usan lo filtrado.
  const [lf, setLf] = useState<LateFilter>(NO_LATE_FILTER)
  const lateRows = filterLate(person.late, lf, at)
  const list = tab === 'late' ? lateRows : person[tab]
  const p = pageOf(list, page, PAGE)
  const empty = BUCKETS.find((b) => b.key === tab)!.empty
  // Spec 025: solo los atrasados se reasignan desde acá (lo de hoy todavía le toca a esta persona).
  const late = lateAssignable(person, lateRows)
  const agent = { id: person.id, name: person.full_name }
  const sel = useAssignSelection({
    filters: { person: person.id, tab, lf },
    rows: tab === 'late' ? pageOf(late, page, PAGE).rows : [],
    total: late.length,
    branchId: lateBranch(person),
    fetchAll: () => Promise.resolve(late),
    noun: 'clientes',
    layout: 'dialog',
    noBranchText: 'Atrasados de varias sucursales: elige una sucursal en «Del día» para reasignar.',
    actions: (ids, stop) => <PriorityButton agent={agent} ids={ids} onDone={stop} />,
  })
  const pickLate = <K extends keyof LateFilter>(k: K, v: LateFilter[K]) => {
    setLf((x) => ({ ...x, [k]: x[k] === v ? null : v }))
    setPage(0)
  }

  const tabCls = (on: boolean) =>
    `-mb-px whitespace-nowrap border-b-[3px] px-2 py-2.5 text-sm font-semibold sm:px-3 sm:text-base ${on ? 'border-gold text-ink' : 'border-transparent text-ink/50 hover:text-ink'}`

  return (
    <Dialog
      open
      size="xl"
      onOpenChange={(o) => !o && onClose()}
      title={`${person.full_name} · Agenda de hoy`}
      description={`Le tocaba hoy ${person.due} · contactó ${person.done.length} · pendientes ${person.pending.length}${person.priority ? ` (★ ${person.priority} prioridad)` : ''} · atrasados ${person.late.length}`}
    >
      <div className="flex gap-1 overflow-x-auto border-b border-ink/10" role="tablist" aria-label="Agenda">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            role="tab"
            aria-selected={tab === b.key}
            onClick={() => {
              setTab(b.key)
              setPage(0)
              setLf(NO_LATE_FILTER)
              sel.stop()
            }}
            className={tabCls(tab === b.key)}
          >
            {b.label}
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs tabular-nums ${tab === b.key ? 'bg-ink text-gold-light' : 'bg-sand'}`}>
              {person[b.key].length}
            </span>
          </button>
        ))}
      </div>

      <div className="max-h-[calc(100dvh-19rem)] overflow-y-auto pt-4">
        {tab === 'late' && person.late.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="late-filters">
            {AGES.map((a) => (
              <Chip key={a.key} on={lf.age === a.key} n={person.lateBy.age[a.key]} onClick={() => pickLate('age', a.key)}>
                {a.label}
              </Chip>
            ))}
            <span className="mx-1 h-5 w-px bg-ink/15" aria-hidden />
            {TYPES.map((t) => (
              <Chip key={t.key} on={lf.type === t.key} n={person.lateBy.type[t.key]} onClick={() => pickLate('type', t.key)}>
                {t.label}
              </Chip>
            ))}
            {late.length > 0 && (
              <span className="ml-auto">
                <SelectToggle sel={sel} disabled={false} />
              </span>
            )}
          </div>
        )}
        {list.length === 0 ? (
          <p className="py-6 text-center text-ink/50">{tab === 'late' && person.late.length > 0 ? 'Ningún atrasado con este filtro.' : empty}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="agenda-clients">
            {p.rows.map((r) => (
              <ClientItem key={r.id} r={r} at={at} sel={tab === 'late' && sel.selecting ? sel : null} agent={agent} />
            ))}
          </ul>
        )}
        {p.pages > 1 && (
          <nav className="mt-3 flex items-center justify-center gap-3" aria-label="Páginas">
            <button
              type="button"
              aria-label="Página anterior"
              disabled={p.page === 0}
              onClick={() => setPage(p.page - 1)}
              className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 disabled:opacity-30"
            >
              ‹
            </button>
            <span className="tabular-nums text-ink/70">
              {p.page + 1} de {p.pages}
            </span>
            <button
              type="button"
              aria-label="Página siguiente"
              disabled={p.page >= p.pages - 1}
              onClick={() => setPage(p.page + 1)}
              className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 disabled:opacity-30"
            >
              ›
            </button>
          </nav>
        )}
        {sel.bar}
      </div>
    </Dialog>
  )
}

/** Spec 026: filtro del desglose de Atrasados, con su cantidad. */
function Chip({ on, n, onClick, children }: { on: boolean; n: number; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ${on ? 'bg-ink text-gold-light ring-ink' : 'bg-white text-ink/70 ring-ink/15 hover:bg-sand'}`}
    >
      {children} <span className="tabular-nums">{n}</span>
    </button>
  )
}

/** `sel` solo llega en Atrasados con el modo «Seleccionar» activo (spec 025). `agent`: a nombre de quién se quita la prioridad (026). */
function ClientItem({ r, at, sel, agent }: { r: AgendaRow; at: Date; sel: AssignSelectionState | null; agent: { id: string; name: string } }) {
  const s = dueStatus(r, at)
  return (
    <li className="grid gap-1 rounded-2xl bg-white p-3 ring-1 ring-ink/10 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {sel && (
          <input
            type="checkbox"
            aria-label={`Seleccionar ${r.full_name}`}
            checked={sel.selected.has(r.id)}
            onChange={() => sel.toggle(r.id)}
            className="mt-0.5 size-5 shrink-0 accent-ink"
          />
        )}
        <div className="min-w-0">
          <Link to="/cliente/$id" params={{ id: r.id }} className="font-semibold hover:text-gold-dark hover:underline">
            {r.full_name}
          </Link>
          <span className="block text-sm text-ink/55">{r.phone_raw}</span>
          {r.reassigned_from_name && <span className="block text-xs text-ink/45">Reasignado de {r.reassigned_from_name}</span>}
          {r.priority_today && s.kind !== 'done' && <PriorityBadge id={r.id} agent={agent} />}
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <span className="font-semibold">{STAGE_LABEL[r.stage] ?? r.stage}</span>
        <span className="block text-ink/55">No contestó {r.contact_attempts}/3</span>
        <span className={`block text-xs font-semibold ${s.kind === 'late' ? 'text-rb-red' : 'text-gold-dark'}`}>{s.label}</span>
      </div>
      <div className="min-w-0 text-sm">
        {r.last_contacted_at ? (
          <>
            <span className="text-ink/70">
              {fmtDate(r.last_contacted_at).slice(0, 5)} {fmtTime(r.last_contacted_at)} ·{' '}
              {r.last_method ? METHOD_LABEL[r.last_method] : ''} · {r.last_result ? RESULT_LABEL[r.last_result] : ''}
            </span>
            {r.last_note && <span className="block break-words text-ink/55">«{r.last_note}»</span>}
          </>
        ) : (
          <span className="text-ink/40">Nunca contactado</span>
        )}
      </div>
    </li>
  )
}
