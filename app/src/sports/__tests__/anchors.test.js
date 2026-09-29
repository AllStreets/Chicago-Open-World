import { describe, it, expect } from 'vitest'
import { decodeAnchors, frameToWorld, fieldFans } from '../anchors.js'

describe('anchors', () => {
  it('decodes the pipeline’s Int16 packing', () => {
    const a = decodeAnchors(new Int16Array([53, 123, -75, 15708, -200, 1, 200, -31416]).buffer, [100, -200])
    expect([...a].map((v) => +v.toFixed(4))).toEqual([105.3, 12.3, -207.5, 1.5708, 80, 0.1, -180, -3.1416])
  })
  it('frame → world: u along the axis, v to its left seen from above', () => {
    const f = { origin: [10, 20], axis: [0, -1] } // axis north
    expect(frameToWorld(f, 5, 0)).toEqual([10, 15])
    expect(frameToWorld(f, 0, 3)).toEqual([7, 20]) // left of north is west (−x)
  })
  it('field fans stand on the field, deterministic', () => {
    const f = { origin: [0, 0], axis: [1, 0] }
    const a = fieldFans(f, 'baseball', 160, 3)
    expect(a.length).toBe(640)
    for (let i = 0; i < 160; i++) { expect(a[i * 4]).toBeGreaterThanOrEqual(8); expect(a[i * 4]).toBeLessThanOrEqual(60); expect(Math.abs(a[i * 4 + 2])).toBeLessThanOrEqual(22); expect(a[i * 4 + 1]).toBeCloseTo(0.3) }
    expect([...fieldFans(f, 'baseball', 160, 3)]).toEqual([...a])
  })
})
