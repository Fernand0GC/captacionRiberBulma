import { Fragment, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { Card } from '@/features/dashboard/charts'
import { fmtDate, fmtTime, STAGE_LABEL } from '@/features/prospects/format'
import { laPazDate } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import {
  saveReferralGoals,
  saveReferrer,
  useReferralMutation,
  useReferralReport,
  useReferrers,
  type ReferralReport,
  type Referrer,
  type ReportRow,
} from './api'
import {
  conversion,
  fmtPercent,
  fulfillment,
  groupByKind,
  KIND_LABEL,
  KINDS,
  monthDays,
  monthLabel,
  monthStart,
  totals,
  type CountsWithGoal,
  type ReferrerKind,
} from './logic'

// Referidos (spec 005): reporte del mes por referidor y administración de referidores y metas.
// Solo jefe de ventas (sus sucursales), gerencia y Sistemas; el servidor lo verifica (can_see_referrals).

const inputCls = 'min-h-10 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/20'
const th = 'py-2 pr-3 font-semibold'
const td = 'py-2 pr-3 tabular-nums'

const when = (iso: string | null) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '—')

function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { v: T; label: string }[]; label: string }) {
  return (
    <div className="flex rounded-full bg-white p-1 ring-1 ring-ink/10" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.v}
          type="button"
          role="tab"
          aria-selected={value === t.v}
          onClick={() => onChange(t.v)}
          className={`min-h-9 rounded-full px-4 text-sm font-semibold ${value === t.v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// Reporte ---------------------------------------------------------------------------------------------

function CountCells({ r }: { r: CountsWithGoal }) {
  return (
    <>
      <td className={`${td} font-semibold`}>{r.arrived}</td>
      <td className={td}>{r.uncontacted}</td>
      <td className={td}>{r.in_followup}</td>
      <td className={`${td} font-semibold text-emerald-700`}>{r.sold}</td>
      <td className={td}>{r.lost}</td>
      <td className={td}>{fmtPercent(conversion(r))}</td>
      <td className={td}>{r.goal ?? '—'}</td>
      <td className={td}>{fmtPercent(fulfillment(r))}</td>
    </>
  )
}

function ContactsList({ report, referrerId }: { report: ReferralReport; referrerId: number }) {
  const list = report.contacts.filter((c) => c.referrer_id === referrerId)
  if (list.length === 0) return <p className="py-2 text-sm text-ink/50">Sin contactos este mes.</p>
  return (
    <table className="w-full text-left text-sm" aria-label="Contactos del referidor">
      <thead>
        <tr className="text-ink/50">
          {['Nombre', 'Celular', 'Producto', 'Responsable', 'Etapa', 'Llegó', 'Venta'].map((h) => (
            <th key={h} scope="col" className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {list.map((c) => (
          <tr key={c.id} className="border-t border-ink/5">
            <td className="py-1.5 pr-3">
              <Link to="/cliente/$id" params={{ id: c.id }} className="font-semibold hover:text-gold-dark hover:underline">
                {c.full_name}
              </Link>
            </td>
            <td className="py-1.5 pr-3 tabular-nums">{c.phone}</td>
            <td className="py-1.5 pr-3">{c.product ?? '—'}</td>
            <td className="py-1.5 pr-3">{c.assigned_to ?? '—'}</td>
            <td className="py-1.5 pr-3">{c.sold_at ? 'Compró' : (STAGE_LABEL[c.stage] ?? c.stage)}</td>
            <td className="py-1.5 pr-3 tabular-nums">{when(c.arrived_at)}</td>
            <td className="py-1.5 pr-3 tabular-nums">{when(c.sold_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SummaryTable({ report, grouped }: { report: ReferralReport; grouped: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const groups = grouped ? groupByKind(report.referrers) : [{ kind: null, rows: report.referrers }]
  const headers = ['Referidor', 'Llegados', 'Sin contactar', 'En seguimiento', 'Compraron', 'Sin interés', 'Conversión', 'Meta', 'Cumplimiento']

  const row = (r: ReportRow) => (
    <Fragment key={r.id}>
      <tr className="border-b border-ink/5" data-testid={`referrer-row-${r.name}`}>
        <td className="py-2 pr-3">
          <button
            type="button"
            className="text-left font-semibold hover:text-gold-dark hover:underline"
            aria-expanded={open === r.id}
            onClick={() => setOpen(open === r.id ? null : r.id)}
          >
            {r.name}
          </button>
          <span className="block text-xs text-ink/45">
            {KIND_LABEL[r.kind]}
            {!r.active && ' · desactivado'}
          </span>
        </td>
        <CountCells r={r} />
      </tr>
      {open === r.id && (
        <tr className="border-b border-ink/5 bg-cream/60">
          <td colSpan={headers.length} className="px-3 py-2">
            <ContactsList report={report} referrerId={r.id} />
          </td>
        </tr>
      )}
    </Fragment>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-ink/50">
            {headers.map((h) => (
              <th key={h} scope="col" className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.kind ?? 'all'}>
              {g.kind && (
                <tr className="bg-sand/50">
                  <th scope="rowgroup" className="py-2 pl-2 pr-3 font-display font-semibold">
                    {KIND_LABEL[g.kind]}
                  </th>
                  <CountCells r={totals(g.rows)} />
                </tr>
              )}
              {g.rows.map(row)}
            </Fragment>
          ))}
          <tr className="border-t-2 border-ink/15 font-bold" data-testid="referrals-total">
            <td className="py-2 pr-3">Total</td>
            <CountCells r={totals(report.referrers)} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function DailyGrid({ report }: { report: ReferralReport }) {
  const days = monthDays(report.days)
  const cell = (r: ReportRow, d: number) => r.by_day[String(d)]
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm text-ink/50">
        Cada celda: contactos que llegaron ese día; <span className="font-semibold text-emerald-700">✓ compras</span> del día.
      </p>
      <table className="text-center text-xs tabular-nums" aria-label="Avance por día">
        <thead>
          <tr className="text-ink/50">
            <th scope="col" className="sticky left-0 bg-white py-1 pr-3 text-left font-semibold">
              Referidor
            </th>
            {days.map((d) => (
              <th key={d} scope="col" className="w-7 px-0.5 py-1 font-semibold">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.referrers.map((r) => (
            <tr key={r.id} className="border-t border-ink/5">
              <th scope="row" className="sticky left-0 whitespace-nowrap bg-white py-1 pr-3 text-left text-sm font-semibold">
                {r.name}
              </th>
              {days.map((d) => {
                const c = cell(r, d)
                return (
                  <td key={d} className="px-0.5 py-1" data-testid={`day-${r.id}-${d}`}>
                    {c?.arrived ? c.arrived : ''}
                    {c?.sold ? <span className="block font-bold text-emerald-700">✓{c.sold > 1 ? c.sold : ''}</span> : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportTab({ branch, month }: { branch: number; month: string }) {
  const q = useReferralReport(branch, month)
  const toast = useToast()
  const [view, setView] = useState<'summary' | 'daily'>('summary')
  const [grouped, setGrouped] = useState(false)
  const [exporting, setExporting] = useState(false)

  if (q.isError) return <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{q.error.message}</p>
  if (!q.data) return <p className="text-ink/45">Cargando…</p>
  const report = q.data
  const t = totals(report.referrers)

  const onExport = async () => {
    setExporting(true)
    try {
      const { exportReferrals } = await import('./exportReferrals')
      await exportReferrals(report)
    } catch {
      toast('No se pudo generar el Excel.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card title={`Referidos de ${monthLabel(report.month)}`} subtitle={`${t.arrived} llegaron · ${t.sold} compraron · conversión ${fmtPercent(conversion(t))}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          label="Vista"
          value={view}
          onChange={setView}
          items={[
            { v: 'summary', label: 'Resumen' },
            { v: 'daily', label: 'Por día' },
          ]}
        />
        {view === 'summary' && (
          <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <input type="checkbox" className="h-4 w-4 accent-gold-dark" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
            Agrupar por tipo
          </label>
        )}
        <Button variant="secondary" className="ml-auto min-h-10" disabled={exporting || report.referrers.length === 0} onClick={() => void onExport()}>
          {exporting ? 'Generando…' : 'Excel'}
        </Button>
      </div>
      {report.referrers.length === 0 ? (
        <p className="text-ink/50">Esta sucursal todavía no tiene referidores. Agrégalos en «Referidores y metas».</p>
      ) : view === 'summary' ? (
        <SummaryTable report={report} grouped={grouped} />
      ) : (
        <DailyGrid report={report} />
      )}
    </Card>
  )
}

// Referidores y metas ---------------------------------------------------------------------------------

type Draft = { name: string; kind: ReferrerKind; sort: string; active: boolean; goal: string }

const goalNumber = (s: string) => (s.trim() === '' ? null : Number(s))
const validGoal = (s: string) => s.trim() === '' || (/^\d{1,4}$/.test(s.trim()) && Number(s) <= 9999)

function ReferrerRow({ r, row, month, branch }: { r: Referrer; row: ReportRow | undefined; month: string; branch: number }) {
  const toast = useToast()
  const ownGoal = row && row.goal_from === month ? row.goal : null
  const initial: Draft = { name: r.name, kind: r.kind, sort: String(r.sort), active: r.active, goal: ownGoal === null ? '' : String(ownGoal) }
  const [d, setD] = useState<Draft>(initial)
  const save = useReferralMutation(async (v: Draft) => {
    if (v.name !== r.name || v.kind !== r.kind || Number(v.sort) !== r.sort || v.active !== r.active) {
      await saveReferrer({ id: r.id, branch_id: branch, name: v.name.trim(), kind: v.kind, sort: Number(v.sort) || 0, active: v.active })
    }
    if (v.goal !== initial.goal) await saveReferralGoals({ branch_id: branch, month, referrers: [{ id: r.id, goal: goalNumber(v.goal) }] })
  })
  const dirty = JSON.stringify(d) !== JSON.stringify(initial)
  const inherited = row && row.goal !== null && row.goal_from !== month

  const onSave = async () => {
    if (!validGoal(d.goal)) return toast('La meta debe ser un número entre 0 y 9999.', 'error')
    try {
      await save.mutateAsync(d)
      toast('✓ Referidor guardado', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <tr className={`border-b border-ink/5 ${d.active ? '' : 'text-ink/45'}`} data-testid={`referrer-edit-${r.name}`}>
      <td className="py-2 pr-2">
        <input aria-label="Nombre" maxLength={60} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={`${inputCls} w-full min-w-40`} />
        {r.source === 'capture' && (
          <p className="mt-1 text-xs text-gold-dark" data-testid={`referrer-source-${r.name}`}>
            Agregado en el registro{r.creator ? ` por ${r.creator.full_name}` : ''}
            {r.created_at ? ` · ${fmtDate(r.created_at)}` : ''}
          </p>
        )}
      </td>
      <td className="py-2 pr-2">
        <select aria-label="Tipo" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as ReferrerKind })} className={inputCls}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2">
        <input aria-label="Orden" type="number" inputMode="numeric" value={d.sort} onChange={(e) => setD({ ...d, sort: e.target.value })} className={`${inputCls} w-16`} />
      </td>
      <td className="py-2 pr-2">
        <input
          aria-label={`Meta de ${r.name}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          placeholder={inherited ? String(row.goal) : '—'}
          value={d.goal}
          onChange={(e) => setD({ ...d, goal: e.target.value })}
          className={`${inputCls} w-20`}
        />
        {inherited && d.goal === '' && <span className="block text-xs text-ink/45">de {monthLabel(row.goal_from ?? month)}</span>}
      </td>
      <td className="py-2 pr-2">
        <input aria-label="Activo" type="checkbox" className="h-5 w-5 accent-gold-dark" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
      </td>
      <td className="py-2">
        <Button variant="secondary" className="min-h-10 px-3 text-sm" disabled={!dirty || save.isPending} onClick={() => void onSave()}>
          Guardar
        </Button>
      </td>
    </tr>
  )
}

function NewReferrer({ branch, month }: { branch: number; month: string }) {
  const toast = useToast()
  const [d, setD] = useState({ name: '', kind: 'staff' as ReferrerKind, goal: '' })
  const create = useReferralMutation(async (v: typeof d) => {
    const id = await saveReferrer({ branch_id: branch, name: v.name.trim(), kind: v.kind, sort: 0, active: true })
    if (v.goal.trim() !== '') await saveReferralGoals({ branch_id: branch, month, referrers: [{ id, goal: goalNumber(v.goal) }] })
  })

  const onAdd = async () => {
    if (d.name.trim().length < 2) return toast('Escribe el nombre del referidor.', 'error')
    if (!validGoal(d.goal)) return toast('La meta debe ser un número entre 0 y 9999.', 'error')
    try {
      await create.mutateAsync(d)
      toast('✓ Referidor agregado', 'success')
      setD({ name: '', kind: d.kind, goal: '' })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div role="group" aria-label="Agregar referidor" className="flex flex-wrap items-end gap-2 rounded-2xl bg-cream/70 p-3">
      <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-ink/70">
        Nuevo referidor
        <input maxLength={60} value={d.name} placeholder="Ej.: Contacto Fernanda" onChange={(e) => setD({ ...d, name: e.target.value })} className={`${inputCls} min-w-48`} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
        Tipo
        <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as ReferrerKind })} className={inputCls}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
        Meta del mes
        <input type="number" inputMode="numeric" min={0} max={9999} value={d.goal} placeholder="—" onChange={(e) => setD({ ...d, goal: e.target.value })} className={`${inputCls} w-24`} />
      </label>
      <Button className="min-h-10" disabled={create.isPending} onClick={() => void onAdd()}>
        Agregar
      </Button>
    </div>
  )
}

function ReferrersTab({ branch, month }: { branch: number; month: string }) {
  const list = useReferrers(branch)
  const report = useReferralReport(branch, month)
  if (list.isError || report.isError) {
    return <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{(list.error ?? report.error)?.message}</p>
  }
  const rows = report.data?.month === month ? report.data.referrers : undefined
  return (
    <Card title="Referidores y metas" subtitle={`Meta de contactos que llegan en ${monthLabel(month)}. Vacía = usa la del mes anterior.`}>
      <NewReferrer branch={branch} month={month} />
      {!list.data || !rows ? (
        <p className="text-ink/45">Cargando…</p>
      ) : list.data.length === 0 ? (
        <p className="text-ink/50">Todavía no hay referidores en esta sucursal.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-ink/50">
                {['Nombre', 'Tipo', 'Orden', 'Meta', 'Activo', ''].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => {
                const row = rows.find((x) => x.id === r.id)
                // La key incluye lo guardado: al refrescar, la fila arranca de nuevo con los valores del servidor.
                return <ReferrerRow key={`${r.id}|${month}|${r.name}|${r.kind}|${r.sort}|${r.active}|${row?.goal_from ?? ''}|${row?.goal ?? ''}`} r={r} row={row} month={month} branch={branch} />
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// Página ----------------------------------------------------------------------------------------------

export function ReferralsPage() {
  const scope = useBranchScope()
  const [branchSel, setBranchSel] = useState<number | undefined>(undefined)
  const branch = branchSel ?? scope.fallback ?? scope.options?.[0]?.id
  const [monthInput, setMonthInput] = useState(() => laPazDate(new Date()).slice(0, 7))
  const month = monthStart(monthInput)
  const [tab, setTab] = useState<'report' | 'referrers'>('report')
  const branchName = scope.options?.find((b) => b.id === branch)?.name

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6">
      <PageTitle
        title="Referidos"
        subtitle={branchName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {(scope.options?.length ?? 0) > 1 && (
              <select aria-label="Sucursal" value={branch ?? ''} onChange={(e) => setBranchSel(Number(e.target.value))} className="min-h-10 rounded-full border border-ink/15 bg-white px-3 text-sm">
                {scope.options?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="month"
              aria-label="Mes"
              value={monthInput}
              onChange={(e) => e.target.value && setMonthInput(e.target.value)}
              className="min-h-10 rounded-full border border-ink/15 bg-white px-3 text-sm"
            />
            <Tabs
              label="Sección"
              value={tab}
              onChange={setTab}
              items={[
                { v: 'report', label: 'Reporte' },
                { v: 'referrers', label: 'Referidores y metas' },
              ]}
            />
          </div>
        }
      />
      {branch === undefined ? (
        <p className="text-ink/45">Cargando…</p>
      ) : tab === 'report' ? (
        <ReportTab key={`${branch}|${month}`} branch={branch} month={month} />
      ) : (
        <ReferrersTab key={`${branch}|${month}`} branch={branch} month={month} />
      )}
    </main>
  )
}
