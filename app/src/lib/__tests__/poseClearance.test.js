// app/src/lib/__tests__/poseClearance.test.js — G6: follow-train and venue focus never end inside a building.
import { describe, it, expect, vi } from 'vitest'
const roof = (x, z) => (Math.abs(x) < 100 && Math.abs(z) < 100 ? 300 : 20)
vi.mock('../clearance.js', () => ({ roofHeightAt: (x, z) => (Math.abs(x) < 100 && Math.abs(z) < 100 ? 300 : 20), clearanceAt: (x, z) => (Math.abs(x) < 100 && Math.abs(z) < 100 ? 325 : 45) }))
vi.mock('../../transit/followCam.js', () => ({ followPose: (x, z) => ({ position: [x, 12, z], target: [x + 30, 8, z] }) }))
vi.mock('../../sports/venueFocus.js', () => ({ venueFocusPose: () => ({ position: [50, 60, -40], target: [0, 10, 0] }) }))
import { CLEAR_M, ensureClear, clearedFollowPose, clearedVenuePose } from '../poseClearance.js'

describe('pose clearance (G6)', () => {
  it('lifts a camera that would sit inside a tower to roof + 25 m, target untouched', () => {
    const p = { position: [0, 50, 0], target: [10, 40, 10] }
    const out = ensureClear(p, () => 300)
    expect(out.position).toEqual([0, 300 + CLEAR_M, 0])
    expect(out.target).toEqual([10, 40, 10])
    expect(p.position[1]).toBe(50) // input not mutated
  })
  it('leaves a clear pose alone (idempotent), and never adds the margin twice', () => {
    const p = { position: [500, 400, 500], target: [0, 0, 0] }
    expect(ensureClear(p, () => 20)).toEqual(p)
    expect(ensureClear(ensureClear(p, () => 380), () => 380)).toEqual(ensureClear(p, () => 380))
    expect(ensureClear({ position: [0, 0, 0], target: [0, 0, 0] }).position[1]).toBe(roof(0, 0) + CLEAR_M) // raw roof + 25, not clearanceAt + 25
  })
  it('follow-train pose over the dense Loop clears the roofs', () => { expect(clearedFollowPose(0, 0).position[1]).toBeGreaterThanOrEqual(300 + CLEAR_M) })
  it('follow-train pose over low roofs still clears them by 25 m', () => { expect(clearedFollowPose(1000, 1000).position[1]).toBeGreaterThanOrEqual(20 + CLEAR_M) })
  it('venue focus inside a tall neighbour is lifted', () => { expect(clearedVenuePose().position[1]).toBeGreaterThanOrEqual(300 + CLEAR_M) })
})
