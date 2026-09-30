// app/src/lib/__tests__/tour.test.js
import { describe, it, expect } from 'vitest'
import { tourAt, tourDuration } from '../tour.js'

const tour = { id: 't', name: 'T', stops: [{ title: 'A', text: 'a', dwell: 5 }, { title: 'B', text: 'b', dwell: 5 }] }
const poses = [{ position: [0, 300, 0], target: [0, 0, 0] }, { position: [2000, 300, 0], target: [2000, 0, 0] }]
describe('tour playback', () => {
  it('starts dwelling on stop 0 with its card', () => {
    const s = tourAt(tour, poses, 0); expect(s.stopIndex).toBe(0); expect(s.phase).toBe('dwell'); expect(s.card.title).toBe('A')
  })
  it('flies between stops, then dwells, and finishes', () => {
    const total = tourDuration(tour, poses)
    const mid = tourAt(tour, poses, 5 + 0.5); expect(mid.phase).toBe('fly'); expect(mid.stopIndex).toBe(1)
    expect(tourAt(tour, poses, total - 0.01).card.title).toBe('B')
    expect(tourAt(tour, poses, total + 1).done).toBe(true)
  })
  it('progress rises monotonically', () => {
    let last = -1
    for (let t = 0; t < tourDuration(tour, poses); t += 0.25) { const p = tourAt(tour, poses, t).progress; expect(p).toBeGreaterThanOrEqual(last); last = p }
  })
})

import { tourStopPose } from '../tourPoses.js'
import { pinBudget } from '../poiFilter.js'
describe('tour framing and pin budget (P4 Task 6 evaluation)', () => {
  it('frames a stop close enough to read the landmark: within 1.8× its height (min 220 m), looking at its upper half', () => {
    const p = tourStopPose({ x: 0, z: 0, top: 141 })
    const d = Math.hypot(p.position[0], p.position[2])
    expect(d).toBeLessThanOrEqual(Math.max(220, 141 * 1.8) + 1); expect(d).toBeGreaterThanOrEqual(180)
    expect(p.target[1]).toBeGreaterThan(141 * 0.4)
  })
  it('shows fewer pins the higher the camera (a wide view stays readable), never fewer than 60', () => {
    expect(pinBudget(150, 3000)).toBeGreaterThan(pinBudget(320, 3000))
    expect(pinBudget(320, 3000)).toBeLessThanOrEqual(200)
    expect(pinBudget(5000, 3000)).toBe(60)
    expect(pinBudget(10, 800)).toBe(800)
  })
})

describe('tour stops look past their neighbours (P4 Task 6 evaluation)', () => {
  it('picks the approach whose sightline crosses the fewest roofs', () => {
    // a 200 m wall of towers south-east of the landmark (where the default view comes from)
    const roofs = (x, z) => (x > 40 && x < 200 && z > 40 && z < 200 ? 180 : 0)
    const p = tourStopPose({ x: 0, z: 0, top: 141 }, roofs)
    expect(p.position[0] > 40 && p.position[2] > 40).toBe(false)
    const open = tourStopPose({ x: 0, z: 0, top: 141 }, () => 0)
    expect(open.position[0]).toBeGreaterThan(0); expect(open.position[2]).toBeGreaterThan(0) // no obstruction: the default south-east view
  })
})
