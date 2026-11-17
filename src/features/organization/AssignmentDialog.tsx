import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Field, TextInput } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { useToast } from '@/ui/Toast'
import {
  saveAssignment,
  SHIFT_LABEL,
  useOrgCatalog,
  useOrgMutation,
  useOrgStaff,
  type Assignment,
  type AssignmentInput,
  type Shift,
} from './api'
import { overlaps, suggestedTimes } from './logic'

type Form = {
  shift: Shift
  profile_id: string
  strategy_id: string
  channel_id: string
  subchannel_id: string
  start_time: string
  end_time: string
  place: string
  goal: string
}

const timeCls =
  'min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-3 text-lg outline-none focus:border-gold focus:ring-4 focus:ring-gold/20'

/** Crear o editar una asignación: persona, turno y canal del catálogo de tres niveles (spec 003, US1). */
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
  const save = useOrgMutation(saveAssignment)
  const [v, setV] = useState<Form>({
    shift: assignment?.shift ?? shift,
    profile_id: assignment?.profile_id ?? '',
    strategy_id: assignment ? String(assignment.strategy_id) : '',
    channel_id: assignment ? String(assignment.channel_id) : '',
    subchannel_id: assignment?.subchannel_id ? String(assignment.subchannel_id) : '',
    start_time: assignment?.start_time ?? '',
    end_time: assignment?.end_time ?? '',
    place: assignment?.place ?? '',
    goal: assignment?.goal !== null && assignment?.goal !== undefined ? String(assignment.goal) : '',
  })
  // Si la persona escribe las horas a mano, el horario sugerido ya no las pisa.
  const [timesTouched, setTimesTouched] = useState(!!assignment?.start_time)
  const [err, setErr] = useState<string>()

  const cat = catalog.data
  const isActiveOrCurrent = (active: boolean, id: number, current: string) => active || String(id) === current
  const strategies = (cat?.strategies ?? []).filter((s) => isActiveOrCurrent(s.active, s.id, v.strategy_id))
  const channels = (cat?.channels ?? []).filter(
    (c) => String(c.strategy_id) === v.strategy_id && isActiveOrCurrent(c.active, c.id, v.channel_id),
  )
  const subchannels = (cat?.subchannels ?? []).filter(
    (s) => String(s.channel_id) === v.channel_id && isActiveOrCurrent(s.active, s.id, v.subchannel_id),
  )
  // La persona asignada sigue en la lista aunque ya no esté activa.
  const people = [...(staff.data ?? [])]
  if (assignment && !people.some((p) => p.id === assignment.profile_id))
    people.push({ id: assignment.profile_id, full_name: `${assignment.person} (inactiva)`, role: '' })

  /** Cambia un campo y vacía lo que depende de él; propone el horario del subcanal. */
  function change(k: keyof Form, value: string) {
    setV((s) => {
      const next = { ...s, [k]: value }
      if (k === 'strategy_id') Object.assign(next, { channel_id: '', subchannel_id: '' })
      if (k === 'channel_id') next.subchannel_id = ''
      if ((k === 'subchannel_id' || k === 'shift') && !timesTouched) {
        const sub = cat?.subchannels.find((x) => String(x.id) === next.subchannel_id)
        const t = suggestedTimes(sub, next.shift)
        next.start_time = t?.start ?? ''
        next.end_time = t?.end ?? ''
      }
      return next
    })
  }

  const clash = v.profile_id
    ? overlaps(
        { id: assignment?.id ?? '', profile_id: v.profile_id, work_date: day, start_time: v.start_time || null, end_time: v.end_time || null },
        sameDay,
      )
    : []

  async function submit() {
    if (!v.profile_id) return setErr('Elige la persona.')
    if (!v.strategy_id || !v.channel_id) return setErr('Elige la estrategia y el canal.')
    if (v.start_time && v.end_time && v.end_time <= v.start_time)
      return setErr('La hora de fin tiene que ser después de la de inicio.')
    const goal = v.goal === '' ? null : Number(v.goal)
    if (goal !== null && !(Number.isInteger(goal) && goal >= 0 && goal <= 9999))
      return setErr('La meta tiene que ser un número entero entre 0 y 9999.')
    const input: AssignmentInput = {
      id: assignment?.id,
      branch_id: branch,
      work_date: day,
      shift: v.shift,
      start_time: v.start_time,
      end_time: v.end_time,
      profile_id: v.profile_id,
      strategy_id: Number(v.strategy_id),
      channel_id: Number(v.channel_id),
      subchannel_id: v.subchannel_id ? Number(v.subchannel_id) : null,
      place: v.place,
      goal,
    }
    try {
      await save.mutateAsync(input)
      toast(assignment ? '✓ Asignación actualizada' : '✓ Asignación agregada', 'success')
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={assignment ? 'Editar asignación' : 'Nueva asignación'}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
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
        <div className="grid grid-cols-2 gap-2">
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
        {clash.length > 0 && (
          <p role="status" className="-mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900 ring-1 ring-amber-200">
            Esta persona ya tiene otra asignación que se cruza ({clash.map((c) => `${c.start_time}–${c.end_time}`).join(', ')}). Se puede guardar igual.
          </p>
        )}
        <Field label="Ubicación / lugar" optional>
          {(id) => (
            <TextInput id={id} value={v.place} maxLength={200} placeholder="Ej.: Barrio Litoral" onChange={(e) => change('place', e.target.value)} />
          )}
        </Field>
        <Field label="Meta" optional>
          {(id) => (
            <TextInput id={id} type="number" inputMode="numeric" min={0} max={9999} value={v.goal} placeholder="Ej.: 30" onChange={(e) => change('goal', e.target.value)} />
          )}
        </Field>
        {err && <p className="text-sm font-medium text-rb-red">{err}</p>}
        <div className="sticky bottom-0 flex gap-2 bg-cream pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={save.isPending} onClick={() => void submit()}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
