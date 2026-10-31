import { useState } from 'react'
import { ProductPicker } from '@/features/capture/ProductPicker'
import { useCatalogs } from '@/features/capture/useCatalogs'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import { fmtDate, fmtTime } from '@/features/prospects/format'
import { suggestedMethod } from './lastAction'
import { METHOD_LABEL, RESULT_LABEL, useAddFollowup, type ContactMethod, type ContactResult, type FollowupRow } from './api'

// Resultados agrupados según el embudo del negocio (FR-037…FR-039).
const GROUPS: { title: string; tone: 'neutral' | 'good' | 'bad'; results: ContactResult[] }[] = [
  { title: 'Sin contacto', tone: 'neutral', results: ['no_answer'] },
  { title: 'Seguimiento', tone: 'good', results: ['looking_product', 'visit_store', 'call_later'] },
  { title: 'Cliente potencial y venta', tone: 'good', results: ['very_interested', 'sold'] },
  { title: 'Sin interés', tone: 'bad', results: ['not_interested', 'wrong_number'] },
]
// Sin llamada telefónica: no se usa (2026-10-29). 'call' queda solo para mostrar contactos viejos.
const METHODS: ContactMethod[] = ['whatsapp_call', 'message', 'store']
const STAGE_AFTER: Partial<Record<ContactResult, string>> = {
  looking_product: 'Seguimiento',
  visit_store: 'Seguimiento',
  call_later: 'Seguimiento',
  very_interested: 'Cliente potencial',
  sold: 'Venta',
  not_interested: 'Sin interés',
  wrong_number: 'Sin interés',
}

function localInput(daysAhead: number, hour: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${date}T${pad(hour)}:00`
}

/** `visitAnswer`: respuesta a "¿vino a la tienda?" de una visita vencida (vino = contacto en tienda; no vino = reprogramar). */
export function ResultDialog({ row, visitAnswer, onClose }: { row: FollowupRow; visitAnswer?: 'came' | 'missed'; onClose: () => void }) {
  const [method, setMethod] = useState<ContactMethod>(() => (visitAnswer === 'came' ? 'store' : suggestedMethod(row.id)))
  const [result, setResult] = useState<ContactResult | null>(null)
  const [visit, setVisit] = useState(() => localInput(1, 10))
  const [callback, setCallback] = useState(() => localInput(1, 9))
  const [productId, setProductId] = useState<number | null>(row.product_id)
  const visitWhen = row.visit_at ? `${fmtDate(row.visit_at).slice(0, 5)} ${fmtTime(row.visit_at)}` : ''
  const [note, setNote] = useState(() => (visitAnswer === 'missed' ? `No vino a la visita del ${visitWhen}` : visitAnswer === 'came' ? 'Vino a la tienda' : ''))
  const { catalogs } = useCatalogs()
  const add = useAddFollowup()
  const toast = useToast()
  const attemptsLeft = 3 - row.contact_attempts

  const missing =
    !result ||
    (result === 'visit_store' && !visit) ||
    (result === 'call_later' && !callback) ||
    (result === 'sold' && productId === null)

  async function save() {
    if (!result || missing) return
    try {
      const res = await add.mutateAsync({
        prospect_id: row.id,
        result,
        method,
        note: note.trim() || undefined,
        visit_at: result === 'visit_store' ? new Date(visit).toISOString() : undefined,
        callback_at: result === 'call_later' ? new Date(callback).toISOString() : undefined,
        product_id: result === 'sold' && productId !== null ? productId : undefined,
      })
      toast(
        result === 'no_answer'
          ? res.stage === 'lost'
            ? 'Tercer intento sin respuesta: queda como Sin interés.'
            : `No contestó (${res.contact_attempts}/3). Vuelve mañana.`
          : `✓ ${RESULT_LABEL[result]} → ${STAGE_AFTER[result]}`,
        'success',
      )
      onClose()
    } catch {
      /* el error se muestra abajo */
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={row.full_name} description={row.phone_raw}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <div role="radiogroup" aria-label="¿Cómo fue el contacto?" className="grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={`min-h-10 rounded-xl text-sm font-semibold ${method === m ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
            >
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>

        {visitAnswer && (
          <p className={`rounded-2xl p-3 text-sm font-semibold ${visitAnswer === 'came' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-100 text-amber-900'}`} data-testid="visit-hint">
            {visitAnswer === 'came'
              ? `✓ Vino a la tienda (visita del ${visitWhen}). ¿Cómo terminó?`
              : `No vino a la visita del ${visitWhen}. Escríbele por WhatsApp para reprogramar y registra qué dijo.`}
          </p>
        )}

        <div role="radiogroup" aria-label="Resultado" className="flex flex-col gap-3">
          {GROUPS.filter((g) => !(visitAnswer === 'came' && g.title === 'Sin contacto')).map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">{g.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.results.map((r) => {
                  const active = result === r
                  return (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setResult(r)}
                      className={`min-h-12 rounded-2xl border px-2 text-sm font-semibold leading-tight transition ${
                        active
                          ? g.tone === 'bad'
                            ? 'border-rb-red bg-rb-red text-white'
                            : 'border-ink bg-ink text-gold-light'
                          : 'border-ink/15 bg-white text-ink active:bg-sand'
                      }`}
                    >
                      {RESULT_LABEL[r]}
                      {r === 'no_answer' && <span className="block text-xs font-normal opacity-70">quedan {attemptsLeft} de 3</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {result === 'visit_store' && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80">
            ¿Cuándo visitará la tienda? *
            <input type="datetime-local" value={visit} onChange={(e) => setVisit(e.target.value)} className="min-h-12 rounded-xl border border-ink/15 bg-white px-3 text-base font-normal" />
          </label>
        )}
        {result === 'call_later' && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80">
            ¿Cuándo volver a contactar? (día y hora) * <span className="font-normal text-ink/45">(ej.: viajó y vuelve en unos días)</span>
            <input type="datetime-local" value={callback} onChange={(e) => setCallback(e.target.value)} className="min-h-12 rounded-xl border border-ink/15 bg-white px-3 text-base font-normal" />
          </label>
        )}
        {result === 'sold' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink/80">¿Qué compró? *</span>
            {catalogs ? <ProductPicker catalogs={catalogs} value={productId} onChange={setProductId} /> : <p className="text-sm text-ink/50">Cargando productos…</p>}
          </div>
        )}

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80">
          Observación <span className="font-normal text-ink/40">(opcional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-base font-normal" />
        </label>

        {add.isError && <p className="text-sm font-medium text-rb-red">{(add.error as Error).message}</p>}

        <div className="sticky bottom-0 flex gap-2 bg-cream pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={missing || add.isPending} onClick={() => void save()}>
            {add.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
