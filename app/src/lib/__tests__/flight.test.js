import { describe, it, expect } from 'vitest'
import { flyPose, flightDuration, poseForPlace } from '../flight.js'
const A = { position: [0, 300, 1000], target: [0, 0, 0] }, B = { position: [5000, 300, -5000], target: [5000, 0, -6000] }
describe('flight', () => {
  it('starts and ends exactly on the poses', () => {
    expect(flyPose(A, B, 0)).toEqual(A); expect(flyPose(A, B, 1)).toEqual(B)
  })
  it('arcs up over the city on long jumps', () => {
    const mid = flyPose(A, B, 0.5)
    expect(mid.position[1]).toBeGreaterThan(1000)
  })
  it('duration grows with distance, clamped', () => {
    expect(flightDuration(A, A)).toBeCloseTo(1.4)
    expect(flightDuration(A, B)).toBeGreaterThan(2.5)
    expect(flightDuration(A, { position: [90000, 0, 0], target: [90000, 0, 0] })).toBe(4.5)
  })
  it('poseForPlace frames a tower from the south-east, above min altitude', () => {
    const p = poseForPlace({ x: 100, z: -200, top: 400 })
    expect(p.target).toEqual([100, 200, -200])
    expect(p.position[0]).toBeGreaterThan(100); expect(p.position[2]).toBeGreaterThan(-200)
    expect(p.position[1]).toBeGreaterThan(400)
    expect(poseForPlace({ x: 0, z: 0, top: 0 }).position[1]).toBeGreaterThanOrEqual(30)
  })
})
