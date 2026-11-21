import { PageTitle } from '@/ui/PageTitle'
import { ContactsSection, RegistrarsSection } from './ContactsSection'
import { LoadSection } from './LoadSection'
import { pickBranch, Tabs, useReferralScope } from './parts'
import { ReferrersSection } from './ReferrersSection'
import { ReportSection } from './ReportSection'
import { PERIODS, type ReferralSection } from './search'

// Referidos (spec 005 + 014 + 016): reporte por período y sucursales, contactos, quién registra, referidores y metas,
// y carga en lote con asignación (016).
// Solo jefe de ventas (sus sucursales), gerencia y Sistemas; el servidor lo verifica (referral_branches).
// Todos los filtros viven en la URL (FR-009): recargar o compartir el link abre la misma vista.

const SECTIONS: { v: ReferralSection; label: string }[] = [
  { v: 'reporte', label: 'Reporte' },
  { v: 'contactos', label: 'Contactos' },
  { v: 'quien', label: 'Quién registra' },
  { v: 'referidores', label: 'Referidores y metas' },
  { v: 'cargar', label: 'Cargar' },
]

export function ReferralsPage() {
  const s = useReferralScope()
  const section = s.search.seccion ?? 'reporte'
  const period = s.search.periodo ?? 'mes'
  const showPeriod = section !== 'referidores' && section !== 'cargar'

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6">
      <PageTitle
        title="Referidos"
        subtitle={s.branchName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {(s.options.length > 1 || s.allowAll) && (
              <select
                aria-label="Sucursal"
                value={s.branch ?? ''}
                onChange={(e) => pickBranch(s, e.target.value ? Number(e.target.value) : undefined)}
                className="min-h-10 rounded-full border border-ink/15 bg-white px-3 text-sm"
              >
                {s.canAll && <option value="">{s.allLabel}</option>}
                {s.options.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <Tabs label="Sección" value={section} onChange={(v) => s.setSearch({ seccion: v === 'reporte' ? undefined : v }, { push: true })} items={SECTIONS} />
          </div>
        }
      />
      {showPeriod && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-full bg-white p-1 ring-1 ring-ink/10" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <button
                key={p.v}
                type="button"
                aria-pressed={period === p.v}
                onClick={() =>
                  s.setSearch({
                    periodo: p.v === 'mes' ? undefined : p.v,
                    // Al pasar a «Rango» arranca del período que se estaba viendo.
                    ...(p.v === 'rango' && !s.search.desde ? { desde: s.range.from, hasta: s.range.to } : {}),
                  })
                }
                className={`min-h-9 rounded-full px-4 text-sm font-semibold ${period === p.v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'rango' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Desde"
                value={s.range.from}
                onChange={(e) => s.setSearch({ desde: e.target.value || undefined })}
                className="min-h-10 rounded-xl border border-ink/15 bg-white px-2 text-sm"
              />
              <span className="text-ink/40">a</span>
              <input
                type="date"
                aria-label="Hasta"
                value={s.range.to}
                min={s.range.from}
                onChange={(e) => s.setSearch({ hasta: e.target.value || undefined })}
                className="min-h-10 rounded-xl border border-ink/15 bg-white px-2 text-sm"
              />
            </div>
          )}
        </div>
      )}
      {!s.ready ? (
        <p className="text-ink/45">Cargando…</p>
      ) : section === 'contactos' ? (
        <ContactsSection s={s} />
      ) : section === 'quien' ? (
        <RegistrarsSection s={s} />
      ) : section === 'cargar' ? (
        <LoadSection s={s} />
      ) : section === 'referidores' ? (
        <ReferrersSection key={s.branch ?? 'all'} s={s} />
      ) : (
        <ReportSection s={s} />
      )}
    </main>
  )
}
