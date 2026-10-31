import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

export function Field({
  label,
  error,
  hint,
  required,
  optional,
  children,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  /** Muestra "(opcional)" junto al nombre, igual que el resto de los campos no obligatorios. */
  optional?: boolean
  children: (id: string, describedBy: string | undefined) => ReactNode
}) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink/80">
        {label}
        {required && <span className="text-gold-dark"> *</span>}
        {optional && <span className="font-normal text-ink/40"> (opcional)</span>}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-rb-red" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink/50">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({ invalid, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`min-h-13 w-full rounded-2xl border bg-white px-4 text-lg outline-none transition placeholder:text-ink/30 focus:border-gold focus:ring-4 focus:ring-gold/20 ${
        invalid ? 'border-rb-red' : 'border-ink/15'
      } ${className}`}
      {...props}
    />
  )
}
