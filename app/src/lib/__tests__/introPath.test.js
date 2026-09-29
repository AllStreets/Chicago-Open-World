import { describe, it, expect } from 'vitest'
import { introPose, INTRO_SECONDS } from '../introPath.js'
import { BOOKMARKS } from '../bookmarks.js'

describe('introPose', () => {
  it('ends exactly on the Streeterville bookmark', () => {
    const e = introPose(1)
    e.position.forEach((v, i) => expect(v).toBeCloseTo(BOOKMARKS.streeterville.position[i]))
    e.target.forEach((v, i) => expect(v).toBeCloseTo(BOOKMARKS.streeterville.target[i]))
  })
  it('starts far out over the lake and descends', () => {
    const s = introPose(0)
    expect(s.position[0]).toBeGreaterThan(3500)
    expect(s.position[1]).toBeGreaterThan(introPose(1).position[1])
  })
  it('clamps t and never leaves min altitude', () => {
    expect(introPose(-1)).toEqual(introPose(0))
    expect(introPose(2)).toEqual(introPose(1))
    for (let t = 0; t <= 1; t += 0.05) expect(introPose(t).position[1]).toBeGreaterThanOrEqual(30)
    expect(INTRO_SECONDS).toBe(7)
  })
})
