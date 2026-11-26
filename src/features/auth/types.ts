export type AppRole =
  | 'field_volunteer'
  | 'field_assistant'
  | 'field_supervisor'
  | 'branch_manager'
  | 'sales_lead'
  | 'general_manager'
  | 'admin'
  /** Cobros (spec 006): solo verifica compartidas de sus sucursales; sin datos de clientes. */
  | 'collections'

/** Permisos por persona (spec 029): se otorgan a una encargada, solo valen en su sucursal. */
export type Permission = 'replan_past' | 'referrals'

export type Profile = {
  id: string
  username: string
  full_name: string
  role: AppRole
  branch_id: number | null
  /** Jefe de ventas y Cobros: sus sucursales. */
  branch_ids?: number[]
  contract_type: 'temporary' | 'permanent'
  active: boolean
  deactivated_at: string | null
  /** Permisos extra (spec 029). Puede faltar en un perfil guardado en caché antes de la 029. */
  permissions?: Permission[]
  /** CI de la cuenta única (solo lo traen la pantalla Usuarios). */
  ci?: string | null
}

export const ROLE_LABEL: Record<AppRole, string> = {
  field_volunteer: 'Volantero',
  field_assistant: 'Auxiliar',
  field_supervisor: 'Supervisor',
  branch_manager: 'Encargado',
  sales_lead: 'Jefe de ventas',
  general_manager: 'Gerente',
  admin: 'Sistemas',
  collections: 'Cobros',
}

export const FIELD_ROLES: AppRole[] = ['field_volunteer', 'field_assistant', 'field_supervisor']
export const MANAGER_ROLES: AppRole[] = ['branch_manager', 'sales_lead', 'general_manager', 'admin']
/** Ven todas las sucursales (sin sucursal propia). */
export const GLOBAL_ROLES: AppRole[] = ['general_manager', 'admin']
/** Todos registran clientes; quien no tiene sucursal propia (jefe, gerencia, Sistemas) elige en cuál. */
export const CAPTURE_ROLES: AppRole[] = [...FIELD_ROLES, ...MANAGER_ROLES]
/** Tienen "Mis contactos". Gerencia también: queda como responsable de lo que toma con "Hacer seguimiento". */
export const FOLLOWUP_ROLES: AppRole[] = ['field_assistant', 'field_supervisor', ...MANAGER_ROLES]

/** Organización comercial (spec 003): cargan y corrigen. El supervisor reemplaza al encargado cuando hace falta. */
export const ORG_MANAGE_ROLES: AppRole[] = ['field_supervisor', ...MANAGER_ROLES]
/** Organización comercial: la ven (el auxiliar, solo lo suyo). La volantera no la ve. */
export const ORG_VIEW_ROLES: AppRole[] = ['field_assistant', ...ORG_MANAGE_ROLES]

/** Referidos (spec 005): reporte y referidores. El encargado no (el servidor lo verifica con can_see_referrals). */
export const REFERRAL_ROLES: AppRole[] = ['sales_lead', 'general_manager', 'admin']

/** Verificar compartidas (spec 006): Cobros en sus sucursales; gerencia y Sistemas en todas. */
export const VERIFY_SHARES_ROLES: AppRole[] = ['collections', ...GLOBAL_ROLES]

/** Roles con sucursales en profile_branches (sin sucursal propia). */
export const MULTI_BRANCH_ROLES: AppRole[] = ['sales_lead', 'collections']

export function homePath(role: AppRole): string {
  if (role === 'collections') return '/verificar-compartidas'
  if (MANAGER_ROLES.includes(role)) return '/panel'
  // Auxiliar y supervisor trabajan sobre todo la recaptación: entran a Mis contactos.
  return FOLLOWUP_ROLES.includes(role) ? '/seguimiento' : '/registrar'
}
