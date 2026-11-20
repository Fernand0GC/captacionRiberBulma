import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { digits, NUMERIC_INPUT } from '@/lib/numeric'
import { Field, TextInput } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { useToast } from '@/ui/Toast'
import { useChannels } from '@/features/prospects/api'
import { useAgendaMutation, useStrategies, type Activity, type Shift } from './api'
import { CHANNEL_GROUP_LABEL } from '@/features/capture/channelGroups'

/** Crear o editar una actividad del plan (misma forma que las planillas de las sucursales). */
export function ActivityDialog({
  branch,
  day,
  shift,
  activity,
  suggestedGoal,
  onClose,
}: {
  branch: number
  day: string
  shift: Shift
  activity?: Activity
  /** Lo que falta repartir de la meta del día (Metas) entre las actividades; se propone en una actividad nueva. */
  suggestedGoal?: number
  onClose: () => void
}) {
  const strategies = useStrategies()
  const channels = useChannels()
  const toast = useToast()
  const save = useAgendaMutation<Record<string, unknown>>('save_activity', (p) => ({ p }))
  const [v, setV] = useState({
    shift: activity?.shift ?? shift,
    start_time: activity?.start_time ?? (shift === 'morning' ? '08:30' : '15:30'),
    end_time: activity?.end_time ?? '',
    strategy_id: activity?.strategy_id ? String(activity.strategy_id) : '',
    description: activity?.description ?? '',
    responsibles: activity?.responsibles ?? '',
    goal: activity?.goal ?? '',
    channel_id: activity?.channel_id ? String(activity.channel_id) : '',
    goal_count: activity?.goal_count ? String(activity.goal_count) : !activity && suggestedGoal ? String(suggestedGoal) : '',
    places: activity?.places ?? '',
  })
  const [err, setErr] = useState<string>()
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }))

  async function submit() {
    if (v.description.trim().length < 2) return setErr('Escribe qué se va a hacer.')
    if (v.end_time && v.end_time <= v.start_time) return setErr('La hora de fin tiene que ser después del inicio.')
    if (v.goal_count && !(Number(v.goal_count) >= 1 && Number(v.goal_count) <= 9999)) return setErr('La meta de captaciones tiene que ser un número mayor a 0.')
    try {
      await save.mutateAsync({ ...v, id: activity?.id, branch_id: branch, activity_date: day })
      toast(activity ? '✓ Actividad actualizada' : '✓ Actividad agregada', 'success')
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const timeCls = 'min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-3 text-lg outline-none focus:border-gold focus:ring-4 focus:ring-gold/20'
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={activity ? 'Editar actividad' : 'Nueva actividad'}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
            Turno
            <select value={v.shift} onChange={(e) => set('shift')(e.target.value)} className={timeCls}>
              <option value="morning">Mañana</option>
              <option value="afternoon">Tarde</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
            Desde
            <input type="time" value={v.start_time} onChange={(e) => set('start_time')(e.target.value)} className={timeCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
            Hasta
            <input type="time" value={v.end_time} onChange={(e) => set('end_time')(e.target.value)} className={timeCls} />
          </label>
        </div>
        <Field label="Estrategia / área">
          {(id) => (
            <Select id={id} value={v.strategy_id} onChange={set('strategy_id')} placeholder="Elegir…" options={(strategies.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))} />
          )}
        </Field>
        <Field label="Actividad" required>
          {(id) => <TextInput id={id} value={v.description} placeholder="Ej.: Negociación a clientes independientes barrio Litoral" onChange={(e) => set('description')(e.target.value)} />}
        </Field>
        <Field label="Personal a cargo">
          {(id) => <TextInput id={id} value={v.responsibles} placeholder="Ej.: Claudia y volantera" onChange={(e) => set('responsibles')(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Canal">
            {(id) => (
              <Select id={id} value={v.channel_id} onChange={set('channel_id')} placeholder="Todos" options={(channels.data ?? []).map((c) => ({ value: String(c.id), label: c.name, group: c.group ? CHANNEL_GROUP_LABEL[c.group] : undefined }))} />
            )}
          </Field>
          <Field label="Meta de captaciones">
            {(id) => (
              <TextInput id={id} {...NUMERIC_INPUT} value={v.goal_count} placeholder="Ej.: 30" onChange={(e) => set('goal_count')(digits(e.target.value))} />
            )}
          </Field>
        </div>
        <p className="-mt-2 text-xs text-ink/50">
          Las captaciones de la sucursal en este horario{v.channel_id ? ' y canal' : ''} se cuentan solas para esta actividad.
        </p>
        <Field label="Otra meta (ventas, visitas…)">
          {(id) => <TextInput id={id} value={v.goal} placeholder="Ej.: 5 ventas · 20 visitas pactadas" onChange={(e) => set('goal')(e.target.value)} />}
        </Field>
        <Field label="Descripción del canal (dónde)">
          {(id) => <TextInput id={id} value={v.places} maxLength={120} placeholder="Ej.: Colegio Don Bosco, barrio Litoral" onChange={(e) => set('places')(e.target.value)} />}
        </Field>
        <p className="-mt-2 text-xs text-ink/50">El personal la recibe sola en Registrar junto con el canal.</p>
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
