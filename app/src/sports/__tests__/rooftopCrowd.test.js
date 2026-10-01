import { describe, it, expect } from 'vitest'
import { rooftopDensity, rooftopCount } from '../crowd.js'

describe('the Wrigley rooftop crowds (user item 13)', () => {
  it('fill on game nights, thin out before and after, and are empty otherwise', () => {
    expect(rooftopDensity('live')).toBeGreaterThan(0.8)
    expect(rooftopDensity('pregame')).toBeGreaterThan(0.2); expect(rooftopDensity('pregame')).toBeLessThan(rooftopDensity('live'))
    expect(rooftopDensity('postgame')).toBeLessThan(rooftopDensity('pregame'))
    expect(rooftopDensity('idle')).toBe(0); expect(rooftopDensity(undefined)).toBe(0)
  })
  it('counts from the venue sidecar', () => {
    const v = { rooftopCount: 1000 }
    expect(rooftopCount(v, { state: 'live' })).toBeGreaterThan(800)
    expect(rooftopCount(v, null)).toBe(0)
    expect(rooftopCount({}, { state: 'live' })).toBe(0)
  })
})
