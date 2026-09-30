// app/src/lib/__tests__/alerts.test.js
import { describe, it, expect } from 'vitest'
import { alertsToLinePulses } from '../alerts.js'

describe('alerts → line pulses', () => {
  it('takes the max severity per line and keeps headlines', () => {
    const m = alertsToLinePulses({ alerts: [
      { id: '1', headline: 'Red Line delays', impact: 'Significant Delays', affected: ['Red Line'] },
      { id: '2', headline: 'Red Line work', impact: 'Planned Work', affected: ['Red Line', 'Purple Line'] },
    ] })
    expect(m.get('red').severity).toBe(1)
    expect(m.get('red').headlines).toEqual(['Red Line delays', 'Red Line work'])
    expect(m.get('purple').severity).toBeCloseTo(0.3)
  })
  it('ignores bus routes and zero-severity impacts', () => {
    const m = alertsToLinePulses({ alerts: [
      { id: '3', headline: 'Bus reroute', impact: 'Service Change', affected: ['#22 Clark'] },
      { id: '4', headline: 'Elevator out', impact: 'Elevator Status', affected: ['Blue Line'] },
    ] })
    expect(m.size).toBe(0)
  })
  it('tolerates null and malformed payloads', () => {
    expect(alertsToLinePulses(null).size).toBe(0)
    expect(alertsToLinePulses({ alerts: 'nope' }).size).toBe(0)
    expect(alertsToLinePulses({ alerts: [{ impact: 'Minor Delays' }] }).size).toBe(0)
  })
})
