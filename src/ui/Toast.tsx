import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastAction = { label: string; onClick: () => void }
type ToastItem = { id: number; text: string; tone: 'info' | 'error' | 'success'; action?: ToastAction }
/** Con `action` (ej.: "Deshacer") el aviso dura un poco más y muestra el botón. */
type ToastFn = (text: string, tone?: ToastItem['tone'], action?: ToastAction) => void

const ToastContext = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])
  const push = useCallback<ToastFn>(
    (text, tone = 'info', action) => {
      const id = Date.now() + Math.random()
      setItems((xs) => [...xs, { id, text, tone, action }])
      setTimeout(() => dismiss(id), action ? 6000 : 4000)
    },
    [dismiss],
  )
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-pop pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium shadow-xl ${
              t.tone === 'error' ? 'bg-rb-red text-white' : t.tone === 'success' ? 'bg-ink text-gold-light' : 'bg-charcoal text-white'
            }`}
          >
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick()
                  dismiss(t.id)
                }}
                className="min-h-9 shrink-0 rounded-full px-3 text-sm font-bold text-gold-light ring-1 ring-gold-light/40 active:bg-white/10"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
