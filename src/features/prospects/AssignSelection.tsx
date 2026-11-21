import { useEffect, useState, type ReactNode } from 'react'
import { ROLE_LABEL } from '@/features/auth/types'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import { useAssign, useAssignees } from './api'

// Seleccionar y asignar responsable (FR-035, reparto FR-039b). Lo comparten Captaciones y Seguimientos (spec 015)
// para que las reglas (reparto, confirmar al reasignar, «las N del filtro») sean siempre las mismas.

export type Owner = { id: string | null; name: string | null }
export type Selection = Map<string, Owner>
/** Lo mínimo que necesita una fila para poder asignarse. */
export type Assignable = { id: string; assigned_to: string | null; assigned_to_name: string | null }

const ownerOf = (r: Assignable): Owner => ({ id: r.assigned_to, name: r.assigned_to_name })

/** "5 sin responsable · 8 de Ana · 3 de Luis" (los 3 con más; el resto como "otros"). */
export function ownersSummary(sel: ReadonlyMap<string, Owner>): string {
  const by = new Map<string, number>()
  for (const o of sel.values()) {
    const k = o.id === null ? '' : (o.name ?? '¿?')
    by.set(k, (by.get(k) ?? 0) + 1)
  }
  const parts = [...by.entries()].sort((a, b) => b[1] - a[1])
  const text = parts.slice(0, 3).map(([k, n]) => (k === '' ? `${n} sin responsable` : `${n} de ${k}`))
  const rest = parts.slice(3).reduce((t, [, n]) => t + n, 0)
  return [...text, ...(rest ? [`${rest} de otros`] : [])].join(' · ')
}

/** Cómo se nombran las filas: «captaciones» (femenino) o «clientes» (masculino). */
export type Noun = 'captaciones' | 'clientes'

type Options<R extends Assignable> = {
  /** Filtros de la lista: si cambian, la selección se limpia sola. */
  filters: unknown
  rows: R[]
  total: number
  /** Sucursal elegida: sin ella no se asigna (las personas son de cada sucursal). */
  branchId: number | undefined
  /** Trae todas las filas del filtro (para «Seleccionar las N del filtro»). */
  fetchAll: () => Promise<R[]>
  noun: Noun
}

export function useAssignSelection<R extends Assignable>({ filters, rows, total, branchId, fetchAll, noun }: Options<R>) {
  const f = noun === 'captaciones'
  const g = (fem: string, masc: string) => (f ? fem : masc)
  const toast = useToast()
  const assign = useAssign()
  const assignees = useAssignees(branchId)
  const [assignTo, setAssignTo] = useState('')
  // Modo "Seleccionar": recién ahí salen las casillas y la barra para asignar.
  const [selecting, setSelecting] = useState(false)
  // La selección vale para los filtros en que se hizo (se mantiene al cambiar de página; al cambiar filtros se limpia sola).
  // Guarda el responsable actual de cada una para avisar a quién se le quitan al reasignar.
  const selectionKey = JSON.stringify(filters)
  const [selection, setSelection] = useState<{ key: string; ids: Selection }>({ key: selectionKey, ids: new Map() })
  const selected = selection.key === selectionKey ? selection.ids : (new Map() as Selection)
  const setSelected = (ids: Selection) => setSelection({ key: selectionKey, ids })
  const toggle = (id: string) =>
    setSelection((cur) => {
      const n: Selection = new Map(cur.key === selectionKey ? cur.ids : [])
      const r = rows.find((x) => x.id === id)
      if (n.has(id)) n.delete(id)
      else if (r) n.set(id, ownerOf(r))
      return { key: selectionKey, ids: n }
    })
  const [confirming, setConfirming] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const stop = () => {
    setSelecting(false)
    setSelection({ key: selectionKey, ids: new Map() })
    setAssignTo('')
    setConfirming(false)
  }
  useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelecting(false)
        setSelection((s) => ({ ...s, ids: new Map() }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting])
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggleAll = () => {
    const n: Selection = new Map(selected)
    for (const r of rows) {
      if (allOnPage) n.delete(r.id)
      else n.set(r.id, ownerOf(r))
    }
    setSelected(n)
  }
  // La casilla "todas" de la tabla marca solo la página y en celular no hay: esto trae todas las del filtro.
  async function selectAllMatching() {
    setLoadingAll(true)
    try {
      const all = await fetchAll()
      setSelected(new Map(all.map((r) => [r.id, ownerOf(r)])))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoadingAll(false)
    }
  }
  const allMatching = total > 0 && selected.size >= total
  // Reparto de la tarde (FR-039b): en partes iguales entre las auxiliares de la sucursal.
  const auxiliaries = (assignees.data ?? []).filter((a) => a.role === 'field_assistant')
  // Las que hoy son de otra persona: se le quitan (reasignar). Se confirma antes.
  const taken = [...selected.values()].filter((o) => o.id !== null && o.id !== assignTo)
  const isReassign = assignTo !== '' && taken.length > 0
  const them = g('las', 'los')
  const targetLabel =
    assignTo === 'split'
      ? `repartir${them} entre las ${auxiliaries.length} auxiliares`
      : assignTo === 'none'
        ? `dejar${them} sin responsable`
        : `pasar${them} a ${assignees.data?.find((a) => a.id === assignTo)?.full_name ?? ''}`
  async function doAssign() {
    setConfirming(false)
    try {
      if (assignTo === 'split') {
        const ids = [...selected.keys()]
        const buckets = auxiliaries.map((a, i) => ({ to: a.id, ids: ids.filter((_, j) => j % auxiliaries.length === i) }))
        for (const b of buckets) if (b.ids.length) await assign.mutateAsync({ ids: b.ids, to: b.to })
        toast(`✓ ${ids.length} ${isReassign ? g('reasignadas', 'reasignados') : g('repartidas', 'repartidos')} entre ${auxiliaries.length} auxiliares`, 'success')
        stop()
        return
      }
      const n = await assign.mutateAsync({ ids: [...selected.keys()], to: assignTo === 'none' ? null : assignTo })
      toast(
        assignTo === 'none' ? `✓ ${n} sin responsable` : `✓ ${n} ${isReassign ? g('reasignadas', 'reasignados') : g('asignadas', 'asignados')}`,
        'success',
      )
      stop()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const countLabel =
    selected.size === 0
      ? `Marca ${g('las', 'los')} ${noun}`
      : allMatching
        ? `${g('Las', 'Los')} ${selected.size} del filtro`
        : `${selected.size} ${selected.size === 1 ? g('seleccionada', 'seleccionado') : g('seleccionadas', 'seleccionados')}`

  const bar: ReactNode = selecting && (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-2xl lg:left-64"
        role="region"
        aria-label="Asignar"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <span className="flex flex-col">
            <span className="font-semibold" data-testid="selected-count">
              {countLabel}
            </span>
            {selected.size > 0 && (
              <span className="text-xs text-white/70" data-testid="selected-owners">
                {ownersSummary(selected)}
              </span>
            )}
          </span>
          {!allMatching && total > 0 && (
            <button
              type="button"
              onClick={() => void selectAllMatching()}
              disabled={loadingAll}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-gold-light underline disabled:opacity-60"
            >
              {loadingAll ? 'Marcando…' : `Seleccionar ${g('las', 'los')} ${total} del filtro`}
            </button>
          )}
          {branchId === undefined ? (
            <span className="text-sm text-white/70">Elige una sucursal en el filtro para asignar.</span>
          ) : (
            <>
              <select
                aria-label="Asignar a"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="min-h-11 rounded-xl bg-white px-3 text-ink"
              >
                <option value="">Asignar a…</option>
                {auxiliaries.length > 1 && <option value="split">Repartir entre las {auxiliaries.length} auxiliares</option>}
                {assignees.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({ROLE_LABEL[a.role]})
                  </option>
                ))}
                <option value="none">— Quitar responsable</option>
              </select>
              <button
                type="button"
                disabled={!assignTo || selected.size === 0 || assign.isPending}
                onClick={() => (isReassign ? setConfirming(true) : void doAssign())}
                className="bg-gold-gradient min-h-11 rounded-xl px-5 font-semibold text-ink disabled:opacity-50"
              >
                {assign.isPending ? 'Asignando…' : isReassign ? 'Reasignar' : 'Asignar'}
              </button>
            </>
          )}
          <button type="button" onClick={stop} className="ml-auto min-h-11 px-2 text-sm text-white/70 underline">
            Cancelar
          </button>
        </div>
      </div>

      {confirming && (
        <Dialog open onOpenChange={(o) => !o && setConfirming(false)} title="¿Reasignar?" description={`Vas a ${targetLabel}.`}>
          <p className="text-sm text-ink/80">
            Se les quitan a quien {them} tiene hoy: <b>{ownersSummary(new Map(taken.map((o, i) => [String(i), o])))}</b>. Queda en el
            historial de cada ficha.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={() => void doAssign()}>
              Reasignar {selected.size}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )

  return { selecting, start: () => setSelecting(true), stop, selected, toggle, allOnPage, toggleAll, bar }
}

export type AssignSelectionState = ReturnType<typeof useAssignSelection>

/** Botón «Seleccionar» / «Cancelar selección» del encabezado. */
export function SelectToggle({ sel, disabled }: { sel: AssignSelectionState; disabled: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={sel.selecting}
      onClick={() => (sel.selecting ? sel.stop() : sel.start())}
      disabled={disabled}
      className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 disabled:opacity-50 ${
        sel.selecting ? 'bg-ink text-gold-light ring-ink' : 'bg-white text-ink ring-ink/15 active:bg-sand'
      }`}
    >
      {sel.selecting ? 'Cancelar selección' : 'Seleccionar'}
    </button>
  )
}
