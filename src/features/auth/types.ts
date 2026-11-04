export type AppRole =
  | 'field_volunteer'
  | 'field_assistant'
  | 'field_supervisor'
  | 'branch_manager'
  | 'sales_lead'
  | 'general_manager'
  | 'admin'

export type Profile = {
  id: string
  username: string
  full_name: string
  role: AppRole
  branch_id: number | null
  /** Solo jefe de ventas: las sucursales que gestiona. */
  branch_ids?: number[]
  contract_type: 'temporary' | 'permanent'
  active: boolean
  deactivated_at: string | null
}

export const ROLE_LABEL: Record<AppRole, string> = {
  field_volunteer: 'Volantero',
  field_assistant: 'Auxiliar',
  field_supervisor: 'Supervisor',
  branch_manager: 'Encargado',
  sales_lead: 'Jefe de ventas',
  general_manager: 'Gerente',
  admin: 'Sistemas',
}

export const FIELD_ROLES: AppRole[] = ['field_volunteer', 'field_assistant', 'field_supervisor']
export const MANAGER_ROLES: AppRole[] = ['branch_manager', 'sales_lead', 'general_manager', 'admin']
/** Ven todas las sucursales (sin sucursal propia). */
export const GLOBAL_ROLES: AppRole[] = ['general_manager', 'admin']
/** Todos registran clientes; quien no tiene sucursal propia (jefe, gerencia, Sistemas) elige en cuál. */
export const CAPTURE_ROLES: AppRole[] = [...FIELD_ROLES, ...MANAGER_ROLES]
export const FOLLOWUP_ROLES: AppRole[] = ['field_assistant', 'field_supervisor', 'branch_manager']

export function homePath(role: AppRole): string {
  if (MANAGER_ROLES.includes(role)) return '/panel'
  // Auxiliar y supervisor trabajan sobre todo la recaptación: entran a Mis contactos.
  return FOLLOWUP_ROLES.includes(role) ? '/seguimiento' : '/registrar'
}
