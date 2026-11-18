import { useState, type FormEvent } from 'react'
import { ROLE_LABEL, type AppRole } from '@/features/auth/types'
import { generatePassword } from '@/lib/adminUsers'
import { Button } from '@/ui/Button'
import { Field, TextInput } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { parseCi } from '../../../supabase/functions/_shared/ci'
import type { UserRow } from './api'

export type UserFormValues = {
  username: string
  full_name: string
  role: AppRole
  branch_id: number | null
  /** Jefe de ventas: sus sucursales. */
  branch_ids: number[]
  contract_type: 'temporary' | 'permanent'
  /** CI de la cuenta única; vacío = sin CI. */
  ci: string
  /** Solo al crear. */
  password?: string
}

const ROLES: AppRole[] = [
  'field_volunteer',
  'field_assistant',
  'field_supervisor',
  'branch_manager',
  'sales_lead',
  'general_manager',
  'admin',
]
// Sin sucursal propia. Cobros (spec 006) tiene sus sucursales, pero se asignan con «Hacer Cobros» en la lista.
const GLOBAL: AppRole[] = ['general_manager', 'admin', 'sales_lead', 'collections']

export function UserForm({
  initial,
  branches,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: UserRow
  branches: { id: number; name: string }[]
  busy: boolean
  error?: string
  onSubmit: (v: UserFormValues) => void
  onCancel: () => void
}) {
  const [v, setV] = useState<UserFormValues>({
    username: initial?.username ?? '',
    full_name: initial?.full_name ?? '',
    role: initial?.role ?? 'field_volunteer',
    branch_id: initial?.branch_id ?? null,
    branch_ids: initial?.branch_ids ?? [],
    contract_type: initial?.contract_type ?? 'temporary',
    ci: initial?.ci ?? '',
    password: initial ? undefined : generatePassword(),
  })
  const [errs, setErrs] = useState<Partial<Record<keyof UserFormValues, string>>>({})
  const needsBranch = !GLOBAL.includes(v.role)
  // Cobros no se crea desde acá (la Edge Function no lo conoce): solo aparece para no perderlo al editar.
  const roles = initial?.role === 'collections' ? [...ROLES, 'collections' as const] : ROLES
  const isLead = v.role === 'sales_lead'

  function submit(e: FormEvent) {
    e.preventDefault()
    const x: typeof errs = {}
    if (!initial && !/^[a-z0-9._]{3,30}$/.test(v.username))
      x.username = '3 a 30 caracteres: minúsculas, números, punto o guion bajo.'
    if (v.full_name.trim().length < 3) x.full_name = 'Escribe el nombre completo.'
    if (needsBranch && !v.branch_id) x.branch_id = 'Elige la sucursal.'
    if (isLead && v.branch_ids.length === 0) x.branch_ids = 'Elige al menos una sucursal.'
    const ci = v.ci.trim() ? parseCi(v.ci) : ''
    if (ci === null) x.ci = 'Número de 4 a 12 dígitos y, si tiene, complemento con guion. Ej.: 7788990-1B'
    if (!initial && (v.password ?? '').trim().length < 8) x.password = 'Mínimo 8 caracteres.'
    setErrs(x)
    if (Object.keys(x).length === 0)
      onSubmit({ ...v, ci: ci ?? '', password: v.password?.trim(), branch_id: needsBranch ? v.branch_id : null, branch_ids: isLead ? v.branch_ids : [] })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!initial && (
        <Field label="Usuario (para entrar)" required error={errs.username} hint="Ej.: maria.verdolago">
          {(id, d) => (
            <TextInput
              id={id}
              aria-describedby={d}
              invalid={!!errs.username}
              autoCapitalize="none"
              autoCorrect="off"
              value={v.username}
              onChange={(e) => setV({ ...v, username: e.target.value.toLowerCase().trim() })}
            />
          )}
        </Field>
      )}
      {!initial && (
        <Field
          label="Contraseña"
          required
          error={errs.password}
          hint="Escribe la que quieras o usa la generada (mínimo 8)."
        >
          {(id, d) => (
            <div className="flex gap-2">
              <TextInput
                id={id}
                aria-describedby={d}
                invalid={!!errs.password}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                value={v.password ?? ''}
                onChange={(e) => setV({ ...v, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setV({ ...v, password: generatePassword() })}
                className="min-h-12 shrink-0 rounded-xl px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand"
              >
                Generar
              </button>
            </div>
          )}
        </Field>
      )}
      <Field label="Nombre completo" required error={errs.full_name}>
        {(id, d) => (
          <TextInput
            id={id}
            aria-describedby={d}
            invalid={!!errs.full_name}
            value={v.full_name}
            onChange={(e) => setV({ ...v, full_name: e.target.value })}
          />
        )}
      </Field>
      <Field label="CI (cuenta única)" error={errs.ci} hint="Opcional. Con él la persona entra con la cuenta única.">
        {(id, d) => (
          <TextInput
            id={id}
            aria-describedby={d}
            invalid={!!errs.ci}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            value={v.ci}
            onChange={(e) => setV({ ...v, ci: e.target.value })}
          />
        )}
      </Field>
      <Field label="Rol" required>
        {(id) => (
          <Select
            id={id}
            value={v.role}
            onChange={(r) => {
              const role = r as AppRole
              setV({ ...v, role, contract_type: role === 'field_volunteer' ? 'temporary' : v.contract_type })
            }}
            options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        )}
      </Field>
      {needsBranch && (
        <Field label="Sucursal" required error={errs.branch_id}>
          {(id, d) => (
            <Select
              id={id}
              describedBy={d}
              invalid={!!errs.branch_id}
              value={v.branch_id ? String(v.branch_id) : ''}
              onChange={(b) => setV({ ...v, branch_id: b ? Number(b) : null })}
              options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
            />
          )}
        </Field>
      )}
      {isLead && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink/80">
            Sucursales a cargo <span className="text-gold-dark">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {branches.map((b) => {
              const on = v.branch_ids.includes(b.id)
              return (
                <label key={b.id} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 ring-1 ${on ? 'bg-gold/10 ring-gold/50' : 'bg-white ring-ink/15'}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-gold"
                    checked={on}
                    onChange={() => setV({ ...v, branch_ids: on ? v.branch_ids.filter((x) => x !== b.id) : [...v.branch_ids, b.id] })}
                  />
                  {b.name}
                </label>
              )
            })}
          </div>
          {errs.branch_ids && (
            <p role="alert" className="text-sm font-medium text-rb-red">
              {errs.branch_ids}
            </p>
          )}
        </fieldset>
      )}
      <Field label="Contrato" required>
        {(id) => (
          <Select
            id={id}
            value={v.contract_type}
            onChange={(c) => setV({ ...v, contract_type: c as UserFormValues['contract_type'] })}
            options={[
              { value: 'temporary', label: 'Temporal' },
              { value: 'permanent', label: 'Con contrato' },
            ]}
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="text-sm font-medium text-rb-red">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? 'Guardando…' : initial ? 'Guardar' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  )
}
