import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card } from '@/features/dashboard/charts'
import { ROLE_LABEL, type AppRole } from '@/features/auth/types'
import { fmtDate, STAGE_LABEL } from '@/features/prospects/format'
import { Button } from '@/ui/Button'
import { ColumnFilter, FilterOptions, type FilterOption } from '@/ui/ColumnFilter'
import { useToast } from '@/ui/Toast'
import { useReferralRange, type RangeContact } from './api'
import { contactStage, filterContacts, fmtPercent, rangeLabel, sortRegistrars } from './logic'
import { pickBranch, td, th, type ReferralScope } from './parts'

// Pestañas «Contactos» (US4) y «Quién registra» (US5) de Referidos (spec 014).

const fmtShort = (iso: string | null) => (iso ? fmtDate(iso) : '—')

/** Opciones de un filtro a partir de los valores que hay en la lista (sin repetidos, en orden alfabético). */
function optionsOf(list: RangeContact[], pick: (c: RangeContact) => string | null): FilterOption[] {
  const values = [...new Set(list.map(pick).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'es'))
  return values.map((v) => ({ value: v, label: v }))
}

const STAGE_OPTIONS: FilterOption[] = [
  { value: 'capture', label: STAGE_LABEL.capture ?? 'Sin contactar' },
  { value: 'recapture', label: STAGE_LABEL.recapture ?? 'Recaptación' },
  { value: 'followup', label: STAGE_LABEL.followup ?? 'Seguimiento' },
  { value: 'interested', label: STAGE_LABEL.interested ?? 'Cliente potencial' },
  { value: 'sold', label: 'Compró' },
  { value: 'lost', label: STAGE_LABEL.lost ?? 'Sin interés' },
]

export function ContactsSection({ s }: { s: ReferralScope }) {
  const q = useReferralRange({ branch_id: s.branch, from: s.range.from, to: s.range.to })
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  if (q.isError) return <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{q.error.message}</p>
  if (!q.data) return <p className="text-ink/45">Cargando…</p>
  const report = q.data
  const all = report.contacts
  const f = s.search
  const list = filterContacts(all, {
    referrerId: f.referidor,
    stage: f.etapa,
    assigned: f.responsable,
    product: f.producto,
    author: f.autor,
  })
  const many = s.branch === undefined
  const referrerOptions: FilterOption[] = [...new Map(all.map((c) => [c.referrer_id, c])).values()]
    .map((c) => ({ value: String(c.referrer_id), label: many ? `${c.referrer_name} · ${c.branch_name}` : c.referrer_name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  const labelOf = (opts: FilterOption[], v: string | number | undefined) =>
    v === undefined ? undefined : (opts.find((o) => o.value === String(v))?.label ?? String(v))

  const onExport = async () => {
    setExporting(true)
    try {
      const { exportContacts } = await import('./exportReferrals')
      await exportContacts(list, { title: `Referidos · ${s.branchName ?? ''} · ${rangeLabel(report.from, report.to)}` })
    } catch {
      toast('No se pudo generar el Excel.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const filtered = list.length !== all.length
  return (
    <Card
      title={`Contactos referidos · ${rangeLabel(report.from, report.to)}`}
      subtitle={`${s.branchName ?? ''} · ${filtered ? `${list.length} de ${all.length}` : all.length} contactos. Los que siguen sin contactar, del que más espera al que menos.`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {filtered && (
          <Button
            variant="secondary"
            className="min-h-10"
            onClick={() => s.setSearch({ referidor: undefined, etapa: undefined, responsable: undefined, producto: undefined, autor: undefined })}
          >
            Quitar filtros
          </Button>
        )}
        <Button variant="secondary" className="ml-auto min-h-10" disabled={exporting || list.length === 0} onClick={() => void onExport()}>
          {exporting ? 'Generando…' : 'Excel'}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-sm" aria-label="Contactos referidos">
          <thead>
            <tr className="border-b border-ink/10 text-ink/50">
              <th scope="col" className={th}>
                Cliente
              </th>
              {many && (
                <th scope="col" className={th}>
                  Sucursal
                </th>
              )}
              <th scope="col" className="p-0 font-semibold">
                <ColumnFilter
                  label="Referidor"
                  active={f.referidor !== undefined}
                  valueLabel={labelOf(referrerOptions, f.referidor)}
                  onClear={() => s.setSearch({ referidor: undefined })}
                >
                  <FilterOptions
                    noun="referidor"
                    options={referrerOptions}
                    value={f.referidor === undefined ? undefined : String(f.referidor)}
                    onPick={(v) => s.setSearch({ referidor: v ? Number(v) : undefined })}
                  />
                </ColumnFilter>
              </th>
              <th scope="col" className="p-0 font-semibold">
                <ColumnFilter label="Producto" active={!!f.producto} valueLabel={f.producto} onClear={() => s.setSearch({ producto: undefined })}>
                  <FilterOptions noun="producto" options={optionsOf(all, (c) => c.product)} value={f.producto} onPick={(v) => s.setSearch({ producto: v })} />
                </ColumnFilter>
              </th>
              <th scope="col" className="p-0 font-semibold">
                <ColumnFilter
                  label="Responsable"
                  active={!!f.responsable}
                  valueLabel={f.responsable}
                  onClear={() => s.setSearch({ responsable: undefined })}
                >
                  <FilterOptions
                    noun="responsable"
                    options={optionsOf(all, (c) => c.assigned_to)}
                    value={f.responsable}
                    onPick={(v) => s.setSearch({ responsable: v })}
                  />
                </ColumnFilter>
              </th>
              <th scope="col" className="p-0 font-semibold">
                <ColumnFilter label="Registrado por" active={!!f.autor} valueLabel={f.autor} onClear={() => s.setSearch({ autor: undefined })}>
                  <FilterOptions noun="persona" options={optionsOf(all, (c) => c.registered_by)} value={f.autor} onPick={(v) => s.setSearch({ autor: v })} />
                </ColumnFilter>
              </th>
              <th scope="col" className="p-0 font-semibold">
                <ColumnFilter label="Etapa" active={!!f.etapa} valueLabel={labelOf(STAGE_OPTIONS, f.etapa)} onClear={() => s.setSearch({ etapa: undefined })}>
                  <FilterOptions noun="etapa" options={STAGE_OPTIONS} value={f.etapa} onPick={(v) => s.setSearch({ etapa: v })} />
                </ColumnFilter>
              </th>
              <th scope="col" className={th}>
                Llegó
              </th>
              <th scope="col" className={th}>
                Último contacto
              </th>
              <th scope="col" className={th}>
                Venta
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={many ? 10 : 9} className="py-6 text-center text-ink/50">
                  {all.length === 0 ? 'Nadie registró referidos en el período.' : 'Ningún contacto con estos filtros.'}
                </td>
              </tr>
            )}
            {list.map((c) => (
              <tr key={c.id} className="border-b border-ink/5" data-testid={`contact-row-${c.full_name}`}>
                <td className="py-2 pr-3">
                  <Link to="/cliente/$id" params={{ id: c.id }} className="font-semibold hover:text-gold-dark hover:underline">
                    {c.full_name}
                  </Link>
                  <span className="block text-xs tabular-nums text-ink/45">{c.phone}</span>
                </td>
                {many && <td className="py-2 pr-3">{c.branch_name}</td>}
                <td className="py-2 pr-3">{c.referrer_name}</td>
                <td className="py-2 pr-3">{c.product ?? '—'}</td>
                <td className="py-2 pr-3">{c.assigned_to ?? <span className="text-rb-red">Sin asignar</span>}</td>
                <td className="py-2 pr-3">{c.registered_by ?? '—'}</td>
                <td className="py-2 pr-3">
                  {contactStage(c)}
                  {c.days_waiting !== null && (
                    <span className={`block text-xs font-semibold ${c.days_waiting >= 3 ? 'text-rb-red' : 'text-ink/50'}`}>
                      {c.days_waiting === 0 ? 'llegó hoy' : `espera hace ${c.days_waiting} ${c.days_waiting === 1 ? 'día' : 'días'}`}
                    </span>
                  )}
                </td>
                <td className={td}>{fmtShort(c.arrived_at)}</td>
                <td className={td}>{fmtShort(c.last_contact_at)}</td>
                <td className={td}>{fmtShort(c.sold_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function RegistrarsSection({ s }: { s: ReferralScope }) {
  const q = useReferralRange({ branch_id: s.branch, from: s.range.from, to: s.range.to })
  if (q.isError) return <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{q.error.message}</p>
  if (!q.data) return <p className="text-ink/45">Cargando…</p>
  const report = q.data
  const rows = sortRegistrars(report.registrars)
  const many = s.branch === undefined
  const marking = rows.filter((r) => r.referred > 0).length
  return (
    <Card
      title={`Quién registra referidos · ${rangeLabel(report.from, report.to)}`}
      subtitle={`${s.branchName ?? ''} · ${marking} de ${rows.length} personas marcaron al menos un referido. Las que registraron sin marcar ninguno, en rojo.`}
    >
      {rows.length === 0 ? (
        <p className="text-ink/50">Nadie registró captaciones en el período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm" aria-label="Quién registra referidos">
            <thead>
              <tr className="border-b border-ink/10 text-ink/50">
                {['Persona', ...(many ? ['Sucursal'] : []), 'Captaciones', 'Referidas', '% referidas'].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.id}-${r.branch_name}`} className="border-b border-ink/5" data-testid={`registrar-row-${r.name}`}>
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{r.name}</span>
                    <span className="block text-xs text-ink/45">{ROLE_LABEL[r.role as AppRole] ?? r.role}</span>
                  </td>
                  {many && (
                    <td className="py-2 pr-3">
                      <button type="button" className="hover:text-gold-dark hover:underline" onClick={() => pickBranch(s, s.options.find((b) => b.name === r.branch_name)?.id, { push: true })}>
                        {r.branch_name}
                      </button>
                    </td>
                  )}
                  <td className={td}>{r.captures}</td>
                  <td className={`${td} font-semibold ${r.referred === 0 ? 'text-rb-red' : 'text-emerald-700'}`}>{r.referred}</td>
                  <td className={td}>{fmtPercent(Math.round((r.referred / r.captures) * 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
