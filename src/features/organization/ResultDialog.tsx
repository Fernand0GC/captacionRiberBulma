import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Field, TextInput } from '@/ui/Field'
import { useToast } from '@/ui/Toast'
import { setAssignmentResult, useOrgMutation, type Assignment } from './api'

const NOTES_MAX = 300

const asText = (n: number | null) => (n === null ? '' : String(n))
/** '' = sin resultado; undefined = número inválido. */
const parseResult = (raw: string): number | null | undefined => {
  if (raw === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : undefined
}

/**
 * Resultado y observaciones de una asignación (spec 003, US2). Desde la 004 pide «Captados» y «Compartidas» por
 * separado, según las marcas de la fila o si ya hay meta o resultado cargado. Vacío = vuelve a «sin resultado».
 */
export function ResultDialog({ assignment: a, onClose }: { assignment: Assignment; onClose: () => void }) {
  const toast = useToast()
  const save = useOrgMutation(setAssignmentResult)
  const [result, setResult] = useState(asText(a.result))
  const [shareResult, setShareResult] = useState(asText(a.share_result))
  const [notes, setNotes] = useState(a.notes ?? '')
  const [err, setErr] = useState<string>()
  const showShare = a.uses_share_goal || a.share_goal !== null || a.share_result !== null
  // Sin ninguna meta (p. ej. Tareas administrativas) igual se puede anotar un resultado de captación.
  const showCapture = a.uses_goal || a.goal !== null || a.result !== null || !showShare

  async function submit() {
    const n = showCapture ? parseResult(result) : a.result
    const sn = showShare ? parseResult(shareResult) : a.share_result
    if (n === undefined) return setErr('Los captados tienen que ser un número entero entre 0 y 9999.')
    if (sn === undefined) return setErr('Las compartidas tienen que ser un número entero entre 0 y 9999.')
    // Se avisa y no se recorta: lo escrito queda en el campo para que la persona lo acorte.
    if (notes.trim().length > NOTES_MAX) return setErr(`Las observaciones admiten hasta ${NOTES_MAX} caracteres.`)
    try {
      await save.mutateAsync({ id: a.id, result: n, share_result: sn, notes })
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
      description={`${a.person} · ${a.channel}${a.subchannel ? ` · ${a.subchannel}` : ''}`}
    >
      <div className="flex flex-col gap-4">
        {showCapture && <ResultField label="Captados" goal={a.goal} value={result} onChange={setResult} />}
        {showShare && <ResultField label="Compartidas" goal={a.share_goal} value={shareResult} onChange={setShareResult} />}
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

function ResultField({
  label,
  goal,
  value,
  onChange,
}: {
  label: string
  goal: number | null
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field label={label} hint={goal !== null ? `Meta: ${goal}` : 'Sin meta'}>
      {(id, describedBy) => (
        <TextInput
          id={id}
          aria-describedby={describedBy}
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={value}
          placeholder="Vacío = sin resultado"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}
