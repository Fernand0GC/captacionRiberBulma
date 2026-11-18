import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { MdFileDownload, MdHistory } from 'react-icons/md'
import { useAuth } from '@/features/auth/AuthProvider'
import { GLOBAL_ROLES } from '@/features/auth/types'
import { useBranches } from '@/features/prospects/api'
import { laPazDate } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { AssignmentDialog } from './AssignmentDialog'
import { copyDay, deleteAssignment, SHIFT_LABEL, useOrgList, useOrgMutation, type Assignment, type Shift } from './api'
import { ResultDialog } from './ResultDialog'
import {
  addDays,
  applyFilters,
  compliance,
  daysBetween,
  filterOptions,
  totals,
  type FilterKey,
  type Filters,
} from './logic'

const FILTERS: { k: FilterKey; label: string }[] = [
  { k: 'lead', label: 'Gerente' },
  { k: 'branch', label: 'Sucursal' },
  { k: 'shift', label: 'Turno' },
  { k: 'person', label: 'Personal' },
  { k: 'strategy', label: 'Estrategia' },
  { k: 'channel', label: 'Canal' },
  { k: 'subchannel', label: 'Subcanal' },
]
const MAX_DAYS = 31

const dm = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
const hours = (r: Assignment) => (r.start_time ? `${r.start_time}${r.end_time ? `–${r.end_time}` : ''}` : '—')

/** «15 de 30 · 50 %», «15» sin meta, o «Pendiente» (sin resultado no es 0). */
function ResultCell({ r }: { r: Assignment }) {
  if (r.result === null) return <span className="text-ink/45">Pendiente</span>
  const pct = compliance(r.goal, r.result)
  return (
    <span className="tabular-nums" data-testid="assignment-result">
      <strong>{r.result}</strong>
      {r.goal !== null && <span className="text-ink/50"> de {r.goal}</span>}
      {pct !== null && <span className={pct >= 100 ? 'font-semibold text-emerald-700' : 'text-ink/60'}> · {pct} %</span>}
    </span>
  )
}

/** Organización comercial por sucursal (spec 003): reemplaza la planilla de ventas. */
export function OrganizationPage() {
  const { profile } = useAuth()
  const role = profile!.role
  const ownOnly = role === 'field_assistant'
  const global = GLOBAL_ROLES.includes(role)
  const branchesQ = useBranches()
  const toast = useToast()
  const today = laPazDate(new Date())

  // Sucursales que puede elegir: gerencia todas, jefe las suyas, el resto la propia (fija).
  const scopeBranches = useMemo(() => {
    const all = branchesQ.data ?? []
    if (global) return all
    if (role === 'sales_lead') return all.filter((b) => profile!.branch_ids?.includes(b.id))
    return all.filter((b) => b.id === profile!.branch_id)
  }, [branchesQ.data, global, role, profile])
  const [picked, setPicked] = useState<number[]>([]) // vacío = todas las de su alcance
  const branchIds = picked.length ? picked : scopeBranches.map((b) => b.id)

  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const rangeOk = daysBetween(from, to) >= 0 && daysBetween(from, to) < MAX_DAYS
  const q = useOrgList(from, to, picked, rangeOk && (global || scopeBranches.length > 0))
  const rows = useMemo(() => q.data?.rows ?? [], [q.data])

  const [filters, setFilters] = useState<Filters>({})
  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const t = totals(visible)
  const anyFilter = Object.values(filters).some(Boolean)

  const singleDay = from === to
  const [addBranch, setAddBranch] = useState<number | undefined>(undefined)
  const targetBranch = branchIds.length === 1 ? branchIds[0] : (addBranch ?? branchIds[0])
  const canManage = !!q.data?.can_manage && !ownOnly
  const [edit, setEdit] = useState<{ shift: Shift; assignment?: Assignment; branch: number } | null>(null)
  const [resultOf, setResultOf] = useState<Assignment | null>(null)
  const del = useOrgMutation(deleteAssignment)
  const copy = useOrgMutation(copyDay)
  const [exporting, setExporting] = useState(false)

  const scopeName =
    branchIds.length === 1
      ? (scopeBranches.find((b) => b.id === branchIds[0])?.name ?? 'Sucursal')
      : picked.length === 0 && global
        ? 'Todas las sucursales'
        : `${branchIds.length} sucursales`

  function setDay(d: string) {
    setFrom(d)
    setTo(d)
  }

  async function doCopy(fromDay: string, toDay: string, msg: string) {
    if (targetBranch === undefined) return
    try {
      const n = await copy.mutateAsync({ branch: targetBranch, from: fromDay, to: toDay })
      toast(n ? `✓ ${n} asignaciones ${msg}` : 'No había asignaciones para copiar', n ? 'success' : 'info')
      if (n) setDay(toDay)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function doDelete(r: Assignment) {
    if (!window.confirm(`¿Quitar la asignación de ${r.person} (${r.channel})?`)) return
    try {
      await del.mutateAsync(r.id)
      toast('Asignación quitada', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function doExport() {
    setExporting(true)
    try {
      const n = await exportOrganization(visible, scopeName, from, to)
      toast(n ? `✓ Excel con ${n} asignaciones` : 'No hay asignaciones para exportar', n ? 'success' : 'info')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  const actions = (r: Assignment) => (
    <div className="flex flex-wrap gap-1.5">
      {r.can_set_result && !ownOnly && (
        <button type="button" onClick={() => setResultOf(r)} className="min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand">
          Resultado
        </button>
      )}
      {r.can_replan && !ownOnly && (
        <>
          <button
            type="button"
            onClick={() => setEdit({ shift: r.shift, assignment: r, branch: r.branch_id })}
            className="min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand"
          >
            Editar
          </button>
          <button
            type="button"
            aria-label={`Quitar asignación de ${r.person}`}
            onClick={() => void doDelete(r)}
            className="min-h-9 rounded-full px-3 text-sm font-semibold text-rb-red ring-1 ring-rb-red/30"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title={ownOnly ? 'Mi plan' : 'Planificación'}
        subtitle={ownOnly ? 'Tus asignaciones' : scopeName}
        actions={
          !ownOnly && (
            <Link to="/planificacion/historial" className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-ink/70 ring-1 ring-ink/15">
              <MdHistory aria-hidden className="h-5 w-5" /> Planificación anterior
            </Link>
          )
        }
      />

      {/* Rango y sucursales */}
      <section className="flex flex-wrap items-end gap-2 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-ink/5" aria-label="Período">
        {singleDay && (
          <button type="button" aria-label="Día anterior" onClick={() => setDay(addDays(from, -1))} className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand">
            ‹
          </button>
        )}
        <label className="flex flex-col text-xs font-semibold text-ink/60">
          Desde
          <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="min-h-11 rounded-xl border border-ink/15 px-2 text-base" />
        </label>
        <label className="flex flex-col text-xs font-semibold text-ink/60">
          Hasta
          <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="min-h-11 rounded-xl border border-ink/15 px-2 text-base" />
        </label>
        {singleDay && (
          <button type="button" aria-label="Día siguiente" onClick={() => setDay(addDays(from, 1))} className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand">
            ›
          </button>
        )}
        <div className="flex gap-1">
          <Button variant="ghost" className="min-h-11 text-sm" onClick={() => setDay(today)}>
            Hoy
          </Button>
          <Button variant="ghost" className="min-h-11 text-sm" onClick={() => { setFrom(addDays(today, -6)); setTo(today) }}>
            7 días
          </Button>
        </div>
        {scopeBranches.length > 1 && !ownOnly && (
          <fieldset className="flex flex-wrap items-center gap-1.5" aria-label="Sucursales">
            {scopeBranches.map((b) => {
              const on = picked.includes(b.id)
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== b.id) : [...p, b.id]))}
                  className={`min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ${on ? 'bg-ink text-gold-light ring-ink' : 'ring-ink/15'}`}
                >
                  {b.name}
                </button>
              )
            })}
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicked([])} className="min-h-9 px-2 text-sm text-ink/60 underline">
                Todas
              </button>
            )}
          </fieldset>
        )}
      </section>
      {!rangeOk && <p className="rounded-2xl bg-rb-red/10 p-3 text-rb-red">Elige un rango de hasta {MAX_DAYS} días, con «Hasta» después de «Desde».</p>}

      {/* Filtros por columna */}
      {!ownOnly && rows.length > 0 && (
        <section className="flex flex-wrap items-end gap-2" aria-label="Filtros">
          {FILTERS.map(({ k, label }) => {
            const opts = filterOptions(rows, k)
            return (
              <label key={k} className="flex flex-col text-xs font-semibold text-ink/60">
                {label}
                <select
                  aria-label={label}
                  value={filters[k] ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value || undefined }))}
                  className={`min-h-10 max-w-48 rounded-xl border bg-white px-2 text-sm ${filters[k] ? 'border-ink' : 'border-ink/15'}`}
                >
                  <option value="">Todos</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {k === 'shift' ? SHIFT_LABEL[o as Shift] : o}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
          {anyFilter && (
            <Button variant="ghost" className="min-h-10 text-sm" onClick={() => setFilters({})}>
              Quitar filtros
            </Button>
          )}
        </section>
      )}

      {/* Totales según el filtro */}
      <section className="grid grid-cols-3 gap-2" aria-label="Totales" data-testid="org-totals">
        {[
          ['Meta total', t.goal],
          ['Resultado total', t.result],
          ['Asignaciones', t.count],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
            <p className="font-display text-2xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </section>

      {/* Acciones de carga */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {singleDay ? (
            <>
              {branchIds.length > 1 && (
                <select aria-label="Cargar en" value={targetBranch ?? ''} onChange={(e) => setAddBranch(Number(e.target.value))} className="min-h-11 rounded-xl border border-ink/15 bg-white px-2">
                  {scopeBranches
                    .filter((b) => branchIds.includes(b.id))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        Cargar en {b.name}
                      </option>
                    ))}
                </select>
              )}
              {(['morning', 'afternoon'] as Shift[]).map((s) => (
                <Button key={s} className="min-h-11 text-sm" disabled={targetBranch === undefined} onClick={() => targetBranch !== undefined && setEdit({ shift: s, branch: targetBranch })}>
                  ＋ {SHIFT_LABEL[s]}
                </Button>
              ))}
              <Button variant="secondary" className="min-h-11 text-sm" disabled={copy.isPending} onClick={() => void doCopy(addDays(from, -1), from, 'copiadas del día anterior')}>
                Copiar del día anterior
              </Button>
              {rows.some((r) => r.branch_id === targetBranch) && (
                <Button variant="secondary" className="min-h-11 text-sm" disabled={copy.isPending} onClick={() => void doCopy(from, addDays(from, 1), 'copiadas al día siguiente')}>
                  Copiar al día siguiente
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-ink/55">Para cargar asignaciones, elige un solo día.</p>
          )}
          <Button variant="secondary" className="ml-auto min-h-11 text-sm" disabled={exporting || visible.length === 0} onClick={() => void doExport()}>
            <MdFileDownload aria-hidden className="mr-1 inline h-5 w-5" /> {exporting ? 'Exportando…' : 'Exportar Excel'}
          </Button>
        </div>
      )}

      {/* Asignaciones */}
      {q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">{(q.error as Error).message}</p>
      ) : q.isLoading ? (
        <p className="p-6 text-center text-ink/50">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5" data-testid="org-empty">
          {rows.length === 0 ? (ownOnly ? 'No tienes asignaciones en estas fechas.' : 'Sin asignaciones en estas fechas.') : 'Sin resultados para estos filtros.'}
        </p>
      ) : (
        <>
          {/* Pantalla ancha: tabla con las columnas de la planilla */}
          <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-gradient text-xs uppercase tracking-wide text-gold-light">
                <tr>
                  {['Fecha', 'Gerente', 'Sucursal', 'Turno', 'Horario', 'Personal', 'Estrategia', 'Canal', 'Subcanal', 'Lugar', 'Meta', 'Resultado', 'Observaciones', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {visible.map((r) => (
                  <tr key={r.id} data-testid="assignment">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{dm(r.work_date)}</td>
                    <td className="px-3 py-2">{r.lead ?? '—'}</td>
                    <td className="px-3 py-2">{r.branch}</td>
                    <td className="px-3 py-2">{SHIFT_LABEL[r.shift]}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{hours(r)}</td>
                    <td className="px-3 py-2 font-semibold">{r.person}</td>
                    <td className="px-3 py-2">{r.strategy}</td>
                    <td className="px-3 py-2">{r.channel}</td>
                    <td className="px-3 py-2">{r.subchannel ?? '—'}</td>
                    <td className="px-3 py-2">{r.place ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.goal ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <ResultCell r={r} />
                    </td>
                    <td className="max-w-56 px-3 py-2 text-ink/70">{r.notes ?? ''}</td>
                    <td className="px-3 py-2">{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: una tarjeta por asignación */}
          <ul className="flex flex-col gap-2 lg:hidden">
            {visible.map((r) => (
              <li key={r.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5" data-testid="assignment-card">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-lg font-semibold tabular-nums">
                    {hours(r)} <span className="text-sm font-normal text-ink/50">· {SHIFT_LABEL[r.shift]}{singleDay ? '' : ` · ${dm(r.work_date)}`}</span>
                  </p>
                  <ResultCell r={r} />
                </div>
                {!ownOnly && <p className="font-semibold">{r.person}</p>}
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-dark">
                  {r.strategy} · {r.channel}
                </p>
                {r.subchannel && <p className="text-sm">{r.subchannel}</p>}
                <p className="text-sm text-ink/60">
                  {[r.place, r.goal !== null && `Meta ${r.goal}`, branchIds.length > 1 && r.branch, r.lead && `Gerente: ${r.lead}`].filter(Boolean).join(' · ')}
                </p>
                {r.notes && <p className="mt-1 text-sm italic text-ink/70">“{r.notes}”</p>}
                <div className="mt-2">{actions(r)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {edit && (
        <AssignmentDialog
          branch={edit.branch}
          day={edit.assignment?.work_date ?? from}
          shift={edit.shift}
          assignment={edit.assignment}
          sameDay={rows.filter((r) => r.branch_id === edit.branch && r.work_date === (edit.assignment?.work_date ?? from))}
          onClose={() => setEdit(null)}
        />
      )}
      {resultOf && <ResultDialog assignment={resultOf} onClose={() => setResultOf(null)} />}
    </main>
  )
}

/** El Excel se carga solo al exportar (exceljs pesa; constitución II). */
async function exportOrganization(...args: Parameters<typeof import('./exportOrganization').exportOrganization>) {
  const m = await import('./exportOrganization')
  return m.exportOrganization(...args)
}
