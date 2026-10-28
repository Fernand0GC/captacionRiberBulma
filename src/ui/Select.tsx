export type Option = { value: string; label: string }

/** Select nativo: cero JS extra y el selector del sistema en Android (dedo, accesible). */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Elegir…',
  invalid,
  describedBy,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={`min-h-13 w-full appearance-none rounded-2xl border bg-white bg-[length:12px] bg-[right_1rem_center] bg-no-repeat px-4 pr-10 text-lg outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20 ${
        invalid ? 'border-rb-red' : 'border-ink/15'
      } ${value ? 'text-ink' : 'text-ink/35'}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8861c' stroke-width='2' fill='none'/%3E%3C/svg%3E\")",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="text-ink">
          {o.label}
        </option>
      ))}
    </select>
  )
}
