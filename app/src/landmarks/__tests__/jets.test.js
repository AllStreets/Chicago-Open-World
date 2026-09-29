import { describe, it, expect } from 'vitest'
import { jetPoint, landingTime, launchSpeed, buildParticles, PARTICLES, G } from '../jets.js'

const centre = { kind: 'centre', p: [0, 10.6, 0], dir: [0, 1, 0], h: 35.4, floor: 8.95 }
describe('fountain jets', () => {
  it('launch speed reaches the jet height: the centre jet tops out at 46 m', () => {
    expect(launchSpeed(35.4) ** 2 / (2 * G)).toBeCloseTo(35.4)
    let top = 0
    for (let s = 0; s < 1; s += 0.001) top = Math.max(top, jetPoint(centre, 1, s, 0)[1])
    expect(top).toBeCloseTo(46, 0)
  })
  it('water lands on the basin below, and half-power jets are lower', () => {
    const T = landingTime(centre, 1)
    expect(jetPoint(centre, 1, 0.9999999, 0)[1]).toBeCloseTo(centre.floor, 0)
    expect(T).toBeGreaterThan(5)
    let half = 0
    for (let s = 0; s < 1; s += 0.001) half = Math.max(half, jetPoint(centre, 0.5, s, 0)[1])
    expect(half).toBeLessThan(30)
  })
  it('an idle jet emits nothing', () => {
    expect(jetPoint(centre, 0, 0.3, 1)).toBeNull()
  })
  it('particle buffers: counts per kind, seeds in [0, 1)', () => {
    const b = buildParticles([centre, { ...centre, kind: 'seahorse' }])
    expect(b.emitter.length).toBe(PARTICLES.centre + PARTICLES.seahorse)
    expect(Math.max(...b.seed)).toBeLessThan(1)
  })
})
