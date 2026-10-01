// app/src/lib/__tests__/openingHours.test.js — OSM opening_hours → today's hours in plain words (place popup).
import { describe, it, expect } from 'vitest'
import { hoursToday } from '../openingHours.js'

// 2026-09-30 is a Wednesday; 2026-10-03 a Saturday
const WED = new Date(2026, 8, 30, 12), SAT = new Date(2026, 9, 3, 12)
describe('hoursToday', () => {
  it('weekday ranges', () => {
    expect(hoursToday('Mo-Fr 09:00-17:00', WED)).toBe('Open today 9 am – 5 pm')
    expect(hoursToday('Mo-Fr 09:00-17:00', SAT)).toBe('Closed today')
  })
  it('day lists, and later rules override earlier ones', () => {
    expect(hoursToday('Mo-Su 11:00-22:00; Sa,Su 10:00-23:30', SAT)).toBe('Open today 10 am – 11:30 pm')
    expect(hoursToday('Mo-Su 11:00-22:00; We off', WED)).toBe('Closed today')
  })
  it('24/7, no days at all, and several ranges in a day', () => {
    expect(hoursToday('24/7', WED)).toBe('Open 24 hours')
    expect(hoursToday('10:00-20:00', SAT)).toBe('Open today 10 am – 8 pm')
    expect(hoursToday('Mo-Fr 11:00-14:00,17:00-22:00', WED)).toBe('Open today 11 am – 2 pm, 5 pm – 10 pm')
  })
  it('past midnight, noon and midnight read naturally', () => {
    expect(hoursToday('We 18:00-02:00', WED)).toBe('Open today 6 pm – 2 am')
    expect(hoursToday('We 12:00-24:00', WED)).toBe('Open today noon – midnight')
  })
  it('unparseable or missing hours give nothing (the popup then shows the raw string or omits the line)', () => {
    expect(hoursToday(null, WED)).toBeNull()
    expect(hoursToday('by appointment', WED)).toBeNull()
  })
})
