import { describe, expect, it } from 'vitest'
import { effectiveText, fmtAvg, longDay, perDay, perPerson, shiftDay, WEEK_DAYS } from '@/features/monitoring/daily'

describe('reporte del día (009)', () => {
  it('perPerson: registros ÷ personas; sin personas, null (no 0 ÷ 0)', () => {
    expect(perPerson({ new: 9, new_people: 2 })).toBe(4.5)
    expect(perPerson({ new: 0, new_people: 0 })).toBeNull()
  })
  it('perDay: semana ÷ 7', () => {
    expect(WEEK_DAYS).toBe(7)
    expect(perDay({ week_new: 133 })).toBe(19)
    expect(perDay({ week_new: 0 })).toBe(0)
  })
  it('fmtAvg: una decimal con coma; null es «—»', () => {
    expect(fmtAvg(4.5)).toBe('4,5')
    expect(fmtAvg(19)).toBe('19')
    expect(fmtAvg(4.8333)).toBe('4,8')
    expect(fmtAvg(null)).toBe('—')
  })
  it('effectiveText: porcentaje de clientes; sin seguimiento, null', () => {
    expect(effectiveText({ followed: 31, effective: 18 })).toBe('58 % de los clientes')
    expect(effectiveText({ followed: 0, effective: 0 })).toBeNull()
  })
  it('shiftDay y longDay: sin depender de la zona del navegador', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(longDay('2026-11-19')).toBe('jueves, 19 de noviembre')
  })
})
