// app/src/lib/__tests__/labels.test.js
import { describe, it, expect } from 'vitest'
import { beaconLayout } from '../labels.js'

const toScreen = (x, y, z) => ({ sx: x, sy: y, depth: z, visible: true })
describe('beaconLayout', () => {
  it('fades with distance', () => {
    const r = beaconLayout([{ id: 'a', x: 10, y: 10, z: 1000, priority: 1 }, { id: 'b', x: 500, y: 10, z: 7000, priority: 1 }], { toScreen, width: 1280, height: 800 })
    expect(r.find((b) => b.id === 'a').alpha).toBe(1); expect(r.find((b) => b.id === 'b').alpha).toBe(0)
  })
  it('culls overlapping labels, keeping the higher priority then the nearer', () => {
    const r = beaconLayout([
      { id: 'far', x: 100, y: 100, z: 1500, priority: 1 }, { id: 'near', x: 110, y: 105, z: 500, priority: 1 }, { id: 'vip', x: 120, y: 100, z: 1800, priority: 5 },
    ], { toScreen, width: 1280, height: 800 })
    expect(r.filter((b) => b.labelled).map((b) => b.id)).toEqual(['vip'])
  })
  it('never labels more than maxLabels', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, x: (i % 10) * 200, y: Math.floor(i / 10) * 60, z: 100, priority: 1 }))
    expect(beaconLayout(items, { toScreen, width: 2000, height: 400, maxLabels: 16 }).filter((b) => b.labelled).length).toBeLessThanOrEqual(16)
  })
  it('skips items behind the camera', () => {
    const r = beaconLayout([{ id: 'x', x: 0, y: 0, z: 10, priority: 1 }], { toScreen: () => ({ visible: false }), width: 10, height: 10 })
    expect(r[0].labelled).toBe(false); expect(r[0].alpha).toBe(0)
  })
})

describe('per-item fade (P4 Task 7 evaluation)', () => {
  it('an item may carry its own fade distance (neighbourhood names stay readable from high up)', () => {
    const toScreen = (x, y, z) => ({ sx: x, sy: y, depth: z, visible: true })
    const r = beaconLayout([{ id: 'zone', x: 100, y: 100, z: 7000, priority: 1, fadeFar: 12000 }, { id: 'pin', x: 400, y: 100, z: 7000, priority: 1 }], { toScreen, width: 1280, height: 800 })
    expect(r.find((b) => b.id === 'zone').alpha).toBeGreaterThan(0.4)
    expect(r.find((b) => b.id === 'pin').alpha).toBe(0)
  })
})
