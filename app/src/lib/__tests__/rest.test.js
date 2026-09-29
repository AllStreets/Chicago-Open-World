// app/src/lib/__tests__/rest.test.js
import { describe, it, expect } from 'vitest'
import { createRestTracker } from '../rest.js'

describe('rest tracker (G5)', () => {
  it('settles after N consecutive still frames', () => {
    const r = createRestTracker({ frames: 3, eps: 0.01 })
    expect([r.sample([0, 0]), r.sample([0, 0]), r.sample([0, 0]), r.sample([0, 0])]).toEqual([false, false, false, true])
  })
  it('any movement beyond eps resets; jitter within eps does not', () => {
    const r = createRestTracker({ frames: 2, eps: 0.01 })
    r.sample([0]); r.sample([0.005]); expect(r.sample([0.009])).toBe(true)
    expect(r.sample([1])).toBe(false)
    expect(r.sample([1])).toBe(false)
    expect(r.sample([1])).toBe(true)
  })
})
