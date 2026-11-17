import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Field, TextInput } from '@/ui/Field'
import { useToast } from '@/ui/Toast'
import { setAssignmentResult, useOrgMutation, type Assignment } from './api'

const NOTES_MAX = 300

/** Resultado y observaciones de una asignación (spec 003, US2). Vacío = vuelve a «sin resultado». */
export function ResultDialog({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const toast = useToast()
  const save = useOrgMutation(setAssignmentResult)
  const [result, setResult] = useState(assignment.result === null ? '' : String(assignment.result))
  const [notes, setNotes] = useState(assignment.notes ?? '')
  const [err, setErr] = useState<string>()

  async function submit() {
    const n = result === '' ? null : Number(result)
    if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= 9999))
      return setErr('El resultado tiene que ser un número entero entre 0 y 9999.')
    // Se avisa y no se recorta: lo escrito queda en el campo para que la persona lo acorte.
    if (notes.trim().length > NOTES_MAX) return setErr(`Las observaciones admiten hasta ${NOTES_MAX} caracteres.`)
    try {
      await save.mutateAsync({ id: assignment.id, result: n, notes })
      toast('✓ Resultado guardado', 'success')
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const over = notes.trim().length > NOTES_MAX
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Resultado"
      description={`${assignment.person} · ${assignment.channel}${assignment.subchannel ? ` · ${assignment.subchannel}` : ''}`}
    >
      <div className="flex flex-col gap-4">
        <Field label="Resultado" hint={assignment.goal !== null ? `Meta: ${assignment.goal}` : 'Sin meta'}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              value={result}
              placeholder="Vacío = sin resultado"
              onChange={(e) => setResult(e.target.value)}
            />
          )}
        </Field>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80">
          <span>
            Observaciones <span className="font-normal text-ink/40">(opcional)</span>
          </span>
          <textarea
            value={notes}
            rows={3}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej.: 5 ventas concretadas"
            aria-invalid={over || undefined}
            className={`rounded-2xl border bg-white px-4 py-3 text-base font-normal outline-none focus:border-gold focus:ring-4 focus:ring-gold/20 ${over ? 'border-rb-red' : 'border-ink/15'}`}
          />
          <span className={`text-right text-xs font-normal tabular-nums ${over ? 'text-rb-red' : 'text-ink/40'}`}>
            {notes.trim().length}/{NOTES_MAX}
          </span>
        </label>
        {err && <p className="text-sm font-medium text-rb-red">{err}</p>}
        <div className="flex gap-2">
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
