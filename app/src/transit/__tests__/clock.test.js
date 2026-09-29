import { describe, it, expect } from 'vitest'
import { chicagoClock, periodOf } from '../clock.js'

const P = { weekday: [['night', 0, 5], ['peak', 5, 9.5], ['midday', 9.5, 15.5], ['peak', 15.5, 18.5], ['evening', 18.5, 24]], weekend: [['night', 0, 6], ['weekend', 6, 24]] }
const at = (iso) => chicagoClock(Date.parse(iso))

describe('Chicago clock', () => {
  it('reads wall-clock time in CDT and CST', () => {
    expect(at('2026-09-30T08:15:00-05:00')).toMatchObject({ date: '2026-09-30', weekday: 'Wed', weekend: false, hours: 8.25, midnightMs: Date.parse('2026-09-30T00:00:00-05:00') })
    expect(at('2026-12-05T13:30:00-06:00')).toMatchObject({ date: '2026-12-05', weekday: 'Sat', weekend: true, hours: 13.5 })
  })
  it('midnight is the true local midnight on the DST changeover day', () => {
    expect(at('2026-11-01T10:00:00-06:00').midnightMs).toBe(Date.parse('2026-11-01T00:00:00-05:00'))
    expect(at('2026-03-08T12:00:00-05:00').midnightMs).toBe(Date.parse('2026-03-08T00:00:00-06:00'))
  })
  it('service periods', () => {
    expect(periodOf(at('2026-09-30T08:15:00-05:00'), P)).toBe('peak')
    expect(periodOf(at('2026-09-30T12:00:00-05:00'), P)).toBe('midday')
    expect(periodOf(at('2026-09-30T17:00:00-05:00'), P)).toBe('peak')
    expect(periodOf(at('2026-09-30T21:00:00-05:00'), P)).toBe('evening')
    expect(periodOf(at('2026-09-30T03:00:00-05:00'), P)).toBe('night')
    expect(periodOf(at('2026-10-03T12:00:00-05:00'), P)).toBe('weekend')
    expect(periodOf(at('2026-10-03T03:00:00-05:00'), P)).toBe('night')
  })
})
