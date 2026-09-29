import { describe, it, expect } from 'vitest'
import { createPerfMeter } from '../perfMeter.js'

const run = (m, dt, seconds) => { let out = null; for (let t = 0; t < seconds; t += dt) { const r = m.sample(dt); if (r) out = r } return out }

describe('perfMeter', () => {
  it('ignores the warm-up after ready (shader compiles, texture uploads)', () => {
    const m = createPerfMeter()
    expect(run(m, 0.05, 4)).toBeNull() // 50 ms frames during the first 5 s never count
  })
  it('a single background-tab frame (huge dt) never triggers a downgrade', () => {
    const m = createPerfMeter()
    run(m, 1 / 60, 6)
    expect(m.sample(4.0)).toBeNull()
    expect(run(m, 1 / 60, 7)).toBe('ok')
  })
  it('needs two slow windows in a row to report slow', () => {
    const m = createPerfMeter()
    run(m, 1 / 60, 6)
    expect(run(m, 0.04, 3.1)).toBe('ok-pending')
    expect(run(m, 0.04, 3.1)).toBe('slow')
  })
})
