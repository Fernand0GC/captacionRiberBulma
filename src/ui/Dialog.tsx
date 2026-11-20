import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Diálogo modal con <dialog> nativo (foco atrapado, Esc y fondo los maneja el navegador). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** `xl`: ventana ancha para listas con varias columnas (detalle de Actividad, spec 012). */
  size?: 'md' | 'xl'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  // El evento `close` del <dialog> también llega cuando lo cierra la app; solo avisamos los cierres del usuario (Esc).
  const closingByApp = useRef(false)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) {
      closingByApp.current = true
      d.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={() => {
        if (closingByApp.current) closingByApp.current = false
        else onOpenChange(false)
      }}
      className={`m-auto w-[calc(100%-2rem)] ${size === 'xl' ? 'max-w-4xl' : 'max-w-md'} rounded-3xl bg-cream p-6 shadow-2xl backdrop:bg-ink/60 backdrop:backdrop-blur-sm`}
    >
      <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
        {title}
      </h2>
      {description && (
        <p id={descId} className="mt-1 text-ink/60">
          {description}
        </p>
      )}
      <div className="mt-5">{open && children}</div>
    </dialog>
  )
}
