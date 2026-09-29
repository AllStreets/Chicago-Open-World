import { describe, it, expect } from 'vitest'
import { chainRelation, stopsOnRun, isStopRole, isTrackRole } from '../lib/transit/chain.js'

const W = (id, nodes, pts) => [id, { id, nodes, pts, tags: {} }]
const ways = new Map([
  W(1, [10, 11], [[0, 0], [100, 0]]),
  W(2, [12, 11], [[200, 0], [100, 0]]), // mapped against the direction of travel
  W(3, [12, 13], [[200, 0], [300, 0]]),
  W(4, [10, 14], [[0, 0], [-100, 0]]),
  W(5, [20, 21], [[0, 50], [30, 50]]), // 30 m: too short to be a run
])
const rel = (refs) => ({ members: refs.map((ref) => ({ type: 'way', ref, role: '' })) })
const maxStep = (run) => Math.max(...run.pts.slice(1).map((p, i) => Math.hypot(p[0] - run.pts[i][0], p[1] - run.pts[i][1])))

describe('chainRelation', () => {
  it('orders members into one continuous run, reversing ways mapped backwards', () => {
    const [r, ...rest] = chainRelation(rel([1, 2, 3]), ways)
    expect(rest).toHaveLength(0)
    expect(r.pts).toEqual([[0, 0], [100, 0], [200, 0], [300, 0]])
    expect(r.segWay).toEqual([1, 2, 3]); expect(r.wayIds).toEqual([1, 2, 3])
  })
  it('flips the first way when only its start touches the next member', () => {
    expect(chainRelation(rel([1, 4]), ways)[0].pts).toEqual([[100, 0], [0, 0], [-100, 0]])
  })
  it('a route that leaves and re-enters the world splits into runs — never a jump across the gap', () => {
    const runs = chainRelation(rel([1, 98, 97, 3]), ways) // 98 and 97 lie outside the bbox (no geometry)
    expect(runs).toHaveLength(2)
    for (const run of runs) expect(maxStep(run)).toBeLessThanOrEqual(100)
    expect(chainRelation(rel([1, 3]), ways)).toHaveLength(2) // present but not touching: still no bridge
  })
  it('drops runs shorter than 50 m and ignores non-track members', () => {
    expect(chainRelation(rel([5]), ways)).toEqual([])
    expect(chainRelation({ members: [{ type: 'way', ref: 1, role: 'platform' }, { type: 'node', ref: 7, role: 'stop' }] }, ways)).toEqual([])
    expect(isTrackRole('')).toBe(true); expect(isTrackRole('forward')).toBe(true); expect(isTrackRole('platform')).toBe(false)
    expect(isStopRole('stop_entry_only')).toBe(true); expect(isStopRole('platform')).toBe(false)
  })
})

describe('stopsOnRun', () => {
  it('projects stop nodes onto the run in travel order, dropping far ones', () => {
    const run = { pts: [[0, 0], [300, 0]] }
    const s = stopsOnRun(run, [{ id: 1, name: 'A', pt: [150, 10] }, { id: 2, name: 'B', pt: [50, -5] }, { id: 3, name: 'far', pt: [100, 90] }])
    expect(s.map((x) => [x.id, x.s])).toEqual([[2, 50], [1, 150]])
    expect(s[0].pt).toEqual([50, -5])
  })
})
