import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ROLE_LABEL } from '@/features/auth/types'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { dueStatus } from '@/features/followup/dueStatus'
import { pageOf } from '@/features/followup/inboxView'
import { fmtDate, fmtTime, STAGE_LABEL } from '@/features/prospects/format'
import { Dialog } from '@/ui/Dialog'
import { agendaByPerson, agendaTotals, type AgendaBucket, type AgendaPersonView } from './agenda'
import { useRecontactAgenda, type AgendaRow } from './api'

const PAGE = 25

const BUCKETS: { key: AgendaBucket; label: string; empty: string }[] = [
  { key: 'pending', label: 'Pendientes', empty: 'No le queda nada pendiente para hoy.' },
  { key: 'done', label: 'Contactados hoy', empty: 'Todavía no contactó a nadie hoy.' },
  { key: 'late', label: 'Atrasados', empty: 'No tiene atrasados.' },
]

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
                    <Num n={p.pending.length} warn />
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

function Num({ n, warn, alert }: { n: number; warn?: boolean; alert?: boolean }) {
  const tone = n === 0 ? 'text-ink/30' : alert ? 'font-semibold text-rb-red' : warn ? 'font-semibold text-gold-dark' : ''
  return <td className={`px-3 py-2.5 text-right tabular-nums ${tone}`}>{n}</td>
}

function AgendaDialog({ person, at, onClose }: { person: AgendaPersonView; at: Date; onClose: () => void }) {
  const first = BUCKETS.find((b) => person[b.key].length > 0)?.key ?? 'pending'
  const [tab, setTab] = useState<AgendaBucket>(first)
  const [page, setPage] = useState(0)
  const list = person[tab]
  const p = pageOf(list, page, PAGE)
  const empty = BUCKETS.find((b) => b.key === tab)!.empty

  const tabCls = (on: boolean) =>
    `-mb-px whitespace-nowrap border-b-[3px] px-2 py-2.5 text-sm font-semibold sm:px-3 sm:text-base ${on ? 'border-gold text-ink' : 'border-transparent text-ink/50 hover:text-ink'}`

  return (
    <Dialog
      open
      size="xl"
      onOpenChange={(o) => !o && onClose()}
      title={`${person.full_name} · Agenda de hoy`}
      description={`Le tocaba hoy ${person.due} · contactó ${person.done.length} · pendientes ${person.pending.length} · atrasados ${person.late.length}`}
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
        {list.length === 0 ? (
          <p className="py-6 text-center text-ink/50">{empty}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="agenda-clients">
            {p.rows.map((r) => (
              <ClientItem key={r.id} r={r} at={at} />
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
      </div>
    </Dialog>
  )
}

function ClientItem({ r, at }: { r: AgendaRow; at: Date }) {
  const s = dueStatus(r, at)
  return (
    <li className="grid gap-1 rounded-2xl bg-white p-3 ring-1 ring-ink/10 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-3">
      <div className="min-w-0">
        <Link to="/cliente/$id" params={{ id: r.id }} className="font-semibold hover:text-gold-dark hover:underline">
          {r.full_name}
        </Link>
        <span className="block text-sm text-ink/55">{r.phone_raw}</span>
        {r.reassigned_from_name && <span className="block text-xs text-ink/45">Reasignado de {r.reassigned_from_name}</span>}
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
