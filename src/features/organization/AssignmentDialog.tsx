import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Field, TextInput } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { useToast } from '@/ui/Toast'
import {
  addSubchannel,
  saveAssignment,
  saveAssignments,
  SHIFT_LABEL,
  useOrgCatalog,
  useOrgMutation,
  useOrgStaff,
  type Assignment,
  type AssignmentInput,
  type Shift,
  type Subchannel,
} from './api'
import { clashLabel, formFields, goalFlags, overlaps, parseGoal, sameSlot, suggestedTimes, usesFlyers, type GoalFlags } from './logic'

type Form = {
  shift: Shift
  profile_id: string
  strategy_id: string
  channel_id: string
  /** Solo al editar: una asignación tiene un subcanal. */
  subchannel_id: string
  start_time: string
  end_time: string
  place: string
  /** Metas cuando no hay subcanal (o al editar). */
  goal: string
  share_goal: string
  /** Observaciones (spec 006): también al crear; en una carga múltiple van a todas. */
  notes: string
}

const NOTES_MAX = 300

/** Metas escritas para cada subcanal marcado. */
type Goals = { goal: string; share_goal: string }

/** Error del formulario y el campo al que hay que llevar la vista (spec 007, FR-007): su `data-field`. */
type FormError = { message: string; field?: string }

const timeCls =
  'min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-3 text-lg outline-none focus:border-gold focus:ring-4 focus:ring-gold/20'
const asText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

/**
 * Crear o editar una asignación (spec 003, US1). Desde la 004: al crear se marcan uno o varios subcanales, cada uno con
 * sus metas de captación y compartidas, y se puede agregar el subcanal que falta. Al editar sigue siendo uno solo.
 */
export function AssignmentDialog({
  branch,
  day,
  shift,
  assignment,
  sameDay,
  onClose,
}: {
  branch: number
  day: string
  shift: Shift
  assignment?: Assignment
  /** Asignaciones ya cargadas de esa sucursal y día, para avisar de cruces de horario. */
  sameDay: Assignment[]
  onClose: () => void
}) {
  const catalog = useOrgCatalog()
  const staff = useOrgStaff(branch)
  const toast = useToast()
  const qc = useQueryClient()
  const saveOne = useOrgMutation(saveAssignment)
  const saveMany = useOrgMutation(saveAssignments)
  const editing = !!assignment
  const [v, setV] = useState<Form>({
    shift: assignment?.shift ?? shift,
    profile_id: assignment?.profile_id ?? '',
    strategy_id: assignment ? String(assignment.strategy_id) : '',
    channel_id: assignment ? String(assignment.channel_id) : '',
    subchannel_id: assignment?.subchannel_id ? String(assignment.subchannel_id) : '',
    start_time: assignment?.start_time ?? '',
    end_time: assignment?.end_time ?? '',
    place: assignment?.place ?? '',
    goal: asText(assignment?.goal),
    share_goal: asText(assignment?.share_goal),
    notes: assignment?.notes ?? '',
  })
  // Volanteras que van (spec 006, US3): ids marcados.
  const [flyers, setFlyers] = useState<string[]>(assignment?.flyer_ids ?? [])
  // Subcanales marcados al crear, en el orden en que se marcaron (el primero propone el horario).
  const [picked, setPicked] = useState<number[]>([])
  const [goals, setGoals] = useState<Record<number, Goals>>({})
  // Si la persona escribe las horas a mano, el horario sugerido ya no las pisa.
  const [timesTouched, setTimesTouched] = useState(!!assignment?.start_time)
  const [adding, setAdding] = useState<string | null>(null) // null = cerrado; texto = nombre que se escribe
  const [addBusy, setAddBusy] = useState(false)
  const [err, setErr] = useState<FormError>()
  const bodyRef = useRef<HTMLDivElement>(null)
  // Guardado único (spec 007, FR-005): `busy` recién cambia en el próximo render; esta marca cambia al instante.
  const saving = useRef(false)

  /** Muestra el error junto a los botones y lleva la vista al campo que falta (FR-006, FR-007). */
  function fail(message: string, field?: string) {
    setErr({ message, field })
    if (!field) return
    requestAnimationFrame(() => {
      const box = bodyRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)
      if (!box) return
      box.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const input = box.matches('input, select, textarea, button') ? box : box.querySelector<HTMLElement>('input, select, textarea, button')
      input?.focus({ preventScroll: true })
    })
  }

  const cat = catalog.data
  const isActiveOrCurrent = (active: boolean, id: number, current: string) => active || String(id) === current
  const strategies = (cat?.strategies ?? []).filter((s) => isActiveOrCurrent(s.active, s.id, v.strategy_id))
  const channels = (cat?.channels ?? []).filter(
    (c) => String(c.strategy_id) === v.strategy_id && isActiveOrCurrent(c.active, c.id, v.channel_id),
  )
  const subchannels = (cat?.subchannels ?? []).filter(
    (s) => String(s.channel_id) === v.channel_id && isActiveOrCurrent(s.active, s.id, v.subchannel_id),
  )
  const subById = (id: number) => cat?.subchannels.find((s) => s.id === id)
  // Ubicación según la estrategia; metas según el subcanal (o el canal si no hay subcanal).
  const show = formFields(cat, v.strategy_id, v.channel_id, editing ? v.subchannel_id : undefined)
  // La persona asignada sigue en la lista aunque ya no esté activa.
  const people = [...(staff.data ?? [])]
  if (assignment && !people.some((p) => p.id === assignment.profile_id))
    people.push({ id: assignment.profile_id, full_name: `${assignment.person} (inactiva)`, role: '' })
  // Volanteras activas de la sucursal; las que ya iban y se dieron de baja siguen en la lista (FR-009).
  const withFlyers = usesFlyers(cat, v.channel_id)
  const flyerOptions = (staff.data ?? []).filter((p) => p.role === 'field_volunteer').map((p) => ({ id: p.id, name: p.full_name }))
  for (const f of assignment?.flyers ?? [])
    if (!flyerOptions.some((o) => o.id === f.id)) flyerOptions.push({ id: f.id, name: `${f.name} (inactiva)` })

  /** Propone el horario del subcanal para el turno, salvo que la persona ya escribió las horas. */
  const withTimes = (next: Form, subId: string | number | undefined): Form => {
    if (timesTouched) return next
    const t = suggestedTimes(cat?.subchannels.find((x) => String(x.id) === String(subId ?? '')), next.shift)
    return { ...next, start_time: t?.start ?? '', end_time: t?.end ?? '' }
  }

  /** Cambia un campo y vacía lo que depende de él; propone el horario del subcanal. */
  function change(k: keyof Form, value: string) {
    if (k === 'strategy_id' || k === 'channel_id') {
      setPicked([])
      setAdding(null)
    }
    setV((s) => {
      const next = { ...s, [k]: value }
      if (k === 'strategy_id') Object.assign(next, { channel_id: '', subchannel_id: '' })
      if (k === 'channel_id') next.subchannel_id = ''
      if (k === 'subchannel_id') return withTimes(next, value)
      if (k === 'shift') return withTimes(next, editing ? next.subchannel_id : picked[0])
      return next
    })
  }

  /** Marca o desmarca un subcanal; el primero marcado propone el horario (US2, escenario 3). */
  function toggle(id: number, on: boolean) {
    const next = on ? (picked.includes(id) ? picked : [...picked, id]) : picked.filter((x) => x !== id)
    setPicked(next)
    if (next[0] !== picked[0]) setV((s) => withTimes(s, next[0]))
  }

  const setGoal = (id: number, k: keyof Goals, value: string) =>
    setGoals((g) => ({ ...g, [id]: { ...{ goal: '', share_goal: '' }, ...g[id], [k]: value } }))

  async function confirmAdd() {
    if (adding === null || !v.channel_id) return
    const name = adding.trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 80) return fail('El nombre tiene que tener entre 2 y 80 caracteres.', 'new-subchannel')
    setAddBusy(true)
    setErr(undefined)
    try {
      const r = await addSubchannel({ branch, channel: Number(v.channel_id), name })
      // Espera el catálogo nuevo para que el subcanal aparezca ya marcado con sus metas.
      await qc.invalidateQueries({ queryKey: ['org', 'catalog'] })
      toggle(r.id, true)
      setAdding(null)
      toast(r.existed ? 'Ya existía un subcanal con ese nombre: se marcó ese.' : `✓ Subcanal «${name}» agregado`, r.existed ? 'info' : 'success')
    } catch (e) {
      fail((e as Error).message)
    } finally {
      setAddBusy(false)
    }
  }

  const clash = v.profile_id
    ? overlaps(
        { id: assignment?.id ?? '', profile_id: v.profile_id, work_date: day, start_time: v.start_time || null, end_time: v.end_time || null },
        sameDay,
      )
    : []
  // ¿Alguna de las que se cruzan es igual a lo que se está cargando? (FR-009). Con varios subcanales, basta uno.
  const placing = (subchannel_id: number | null) => ({
    shift: v.shift,
    start_time: v.start_time || null,
    end_time: v.end_time || null,
    channel_id: Number(v.channel_id),
    subchannel_id,
  })
  const candidates = editing || picked.length === 0 ? [placing(editing && v.subchannel_id ? Number(v.subchannel_id) : null)] : picked.map(placing)
  const duplicate = clash.some((c) => candidates.some((x) => sameSlot(c, x)))

  /**
   * Metas según la marca: la que no aplica va vacía. La de captación es obligatoria si aplica; la de compartidas es
   * opcional (spec 007, FR-011). `field` es el sufijo del campo (`-<subcanal>` en una carga múltiple).
   */
  function readGoals(flags: GoalFlags, g: Goals, of = '', field = ''): { goal: number | null; share_goal: number | null } | FormError {
    const goal = flags.goal ? parseGoal(g.goal, `meta de captación${of}`) : null
    if (typeof goal === 'string') return { message: goal, field: `goal${field}` }
    const share = flags.share ? parseGoal(g.share_goal, `meta de compartidas${of}`, true) : null
    if (typeof share === 'string') return { message: share, field: `share_goal${field}` }
    return { goal, share_goal: share }
  }

  async function submit() {
    if (saving.current) return
    if (!v.profile_id) return fail('Elige la persona.', 'profile')
    if (!v.strategy_id || !v.channel_id) return fail('Elige la estrategia y el canal.', v.strategy_id ? 'channel' : 'strategy')
    if (v.start_time && v.end_time && v.end_time <= v.start_time)
      return fail('La hora de fin tiene que ser después de la de inicio.', 'times')
    if (v.notes.trim().length > NOTES_MAX) return fail(`Las observaciones admiten hasta ${NOTES_MAX} caracteres.`, 'notes')
    const common = {
      branch_id: branch,
      work_date: day,
      shift: v.shift,
      start_time: v.start_time,
      end_time: v.end_time,
      profile_id: v.profile_id,
      strategy_id: Number(v.strategy_id),
      channel_id: Number(v.channel_id),
      place: show.place ? v.place : '',
      notes: v.notes.trim(),
      flyer_ids: withFlyers ? flyers : [],
    }
    // Valida todas las metas antes de marcar el guardado, para que un error no deje la marca puesta.
    let one: AssignmentInput | undefined
    const items: { subchannel_id: number; goal: number | null; share_goal: number | null }[] = []
    if (editing || picked.length === 0) {
      const g = readGoals(show, v)
      if ('message' in g) return fail(g.message, g.field)
      one = { ...common, id: assignment?.id, subchannel_id: editing && v.subchannel_id ? Number(v.subchannel_id) : null, ...g }
    } else {
      for (const id of picked) {
        const g = readGoals(goalFlags(cat, v.channel_id, id), goals[id] ?? { goal: '', share_goal: '' }, ` de «${subById(id)?.name ?? ''}»`, `-${id}`)
        if ('message' in g) return fail(g.message, g.field)
        items.push({ subchannel_id: id, ...g })
      }
    }
    saving.current = true
    setErr(undefined)
    try {
      if (one) await saveOne.mutateAsync(one)
      else await saveMany.mutateAsync({ ...common, items, goal: null, share_goal: null })
      toast(editing ? '✓ Asignación actualizada' : picked.length > 1 ? `✓ ${picked.length} asignaciones agregadas` : '✓ Asignación agregada', 'success')
      onClose()
    } catch (e) {
      fail((e as Error).message)
    } finally {
      saving.current = false
    }
  }

  const busy = saveOne.isPending || saveMany.isPending
  const notesOver = v.notes.trim().length > NOTES_MAX
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={editing ? 'Editar asignación' : 'Nueva asignación'}>
      <div ref={bodyRef} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2" data-field="profile">
          <Field label="Turno" required>
            {(id) => (
              <Select
                id={id}
                value={v.shift}
                onChange={(x) => x && change('shift', x)}
                options={(['morning', 'afternoon'] as Shift[]).map((s) => ({ value: s, label: SHIFT_LABEL[s] }))}
              />
            )}
          </Field>
          <Field label="Persona" required>
            {(id) => (
              <Select
                id={id}
                value={v.profile_id}
                onChange={(x) => change('profile_id', x)}
                placeholder={staff.isLoading ? 'Cargando…' : 'Elegir…'}
                options={people.map((p) => ({ value: p.id, label: p.full_name }))}
              />
            )}
          </Field>
        </div>
        <div data-field="strategy">
          <Field label="Estrategia" required>
            {(id) => (
              <Select
                id={id}
                value={v.strategy_id}
                onChange={(x) => change('strategy_id', x)}
                options={strategies.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            )}
          </Field>
        </div>
        <div data-field="channel">
          <Field label="Canal" required>
            {(id) => (
              <Select
                id={id}
                value={v.channel_id}
                onChange={(x) => change('channel_id', x)}
                placeholder={v.strategy_id ? 'Elegir…' : 'Primero la estrategia'}
                options={channels.map((c) => ({ value: String(c.id), label: c.name }))}
              />
            )}
          </Field>
        </div>
        {editing ? (
          <Field label="Subcanal" optional>
            {(id) => (
              <Select
                id={id}
                value={v.subchannel_id}
                onChange={(x) => change('subchannel_id', x)}
                placeholder={v.channel_id ? 'Elegir…' : 'Primero el canal'}
                options={subchannels.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            )}
          </Field>
        ) : (
          v.channel_id && (
            <fieldset className="flex flex-col gap-2" aria-label="Subcanales">
              <legend className="mb-1.5 text-sm font-semibold text-ink/80">
                Subcanales <span className="font-normal text-ink/40">(uno o varios, opcional)</span>
              </legend>
              {subchannels.map((s) => (
                <SubchannelOption
                  key={s.id}
                  sub={s}
                  on={picked.includes(s.id)}
                  goals={goals[s.id] ?? { goal: '', share_goal: '' }}
                  fieldSuffix={`-${s.id}`}
                  onToggle={(on) => toggle(s.id, on)}
                  onGoal={(k, x) => setGoal(s.id, k, x)}
                />
              ))}
              {adding === null ? (
                <button type="button" onClick={() => setAdding('')} className="min-h-10 self-start rounded-full px-3 text-sm font-semibold text-gold-dark ring-1 ring-gold/40">
                  + Agregar otro…
                </button>
              ) : (
                <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-sand/50 p-2">
                  <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold text-ink/70">
                    Nombre del subcanal nuevo
                    <input
                      autoFocus
                      data-field="new-subchannel"
                      value={adding}
                      maxLength={80}
                      placeholder="Ej.: Kardex de ventas"
                      onChange={(e) => setAdding(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void confirmAdd()}
                      className="min-h-11 rounded-xl border border-ink/15 bg-white px-3 text-base font-normal"
                    />
                  </label>
                  <Button className="min-h-11 text-sm" disabled={addBusy} onClick={() => void confirmAdd()}>
                    {addBusy ? 'Agregando…' : 'Agregar'}
                  </Button>
                  <Button variant="ghost" className="min-h-11 text-sm" onClick={() => setAdding(null)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </fieldset>
          )
        )}
        <div className="grid grid-cols-2 gap-2" data-field="times">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
            Hora inicio
            <input
              type="time"
              value={v.start_time}
              onChange={(e) => {
                setTimesTouched(true)
                setV((s) => ({ ...s, start_time: e.target.value }))
              }}
              className={timeCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
            Hora fin
            <input
              type="time"
              value={v.end_time}
              onChange={(e) => {
                setTimesTouched(true)
                setV((s) => ({ ...s, end_time: e.target.value }))
              }}
              className={timeCls}
            />
          </label>
        </div>
        {!editing && picked.length > 1 && <p className="-mt-2 text-sm text-ink/55">El horario es el mismo para todos los subcanales marcados.</p>}
        {clash.length > 0 && (
          <p role="status" data-testid="clash-warning" className="-mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900 ring-1 ring-amber-200">
            {duplicate ? 'Ya existe una asignación igual para esta persona' : 'Esta persona ya tiene otra asignación que se cruza'}:{' '}
            <strong>{clash.map(clashLabel).join(', ')}</strong>. Se puede guardar igual.
          </p>
        )}
        {show.place && (
          <Field label="Ubicación / lugar" optional>
            {(id) => (
              <TextInput id={id} value={v.place} maxLength={200} placeholder="Ej.: Barrio Litoral" onChange={(e) => change('place', e.target.value)} />
            )}
          </Field>
        )}
        {/* Con subcanales marcados, las metas van dentro de cada uno; si no, las del canal (o del subcanal al editar). */}
        {(editing || picked.length === 0) && (
          <GoalFields flags={show} goals={v} fieldSuffix="" onGoal={(k, x) => change(k, x)} noGoalText={editing && v.subchannel_id ? 'Este subcanal no lleva meta.' : 'Este canal no lleva meta.'} />
        )}
        {withFlyers && (
          <fieldset className="flex flex-col gap-1" aria-label="Volanteras que van">
            <legend className="mb-1.5 text-sm font-semibold text-ink/80">
              Volanteras que van <span className="font-normal text-ink/40">(opcional)</span>
            </legend>
            {flyerOptions.length === 0 ? (
              <p className="text-sm text-ink/55">{staff.isLoading ? 'Cargando…' : 'No hay volanteras activas en esta sucursal.'}</p>
            ) : (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {flyerOptions.map((f) => (
                  <label key={f.id} className="flex min-h-9 items-center gap-2 text-base">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-ink"
                      checked={flyers.includes(f.id)}
                      onChange={(e) => setFlyers((x) => (e.target.checked ? [...x, f.id] : x.filter((id) => id !== f.id)))}
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80" data-field="notes">
          <span>
            Observaciones <span className="font-normal text-ink/40">(opcional)</span>
          </span>
          <textarea
            value={v.notes}
            rows={2}
            onChange={(e) => change('notes', e.target.value)}
            placeholder="Ej.: Llevar banner y volantes"
            aria-invalid={notesOver || undefined}
            className={`rounded-2xl border bg-white px-4 py-3 text-base font-normal outline-none focus:border-gold focus:ring-4 focus:ring-gold/20 ${notesOver ? 'border-rb-red' : 'border-ink/15'}`}
          />
          <span className={`text-right text-xs font-normal tabular-nums ${notesOver ? 'text-rb-red' : 'text-ink/40'}`}>
            {v.notes.trim().length}/{NOTES_MAX}
          </span>
        </label>
        {!editing && picked.length > 1 && v.notes.trim() && (
          <p className="-mt-3 text-sm text-ink/55">La observación va en todas las asignaciones de esta carga.</p>
        )}
        {/* Pie fijo: el error queda siempre a la vista junto a los botones (spec 007, FR-006). */}
        <div className="sticky bottom-0 flex flex-col gap-2 bg-cream pt-1">
          {err && (
            <p role="alert" data-testid="form-error" className="rounded-xl bg-rb-red/10 px-3 py-2 text-sm font-medium text-rb-red">
              {err.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

/** Campos de meta según la marca efectiva: captación obligatoria; compartidas opcional (spec 007, FR-011). */
function GoalFields({
  flags,
  goals,
  fieldSuffix,
  onGoal,
  noGoalText,
}: {
  flags: GoalFlags
  goals: Goals
  /** Sufijo del `data-field` para llevar la vista al campo con error (`-<subcanal>` en una carga múltiple). */
  fieldSuffix: string
  onGoal: (k: keyof Goals, v: string) => void
  noGoalText: string
}) {
  if (!flags.goal && !flags.share)
    return (
      <p className="text-sm text-ink/55" data-testid="no-goal-note">
        {noGoalText}
      </p>
    )
  const input = (k: keyof Goals, label: string, placeholder: string, required: boolean) => (
    <Field label={label} required={required} optional={!required}>
      {(id) => (
        <TextInput
          id={id}
          data-field={`${k}${fieldSuffix}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={goals[k]}
          placeholder={placeholder}
          onChange={(e) => onGoal(k, e.target.value)}
        />
      )}
    </Field>
  )
  return (
    <div className="grid grid-cols-2 gap-2">
      {flags.goal && input('goal', 'Meta de captación (contactos)', 'Ej.: 30', true)}
      {flags.share && input('share_goal', 'Meta de compartidas', 'Ej.: 15', false)}
    </div>
  )
}

/** Casilla de un subcanal; marcado, muestra sus metas (US2). */
function SubchannelOption({
  sub,
  on,
  goals,
  fieldSuffix,
  onToggle,
  onGoal,
}: {
  sub: Subchannel
  on: boolean
  goals: Goals
  fieldSuffix: string
  onToggle: (on: boolean) => void
  onGoal: (k: keyof Goals, v: string) => void
}) {
  return (
    <div className={`rounded-2xl p-2 ring-1 ${on ? 'bg-white ring-gold/50' : 'ring-ink/10'}`}>
      <label className="flex min-h-9 items-center gap-2 text-base">
        <input type="checkbox" className="h-5 w-5 accent-ink" checked={on} onChange={(e) => onToggle(e.target.checked)} />
        <span className="flex-1">{sub.name}</span>
      </label>
      {on && (
        <div role="group" aria-label={`Metas de ${sub.name}`} className="mt-2">
          <GoalFields flags={{ goal: sub.uses_goal, share: sub.uses_share_goal }} goals={goals} fieldSuffix={fieldSuffix} onGoal={onGoal} noGoalText="Este subcanal no lleva meta." />
        </div>
      )}
    </div>
  )
}
