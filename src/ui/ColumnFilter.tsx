import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { normalizeText } from '@/lib/search'

// Filtro en el título de una columna: el título es un botón que abre un menú pequeño.
// El menú va en un portal (fuera de la tabla) porque el contenedor de la tabla corta lo que se sale (overflow-x-auto).
// No guarda el filtro: quien lo usa lo lee y lo escribe en la URL, igual que la barra de filtros.

const MENU_WIDTH = 288

export function ColumnFilter({
  label,
  active,
  valueLabel,
  onClear,
  children,
}: {
  label: string
  /** Hay un filtro aplicado en esta columna (título en blanco con punto dorado). */
  active: boolean
  /** Lo elegido, visible en el título (ej.: «Volanteo»). */
  valueLabel?: string
  /** Sin onClear no hay botón «Limpiar» (ej.: un jefe de ventas no puede ver «todas las sucursales»). */
  onClear?: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) btn.current?.focus()
  }

  // Ubica el menú debajo del título sin salirse de la pantalla; se recalcula al desplazar o cambiar el tamaño.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = btn.current?.getBoundingClientRect()
      if (!r) return
      const left = Math.min(Math.max(12, r.left), window.innerWidth - MENU_WIDTH - 12)
      // Nunca pasa del borde de abajo: si falta lugar, la lista de opciones se desplaza por dentro.
      setPos({ left, top: r.bottom + 6, maxHeight: Math.max(220, window.innerHeight - r.bottom - 18) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Cierra con Escape o tocando afuera; al abrir, enfoca el primer control del menú.
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLElement>('input, button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) close(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-1.5 whitespace-nowrap px-4 py-3 text-left font-semibold hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-gold ${active ? 'text-white' : ''}`}
      >
        {active && <span className="h-2 w-2 shrink-0 rounded-full bg-gold ring-[3px] ring-gold/30" aria-hidden />}
        {label}
        {active && valueLabel && (
          <span className="max-w-28 truncate text-xs font-normal text-gold-light">{valueLabel}</span>
        )}
        {active && <span className="sr-only">(filtrado)</span>}
        <span aria-hidden className={`text-[10px] transition ${open ? 'rotate-180 opacity-100' : 'opacity-50'}`}>
          ▾
        </span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="dialog"
            aria-label={`Filtrar por ${label}`}
            style={{ left: pos.left, top: pos.top, width: MENU_WIDTH, maxHeight: pos.maxHeight }}
            className="fixed z-50 flex max-w-[calc(100vw-1.5rem)] flex-col gap-3 overflow-hidden rounded-2xl bg-white p-3 text-sm font-normal text-ink shadow-2xl ring-1 ring-ink/10"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-ink/50">Filtrar por {label}</p>
            {children}
            <div className="flex items-center justify-between gap-2 border-t border-ink/10 pt-3">
              {onClear ? (
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => {
                    onClear()
                    close(true)
                  }}
                  className="px-1 py-1.5 text-ink/60 underline disabled:no-underline disabled:opacity-40"
                >
                  Limpiar
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => close(true)}
                className="bg-gold-gradient min-h-9 rounded-full px-4 font-semibold text-ink"
              >
                Listo
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

export type FilterOption = {
  value: string
  label: string
  /** Agrupa las opciones bajo un subtítulo (ej.: Celulares). */
  group?: string
  /** Opción especial en cursiva («Sin canal», «Sin asignar»). */
  special?: boolean
}

/** Lista de opciones de un filtro (elige una; tocar la elegida la quita). Con muchas opciones muestra un buscador. */
export function FilterOptions({
  options,
  value,
  onPick,
  noun,
}: {
  options: FilterOption[]
  value: string | undefined
  onPick: (value: string | undefined) => void
  /** Para el buscador: «Buscar canal…». */
  noun: string
}) {
  const [q, setQ] = useState('')
  const needle = normalizeText(q.trim())
  const shown = needle ? options.filter((o) => normalizeText(`${o.label} ${o.group ?? ''}`).includes(needle)) : options

  return (
    <>
      {options.length > 7 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Buscar ${noun}…`}
          aria-label={`Buscar ${noun}`}
          className="min-h-10 rounded-xl border border-ink/15 px-3 text-base outline-none placeholder:text-ink/35 focus:border-gold focus:ring-4 focus:ring-gold/20"
        />
      )}
      <div className="-mx-1 flex max-h-64 min-h-0 flex-col gap-0.5 overflow-y-auto px-1" role="group" aria-label={`Opciones de ${noun}`}>
        {shown.length === 0 && <p className="px-2 py-2 text-ink/50">Sin coincidencias</p>}
        {shown.map((o, i) => (
          <div key={o.value} className="contents">
            {o.group && o.group !== shown[i - 1]?.group && (
              <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-widest text-ink/50">{o.group}</p>
            )}
            <button
              type="button"
              aria-pressed={value === o.value}
              onClick={() => onPick(value === o.value ? undefined : o.value)}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-sand ${
                value === o.value ? 'bg-gold/10 font-semibold' : ''
              } ${o.special ? 'italic text-ink/60' : ''}`}
            >
              <span
                aria-hidden
                className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                  value === o.value ? 'border-gold bg-[radial-gradient(circle,var(--color-gold)_45%,transparent_50%)]' : 'border-ink/25'
                }`}
              />
              {o.label}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
