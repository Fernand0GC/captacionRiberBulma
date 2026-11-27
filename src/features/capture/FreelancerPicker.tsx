import { useId, useState } from 'react'
import { freelancerView } from '@/features/organization/freelancerView'
import { TextInput } from '@/ui/Field'
import { NAME_MAX, referrerKey, type ReferrerChoice, type ReferrerOption } from './referrerPick'

export function FreelancerPicker({ options, value, onChange, error }: {
  options: ReferrerOption[]
  value: ReferrerChoice | null
  onChange: (value: ReferrerChoice) => void
  error?: string
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const matchesValue = (option: ReferrerOption) => value !== null && (
    value.id !== null ? option.id === value.id : option.id === null && referrerKey(option.name) === referrerKey(value.name)
  )
  // El recién agregado todavía no está en las opciones: se recuerda al guardar la captación.
  const choices = value && !options.some(matchesValue)
    ? [...options, { ...value, kind: 'freelance' }]
    : options
  // Los ids negativos pertenecen solo a la vista; al elegir se recupera la opción original.
  const entries = choices.map((option, index) => ({ id: option.id ?? -(index + 1), name: option.name, option }))
  const selected = entries.find(({ option }) => matchesValue(option))
  const view = freelancerView(entries, selected ? [selected.id] : [], query)
  const byId = new Map(entries.map((entry) => [entry.id, entry.option]))

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-required="true"
      aria-invalid={!!error || undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className="flex flex-col gap-2"
    >
      <span id={`${id}-label`} className="text-sm font-semibold text-ink/80">
        Freelancer <span className="text-gold-dark">*</span>
      </span>
      <TextInput
        type="search"
        aria-label="Buscar freelancer"
        placeholder="Buscar freelancer"
        autoComplete="off"
        autoCapitalize="words"
        maxLength={NAME_MAX}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {view.items.length > 0 && (
        <div className="max-h-96 overflow-y-auto rounded-2xl bg-white ring-1 ring-ink/10">
          {view.items.map((item) => {
            const option = byId.get(item.id)!
            return (
              <label
                key={option.id ?? referrerKey(option.name)}
                className="flex min-h-12 items-center gap-3 border-b border-ink/5 px-4 py-2 last:border-b-0 active:bg-sand"
              >
                <input
                  type="radio"
                  name={`${id}-freelancer`}
                  className="h-5 w-5 shrink-0 accent-gold-dark"
                  checked={item.checked}
                  onChange={() => onChange(option.id === null
                    ? { id: null, name: option.name, kind: 'freelance' }
                    : { id: option.id, name: option.name })}
                />
                <span className="min-w-0 break-words font-medium">{item.name}</span>
              </label>
            )
          })}
        </div>
      )}
      {choices.length === 0 && !query.trim() && (
        <p className="text-sm text-ink/50">No hay freelancers cargados. Escribe el nombre arriba para agregarlo.</p>
      )}
      {view.emptyText && <p className="text-sm text-ink/50">{view.emptyText}</p>}
      {view.addName !== null && (
        <button
          type="button"
          className="min-h-12 rounded-2xl bg-white px-4 text-left font-semibold text-gold-dark ring-1 ring-ink/10 active:bg-sand"
          onClick={() => {
            if (view.addName === null) return
            onChange({ id: null, name: view.addName, kind: 'freelance' })
            setQuery('')
          }}
        >
          Agregar «{view.addName}»
        </button>
      )}
      {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-rb-red">{error}</p>}
    </div>
  )
}
