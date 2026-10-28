import { useState, type FormEvent } from 'react'
import { ROLE_LABEL, type AppRole } from '@/features/auth/types'
import { Button } from '@/ui/Button'
import { Field, TextInput } from '@/ui/Field'
import { Select } from '@/ui/Select'
import type { UserRow } from './api'

export type UserFormValues = {
  username: string
  full_name: string
  role: AppRole
  branch_id: number | null
  contract_type: 'temporary' | 'permanent'
}

const ROLES: AppRole[] = ['field_volunteer', 'field_assistant', 'field_supervisor', 'branch_manager', 'general_manager', 'admin']
const GLOBAL: AppRole[] = ['general_manager', 'admin']

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
    contract_type: initial?.contract_type ?? 'temporary',
  })
  const [errs, setErrs] = useState<Partial<Record<keyof UserFormValues, string>>>({})
  const needsBranch = !GLOBAL.includes(v.role)

  function submit(e: FormEvent) {
    e.preventDefault()
    const x: typeof errs = {}
    if (!initial && !/^[a-z0-9._]{3,30}$/.test(v.username)) x.username = '3 a 30 caracteres: minúsculas, números, punto o guion bajo.'
    if (v.full_name.trim().length < 3) x.full_name = 'Escribe el nombre completo.'
    if (needsBranch && !v.branch_id) x.branch_id = 'Elige la sucursal.'
    setErrs(x)
    if (Object.keys(x).length === 0) onSubmit({ ...v, branch_id: needsBranch ? v.branch_id : null })
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
      <Field label="Nombre completo" required error={errs.full_name}>
        {(id, d) => (
          <TextInput id={id} aria-describedby={d} invalid={!!errs.full_name} value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
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
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
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
