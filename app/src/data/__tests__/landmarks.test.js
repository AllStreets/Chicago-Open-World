// app/src/data/__tests__/landmarks.test.js
import { describe, it, expect } from 'vitest'
import { LANDMARKS, inWorld } from '../landmarks.js'
import tours from '../tours.json'

const BBOX = { s: 41.826, w: -87.695, n: 41.952, e: -87.595 }
describe('VISIT data', () => {
  it('has CHI\'s 32 landmarks with desc, tip and category', () => {
    expect(LANDMARKS).toHaveLength(32)
    for (const l of LANDMARKS) { expect(l.desc.length).toBeGreaterThan(20); expect(l.tip.length).toBeGreaterThan(10) }
  })
  it('flags out-of-world landmarks (MSI, Hyde Park) instead of dropping them', () => {
    expect(inWorld(LANDMARKS.find((l) => /Science & Industry/.test(l.name)), BBOX)).toBe(false)
    expect(inWorld(LANDMARKS.find((l) => l.name === 'Navy Pier'), BBOX)).toBe(true)
  })
  it('ships exactly three tours, each with ≥ 5 stops and card text', () => {
    expect(tours.map((t) => t.name)).toEqual(['Architecture on the River', 'Museum Campus & the Lakefront', 'A Night in River North'])
    for (const t of tours) { expect(t.stops.length).toBeGreaterThanOrEqual(5); for (const s of t.stops) expect(s.text.length).toBeGreaterThan(20) }
  })
})
