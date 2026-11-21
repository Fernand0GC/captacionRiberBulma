import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MdCall, MdChat } from 'react-icons/md'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import { saveReferrerAsks } from './api'
import {
  agoLabel,
  ASK_GROUPS,
  ASK_METHOD_LABEL,
  ASK_METHODS,
  ASK_RESULT_LABEL,
  dayOf,
  daysAgo,
  proposeNext,
  shortDate,
  type AskMethod,
  type AskResult,
  type FollowupReferrer,
} from './asks'
import { KIND_LABEL } from './logic'
import { addDays } from './search'

// Ventana «Pedir referidos» (spec 017, FR-008), con el diseño de «Registrar contacto» de clientes (ResultDialog):
// cómo le pediste, qué respondió, cuándo volver a pedir y observación. Con varios referidores guarda uno por cada uno.

const digits8 = (phone: string) => phone.replace(/\D/g, '').slice(-8)

export function AskDialog({
  candidates,
  initial,
  multi = false,
  today,
  onClose,
}: {
  /** Referidores que se pueden elegir (en «varios») o el único (en uno). */
  candidates: FollowupReferrer[]
  initial: number[]
  multi?: boolean
  today: string
  onClose: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [picked, setPicked] = useState<Set<number>>(() => new Set(initial))
  const [method, setMethod] = useState<AskMethod>(multi ? 'message' : 'whatsapp_call')
  const [result, setResult] = useState<AskResult | null>(multi ? 'waiting' : null)
  const [next, setNext] = useState<string | null>(() => proposeNext(multi ? 'waiting' : 'promised', today))
  const [note, setNote] = useState('')
  const one = !multi ? candidates.find((r) => r.id === initial[0]) : undefined
  const ids = multi ? [...picked] : initial

  const save = useMutation({
    mutationFn: saveReferrerAsks,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['referrals'] })
    },
  })

  const pickResult = (r: AskResult) => {
    setResult(r)
    setNext(proposeNext(r, today))
  }

  const onSave = async () => {
    if (!result || ids.length === 0) return
    try {
      const n = await save.mutateAsync({ referrer_ids: ids, method, result, note: note.trim() || undefined, next_on: result === 'quit' ? null : next })
      const who = multi ? `${n} pedidos guardados` : `Pedido a ${one?.name ?? ''} guardado`
      toast(
        result === 'passed'
          ? `✓ ${who}. Si ya tienes los contactos, cárgalos en «Cargar».`
          : `✓ ${who} · ${ASK_RESULT_LABEL[result]}${result !== 'quit' && next ? ` · volver a pedir el ${shortDate(next)}` : ''}`,
        'success',
      )
      onClose()
    } catch {
      /* el error se muestra abajo */
    }
  }

  const title = multi ? 'Pedir referidos a varios' : `Pedir referidos a ${one?.name ?? ''}`
  const last = one?.last_ask
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} description="Anota cada vez que le pides contactos, aunque no conteste.">
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        {multi ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-ink/80">¿A quiénes? *</p>
            <div className="flex max-h-56 flex-col overflow-y-auto rounded-2xl bg-white ring-1 ring-ink/10" role="group" aria-label="Referidores">
              {candidates.map((r) => (
                <label key={r.id} className="flex min-h-12 items-center gap-3 border-b border-ink/5 px-4 last:border-b-0">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-gold-dark"
                    checked={picked.has(r.id)}
                    onChange={(e) =>
                      setPicked((s) => {
                        const n = new Set(s)
                        if (e.target.checked) n.add(r.id)
                        else n.delete(r.id)
                        return n
                      })
                    }
                  />
                  <span className="flex-1 truncate font-medium">{r.name}</span>
                  <span className="text-xs text-ink/45">{KIND_LABEL[r.kind]}</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-ink/50">Para cuando mandas el mismo mensaje a varios: queda un pedido para cada uno.</p>
          </div>
        ) : (
          one && (
            <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-ink/10" data-testid="ask-referrer">
              <p className="text-sm text-ink/60">
                {KIND_LABEL[one.kind]} ·{' '}
                {last
                  ? `último pedido ${agoLabel(daysAgo(dayOf(last.at), today))}: ${ASK_METHOD_LABEL[last.method].toLowerCase()}, ${ASK_RESULT_LABEL[last.result].toLowerCase()}`
                  : 'nunca se le pidió referidos'}
              </p>
              {one.phone ? (
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://wa.me/591${digits8(one.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMethod('whatsapp_call')}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-ink/15 bg-white px-3 text-sm font-semibold active:bg-sand"
                  >
                    <MdCall aria-hidden className="h-5 w-5 text-ink/70" /> Llamar por WhatsApp
                  </a>
                  <a
                    href={`https://wa.me/591${digits8(one.phone)}?text=${encodeURIComponent(`Hola ${one.name.split(' ')[0]}, ¿tienes algún contacto que quiera conocer nuestros productos? `)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMethod('message')}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-ink/15 bg-white px-3 text-sm font-semibold active:bg-sand"
                  >
                    <MdChat aria-hidden className="h-5 w-5 text-ink/70" /> Enviar mensaje
                  </a>
                </div>
              ) : (
                <p className="text-sm text-ink/50">Sin celular: agrégalo en «Referidores y metas» para escribirle desde aquí.</p>
              )}
            </div>
          )
        )}

        <div role="radiogroup" aria-label="¿Cómo le pediste?" className="grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1">
          {ASK_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={`min-h-10 rounded-xl px-1 text-sm font-semibold leading-tight ${method === m ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
            >
              {ASK_METHOD_LABEL[m]}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="¿Qué respondió?" className="flex flex-col gap-3">
          {ASK_GROUPS.map((g) => (
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
                      onClick={() => pickResult(r)}
                      className={`min-h-12 rounded-2xl border px-2 text-sm font-semibold leading-tight transition ${
                        active
                          ? g.tone === 'bad'
                            ? 'border-rb-red bg-rb-red text-white'
                            : 'border-ink bg-ink text-gold-light'
                          : 'border-ink/15 bg-white text-ink active:bg-sand'
                      }`}
                    >
                      {ASK_RESULT_LABEL[r]}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {result === 'quit' ? (
          <p className="rounded-2xl bg-rb-red/5 p-3 text-sm font-semibold text-rb-red">
            Deja de aparecer en «Para hoy». Sigue activo por si vuelve a pasar contactos.
          </p>
        ) : (
          result && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80">
              ¿Cuándo volver a pedir? <span className="font-normal text-ink/45">(propuesto según la respuesta; puedes cambiarlo)</span>
              <input
                type="date"
                value={next ?? ''}
                min={today}
                max={addDays(today, 90)}
                onChange={(e) => setNext(e.target.value || null)}
                className="min-h-12 rounded-xl border border-ink/15 bg-white px-3 text-base font-normal"
              />
            </label>
          )
        )}
        {result === 'passed' && !multi && (
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            Si ya tienes los contactos, cárgalos en «Cargar»: ahí queda anotado solo.
          </p>
        )}

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80">
          Observación <span className="font-normal text-ink/40">(opcional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ej.: tiene una feria el sábado"
            className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-base font-normal"
          />
        </label>

        {save.isError && <p className="text-sm font-medium text-rb-red">{(save.error as Error).message}</p>}

        <div className="sticky bottom-0 flex gap-2 bg-cream pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={!result || ids.length === 0 || save.isPending} onClick={() => void onSave()}>
            {save.isPending ? 'Guardando…' : multi ? `Guardar ${ids.length} pedido${ids.length === 1 ? '' : 's'}` : 'Guardar pedido'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
