// app/src/transit/__tests__/liveTrains.test.js — live CTA reports snapped onto the track, forward-only (P5 Task 2).
import { describe, it, expect } from 'vitest'
import { snapToTrack, createLiveTracker, servicePaths } from '../liveTrains.js'

// Flat-earth test projection: 1e-5° ≈ 1 m
const project = (lon, lat) => [lon * 1e5, -lat * 1e5]
const unproj = (x, z) => ({ lon: x / 1e5, lat: -z / 1e5 })
const paths = [
  { id: 'red-n', lineId: 'red', points: [[0, 0], [0, -5000]] },   // northbound: bearing 0°
  { id: 'red-s', lineId: 'red', points: [[8, -5000], [8, 0]] },   // southbound: bearing 180°
  { id: 'blue-0', lineId: 'blue', points: [[-3000, 0], [-3000, -5000]] },
]
const at = (x, z, heading, lineId = 'red') => ({ ...unproj(x, z), heading, lineId })

describe('snapToTrack', () => {
  it('snaps onto the path matching the heading, with arc length', () => {
    const n = snapToTrack(at(3, -1000, 2), paths, project); expect(n.pathId).toBe('red-n'); expect(n.s).toBeCloseTo(1000, 0)
    const s = snapToTrack(at(5, -1000, 181), paths, project); expect(s.pathId).toBe('red-s'); expect(s.s).toBeCloseTo(4000, 0)
  })
  it('rejects reports more than 60 m from any path of the line', () => {
    expect(snapToTrack(at(200, -1000, 0), paths, project)).toBeNull()
  })
  it('never snaps a Red train onto the Blue line', () => {
    expect(snapToTrack(at(-3000, -1000, 0), paths, project)).toBeNull()
  })
  it('heading 0 or NaN falls back to the nearest path', () => {
    expect(snapToTrack(at(7, -1000, NaN), paths, project).pathId).toBe('red-s')
    expect(snapToTrack(at(7, -1000, 0), paths, project).pathId).toBe('red-s')
  })
})

describe('live tracker', () => {
  const trains = (z, rn = '801', heading = 0) => [{ rn, ...unproj(0, z), heading, line: 'Red', nextStation: 'Belmont' }]
  it('interpolates forward between polls at the estimated speed', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest(trains(-1000), 0); t.ingest(trains(-1300), 30_000)
    const mid = t.trainsAt(45_000)[0]
    expect(mid.speed).toBeCloseTo(10, 1); expect(mid.s).toBeCloseTo(1450, 0); expect(mid.lineId).toBe('red')
    expect(mid).toMatchObject({ id: 'rn:801', live: true, nextStation: 'Belmont' })
  })
  it('never moves backwards on a small negative GPS jitter', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest(trains(-1000), 0); t.ingest(trains(-990), 30_000)
    expect(t.trainsAt(40_000)[0].s).toBeGreaterThanOrEqual(1000 - 1e-6)
  })
  it('teleports on a jump over 1,500 m instead of sweeping', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest(trains(-500), 0); t.ingest(trains(-3500), 30_000)
    expect(t.trainsAt(30_000)[0].s).toBeCloseTo(3500, 0); expect(t.trainsAt(30_000)[0].speed).toBe(0)
  })
  it('drops trains unseen for 90 s', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest(trains(-1000), 0); expect(t.trainsAt(91_000)).toHaveLength(0)
  })
  it('caps the guess at 45 s of travel past the last report (a laptop waking from sleep)', () => {
    const t = createLiveTracker({ paths, project, staleMs: 10 * 60_000 })
    t.ingest(trains(-1000), 0); t.ingest(trains(-1300), 30_000)
    expect(t.trainsAt(30_000 + 300_000)[0].s).toBeCloseTo(1300 + 10 * 45, 0)
  })
  it('ignores reports for unknown lines and malformed rows', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest([{ rn: '1', lat: 'x', lon: null, line: 'Red' }, { rn: '2', ...unproj(0, -100), heading: 0, line: 'Nope' }, null], 0)
    expect(t.size()).toBe(0)
  })
})

describe('servicePaths', () => {
  it('turns V4 services into snap paths (x, z) keyed by service and line', () => {
    const sim = { services: [{ id: 'svc-red-0', line: 'red', path: { pts: [[0, 5, 0], [0, 5, -100]] } }] }
    expect(servicePaths(sim)).toEqual([{ id: 'svc-red-0', lineId: 'red', points: [[0, 0], [0, -100]] }])
  })
})
