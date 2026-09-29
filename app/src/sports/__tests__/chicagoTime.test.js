import { describe, it, expect } from 'vitest'
import { chicagoDate, chicagoParts, chicagoToUtc, offsetMinutes, addDays, weekday, formatChicago } from '../chicagoTime.js'

const T = (iso) => Date.parse(iso)
describe('chicagoTime (independent of the host time zone)', () => {
  it('Chicago dates roll over at Chicago midnight', () => {
    expect(chicagoDate(T('2026-04-05T04:30:00Z'))).toBe('2026-04-04') // 23:30 CDT
    expect(chicagoDate(T('2026-04-05T05:30:00Z'))).toBe('2026-04-05') // 00:30 CDT
    expect(chicagoDate(T('2026-01-10T05:30:00Z'))).toBe('2026-01-09') // 23:30 CST
  })
  it('offset is −5 h in summer and −6 h in winter', () => {
    expect(offsetMinutes(T('2026-07-01T12:00:00Z'))).toBe(-300)
    expect(offsetMinutes(T('2026-01-01T12:00:00Z'))).toBe(-360)
  })
  it('converts Chicago wall time to UTC across both DST changes', () => {
    expect(chicagoToUtc('2026-03-07', 12)).toBe(T('2026-03-07T18:00:00Z'))
    expect(chicagoToUtc('2026-03-08', 12)).toBe(T('2026-03-08T17:00:00Z'))
    expect(chicagoToUtc('2026-10-31', 12)).toBe(T('2026-10-31T17:00:00Z'))
    expect(chicagoToUtc('2026-11-01', 12)).toBe(T('2026-11-01T18:00:00Z'))
    expect(chicagoToUtc('2026-07-04', 19, 5)).toBe(T('2026-07-05T00:05:00Z'))
  })
  it('parts, days and weekdays', () => {
    expect(chicagoParts(T('2026-07-05T00:05:00Z'))).toMatchObject({ year: 2026, month: 7, day: 4, hour: 19, minute: 5 })
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekday('2026-09-27')).toBe(0)
    expect(formatChicago(T('2026-07-05T00:05:00Z'))).toBe('Sat 7:05 PM')
  })
})
