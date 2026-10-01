// app/src/transit/__tests__/arrivals.test.js — CTA local times read right from any time zone (P5 Task 2, C16).
import { describe, it, expect } from 'vitest'
import { minutesUntil, parseArrivals, chicagoOffsetMinutes, liveArrivalsFor } from '../arrivals.js'

describe('arrivals', () => {
  it('knows Chicago is UTC−5 in summer and UTC−6 in winter', () => {
    expect(chicagoOffsetMinutes(Date.UTC(2026, 6, 1))).toBe(-300)
    expect(chicagoOffsetMinutes(Date.UTC(2026, 0, 15))).toBe(-360)
  })
  it('reads CTA local times correctly for a viewer in any timezone', () => {
    const now = Date.UTC(2026, 8, 29, 19, 0, 0) // 14:00 CDT
    expect(minutesUntil('2026-09-29T14:03:00', now)).toBe(3)
    expect(minutesUntil('2026-09-29T13:59:00', now)).toBe(0)
    const winter = Date.UTC(2026, 0, 15, 20, 0, 0) // 14:00 CST
    expect(minutesUntil('2026-01-15T14:10:00', winter)).toBe(10)
  })
  it('parses, maps lines and sorts; ignores malformed rows', () => {
    const now = Date.UTC(2026, 8, 29, 19, 0, 0)
    const r = parseArrivals({ arrivals: [
      { station: 'Grand', line: 'Red', destination: 'Howard', arrTime: '2026-09-29T14:07:00', isApproaching: false, isDelayed: false },
      { station: 'Grand', line: 'Red', destination: '95th/Dan Ryan', arrTime: '2026-09-29T14:02:00', isApproaching: true, isDelayed: false },
      { station: 'Grand', line: 'Nope' },
    ] }, now)
    expect(r.map((a) => a.minutes)).toEqual([2, 7]); expect(r[0].lineId).toBe('red')
    expect(parseArrivals(null, now)).toEqual([])
  })
  it('live arrivals at a station come from the trains heading for it', () => {
    const now = Date.UTC(2026, 8, 29, 19, 0, 0)
    const reports = [
      { rn: '801', line: 'Red', nextStation: 'Grand', arrTime: '2026-09-29T14:04:00', destination: 'Howard' },
      { rn: '802', line: 'Blue', nextStation: 'Grand', arrTime: '2026-09-29T14:01:00' },
      { rn: '803', line: 'Red', nextStation: 'Chicago', arrTime: '2026-09-29T14:02:00' },
    ]
    const r = liveArrivalsFor({ name: 'Grand', lines: ['red'] }, reports, now)
    expect(r).toEqual([{ lineId: 'red', destination: 'Howard', minutes: 4, isApproaching: false, isDelayed: false, rn: '801' }])
  })
})
