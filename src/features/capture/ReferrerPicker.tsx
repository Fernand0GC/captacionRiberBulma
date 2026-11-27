import { useState } from 'react'
import { KIND_LABEL, type ReferrerKind } from '@/features/referrals/logic'
import { Field, TextInput } from '@/ui/Field'
import {
  canAdd,
  cleanName,
  NAME_MAX,
  NEW_KIND_LABEL,
  NEW_REFERRER_KINDS,
  newKindLabel,
  optionToChoice,
  suggest,
  type NewReferrerKind,
  type ReferrerChoice,
  type ReferrerOption,
} from './referrerPick'

export type PickerText = { label: string; chosen: string; placeholder: string }
const PICKER_TEXT: PickerText = { label: '¿Quién lo recomendó?', chosen: 'Lo recomendó', placeholder: 'Nombre de quien lo recomendó' }

const kindLabel = (o: ReferrerOption) => newKindLabel(o) ?? KIND_LABEL[o.kind as ReferrerKind] ?? ''

/**
 * «¿Quién lo recomendó?» (spec 010): se escribe el nombre; la lista sugiere los de la sucursal y, si no está,
 * «Agregar» pide el tipo. El referidor nuevo no se guarda aquí: viaja con la captación.
 */
export function ReferrerPicker({
  options,
  value,
  onChange,
  query,
  onQueryChange,
  error,
  text = PICKER_TEXT,
  fixedKind,
}: {
  options: ReferrerOption[]
  value: ReferrerChoice | null
  onChange: (v: ReferrerChoice | null) => void
  /** Lo escrito lo guarda el formulario: al Guardar puede resolver una coincidencia exacta. */
  query: string
  onQueryChange: (q: string) => void
  error?: string
  /** Textos de la pantalla (spec 016: la carga de oficina dice «¿Quién te pasó los contactos?»). */
  text?: PickerText
  fixedKind?: NewReferrerKind
}) {
  const [adding, setAdding] = useState(false)

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-gold/10 px-4 py-3 ring-1 ring-gold/30" data-testid="referrer-chosen">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink/55">{text.chosen}</p>
          <p className="truncate text-lg font-semibold">{value.name}</p>
          {value.id === null && <p className="text-sm text-ink/60">{NEW_KIND_LABEL[value.kind]} · nuevo, se agrega a la lista</p>}
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 px-2 font-semibold text-gold-dark"
          onClick={() => {
            onChange(null)
            setAdding(false)
          }}
        >
          Cambiar
        </button>
      </div>
    )
  }

  const name = cleanName(query)

  if (adding && !fixedKind) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
        <p className="text-sm text-ink/60">
          Nuevo: <strong className="text-ink">{name}</strong>
        </p>
        <p className="text-sm font-semibold text-ink/80" id="referrer-kind-label">
          ¿Quién es? <span className="text-gold-dark">*</span>
        </p>
        <div role="group" aria-labelledby="referrer-kind-label" className="grid grid-cols-2 gap-2">
          {NEW_REFERRER_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className="min-h-12 rounded-2xl border border-ink/15 bg-white px-2 text-sm font-semibold text-ink/80 active:bg-sand"
              onClick={() => {
                onChange({ id: null, name, kind: k })
                setAdding(false)
              }}
            >
              {NEW_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <button type="button" className="min-h-11 self-start text-sm font-semibold text-ink/60" onClick={() => setAdding(false)}>
          ← Volver a buscar
        </button>
      </div>
    )
  }

  const eligible = fixedKind ? options.filter((o) => o.kind === fixedKind) : options
  const matches = suggest(eligible, query)
  const showAdd = canAdd(eligible, query)

  return (
    <div className="flex flex-col gap-2">
      <Field
        label={text.label}
        required
        error={error}
        hint={options.length > 0 ? 'La persona que lo mandó, no el cliente. Elige de la lista o escribe el nombre.' : 'La persona que lo mandó, no el cliente. Escribe su nombre.'}
      >
        {(id, d) => (
          <TextInput
            id={id}
            aria-describedby={d}
            invalid={!!error}
            autoComplete="off"
            autoCapitalize="words"
            maxLength={NAME_MAX}
            placeholder={text.placeholder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        )}
      </Field>
      {(matches.length > 0 || showAdd) && (
        <div role="group" aria-label="Sugerencias de referidores" className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
          {matches.map((o) => (
            <button
              key={`${o.id ?? 'n'}-${o.name}`}
              type="button"
              className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/5 px-4 text-left last:border-b-0 active:bg-sand"
              onClick={() => onChange(optionToChoice(o))}
            >
              <span className="truncate font-medium">{o.name}</span>
              <span className="shrink-0 text-xs text-ink/50">{kindLabel(o)}</span>
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              className="flex min-h-12 items-center justify-between gap-3 px-4 text-left font-semibold text-gold-dark active:bg-sand"
              onClick={() => {
                if (fixedKind) onChange({ id: null, name, kind: fixedKind })
                else setAdding(true)
              }}
            >
              <span className="truncate">＋ Agregar «{name}»</span>
              <span className="shrink-0 text-xs font-normal text-ink/50">nuevo</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
