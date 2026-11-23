// Etiquetas de las vistas de monitoreo (Seguimientos y Actividad). Las de etapa, interés, forma y resultado
// se reutilizan de prospects/format y followup/api.
import type { DateBasis } from '@/features/prospects/search'

export type FollowupTab = 'sin_contactar' | 'seguimiento' | 'potencial' | 'venta' | 'sin_interes'

/** Pestañas de Seguimientos y las etapas que agrupa cada una (contracts/rpc.md). */
export const FOLLOWUP_TABS: { tab: FollowupTab; label: string; stages: string[] }[] = [
  { tab: 'sin_contactar', label: 'Sin contactar', stages: ['capture'] },
  { tab: 'seguimiento', label: 'Seguimiento / Recaptación', stages: ['followup', 'recapture'] },
  { tab: 'potencial', label: 'Cliente potencial', stages: ['interested'] },
  { tab: 'venta', label: 'Venta', stages: ['sale'] },
  { tab: 'sin_interes', label: 'Sin interés', stages: ['lost'] },
]

/** Mensaje cuando la pestaña no tiene clientes. */
export const TAB_EMPTY: Record<FollowupTab | 'todos', string> = {
  sin_contactar: 'Ningún cliente sin contactar con estos filtros.',
  seguimiento: 'Ningún cliente en seguimiento o recaptación con estos filtros.',
  potencial: 'Ningún cliente potencial con estos filtros.',
  venta: 'Ninguna venta con estos filtros.',
  sin_interes: 'Ningún cliente sin interés con estos filtros.',
  todos: 'No hay clientes con estos filtros.',
}

export type ActivityMetric =
  | 'calls'
  | 'messages'
  | 'store'
  | 'effective'
  | 'no_answer'
  | 'visits'
  | 'sales'
  | 'clients'
  | 'assigned'
  | 'total'
  | 'first_contacts'
  | 'recontacts'

/** Columnas numéricas de Actividad, en orden. */
export const ACTIVITY_METRICS: { key: ActivityMetric; label: string; short: string }[] = [
  { key: 'calls', label: 'Llamadas', short: 'Llamadas' },
  { key: 'messages', label: 'Mensajes', short: 'Mensajes' },
  { key: 'store', label: 'En tienda', short: 'Tienda' },
  { key: 'effective', label: 'Efectivos', short: 'Efectivos' },
  { key: 'no_answer', label: 'No contestó', short: 'No contestó' },
  { key: 'visits', label: 'Visitas pactadas', short: 'Visitas' },
  { key: 'sales', label: 'Ventas', short: 'Ventas' },
  { key: 'clients', label: 'Clientes contactados', short: 'Clientes' },
  { key: 'assigned', label: 'Clientes asignados', short: 'Asignados' },
  { key: 'total', label: 'Total de contactos', short: 'Total' },
  // Spec 023: el cliente ya tenía un contacto anterior (de cualquier persona) → recontacto.
  { key: 'first_contacts', label: 'Primer contacto', short: '1.er contacto' },
  { key: 'recontacts', label: 'Recontacto', short: 'Recontactos' },
]

/** Métrica que filtra el detalle de contactos (clientes y total muestran todos). */
export type ContactMetric = 'all' | 'calls' | 'messages' | 'store' | 'effective' | 'no_answer' | 'visits' | 'sales' | 'first' | 'recontact'
export const CONTACT_METRICS: ContactMetric[] = ['all', 'calls', 'messages', 'store', 'effective', 'no_answer', 'visits', 'sales', 'first', 'recontact']

export const contactMetricOf = (m: ActivityMetric): ContactMetric =>
  m === 'clients' || m === 'total' || m === 'assigned'
    ? 'all'
    : m === 'first_contacts'
      ? 'first'
      : m === 'recontacts'
        ? 'recontact'
        : m

export const metricLabel = (m: ContactMetric): string =>
  m === 'all'
    ? 'Todos los contactos'
    : m === 'first'
      ? 'Primer contacto'
      : m === 'recontact'
        ? 'Recontacto'
        : (ACTIVITY_METRICS.find((x) => x.key === m)?.label ?? m)

/** Spec 023: «Contar por» de Seguimientos. `verb` va después de «N clientes ·»; `help`, debajo. */
export const DATE_BASIS_TEXT: Record<DateBasis, { option: string; verb: string; help: string }> = {
  registered: { option: 'Registro', verb: 'registrados', help: 'El período cuenta la fecha en que se registró el cliente.' },
  assigned: { option: 'Asignación', verb: 'asignados', help: 'El período cuenta la fecha en que se le asignó al responsable actual.' },
  last_contact: {
    option: 'Último contacto',
    verb: 'con último contacto',
    help: 'El período cuenta la fecha del último contacto del cliente, de cualquier persona.',
  },
  next_contact: {
    option: 'Próximo contacto',
    verb: 'con contacto agendado',
    help: 'El período cuenta la fecha agendada para el próximo contacto.',
  },
}
