import { Fragment, useState } from 'react'
import { Card, DayColumns, StatTile } from '@/features/dashboard/charts'
import { BranchDrillBar } from '@/features/monitoring/BranchDrillBar'
import { laPazDate } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { useToast } from '@/ui/Toast'
import { useReferralRange, type RangeReport, type RangeRow } from './api'
import {
  conversion,
  dayColumns,
  fmtDelta,
  fmtGoal,
  fmtPercent,
  fulfillment,
  groupByKind,
  isSortKey,
  KIND_LABEL,
  KINDS,
  rangeLabel,
  sortRows,
  sumDays,
  totals,
  type CountsWithGoal,
  type ReferrerKind,
} from './logic'
import { inputCls, pickBranch, SortHeader, Tabs, td, th, type ReferralScope } from './parts'
import { ReferrerDetailDialog } from './ReferrerDetailDialog'
import { previousRange } from './search'

// Reporte de referidos por rango (spec 014, US1–US3): tarjetas, tabla por sucursal o por referidor, «Por día».

function CountCells({ r }: { r: CountsWithGoal }) {
  return (
    <>
      <td className={`${td} font-semibold`}>{r.arrived}</td>
      <td className={td}>{r.uncontacted}</td>
      <td className={td}>{r.in_followup}</td>
      <td className={`${td} font-semibold text-emerald-700`}>{r.sold}</td>
      <td className={td}>{r.lost}</td>
      <td className={td}>{fmtPercent(conversion(r))}</td>
      <td className={td}>{fmtGoal(r.goal)}</td>
      <td className={td}>{fmtPercent(fulfillment(r))}</td>
    </>
  )
}

function CountHeaders({ s }: { s: ReferralScope }) {
  return (
    <>
      <SortHeader k="arrived" label="Llegados" s={s} />
      <SortHeader k="uncontacted" label="Sin contactar" s={s} />
      <SortHeader k="in_followup" label="En seguimiento" s={s} />
      <SortHeader k="sold" label="Compraron" s={s} />
      <SortHeader k="lost" label="Sin interés" s={s} />
      <SortHeader k="conversion" label="Conversión" s={s} />
      <SortHeader k="goal" label="Meta" s={s} />
      <SortHeader k="fulfillment" label="Cumplimiento" s={s} />
    </>
  )
}

// Tarjetas --------------------------------------------------------------------------------------------

function Tiles({ report, prev, s }: { report: RangeReport; prev: RangeReport | undefined; s: ReferralScope }) {
  const t = report.totals
  const p = prev?.totals
  const conv = conversion(t)
  const pconv = p ? conversion(p) : null
  const ful = fulfillment(t)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="referral-kpis">
      <StatTile accent label="Llegados" value={t.arrived} hint={p ? fmtDelta(t.arrived, p.arrived) : undefined} />
      <StatTile label="Compraron" value={t.sold} hint={p ? fmtDelta(t.sold, p.sold) : undefined} />
      <StatTile
        label="Conversión"
        value={fmtPercent(conv)}
        hint={conv !== null && pconv !== null ? `${pconv}% el período anterior` : 'compraron ÷ llegados'}
      />
      <StatTile
        label="Cumplimiento"
        value={fmtPercent(ful)}
        hint={t.goal === null ? 'sin metas' : `meta ${fmtGoal(t.goal)}${report.goal_prorated ? ' · prorrateada' : ''}`}
      />
      <button
        type="button"
        className="rounded-3xl text-left focus-visible:outline-2 focus-visible:outline-gold"
        onClick={() => s.setSearch({ seccion: 'contactos', etapa: 'capture' }, { push: true })}
      >
        <StatTile label="Sin contactar" value={t.uncontacted} hint={t.uncontacted ? 'ver la lista →' : 'todos contactados'} />
      </button>
    </div>
  )
}

/** Llegadas por día (de la lista de contactos), para ver la evolución en rangos de varios días. */
function Evolution({ report }: { report: RangeReport }) {
  const cols = dayColumns(report.from, report.to)
  if (cols.length < 2) return null
  const byDay: Record<string, { arrived: number; sold: number }> = {}
  for (const c of report.contacts) {
    const d = laPazDate(new Date(c.arrived_at))
    byDay[d] = { arrived: (byDay[d]?.arrived ?? 0) + 1, sold: 0 }
  }
  const data = cols.map((c) => ({ day: c.key, n: sumDays(byDay, c).arrived }))
  const labels = new Map(cols.map((c) => [c.key, c.label]))
  return (
    <Card title="Referidos que llegaron" subtitle={cols[0]?.days.length === 1 ? 'Por día' : 'Por mes'}>
      <DayColumns data={data} label={(k) => labels.get(k) ?? k} />
    </Card>
  )
}

// Varias sucursales -----------------------------------------------------------------------------------

function BranchTable({ report, s }: { report: RangeReport; s: ReferralScope }) {
  const key = isSortKey(s.search.orden) ? s.search.orden : undefined
  const rows = sortRows(report.by_branch, key, s.search.dir)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-left text-sm" aria-label="Referidos por sucursal">
        <thead>
          <tr className="border-b border-ink/10 text-ink/50">
            <SortHeader k="name" label="Sucursal" s={s} />
            <th scope="col" className={th}>
              Referidores
            </th>
            <CountHeaders s={s} />
            <th scope="col" className={th} title="Captaciones del período marcadas como referidas">
              % referidas
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-b border-ink/5" data-testid={`branch-row-${b.name}`}>
              <td className="py-2 pr-3">
                <button
                  type="button"
                  className="text-left font-semibold hover:text-gold-dark hover:underline"
                  onClick={() => pickBranch(s, b.id, { push: true })}
                >
                  {b.name} →
                </button>
              </td>
              <td className={td}>{b.referrers}</td>
              <CountCells r={b} />
              <td className={td}>{fmtPercent(b.captures ? Math.round((b.arrived / b.captures) * 100) : null)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-ink/15 font-bold" data-testid="referrals-total">
            <td className="py-2 pr-3">Total</td>
            <td className={td}>{report.by_branch.reduce((n, b) => n + b.referrers, 0)}</td>
            <CountCells r={report.totals} />
            <td className={td}>
              {fmtPercent(report.totals.captures ? Math.round((report.totals.arrived / report.totals.captures) * 100) : null)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Una sucursal ----------------------------------------------------------------------------------------

function SummaryTable({ report, rows, s }: { report: RangeReport; rows: RangeRow[]; s: ReferralScope }) {
  const [open, setOpen] = useState<number | null>(null)
  const key = isSortKey(s.search.orden) ? s.search.orden : undefined
  const sorted = sortRows(rows, key, s.search.dir)
  const groups = s.search.agrupar ? groupByKind(sorted) : [{ kind: null, rows: sorted }]

  const openRow = rows.find((r) => r.id === open)

  const row = (r: RangeRow) => (
    <Fragment key={r.id}>
      <tr className="border-b border-ink/5" data-testid={`referrer-row-${r.name}`}>
        <td className="py-2 pr-3">
          <button
            type="button"
            className="text-left font-semibold underline decoration-gold/40 underline-offset-4 hover:text-gold-dark hover:decoration-gold"
            aria-haspopup="dialog"
            onClick={() => setOpen(r.id)}
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
    </Fragment>
  )

  return (
    <div className="overflow-x-auto">
      {openRow && (
        <ReferrerDetailDialog
          name={openRow.name}
          subtitle={`${KIND_LABEL[openRow.kind]} · ${report.branch ?? ''} · ${rangeLabel(report.from, report.to)}`}
          list={report.contacts.filter((c) => c.referrer_id === openRow.id)}
          onClose={() => setOpen(null)}
        />
      )}
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-ink/50">
            <SortHeader k="name" label="Referidor" s={s} />
            <CountHeaders s={s} />
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
            <CountCells r={totals(rows)} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function DailyGrid({ report, rows }: { report: RangeReport; rows: RangeRow[] }) {
  const cols = dayColumns(report.from, report.to)
  const byMonth = (cols[0]?.days.length ?? 1) > 1
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm text-ink/50">
        Cada celda: contactos que llegaron ese {byMonth ? 'mes' : 'día'};{' '}
        <span className="font-semibold text-emerald-700">✓ compras</span> {byMonth ? 'del mes' : 'del día'}.
      </p>
      <table className="text-center text-xs tabular-nums" aria-label="Avance por día">
        <thead>
          <tr className="text-ink/50">
            <th scope="col" className="sticky left-0 bg-white py-1 pr-3 text-left font-semibold">
              Referidor
            </th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className={`${byMonth ? 'px-2' : 'w-7 px-0.5'} py-1 font-semibold`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-ink/5">
              <th scope="row" className="sticky left-0 whitespace-nowrap bg-white py-1 pr-3 text-left text-sm font-semibold">
                {r.name}
              </th>
              {cols.map((c) => {
                const v = sumDays(r.by_day, c)
                return (
                  <td key={c.key} className="px-0.5 py-1" data-testid={`day-${r.id}-${c.key}`}>
                    {v.arrived ? v.arrived : ''}
                    {v.sold ? <span className="block font-bold text-emerald-700">✓{v.sold > 1 ? v.sold : ''}</span> : null}
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

// Sección ---------------------------------------------------------------------------------------------

function Empty({ report, s }: { report: RangeReport; s: ReferralScope }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl bg-cream/70 p-4" data-testid="referrals-empty">
      <p className="text-ink/70">
        Nadie registró referidos en {rangeLabel(report.from, report.to)}
        {report.totals.captures ? ` (hubo ${report.totals.captures} captaciones sin marcar «Es referido»)` : ''}. Los auxiliares los
        marcan al registrar con «Es referido» y quién lo recomendó.
      </p>
      <Button variant="secondary" className="min-h-10" onClick={() => s.setSearch({ seccion: 'quien' }, { push: true })}>
        Ver quién registra
      </Button>
    </div>
  )
}

export function ReportSection({ s }: { s: ReferralScope }) {
  const filters = { branch_id: s.branch, from: s.range.from, to: s.range.to }
  const q = useReferralRange(filters)
  const prev = useReferralRange({ branch_id: s.branch, ...previousRange(s.range), lists: false })
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  if (q.isError) return <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{q.error.message}</p>
  if (!q.data) return <p className="text-ink/45">Cargando…</p>
  const report = q.data
  const kind = s.search.tipo
  const rows = kind ? report.referrers.filter((r) => r.kind === kind) : report.referrers
  const many = s.branch === undefined
  const title = `Referidos · ${rangeLabel(report.from, report.to)}`

  const onExport = async () => {
    setExporting(true)
    try {
      const { exportRangeReport } = await import('./exportReferrals')
      await exportRangeReport(report, { rows, scopeName: s.branchName ?? '', kind })
    } catch {
      toast('No se pudo generar el Excel.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {!many && s.canAll && (
        <BranchDrillBar
          order={s.options.map((b) => ({ branch_id: b.id, name: b.name }))}
          current={s.branch ?? 0}
          name={s.branchName ?? ''}
          onBack={() => pickBranch(s, undefined, { push: true })}
          onStep={(id) => pickBranch(s, id)}
        />
      )}
      <Tiles report={report} prev={prev.data} s={s} />
      <Card
        title={title}
        subtitle={`${s.branchName ?? ''} · ${report.totals.arrived} llegaron · ${report.totals.sold} compraron${report.goal_prorated ? ' · metas prorrateadas a los días del rango' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {!many && (
            <>
              <Tabs
                label="Vista"
                value={s.search.vista ?? 'resumen'}
                onChange={(v) => s.setSearch({ vista: v === 'dia' ? 'dia' : undefined })}
                items={[
                  { v: 'resumen', label: 'Resumen' },
                  { v: 'dia', label: 'Por día' },
                ]}
              />
              <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
                Tipo
                <select
                  aria-label="Tipo de referidor"
                  value={kind ?? ''}
                  onChange={(e) => s.setSearch({ tipo: (e.target.value || undefined) as ReferrerKind | undefined })}
                  className={inputCls}
                >
                  <option value="">Todos</option>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              {!s.search.vista && (
                <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-gold-dark"
                    checked={!!s.search.agrupar}
                    onChange={(e) => s.setSearch({ agrupar: e.target.checked || undefined })}
                  />
                  Agrupar por tipo
                </label>
              )}
            </>
          )}
          <Button variant="secondary" className="ml-auto min-h-10" disabled={exporting} onClick={() => void onExport()}>
            {exporting ? 'Generando…' : 'Excel'}
          </Button>
        </div>
        {report.totals.arrived === 0 && <Empty report={report} s={s} />}
        {many ? (
          <BranchTable report={report} s={s} />
        ) : rows.length === 0 ? (
          <p className="text-ink/50">{kind ? `No hay referidores de tipo ${KIND_LABEL[kind].toLowerCase()}.` : 'Esta sucursal todavía no tiene referidores.'}</p>
        ) : s.search.vista === 'dia' ? (
          <DailyGrid report={report} rows={rows} />
        ) : (
          <SummaryTable report={report} rows={rows} s={s} />
        )}
      </Card>
      <Evolution report={report} />
    </>
  )
}
