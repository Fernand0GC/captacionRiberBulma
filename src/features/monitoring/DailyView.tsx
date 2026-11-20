import { Link } from '@tanstack/react-router'
import { StatTile } from '@/features/dashboard/charts'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { selectCls, ViewSwitch, type ManageScope } from '@/features/prospects/ManageFilterBar'
import { fmtTime, STAGE_LABEL } from '@/features/prospects/format'
import { useReferrers } from '@/features/referrals/api'
import { laPazDate } from '@/lib/dates'
import { PageTitle } from '@/ui/PageTitle'
import { useDailyReport, type DailyFilters, type DailyFollowedRow, type DailyNewRow } from './api'
import { effectiveText, fmtAvg, longDay, perDay, perPerson, shiftDay } from './daily'
import { ExportButton } from './ExportButton'

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** «Referido · Colegas» o el canal de captación. */
function Origin({ r }: { r: { referrer: string | null; channel: string | null } }) {
  if (r.referrer)
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-dark">
        Referido · {r.referrer}
      </span>
    )
  return <span className="text-ink/60">{r.channel ?? '—'}</span>
}

const ClientLink = ({ id, name }: { id: string; name: string }) => (
  <Link
    to="/cliente/$id"
    params={{ id }}
    className="font-semibold text-ink hover:text-gold-dark hover:underline"
  >
    {name}
  </Link>
)

/**
 * Vista «Del día» de /gestion (spec 009): registros nuevos y clientes con seguimiento de un día, con sus listas.
 * Números y listas vienen de una sola llamada (daily_report), así siempre coinciden.
 */
export function DailyView({ scope }: { scope: ManageScope }) {
  const { search, setSearch, isGlobal, sucursal, branchId, branchScope, scopeName } = scope
  const today = laPazDate(new Date())
  const day = search.dia && search.dia <= today ? search.dia : today
  const referred = search.origen === 'referidos'
  // Los referidores son de cada sucursal: con «Todas» solo se filtra «Solo referidos».
  const referrers = useReferrers(referred ? branchId : undefined)
  const filters: DailyFilters = {
    from: day,
    branch_id: isGlobal ? sucursal : undefined,
    origin: referred ? 'referred' : 'all',
    referrer_id: referred && branchId !== undefined ? search.referidor : undefined,
  }
  const q = useDailyReport(filters)
  const r = q.data
  const t = r?.totals
  const tab = search.lista === 'seguimiento' ? 'followed' : 'new'
  const referrerName = referrers.data?.find((x) => x.id === search.referidor)?.name
  const originName = referred
    ? referrerName
      ? `Referidos de ${referrerName}`
      : 'Solo referidos'
    : 'Todos los orígenes'
  const goDay = (d: string) => setSearch({ dia: d === today ? undefined : d })

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title="Del día"
        subtitle={`${scopeName}${referred ? ` · ${originName.toLowerCase()}` : ''}`}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <ExportButton
              disabled={!r || (t?.new ?? 0) + (t?.followed ?? 0) === 0}
              run={async () => {
                const { exportDaily } = await import('./exportDaily')
                await exportDaily(r!, scopeName, originName)
                return '✓ Excel descargado'
              }}
            />
            <ViewSwitch search={search} setSearch={setSearch} />
          </div>
        }
      />

      {/* Día, sucursal y origen */}
      <section
        className="flex flex-wrap items-end gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5"
        aria-label="Filtros"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => goDay(shiftDay(day, -1))}
            className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand"
          >
            ‹
          </button>
          <label className="flex flex-col text-xs font-semibold text-ink/60">
            Día
            <input
              type="date"
              value={day}
              max={today}
              onChange={(e) => e.target.value && goDay(e.target.value > today ? today : e.target.value)}
              className="min-h-11 rounded-xl border border-ink/15 px-2 text-base"
            />
          </label>
          <button
            type="button"
            aria-label="Día siguiente"
            disabled={day >= today}
            onClick={() => goDay(shiftDay(day, 1))}
            className="h-11 w-11 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand disabled:opacity-30"
          >
            ›
          </button>
          {day !== today && (
            <button
              type="button"
              onClick={() => goDay(today)}
              className="min-h-11 rounded-full px-3 text-sm font-semibold text-ink/70"
            >
              Hoy
            </button>
          )}
        </div>
        {isGlobal && (
          <label className="flex min-w-48 flex-col text-xs font-semibold text-ink/60">
            Sucursal
            <select
              aria-label="Sucursal"
              className={selectCls}
              value={sucursal ?? ''}
              onChange={(e) =>
                setSearch({
                  sucursal: e.target.value ? Number(e.target.value) : undefined,
                  referidor: undefined,
                })
              }
            >
              {branchScope.allowAll && <option value="">Todas las sucursales</option>}
              {branchScope.options?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex min-w-44 flex-col text-xs font-semibold text-ink/60">
          Origen
          <select
            aria-label="Origen"
            className={selectCls}
            value={referred ? 'referidos' : ''}
            onChange={(e) =>
              setSearch({
                origen: e.target.value === 'referidos' ? 'referidos' : undefined,
                referidor: undefined,
              })
            }
          >
            <option value="">Todos</option>
            <option value="referidos">Solo referidos</option>
          </select>
        </label>
        {referred && branchId !== undefined && (
          <label className="flex min-w-48 flex-col text-xs font-semibold text-ink/60">
            Referidor
            <select
              aria-label="Referidor"
              className={selectCls}
              value={search.referidor ?? ''}
              onChange={(e) => setSearch({ referidor: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Todos los referidores</option>
              {(referrers.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.active ? '' : ' (baja)'}
                </option>
              ))}
            </select>
          </label>
        )}
        {q.isFetching && <span className="ml-auto text-sm text-ink/40">Actualizando…</span>}
      </section>

      <p className="-mb-1 px-1 text-sm text-ink/55">
        <span className="font-semibold text-ink">{longDay(day).replace(/^./, (c) => c.toUpperCase())}</span>
        {day === today && ' · hoy'}
      </p>

      {q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">
          No se pudo cargar. {(q.error as Error).message}
        </p>
      ) : (
        <>
          {/* Números (FR-001) */}
          <section
            className="grid grid-cols-2 gap-3 lg:grid-cols-5"
            aria-label="Números del día"
            data-testid="daily-totals"
          >
            <StatTile
              accent
              label="Registros nuevos"
              value={t?.new ?? '…'}
              hint={
                t
                  ? `${t.new_people} ${t.new_people === 1 ? 'persona registró' : 'personas registraron'}`
                  : undefined
              }
            />
            <StatTile
              label="Promedio por persona"
              value={t ? fmtAvg(perPerson(t)) : '…'}
              hint="registros ÷ personas"
            />
            <StatTile label="Promedio por día" value={t ? fmtAvg(perDay(t)) : '…'} hint="últimos 7 días" />
            <StatTile
              accent
              label="Clientes con seguimiento"
              value={t?.followed ?? '…'}
              hint={t ? `${t.contacts} ${t.contacts === 1 ? 'contacto' : 'contactos'} en total` : undefined}
            />
            <StatTile
              label="Efectivos"
              value={t?.effective ?? '…'}
              hint={(t && effectiveText(t)) ?? undefined}
            />
          </section>
          {day === today && (
            <p className="-mt-1 px-1 text-xs text-ink/45">
              Los números de hoy pueden subir si alguien registró sin conexión y sincroniza más tarde.
            </p>
          )}

          {/* Listas (FR-002) */}
          <div className="flex gap-1 border-b border-ink/10" role="tablist" aria-label="Listas del día">
            {(
              [
                ['new', 'Registros nuevos', t?.new],
                ['followed', 'Clientes con seguimiento', t?.followed],
              ] as const
            ).map(([k, label, n]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setSearch({ lista: k === 'followed' ? 'seguimiento' : undefined })}
                className={`-mb-px min-h-11 border-b-[3px] px-4 text-sm font-semibold ${tab === k ? 'border-gold text-ink' : 'border-transparent text-ink/50'}`}
              >
                {label}
                <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs tabular-nums">{n ?? '…'}</span>
              </button>
            ))}
          </div>
          {r?.truncated && (
            <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              La lista muestra las primeras 2000 filas. Elige una sucursal para ver todas.
            </p>
          )}
          {r &&
            (tab === 'new' ? (
              <NewTable rows={r.new_rows} showBranch={isGlobal && sucursal === undefined} />
            ) : (
              <FollowedTable
                rows={r.followed_rows}
                day={day}
                showBranch={isGlobal && sucursal === undefined}
              />
            ))}

          {/* Cómo se calcula (FR-008) */}
          <details className="rounded-3xl bg-white p-4 text-sm shadow-sm ring-1 ring-ink/5">
            <summary className="cursor-pointer font-semibold">Cómo se calcula cada número</summary>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-ink/70 sm:grid-cols-[14rem_1fr]">
              <dt className="font-semibold text-ink">Registros nuevos</dt>
              <dd>
                Clientes registrados ese día (hora de Bolivia). Cuenta la hora del registro en el celular,
                aunque se sincronice después. No cuentan duplicados ni anulados.
              </dd>
              <dt className="font-semibold text-ink">Promedio por persona</dt>
              <dd>Registros nuevos ÷ personas que registraron ese día.</dd>
              <dt className="font-semibold text-ink">Promedio por día</dt>
              <dd>Registros de los últimos 7 días (terminando en el día elegido) ÷ 7.</dd>
              <dt className="font-semibold text-ink">Clientes con seguimiento</dt>
              <dd>
                Clientes distintos con al menos un contacto registrado ese día (llamada, mensaje o atención,
                también «no contestó»). Un cliente llamado 3 veces cuenta 1.
              </dd>
              <dt className="font-semibold text-ink">Efectivos</dt>
              <dd>De esos clientes, los que tuvieron al menos un contacto efectivo.</dd>
              <dt className="font-semibold text-ink">Solo referidos</dt>
              <dd>Los mismos números y listas, solo con clientes que tienen referidor.</dd>
            </dl>
          </details>
        </>
      )}
    </main>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{text}</p>
}

function NewTable({ rows, showBranch }: { rows: DailyNewRow[]; showBranch: boolean }) {
  if (rows.length === 0) return <Empty text="No hubo registros nuevos con estos filtros." />
  return (
    <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5">
      <table
        className="w-full min-w-[52rem] text-left text-sm"
        aria-label="Registros nuevos del día"
        data-testid="daily-new"
      >
        <thead className="bg-ink text-xs uppercase tracking-wide text-gold-light">
          <tr>
            {[
              'Hora',
              'Cliente',
              'Celular',
              'Canal / referidor',
              'Registró',
              'Responsable',
              'Etapa',
              ...(showBranch ? ['Sucursal'] : []),
            ].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtTime(r.registered_at)}</td>
              <td className="px-3 py-2">
                <ClientLink id={r.id} name={r.full_name} />
              </td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink/70">{r.phone}</td>
              <td className="px-3 py-2">
                <Origin r={r} />
              </td>
              <td className="px-3 py-2">{r.created_by}</td>
              <td className="px-3 py-2">
                {r.assigned_to ?? <span className="text-ink/40">Sin asignar</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{STAGE_LABEL[r.stage] ?? r.stage}</td>
              {showBranch && <td className="px-3 py-2">{r.branch}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FollowedTable({
  rows,
  day,
  showBranch,
}: {
  rows: DailyFollowedRow[]
  day: string
  showBranch: boolean
}) {
  if (rows.length === 0) return <Empty text="Nadie tuvo seguimiento ese día con estos filtros." />
  return (
    <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5">
      <table
        className="w-full min-w-[60rem] text-left text-sm"
        aria-label="Clientes con seguimiento del día"
        data-testid="daily-followed"
      >
        <thead className="bg-ink text-xs uppercase tracking-wide text-gold-light">
          <tr>
            {[
              'Último contacto',
              'Cliente',
              'Contactos del día',
              'Último resultado',
              'Contactó',
              'Registrado',
              'Canal / referidor',
              'Etapa',
              ...(showBranch ? ['Sucursal'] : []),
            ].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                {fmtTime(r.last_at)}{' '}
                <span className="text-xs text-ink/50">{METHOD_LABEL[r.last_method] ?? r.last_method}</span>
              </td>
              <td className="px-3 py-2">
                <ClientLink id={r.id} name={r.full_name} />
                <span className="block text-xs tabular-nums text-ink/50">{r.phone}</span>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.contacts}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${r.effective ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
                >
                  {RESULT_LABEL[r.last_result] ?? r.last_result}
                </span>
              </td>
              <td className="px-3 py-2">{r.last_actor}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink/70">
                {laPazDate(new Date(r.registered_at)) === day
                  ? 'mismo día'
                  : dm(laPazDate(new Date(r.registered_at)))}
              </td>
              <td className="px-3 py-2">
                <Origin r={r} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">{STAGE_LABEL[r.stage] ?? r.stage}</td>
              {showBranch && <td className="px-3 py-2">{r.branch}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DailyView
