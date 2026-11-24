import { useToast } from '@/ui/Toast'
import { priorityMessage } from './agenda'
import { useSetContactPriority } from './api'

// Spec 026: «Poner para hoy» y «Quitar prioridad». Los comparten el modal «Clientes asignados» y la Agenda de «Del día».

type Agent = { id: string; name: string }

/** Marca o quita la prioridad de hoy y avisa (P3: los que ya no eran de la persona se saltan y se dice cuántos). */
function usePriority(agent: Agent) {
  const toast = useToast()
  const m = useSetContactPriority()
  const run = async (ids: string[], on: boolean): Promise<boolean> => {
    try {
      const res = await m.mutateAsync({ agentId: agent.id, ids, on })
      toast(priorityMessage(res, agent.name, on), on && res.changed === 0 ? 'error' : 'success')
      return true
    } catch (e) {
      // E1: el error se ve y la selección se mantiene (no se cierra el modo Seleccionar).
      toast((e as Error).message, 'error')
      return false
    }
  }
  return { run, busy: m.isPending }
}

/** Botón de la barra de selección: marca los elegidos como prioridad de hoy de `agent`. */
export function PriorityButton({ agent, ids, onDone }: { agent: Agent; ids: string[]; onDone: () => void }) {
  const p = usePriority(agent)
  return (
    <button
      type="button"
      disabled={ids.length === 0 || p.busy}
      onClick={async () => {
        if (await p.run(ids, true)) onDone()
      }}
      title="Siguen con la misma persona: pasan a «Le tocaba hoy» solo por hoy"
      className="min-h-11 rounded-xl bg-white/10 px-4 font-semibold text-gold-light ring-1 ring-gold-light/40 disabled:opacity-50"
    >
      {p.busy ? 'Marcando…' : 'Poner para hoy'}
    </button>
  )
}

/** Etiqueta «Prioridad hoy» con su «Quitar» (B8). Sin `agent` es solo la etiqueta. */
export function PriorityBadge({ agent, id }: { agent?: Agent; id: string }) {
  return (
    <span
      className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold-dark"
      data-testid="priority-badge"
    >
      ★ Prioridad hoy
      {agent && <RemovePriority agent={agent} id={id} />}
    </span>
  )
}

function RemovePriority({ agent, id }: { agent: Agent; id: string }) {
  const p = usePriority(agent)
  return (
    <button
      type="button"
      disabled={p.busy}
      onClick={() => void p.run([id], false)}
      aria-label="Quitar prioridad de hoy"
      className="underline decoration-dotted hover:text-ink disabled:opacity-50"
    >
      Quitar
    </button>
  )
}
