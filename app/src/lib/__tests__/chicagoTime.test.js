import { describe, it, expect } from 'vitest'
import { chicagoClock } from '../chicagoTime.js'
describe('chicagoClock', () => {
  it('reads Chicago wall time whatever the host zone', () => {
    expect(chicagoClock(new Date('2026-09-28T17:05:30Z'))).toMatchObject({ month: 9, day: 28, hour: 12, minute: 5, second: 30, weekday: 1 })
    expect(chicagoClock(new Date('2026-01-15T05:00:00Z'))).toMatchObject({ month: 1, day: 14, hour: 23 })   // CST, UTC−6
    expect(chicagoClock(new Date('2026-07-04T05:00:00Z'))).toMatchObject({ month: 7, day: 4, hour: 0 })     // CDT, UTC−5
  })
})
