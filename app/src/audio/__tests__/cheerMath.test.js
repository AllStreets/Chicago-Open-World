import { describe, it, expect } from 'vitest'
import { distanceGain, murmurLevel, cheerTimes, lastCheer, swellEnvelope, swellNow } from '../cheerMath.js'

describe('cheer math', () => {
  it('attenuates like the inverse model and falls silent at 1.5 km', () => {
    expect(distanceGain(0)).toBe(1); expect(distanceGain(80)).toBe(1)
    expect(distanceGain(500)).toBeCloseTo(80 / (80 + 1.1 * 420), 6)
    expect(distanceGain(1500)).toBe(0)
    expect(distanceGain(900)).toBeLessThan(distanceGain(400))
  })
  it('the murmur follows the game state', () => {
    expect(murmurLevel('idle')).toBe(0); expect(murmurLevel('live')).toBe(0.28); expect(murmurLevel(undefined)).toBe(0)
  })
  it('simulated swells: deterministic, roughly every 1–4 minutes', () => {
    const a = cheerTimes(2, 0, 3600)
    expect(cheerTimes(2, 0, 3600)).toEqual(a)
    expect(a.length).toBeGreaterThan(10); expect(a.length).toBeLessThan(40)
    for (const t of a) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(3600) }
    expect(lastCheer(2, a[3] + 1)).toBe(a[3])
  })
  it('the swell rises in 0.4 s and decays over a few seconds', () => {
    expect(swellEnvelope(-1)).toBe(0); expect(swellEnvelope(0.2)).toBeCloseTo(0.5)
    expect(swellEnvelope(0.4)).toBe(1); expect(swellEnvelope(2)).toBeCloseTo(Math.exp(-1))
    expect(swellEnvelope(-Infinity)).toBe(0)
  })
  it('swellNow: simulated swells only while live; a pushed cheer at any time', () => {
    const t = cheerTimes(2, 0, 3600)[0] + 0.4
    expect(swellNow('live', 2, t, null)).toBeCloseTo(1)
    expect(swellNow('idle', 2, t, null)).toBe(0)
    expect(swellNow('idle', 2, 1000, { at: 999600, strength: 0.5 })).toBeCloseTo(0.5)
  })
})
