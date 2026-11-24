// Edge Function admin-users (contracts/rpc.md). Sistemas gestiona a todos; los gestores, sus volanteras (team_*).
// La service role se usa solo dentro de esta función; nunca llega al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { parseCi } from '../_shared/ci.ts'

const USERNAME_DOMAIN = 'captacion.riberbulma.local'
const ROLES = ['field_volunteer', 'field_assistant', 'field_supervisor', 'branch_manager', 'sales_lead', 'general_manager', 'admin']
// Sin sucursal propia: gerencia y Sistemas ven todas; el jefe de ventas trabaja con su lista (branch_ids).
const NO_BRANCH = ['general_manager', 'admin', 'sales_lead']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-actuar-como',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// CI: vacío = sin CI; otro valor se normaliza (7788990-1b → 7788990-1B). undefined = no cambia.
type CiInput = { ok: true; ci: string | null | undefined } | { ok: false }
function readCi(v: unknown): CiInput {
  if (v === undefined) return { ok: true, ci: undefined }
  if (v === null || String(v).trim() === '') return { ok: true, ci: null }
  const ci = parseCi(String(v))
  return ci ? { ok: true, ci } : { ok: false }
}
const ciTaken = (e: { code?: string; message?: string } | null) => e?.code === '23505' && (e.message ?? '').includes('profiles_ci_key')
const ciDuplicate = () => json(409, { code: 'invalid_input', details: { field: 'ci', reason: 'duplicate' } })

type CreateInput = {
  action: 'create'
  username: string
  full_name: string
  role: string
  branch_id: number | null
  contract_type: 'temporary' | 'permanent'
  password: string
  branch_ids?: number[]
  /** CI de la cuenta única (opcional). */
  ci?: string | null
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

type Admin = ReturnType<typeof createClient>
type Caller = { id: string; role: string; branch_id: number | null }

const TEAM_ROLES = ['branch_manager', 'sales_lead', 'general_manager', 'admin']
const GLOBAL = ['general_manager', 'admin']

// Texto en minúsculas, sin tildes ni símbolos (para armar el usuario).
const plain = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

// Clave de 6 números: fácil de dictar a una volantera; se cambia con "Nueva clave" si se comparte.
function pin(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
}

async function managesBranch(admin: Admin, caller: Caller, branch: number): Promise<boolean> {
  if (GLOBAL.includes(caller.role)) return true
  if (caller.role === 'branch_manager') return caller.branch_id === branch
  const { data } = await admin.from('profile_branches').select('branch_id').eq('profile_id', caller.id).eq('branch_id', branch)
  return (data ?? []).length > 0
}

// vol.<sucursal>.<nombre>, con número si ya existe (vol.trini.maria2). Las volanteras rotan: los nombres se repiten.
async function teamUsername(admin: Admin, branch: number, fullName: string): Promise<string | null> {
  const { data: b } = await admin.from('branches').select('code').eq('id', branch).maybeSingle()
  const first = plain(fullName).split(/\s+/)[0]?.slice(0, 12)
  if (!b || !first) return null
  const base = `vol.${plain(b.code).replace(/ /g, '').slice(0, 5)}.${first}`
  const { data: taken } = await admin.from('profiles').select('username').like('username', `${base}%`)
  const used = new Set((taken ?? []).map((t) => t.username))
  for (let n = 1; n < 100; n++) {
    const u = n === 1 ? base : `${base}${n}`
    if (!used.has(u)) return u
  }
  return null
}

async function audit(admin: Admin, actor: string, rowId: string, old: unknown, next: unknown) {
  await admin.from('audit_log').insert({ table_name: 'profiles', row_id: rowId, actor_id: actor, old, new: next })
}

async function team(admin: Admin, caller: Caller, body: Record<string, unknown>): Promise<Response> {
  if (body.action === 'team_create') {
    const branch = Number(body.branch_id)
    const fullName = String(body.full_name ?? '').trim().replace(/\s+/g, ' ')
    if (!Number.isInteger(branch) || branch <= 0) return json(400, { code: 'invalid_input', details: { field: 'branch_id' } })
    if (fullName.length < 3 || fullName.length > 120) return json(400, { code: 'invalid_input', details: { field: 'full_name' } })
    if (!(await managesBranch(admin, caller, branch))) return json(403, { code: 'forbidden' })
    const username = await teamUsername(admin, branch, fullName)
    if (!username) return json(400, { code: 'invalid_input', details: { field: 'full_name' } })
    const password = pin()
    const { data: created, error } = await admin.auth.admin.createUser({
      email: `${username}@${USERNAME_DOMAIN}`,
      password,
      email_confirm: true,
    })
    if (error || !created.user) return json(500, { code: 'unknown' })
    const profile = { id: created.user.id, username, full_name: fullName, role: 'field_volunteer', branch_id: branch, contract_type: 'temporary' }
    const { error: pErr } = await admin.from('profiles').insert(profile)
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json(500, { code: 'unknown' })
    }
    await audit(admin, caller.id, created.user.id, null, profile)
    return json(201, { id: created.user.id, username, password })
  }

  // El resto actúa sobre una volantera existente de una sucursal que gestiona quien llama.
  const id = String(body.id ?? '')
  const { data: target } = await admin.from('profiles').select('id, role, branch_id, active, full_name').eq('id', id).maybeSingle()
  if (!target) return json(404, { code: 'not_found' })
  if (target.role !== 'field_volunteer' || !target.branch_id || !(await managesBranch(admin, caller, target.branch_id))) {
    return json(403, { code: 'forbidden' })
  }

  switch (body.action) {
    case 'team_rename': {
      const fullName = String(body.full_name ?? '').trim().replace(/\s+/g, ' ')
      if (fullName.length < 3 || fullName.length > 120) return json(400, { code: 'invalid_input', details: { field: 'full_name' } })
      const { error } = await admin.from('profiles').update({ full_name: fullName }).eq('id', id)
      if (error) return json(500, { code: 'unknown' })
      await audit(admin, caller.id, id, { full_name: target.full_name }, { full_name: fullName })
      return json(200, { id })
    }
    case 'team_deactivate':
    case 'team_reactivate': {
      // Igual que la baja de Sistemas: perfil inactivo, sin ban; lo guardado sin señal antes de la baja aún sube.
      const active = body.action === 'team_reactivate'
      const { error } = await admin
        .from('profiles')
        .update({ active, deactivated_at: active ? null : new Date().toISOString() })
        .eq('id', id)
      if (error) return json(500, { code: 'unknown' })
      await audit(admin, caller.id, id, { active: target.active }, { active })
      return json(200, { id })
    }
    case 'team_password': {
      const password = pin()
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return json(500, { code: 'unknown' })
      await audit(admin, caller.id, id, null, { password: 'changed' })
      return json(200, { id, password })
    }
    case 'team_delete': {
      // Solo se borra de verdad si no registró nada (error de tipeo). Con registros se archiva: su autoría se conserva.
      const { error } = await admin.from('profiles').delete().eq('id', id)
      if (error) {
        if (error.code !== '23503') return json(500, { code: 'unknown' })
        if (target.active) {
          await admin.from('profiles').update({ active: false, deactivated_at: new Date().toISOString() }).eq('id', id)
          await audit(admin, caller.id, id, { active: true }, { active: false })
        }
        return json(200, { id, archived: true })
      }
      await admin.auth.admin.deleteUser(id)
      await audit(admin, caller.id, id, { full_name: target.full_name }, null)
      return json(200, { id, archived: false })
    }
    default:
      return json(400, { code: 'invalid_input', details: { field: 'action' } })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { code: 'invalid_input' })
  // «Actuar como» (spec 027): altas, bajas y claves nunca se hacen suplantando; esta función ve la identidad real.
  if (req.headers.has('x-actuar-como')) return json(403, { code: 'forbidden', details: { reason: 'impersonating' } })

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Quien llama debe ser admin activo (verificado con su propio JWT + profiles).
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData } = await caller.auth.getUser()
  if (!userData.user) return json(401, { code: 'forbidden' })
  const { data: me } = await caller.from('profiles').select('role, active, branch_id').eq('id', userData.user.id).maybeSingle()
  if (!me || !me.active) return json(403, { code: 'forbidden' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  let body: { action?: string } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { code: 'invalid_input' })
  }

  // Mi equipo: encargado y jefe de ventas (y gerencia/Sistemas) gestionan solo volanteras de sus sucursales.
  if (String(body.action ?? '').startsWith('team_')) {
    if (!TEAM_ROLES.includes(me.role)) return json(403, { code: 'forbidden' })
    return team(admin, { id: userData.user.id, role: me.role, branch_id: me.branch_id }, body)
  }
  if (me.role !== 'admin') return json(403, { code: 'forbidden' })

  switch (body.action) {
    case 'create': {
      const input = body as unknown as CreateInput
      const bad = validateCreate(input)
      if (bad) return json(400, { code: 'invalid_input', details: { field: bad } })
      const ci = readCi(input.ci)
      if (!ci.ok) return json(400, { code: 'invalid_input', details: { field: 'ci' } })
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
        ci: ci.ci ?? null,
      })
      const bErr =
        !pErr && input.role === 'sales_lead'
          ? (await admin.from('profile_branches').insert(input.branch_ids!.map((b) => ({ profile_id: created.user.id, branch_id: b })))).error
          : null
      if (pErr || bErr) {
        // No dejar cuentas a medias: el perfil impide borrar la cuenta (on delete restrict), se borra primero.
        if (!pErr) await admin.from('profiles').delete().eq('id', created.user.id)
        await admin.auth.admin.deleteUser(created.user.id)
        return ciTaken(pErr) ? ciDuplicate() : json(500, { code: 'unknown' })
      }
      return json(201, { id: created.user.id })
    }
    case 'update': {
      // Nombre, rol, sucursal, contrato y CI. El usuario (login) no cambia.
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
      if (body.ci !== undefined) {
        const ci = readCi(body.ci)
        if (!ci.ok) return json(400, { code: 'invalid_input', details: { field: 'ci' } })
        patch.ci = ci.ci
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
      if (ciTaken(error)) return ciDuplicate()
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
