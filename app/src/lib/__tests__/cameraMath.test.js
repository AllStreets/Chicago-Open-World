import { describe, it, expect } from 'vitest'
import { clampCamera, glideVector, MIN_ALT, MAX_DIST } from '../cameraMath.js'

describe('clampCamera', () => {
  it('lifts the camera to minimum altitude', () => {
    expect(clampCamera([0, -50, 0], [0, 0, -10]).position[1]).toBe(MIN_ALT)
  })
  it('keeps the target on or above ground', () => {
    expect(clampCamera([0, 200, 0], [0, -20, -10]).target[1]).toBe(0)
  })
  it('limits camera-target distance', () => {
    const { position, target } = clampCamera([0, 9000, 0], [0, 0, 0])
    expect(Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])).toBeCloseTo(MAX_DIST)
  })
  it('limits how far the target wanders from the origin', () => {
    const { target } = clampCamera([10000, 200, 0], [9000, 0, 0])
    expect(Math.hypot(target[0], target[2])).toBeCloseTo(MAX_DIST)
  })
  it('passes a valid pose through unchanged', () => {
    expect(clampCamera([100, 200, 300], [0, 0, 0])).toEqual({ position: [100, 200, 300], target: [0, 0, 0], clamped: false })
  })
})

describe('glideVector', () => {
  it('W moves toward where the camera looks (azimuth 0 = looking north, -Z)', () => {
    const [dx, dz] = glideVector(new Set(['KeyW']), 0)
    expect(dx).toBeCloseTo(0); expect(dz).toBeCloseTo(-1)
  })
  it('D strafes right (east when looking north)', () => {
    const [dx] = glideVector(new Set(['KeyD']), 0)
    expect(dx).toBeCloseTo(1)
  })
  it('diagonal is normalized; no keys is zero', () => {
    const v = glideVector(new Set(['KeyW', 'KeyD']), 0)
    expect(Math.hypot(...v)).toBeCloseTo(1)
    expect(glideVector(new Set(), 0)).toEqual([0, 0])
  })
})

describe('clampCamera clamped flag (no false fires)', () => {
  it('reports clamped=false for 5,000 random in-bounds poses', () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 5000; i++) {
      const target = [rnd() * 2000 - 1000, rnd() * 100, rnd() * 2000 - 1000]
      const position = [target[0] + rnd() * 1000 - 500, 40 + rnd() * 900, target[2] + rnd() * 1000 - 500]
      expect(clampCamera(position, target).clamped).toBe(false)
    }
  })
  it('reports clamped=true when a limit applies', () => {
    expect(clampCamera([0, -50, 0], [0, 0, -10]).clamped).toBe(true)
    expect(clampCamera([0, 9000, 0], [0, 0, 0]).clamped).toBe(true)
  })
})

describe('headingDeg', () => {
  it('is always within [0, 360) even after many turns', async () => {
    const { headingDeg } = await import('../cameraMath.js')
    expect(headingDeg(0)).toBe(0)
    expect(headingDeg(Math.PI / 2)).toBe(270) // looking west
    expect(headingDeg(-Math.PI / 2)).toBe(90) // looking east
    expect(headingDeg(40 * Math.PI + Math.PI / 2)).toBe(270)
    expect(headingDeg(-40 * Math.PI - Math.PI / 2)).toBe(90)
  })

describe('world bounds clamp', () => {
  const B = { minX: -5000, maxX: 4000, minZ: -8000, maxZ: 6000 }
  it('clamps the target into the world rect and keeps the camera offset', () => {
    const { target, position, clamped } = clampCamera([9000, 300, 100], [8000, 0, 0], B)
    expect(target[0]).toBe(4000); expect(position[0]).toBe(5000); expect(clamped).toBe(true)
  })
  it('allows 6 km camera distance, caps beyond', () => {
    expect(MAX_DIST).toBe(6000)
    const { position, target } = clampCamera([0, 9000, 0], [0, 0, 0], B)
    expect(Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])).toBeCloseTo(6000)
  })
  it('a pose inside the world is untouched', () => {
    expect(clampCamera([100, 400, -7000], [0, 0, -7500], B).clamped).toBe(false)
  })
})
})

import { slideMove, STEP_M } from '../cameraMath.js'

describe('free-flight clearance (G2)', () => {
  const open = () => 25
  const wallEast = (x) => (x > 5 ? 300 : 25) // a 275 m tower face at x = 5
  it('open ground: the move passes unchanged', () => {
    expect(slideMove([0, 100, 0], [10, 0, 0], open)).toEqual([10, 0, 0])
  })
  it('a diagonal move into a tower slides along its face', () => {
    expect(slideMove([0, 100, 0], [10, 0, 10], wallEast)).toEqual([0, 0, 10])
  })
  it('head-on into a tower: no horizontal motion, the camera rises instead of stopping', () => {
    const [dx, dy, dz] = slideMove([0, 100, 0], [10, 0, 0], wallEast)
    expect(dx).toBe(0); expect(dz).toBe(0)
    expect(dy).toBeGreaterThan(0); expect(dy).toBeLessThanOrEqual(20)
  })
  it('a small rise (≤ STEP_M) is climbed while moving', () => {
    expect(STEP_M).toBe(12)
    expect(slideMove([0, 100, 0], [10, 0, 0], () => 105)).toEqual([10, 5, 0])
  })
  it('holding climb over a tower keeps rising', () => {
    const [, dy] = slideMove([0, 100, 0], [10, 3, 0], wallEast)
    expect(dy).toBeGreaterThan(3)
  })
})

describe('WORLD_BOUNDS reach the offshore landmarks (P3)', () => {
  it('the camera can look at the Chicago Harbor Lighthouse on the outer breakwater', async () => {
    const { WORLD_BOUNDS, clampCamera } = await import('../cameraMath.js')
    const lighthouse = [3049, 9, -823]
    const r = clampCamera([2900, 70, -680], lighthouse, WORLD_BOUNDS)
    const t = r.target ?? r[1]
    expect(t[0]).toBeCloseTo(3049, 0)
  })
})

describe('WORLD_BOUNDS reach the Waveland Clock Tower (merge review)', () => {
  it('the camera can look at the tower at the north end of Lincoln Park', async () => {
    const { WORLD_BOUNDS, clampCamera } = await import('../cameraMath.js')
    const r = clampCamera([-1000, 120, -7600], [-1101, 20, -7759], WORLD_BOUNDS)
    expect(r.target[2]).toBeCloseTo(-7759, 0)
  })
})
