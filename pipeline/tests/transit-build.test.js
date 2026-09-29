import { describe, it, expect, vi } from 'vitest'
import { unproject } from '../../shared/project.js'
import { loadCatalog } from '../lib/transit/lines.js'
import { buildTransit, gradeRuns } from '../build/build-transit.js'
import { transitStats, validateTransit, assertTransit } from '../lib/transit/validate.js'

const ll = (x, z) => { const [lon, lat] = unproject(x, z); return { lon, lat } }
const catalog = loadCatalog()

describe('validateTransit', () => {
  const cat = {
    lines: [
      { id: 'red', operator: 'cta', expect: { inBounds: true, minSegments: 6, minKm: 6, maxKm: 90 } },
      { id: 'up-n', operator: 'metra', expect: { inBounds: true, minSegments: 2, minKm: 2, maxKm: 70 } },
      { id: 'yellow', operator: 'cta', expect: { inBounds: false } },
    ],
    requiredStations: ['clark\\s*/\\s*lake'],
  }
  it('passes a healthy build; a thin Metra line only warns', () => {
    const v = validateTransit({ red: { segments: 20, km: 30 }, 'up-n': { segments: 1, km: 3 } }, cat, [{ name: 'Clark/Lake' }])
    expect(v.errors).toEqual([]); expect(v.warnings).toEqual(['up-n: 1 segments < 2'])
  })
  it('a thin CTA line, a missing station and an unexpected line are reported', () => {
    const v = validateTransit({ red: { segments: 3, km: 2 }, yellow: { segments: 2, km: 1 } }, cat, [])
    expect(v.errors).toEqual(['red: 3 segments < 6', 'station missing: /clark\\s*/\\s*lake/'])
    expect(v.warnings).toEqual(['up-n: 0 segments < 2', 'yellow: expected outside the world but found 2 segments'])
    const log = { warn: vi.fn() }
    expect(() => assertTransit(v, log)).toThrow(/transit validation failed/); expect(log.warn).toHaveBeenCalledTimes(2)
    expect(transitStats([{ lines: ['red', 'blue'], pts2: [[0, 0], [300, 400]] }, { lines: ['red'], pts2: [[0, 0], [0, 1000]] }])).toEqual({ red: { segments: 2, km: 1.5 }, blue: { segments: 1, km: 0.5 } })
  })
})

describe('buildTransit', () => {
  // A Red Line run north along x = 100 (clear of tile edges): 400 m of elevated, then 800 m of subway; a stop and its station on the elevated part.
  const routeEls = [
    { type: 'way', id: 1, nodes: [101, 102], geometry: [ll(100, 0), ll(100, -400)], tags: { railway: 'subway', bridge: 'yes', layer: '2' } },
    { type: 'way', id: 2, nodes: [102, 103], geometry: [ll(100, -400), ll(100, -1200)], tags: { railway: 'subway', tunnel: 'yes', layer: '-2' } },
    { type: 'node', id: 200, ...ll(100, -200), tags: { public_transport: 'stop_position', name: 'Test/Lake' } },
    { type: 'relation', id: 10, tags: { type: 'route', route: 'subway', network: 'CTA', ref: 'Red', name: 'CTA Red Line', to: '95th/Dan Ryan' },
      members: [{ type: 'way', ref: 1, role: '' }, { type: 'way', ref: 2, role: '' }, { type: 'node', ref: 200, role: 'stop' }] },
    { type: 'relation', id: 11, tags: { type: 'route', route: 'train', network: 'Amtrak' }, members: [{ type: 'way', ref: 1, role: '' }] },
  ]
  const stationEls = [{ type: 'node', id: 300, ...ll(103, -200), tags: { railway: 'station', name: 'Test/Lake', network: 'CTA' } }]
  const added = []
  const out = buildTransit({ routeEls, stationEls, catalog, styles: { add: (k) => { added.push(k); return added.length } } })

  it('lines carry official colours and their catalog index; routes are graded and height-profiled', () => {
    expect(out.json.lines).toHaveLength(1)
    expect(out.json.lines[0]).toMatchObject({ id: 'red', colour: '#c60c30', index: 0, operator: 'cta' })
    expect(out.json.lines[0].expect).toBeUndefined()
    const [r] = out.json.routes
    expect(r).toMatchObject({ id: 'red-10-0', line: 'red', to: '95th/Dan Ryan' })
    expect(r.path[0][1]).toBe(7.2); expect(r.path.at(-1)[1]).toBe(-9)
    expect(r.stops).toEqual([{ station: 'st-n300', name: 'Test/Lake', s: 200 }])
  })
  it('the station sits on the elevated deck; only CTA/Metra ways are claimed', () => {
    expect(out.json.stations).toEqual([expect.objectContaining({ id: 'st-n300', lines: ['red'], grade: 'elevated', y: 8.27, operator: 'cta' })])
    expect([...out.wayIds].sort()).toEqual([1, 2])
    expect(out.stats.red.segments).toBe(2); expect(out.stats.red.km).toBeCloseTo(1.2, 2)
    expect(added).toEqual(['station-cta', 'station-metra'])
  })
  it('tiles: structure, ties and stations on the elevated tile; only ghosted glow deep in the subway', () => {
    const t0 = out.tiles.get('0_-1'), t2 = out.tiles.get('0_-3')
    expect(t0.transit.positions.length).toBeGreaterThan(0); expect(t0.ties.positions.length).toBeGreaterThan(0)
    expect(t0.stations.positions.length).toBeGreaterThan(0); expect(t0.glow.positions.length).toBeGreaterThan(0)
    expect(out.tiles.get('0_-2').transit.positions.length).toBeGreaterThan(0) // the portal
    expect(t2.transit.positions).toHaveLength(0)
    expect(new Set(t2.glow.extra.GHOST)).toEqual(new Set([1]))
    expect([...out.tiles.values()].some((t) => t.glowLod.positions.length > 0)).toBe(true)
  })
  it('gradeRuns splits a piece where the grade changes', () => {
    const runs = gradeRuns({ pts3: [[0, 7, 0], [1, 7, 0], [2, 3, 0], [3, 0, 0]], grades: ['elevated', 'elevated', 'subway'] })
    expect(runs.map((r) => [r.grade, r.pts3.length])).toEqual([['elevated', 3], ['subway', 2]])
  })
  it('V4: lines carry their sourced service; services, periods and rolling stock ride along', () => {
    expect(out.json.lines[0].service).toMatchObject({ stock: 'cta5000', cars: { peak: 8, offpeak: 8 }, headwayMin: { peak: 5, midday: 7, evening: 10, night: 15, weekend: 8 } })
    expect(out.json.servicePeriods.weekday[1]).toEqual(['peak', 5, 9.5])
    expect(out.json.rollingStock.cta5000.length).toBe(14.63)
    expect(out.json.services).toEqual([{ id: 'svc-red-10-0', line: 'red', routes: ['red-10-0'], inbound: false }])
  })
})
