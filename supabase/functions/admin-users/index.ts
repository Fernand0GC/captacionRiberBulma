// Edge Function admin-users (contracts/rpc.md). Solo administradores activos.
// La service role se usa solo dentro de esta función; nunca llega al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const USERNAME_DOMAIN = 'captacion.riberbulma.local'
const ROLES = ['field_volunteer', 'field_assistant', 'field_supervisor', 'branch_manager', 'sales_lead', 'general_manager', 'admin']
// Sin sucursal propia: gerencia y Sistemas ven todas; el jefe de ventas trabaja con su lista (branch_ids).
const NO_BRANCH = ['general_manager', 'admin', 'sales_lead']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

type CreateInput = {
  action: 'create'
  username: string
  full_name: string
  role: string
  branch_id: number | null
  contract_type: 'temporary' | 'permanent'
  password: string
  branch_ids?: number[]
}

const validBranchIds = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every((x) => Number.isInteger(x) && x > 0)

function validateCreate(b: CreateInput): string | null {
  if (!/^[a-z0-9._]{3,30}$/.test(b.username ?? '')) return 'username'
  if (!b.full_name || b.full_name.trim().length < 3) return 'full_name'
  if (!ROLES.includes(b.role)) return 'role'
  if (b.role === 'sales_lead') {
    if (!validBranchIds(b.branch_ids)) return 'branch_ids'
  } else if (!NO_BRANCH.includes(b.role) && !b.branch_id) return 'branch_id'
  if (!['temporary', 'permanent'].includes(b.contract_type)) return 'contract_type'
  if (!b.password || b.password.length < 8) return 'password'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { code: 'invalid_input' })

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Quien llama debe ser admin activo (verificado con su propio JWT + profiles).
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData } = await caller.auth.getUser()
  if (!userData.user) return json(401, { code: 'forbidden' })
  const { data: me } = await caller.from('profiles').select('role, active').eq('id', userData.user.id).maybeSingle()
  if (!me || !me.active || me.role !== 'admin') return json(403, { code: 'forbidden' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  let body: { action?: string } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { code: 'invalid_input' })
  }

  switch (body.action) {
    case 'create': {
      const input = body as unknown as CreateInput
      const bad = validateCreate(input)
      if (bad) return json(400, { code: 'invalid_input', details: { field: bad } })
      const { data: created, error } = await admin.auth.admin.createUser({
        email: `${input.username}@${USERNAME_DOMAIN}`,
        password: input.password,
        email_confirm: true,
      })
      if (error || !created.user) {
        const dup = error?.message?.toLowerCase().includes('already')
        return json(dup ? 409 : 500, { code: dup ? 'invalid_input' : 'unknown', details: { field: 'username', reason: dup ? 'duplicate' : undefined } })
      }
      const { error: pErr } = await admin.from('profiles').insert({
        id: created.user.id,
        username: input.username,
        full_name: input.full_name.trim(),
        role: input.role,
        branch_id: NO_BRANCH.includes(input.role) ? null : input.branch_id,
        contract_type: input.contract_type,
      })
      const bErr =
        !pErr && input.role === 'sales_lead'
          ? (await admin.from('profile_branches').insert(input.branch_ids!.map((b) => ({ profile_id: created.user.id, branch_id: b })))).error
          : null
      if (pErr || bErr) {
        // No dejar cuentas a medias: el perfil impide borrar la cuenta (on delete restrict), se borra primero.
        if (!pErr) await admin.from('profiles').delete().eq('id', created.user.id)
        await admin.auth.admin.deleteUser(created.user.id)
        return json(500, { code: 'unknown' })
      }
      return json(201, { id: created.user.id })
    }
    case 'update': {
      // Nombre, rol, sucursal y contrato. El usuario (login) no cambia.
      const id = String(body.id ?? '')
      const patch: Record<string, unknown> = {}
      if (body.full_name !== undefined) {
        const n = String(body.full_name).trim()
        if (n.length < 3) return json(400, { code: 'invalid_input', details: { field: 'full_name' } })
        patch.full_name = n
      }
      if (body.role !== undefined) {
        if (!ROLES.includes(String(body.role))) return json(400, { code: 'invalid_input', details: { field: 'role' } })
        patch.role = body.role
      }
      if (body.contract_type !== undefined) {
        if (!['temporary', 'permanent'].includes(String(body.contract_type))) return json(400, { code: 'invalid_input', details: { field: 'contract_type' } })
        patch.contract_type = body.contract_type
      }
      const role = String(patch.role ?? (await admin.from('profiles').select('role').eq('id', id).maybeSingle()).data?.role ?? '')
      if (role === 'sales_lead' && body.branch_ids !== undefined && !validBranchIds(body.branch_ids)) {
        return json(400, { code: 'invalid_input', details: { field: 'branch_ids' } })
      }
      if (NO_BRANCH.includes(role)) patch.branch_id = null
      else if (body.branch_id !== undefined) {
        if (!body.branch_id) return json(400, { code: 'invalid_input', details: { field: 'branch_id' } })
        patch.branch_id = body.branch_id
      }
      if (id === userData.user.id && patch.role && patch.role !== 'admin') {
        return json(400, { code: 'invalid_input', details: { field: 'role', reason: 'self' } }) // no quitarse el rol a uno mismo
      }
      const { data, error } = await admin.from('profiles').update(patch).eq('id', id).select('id').maybeSingle()
      if (error) return json(400, { code: 'invalid_input', details: { field: 'branch_id' } })
      if (!data) return json(404, { code: 'not_found' })
      // Sucursales del jefe: se reemplaza la lista; si deja de ser jefe, se limpia.
      if (role !== 'sales_lead' || body.branch_ids !== undefined) {
        await admin.from('profile_branches').delete().eq('profile_id', id)
        if (role === 'sales_lead') {
          const ids = body.branch_ids as number[]
          const { error: bErr } = await admin.from('profile_branches').insert(ids.map((b) => ({ profile_id: id, branch_id: b })))
          if (bErr) return json(400, { code: 'invalid_input', details: { field: 'branch_ids' } })
        }
      }
      return json(200, { id })
    }
    case 'deactivate':
    case 'reactivate': {
      // Baja = perfil inactivo (sin ban de Auth): lo registrado sin señal antes de la baja aún puede subir (research R9).
      const id = String(body.id ?? '')
      if (id === userData.user.id) return json(400, { code: 'invalid_input', details: { field: 'id', reason: 'self' } })
      const active = body.action === 'reactivate'
      const { data, error } = await admin
        .from('profiles')
        .update({ active, deactivated_at: active ? null : new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .maybeSingle()
      if (error) return json(500, { code: 'unknown' })
      if (!data) return json(404, { code: 'not_found' })
      return json(200, { id })
    }
    case 'reset_password': {
      const id = String(body.id ?? '')
      const password = String(body.password ?? '')
      if (password.length < 8) return json(400, { code: 'invalid_input', details: { field: 'password' } })
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return json(404, { code: 'not_found' })
      return json(200, { id })
    }
    default:
      return json(400, { code: 'invalid_input', details: { field: 'action' } })
  }
})
