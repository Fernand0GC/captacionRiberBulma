import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { digits, NUMERIC_INPUT } from '@/lib/numeric'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { saveCatalogItem, useOrgCatalog, useProfileNames, type CatalogLevel, type Channel, type Subchannel } from './api'

type Item = { id?: number; name: string; sort: number; active: boolean }
type Flag = 'uses_place' | 'uses_goal' | 'uses_share_goal' | 'uses_flyers' | 'uses_freelancers'
/** Valor de una marca que todavía no existe en el elemento (fila nueva). */
const FLAG_DEFAULT: Record<Flag, boolean> = { uses_place: true, uses_goal: true, uses_share_goal: false, uses_flyers: false, uses_freelancers: false }
type FlagDef = { key: Flag; label: string }
const PLACE_FLAGS: FlagDef[] = [{ key: 'uses_place', label: 'Pide ubicación' }]
/** Por subcanal; en el canal valen para asignaciones sin subcanal y como valor inicial de subcanales nuevos (004). */
const GOAL_FLAGS: FlagDef[] = [
  { key: 'uses_goal', label: 'Captación' },
  { key: 'uses_share_goal', label: 'Compartidas' },
]
/** Canal: metas y «Volanteras que van» (spec 006, FR-008). */
const CHANNEL_FLAGS: FlagDef[] = [...GOAL_FLAGS, { key: 'uses_flyers', label: 'Pide volanteras' }, { key: 'uses_freelancers', label: 'Freelancers' }]
type Draft = Item &
  Partial<Record<Flag, boolean>> &
  Partial<Pick<Subchannel, 'morning_start' | 'morning_end' | 'afternoon_start' | 'afternoon_end'>>

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')
const inputCls = 'min-h-10 rounded-xl border border-ink/15 bg-white px-2'

/** Una fila editable del catálogo. Sin botón de borrar: se desactiva (las asignaciones viejas lo siguen usando). */
function Row({
  level,
  item,
  parent,
  withTimes,
  flags = [],
  addedBy,
}: {
  level: CatalogLevel
  item: Draft
  parent?: { key: 'strategy_id' | 'channel_id'; id: number }
  withTimes?: boolean
  /** Casillas extra: «Pide ubicación» (estrategia) o metas de captación y compartidas (canal y subcanal). */
  flags?: FlagDef[]
  /** «Agregado por … el …» en subcanales que agregó ventas desde el formulario (FR-016). */
  addedBy?: string
}) {
  const qc = useQueryClient()
  const toast = useToast()
  // La base devuelve las horas con segundos ("10:00:00"); el formulario trabaja con "10:00".
  const base: Draft = {
    ...item,
    ...Object.fromEntries(flags.map((f) => [f.key, item[f.key] ?? FLAG_DEFAULT[f.key]])),
    ...(withTimes && {
      morning_start: hhmm(item.morning_start),
      morning_end: hhmm(item.morning_end),
      afternoon_start: hhmm(item.afternoon_start),
      afternoon_end: hhmm(item.afternoon_end),
    }),
  }
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
      for (const f of flags) fields[f.key] = d[f.key] ?? FLAG_DEFAULT[f.key]
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
      <input aria-label="Orden" {...NUMERIC_INPUT} value={d.sort} onChange={(e) => set('sort', digits(e.target.value))} className={`${inputCls} w-16`} />
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
      {flags.map((f) => (
        <label key={f.key} className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={d[f.key] ?? FLAG_DEFAULT[f.key]} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
        </label>
      ))}
      {d.id && (
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={d.active} onChange={(e) => set('active', e.target.checked)} /> Activo
        </label>
      )}
      <Button className="min-h-10 px-3 text-sm" disabled={!dirty || busy} onClick={() => void save()}>
        {d.id ? 'Guardar' : 'Agregar'}
      </Button>
      {addedBy && (
        <span className="w-full rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-dark sm:w-auto" data-testid="added-by-sales">
          {addedBy}
        </span>
      )}
    </div>
  )
}

const empty = (sort: number): Draft => ({ name: '', sort, active: true })
/** Subcanal nuevo: parte con las metas de su canal. */
const emptySub = (sort: number, c: Channel): Draft => ({ ...empty(sort), uses_goal: c.uses_goal, uses_share_goal: c.uses_share_goal })
const dmy = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' })

/**
 * Catálogo de la organización (spec 003, US4): solo Sistemas. La base lo exige con RLS. Desde la 004, metas de captación
 * y compartidas por subcanal, y los subcanales que agregó ventas desde el formulario quedan señalados.
 */
export function CatalogPage() {
  const q = useOrgCatalog()
  const [open, setOpen] = useState<number | null>(null)
  const cat = q.data
  const names = useProfileNames((cat?.subchannels ?? []).flatMap((x) => (x.added_by ? [x.added_by] : [])))
  const addedBy = (x: Subchannel) =>
    x.added_by ? `Agregado por ${names.data?.[x.added_by] ?? 'ventas'}${x.added_at ? ` el ${dmy(x.added_at)}` : ''}` : undefined
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
              <Row level="org_strategies" item={s} flags={PLACE_FLAGS} />
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
                          <Row level="org_channels" item={c} flags={CHANNEL_FLAGS} />
                        </div>
                        <span className="text-xs text-ink/50">{subs.length} {subs.length === 1 ? 'subcanal' : 'subcanales'}</span>
                      </div>
                      {open === c.id && (
                        <div className="ml-11 border-l-2 border-ink/10 pl-3">
                          {subs.map((x) => (
                            <Row key={x.id} level="org_subchannels" item={x} withTimes flags={GOAL_FLAGS} addedBy={addedBy(x)} />
                          ))}
                          <Row level="org_subchannels" item={emptySub(subs.length + 1, c)} parent={{ key: 'channel_id', id: c.id }} withTimes flags={GOAL_FLAGS} />
                        </div>
                      )}
                    </div>
                  )
                })}
                <Row level="org_channels" item={empty(channels.length + 1)} parent={{ key: 'strategy_id', id: s.id }} flags={CHANNEL_FLAGS} />
              </div>
            </section>
          )
        })}
      {cat && (
        <section className="rounded-3xl bg-white p-4 ring-1 ring-ink/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Nueva estrategia</p>
          <Row level="org_strategies" item={empty(cat.strategies.length + 1)} flags={PLACE_FLAGS} />
        </section>
      )}
    </main>
  )
}
