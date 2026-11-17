import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { saveCatalogItem, useOrgCatalog, type CatalogLevel, type Subchannel } from './api'

type Item = { id?: number; name: string; sort: number; active: boolean }
type Draft = Item & Partial<Pick<Subchannel, 'morning_start' | 'morning_end' | 'afternoon_start' | 'afternoon_end'>>

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')
const inputCls = 'min-h-10 rounded-xl border border-ink/15 bg-white px-2'

/** Una fila editable del catálogo. Sin botón de borrar: se desactiva (las asignaciones viejas lo siguen usando). */
function Row({
  level,
  item,
  parent,
  withTimes,
}: {
  level: CatalogLevel
  item: Draft
  parent?: { key: 'strategy_id' | 'channel_id'; id: number }
  withTimes?: boolean
}) {
  const qc = useQueryClient()
  const toast = useToast()
  // La base devuelve las horas con segundos ("10:00:00"); el formulario trabaja con "10:00".
  const base: Draft = withTimes
    ? { ...item, morning_start: hhmm(item.morning_start), morning_end: hhmm(item.morning_end), afternoon_start: hhmm(item.afternoon_start), afternoon_end: hhmm(item.afternoon_end) }
    : item
  const [d, setD] = useState<Draft>(base)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(d) !== JSON.stringify(base)
  const set = (k: keyof Draft, v: string | number | boolean) => setD((s) => ({ ...s, [k]: v }))

  async function save() {
    if (d.name.trim().length < 2) return toast('Escribe un nombre de al menos 2 letras.', 'error')
    setBusy(true)
    try {
      const fields: Record<string, unknown> = { id: d.id, name: d.name.trim(), sort: Number(d.sort) || 0, active: d.active }
      if (parent && !d.id) fields[parent.key] = parent.id
      if (withTimes)
        for (const k of ['morning_start', 'morning_end', 'afternoon_start', 'afternoon_end'] as const) fields[k] = d[k] || null
      await saveCatalogItem(level, fields as Record<string, unknown> & { id?: number })
      await qc.invalidateQueries({ queryKey: ['org', 'catalog'] })
      toast(d.id ? '✓ Guardado' : '✓ Agregado', 'success')
      if (!d.id) setD(base)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 py-1.5 ${d.active ? '' : 'opacity-60'}`} data-testid={`catalog-row-${level}`}>
      <input aria-label="Nombre" value={d.name} placeholder="Nombre nuevo…" onChange={(e) => set('name', e.target.value)} className={`${inputCls} min-w-48 flex-1`} />
      <input aria-label="Orden" type="number" value={d.sort} onChange={(e) => set('sort', e.target.value)} className={`${inputCls} w-16`} />
      {withTimes && (
        <span className="flex flex-wrap items-center gap-1 text-xs text-ink/60">
          Mañana
          <input aria-label="Mañana inicio" type="time" value={hhmm(d.morning_start)} onChange={(e) => set('morning_start', e.target.value)} className={inputCls} />
          <input aria-label="Mañana fin" type="time" value={hhmm(d.morning_end)} onChange={(e) => set('morning_end', e.target.value)} className={inputCls} />
          Tarde
          <input aria-label="Tarde inicio" type="time" value={hhmm(d.afternoon_start)} onChange={(e) => set('afternoon_start', e.target.value)} className={inputCls} />
          <input aria-label="Tarde fin" type="time" value={hhmm(d.afternoon_end)} onChange={(e) => set('afternoon_end', e.target.value)} className={inputCls} />
        </span>
      )}
      {d.id && (
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={d.active} onChange={(e) => set('active', e.target.checked)} /> Activo
        </label>
      )}
      <Button className="min-h-10 px-3 text-sm" disabled={!dirty || busy} onClick={() => void save()}>
        {d.id ? 'Guardar' : 'Agregar'}
      </Button>
    </div>
  )
}

const empty = (sort: number): Draft => ({ name: '', sort, active: true })

/** Catálogo de la organización (spec 003, US4): solo Sistemas. La base lo exige con RLS. */
export function CatalogPage() {
  const q = useOrgCatalog()
  const [open, setOpen] = useState<number | null>(null)
  const cat = q.data
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle title="Catálogo de la planificación" subtitle="Estrategias, canales, subcanales y horario sugerido" />
      {q.isError && <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">{(q.error as Error).message}</p>}
      {cat &&
        cat.strategies.map((s) => {
          const channels = cat.channels.filter((c) => c.strategy_id === s.id)
          return (
            <section key={s.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5" aria-label={`Estrategia ${s.name}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Estrategia</p>
              <Row level="org_strategies" item={s} />
              <div className="mt-2 flex flex-col gap-2 border-l-2 border-gold/40 pl-3">
                {channels.map((c) => {
                  const subs = cat.subchannels.filter((x) => x.channel_id === c.id)
                  return (
                    <div key={c.id}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-expanded={open === c.id}
                          onClick={() => setOpen(open === c.id ? null : c.id)}
                          className="min-h-9 w-9 rounded-full ring-1 ring-ink/15"
                          aria-label={`Subcanales de ${c.name}`}
                        >
                          {open === c.id ? '−' : '+'}
                        </button>
                        <div className="flex-1">
                          <Row level="org_channels" item={c} />
                        </div>
                        <span className="text-xs text-ink/50">{subs.length} subcanales</span>
                      </div>
                      {open === c.id && (
                        <div className="ml-11 border-l-2 border-ink/10 pl-3">
                          {subs.map((x) => (
                            <Row key={x.id} level="org_subchannels" item={x} withTimes />
                          ))}
                          <Row level="org_subchannels" item={empty(subs.length + 1)} parent={{ key: 'channel_id', id: c.id }} withTimes />
                        </div>
                      )}
                    </div>
                  )
                })}
                <Row level="org_channels" item={empty(channels.length + 1)} parent={{ key: 'strategy_id', id: s.id }} />
              </div>
            </section>
          )
        })}
      {cat && (
        <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Nueva estrategia</p>
          <Row level="org_strategies" item={empty(cat.strategies.length + 1)} />
        </section>
      )}
    </main>
  )
}
