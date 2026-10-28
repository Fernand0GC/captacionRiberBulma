// Edge Function admin-users (contracts/rpc.md). Solo administradores activos.
// La service role se usa solo dentro de esta función; nunca llega al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const USERNAME_DOMAIN = 'captacion.riberbulma.local'
const ROLES = ['field_volunteer', 'field_assistant', 'field_supervisor', 'branch_manager', 'general_manager', 'admin']

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
}

function validateCreate(b: CreateInput): string | null {
  if (!/^[a-z0-9._]{3,30}$/.test(b.username ?? '')) return 'username'
  if (!b.full_name || b.full_name.trim().length < 3) return 'full_name'
  if (!ROLES.includes(b.role)) return 'role'
  if (!['general_manager', 'admin'].includes(b.role) && !b.branch_id) return 'branch_id'
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
        branch_id: ['general_manager', 'admin'].includes(input.role) ? null : input.branch_id,
        contract_type: input.contract_type,
      })
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id) // no dejar cuentas sin perfil
        return json(500, { code: 'unknown' })
      }
      return json(201, { id: created.user.id })
    }
    // update, deactivate, reactivate, reset_password: US7 (T059).
    default:
      return json(400, { code: 'invalid_input', details: { field: 'action' } })
  }
})
