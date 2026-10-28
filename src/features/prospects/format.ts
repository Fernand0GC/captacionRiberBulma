import { BUSINESS_TZ } from '@/lib/dates'

const dateFmt = new Intl.DateTimeFormat('es-BO', { timeZone: BUSINESS_TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('es-BO', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso))
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso))

export const INTEREST_LABEL = { high: 'Alto', medium: 'Medio', low: 'Bajo' } as const
