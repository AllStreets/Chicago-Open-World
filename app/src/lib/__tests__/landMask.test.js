import { describe, it, expect } from 'vitest'
import { makeIsWater } from '../landMask.js'
describe('makeIsWater', () => {
  const isWater = makeIsWater([[[0, 0], [100, 0], [100, -100], [0, -100]]])
  it('land inside the rings, water outside', () => {
    expect(isWater(50, -50)).toBe(false)
    expect(isWater(150, -50)).toBe(true)
  })
  it('no rings → never water (unknown)', () => {
    expect(makeIsWater([])(1, 1)).toBe(false)
  })
})
