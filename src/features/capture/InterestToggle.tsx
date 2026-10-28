const OPTIONS = [
  { value: 'high', label: 'Alto' },
  { value: 'medium', label: 'Medio' },
  { value: 'low', label: 'Bajo' },
] as const

/** Interés opcional: un toque elige, otro toque en el mismo lo quita. */
export function InterestToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Nivel de interés" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? '' : o.value)}
            className={`min-h-12 rounded-2xl border text-base font-semibold transition ${
              active ? 'border-ink bg-ink text-gold-light' : 'border-ink/15 bg-white text-ink/70 active:bg-sand'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
