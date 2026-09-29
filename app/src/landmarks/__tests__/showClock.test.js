import { describe, it, expect } from 'vitest'
import { liftShowTime, gatePoints, gateActive, nearestMoving } from '../showClock.js'
import { LIFT_DEMO } from '../../bridges/lift.js'

describe('show clocks', () => {
  it('a manual lift runs from its start; lowering and idle have no music clock', () => {
    expect(liftShowTime({ startedAt: 1000 }, 21000)).toBeCloseTo(20)
    expect(liftShowTime({ startedAt: 1000, stoppedAt: 5000 }, 6000)).toBeNull()
    expect(liftShowTime(null, 6000)).toBeNull()
  })
  it('gates stand at both approaches, either side of the roadway', () => {
    const g = gatePoints({ centre: [0, 0], axis: [0, -1], span: 60 })
    expect(g).toHaveLength(4)
    for (const [x, y, z] of g) { expect(Math.abs(z)).toBeGreaterThan(30); expect(Math.abs(x)).toBeCloseTo(7); expect(y).toBeGreaterThan(2) }
  })
  it('a bridge warns 8 s before its leaves move and until they are down', () => {
    const S = LIFT_DEMO.staggerS
    expect(gateActive(2, 2 * S - 9, 0)).toBe(false)
    expect(gateActive(2, 2 * S - 7, 0)).toBe(true)
    expect(gateActive(0, 500, 0.3)).toBe(true)     // still up
    expect(gateActive(0, 500, 0)).toBe(false)      // down after its run
  })
  it('the music sits at the moving bridge nearest the camera', () => {
    const bridges = [{ key: 'a', centre: [0, 0] }, { key: 'b', centre: [1000, 0] }]
    expect(nearestMoving(bridges, { a: 0.4, b: 0.5 }, [900, 0])).toEqual([1000, 8, 0])
    expect(nearestMoving(bridges, { a: 0.4, b: 0 }, [900, 0])).toEqual([0, 8, 0])
    expect(nearestMoving(bridges, {}, [900, 0])).toBeNull()
  })
})
