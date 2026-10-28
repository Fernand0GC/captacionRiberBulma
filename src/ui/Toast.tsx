import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastItem = { id: number; text: string; tone: 'info' | 'error' | 'success' }
type ToastFn = (text: string, tone?: ToastItem['tone']) => void

const ToastContext = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback<ToastFn>((text, tone = 'info') => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs, { id, text, tone }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-pop pointer-events-auto w-full max-w-md rounded-2xl px-4 py-3 text-base font-medium shadow-xl ${
              t.tone === 'error' ? 'bg-rb-red text-white' : t.tone === 'success' ? 'bg-ink text-gold-light' : 'bg-charcoal text-white'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
