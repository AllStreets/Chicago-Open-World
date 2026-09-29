import { describe, it, expect } from 'vitest'
import { envKey } from '../envKey.js'

describe('envKey', () => {
  it('changes only when the sun moves by ~2° (not every LIVE minute)', () => {
    const a = envKey([0.6, 0.1, -0.79])
    const tiny = envKey([0.6005, 0.1003, -0.7896])
    expect(tiny).toBe(a)
    expect(envKey([0.3, 0.5, -0.81])).not.toBe(a)
  })
  it('is a string and handles night', () => {
    expect(typeof envKey([0, -1, 0])).toBe('string')
  })
})
