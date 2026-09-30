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
