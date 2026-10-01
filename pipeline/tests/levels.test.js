import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FT, median, checkLevels, ccdToNavd88, waterRefsNavd88, summarizeSamples, sampleChecks, tubeCrossings, tubeDipChecks, lowerLevelZone, compactLowerWays } from '../lib/levels.js'
import { project } from '../../shared/project.js'

const data = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'))
const L = data.levels

describe('levels.json — D0-1 constants and invariants', () => {
  it('has every constant the plan names, as finite numbers', () => {
    for (const k of ['RIVER_Y', 'LAKE_Y', 'RIVERWALK_Y', 'LOWER_Y', 'LOWER2_Y', 'SLAB_M', 'CLEAR_M']) expect(Number.isFinite(L[k]), k).toBe(true)
  })
  it('passes the plan invariants (LOWER_Y − RIVER_Y ≥ 0.8; −SLAB_M − LOWER_Y ≥ 4.19; LAKE_Y − RIVER_Y ∈ [0, 1.7])', () => {
    expect(L.LOWER_Y - L.RIVER_Y).toBeGreaterThanOrEqual(0.8)
    expect(-L.SLAB_M - L.LOWER_Y).toBeGreaterThanOrEqual(4.19)
    expect(L.LAKE_Y - L.RIVER_Y).toBeGreaterThanOrEqual(0)
    expect(L.LAKE_Y - L.RIVER_Y).toBeLessThanOrEqual(1.7)
    expect(checkLevels(L)).toEqual([])
  })
  it('every constant cites at least one source that exists', () => {
    for (const [k, refs] of Object.entries(data.levelSources)) {
      expect(Object.keys(L), k).toContain(k)
      expect(refs.length, k).toBeGreaterThan(0)
      for (const r of refs) expect(data.sources[r], `${k} → ${r}`).toBeTruthy()
    }
    for (const k of Object.keys(L)) expect(data.levelSources[k], k).toBeTruthy()
    for (const s of Object.values(data.sources)) expect(s.url || s.ref, s.title).toMatch(/\S{8,}/)
  })
})

describe('checkLevels', () => {
  const ok = { RIVER_Y: -6.3, LAKE_Y: -4.65, RIVERWALK_Y: -5.3, LOWER_Y: -5.1, LOWER2_Y: -9.5, SLAB_M: 0.9, CLEAR_M: 4.19 }
  it('accepts a consistent stack', () => expect(checkLevels(ok)).toEqual([]))
  it('rejects a lower deck too close to the river', () => expect(checkLevels({ ...ok, LOWER_Y: -5.8 }).join()).toMatch(/LOWER_Y − RIVER_Y/))
  it('rejects too little headroom under the upper slab', () => expect(checkLevels({ ...ok, LOWER_Y: -4.8 }).join()).toMatch(/clearance/))
  it('rejects a lake below the river or a step over 1.7 m', () => {
    expect(checkLevels({ ...ok, LAKE_Y: -6.5 }).join()).toMatch(/LAKE_Y − RIVER_Y/)
    expect(checkLevels({ ...ok, LAKE_Y: -4.0 }).join()).toMatch(/LAKE_Y − RIVER_Y/)
  })
  it('rejects a Riverwalk under water and a third level above the second', () => {
    expect(checkLevels({ ...ok, RIVERWALK_Y: -6.4 }).join()).toMatch(/RIVERWALK_Y/)
    expect(checkLevels({ ...ok, LOWER2_Y: -7 }).join()).toMatch(/LOWER2_Y/)
  })
})

describe('datums', () => {
  it('Chicago City Datum ↔ NAVD88 offset is the calibrated one (≈ 579.3 ft)', () => {
    expect(data.datum.ccdZeroNavd88Ft).toBeGreaterThan(579.0)
    expect(data.datum.ccdZeroNavd88Ft).toBeLessThan(579.6)
    expect(ccdToNavd88(-2.0, data.datum)).toBeCloseTo(data.datum.ccdZeroNavd88Ft - 2.0, 6)
  })
  it('water references: river regulated −2.0 ft CCD, lake long-term mean above it by about the lock’s normal 2 ft lift', () => {
    const w = waterRefsNavd88(data)
    expect(w.river).toBeCloseTo(data.datum.ccdZeroNavd88Ft - 2.0, 6)
    expect(w.lake - w.river).toBeGreaterThan(1.0)
    expect(w.lake - w.river).toBeLessThan(3.0)
  })
  it('median and FT', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(FT).toBe(0.3048)
  })
})

describe('levels.json.samples — D0-2 LiDAR verification', () => {
  const S = data.samples
  it('has 40 sampled points of the kinds the plan lists, all inside the world, all with a 2017 1 m reading', () => {
    expect(S.length).toBe(40)
    expect(new Set(S.map((s) => s.id)).size).toBe(40)
    const kinds = new Set(S.map((s) => s.kind))
    for (const k of ['loopStreet', 'upperWacker', 'riverwalk', 'lowerEntrance', 'bridgeApproach', 'lakeStreet', 'lakeEdge']) expect(kinds, k).toContain(k)
    for (const s of S) {
      expect(s.lat, s.id).toBeGreaterThan(41.826); expect(s.lat, s.id).toBeLessThan(41.952)
      expect(s.lon, s.id).toBeGreaterThan(-87.695); expect(s.lon, s.id).toBeLessThan(-87.595)
      expect(s.ftNavd88, s.id).toBeGreaterThan(570); expect(s.ftNavd88, s.id).toBeLessThan(640)
      expect(s.date, s.id).toMatch(/2017/)
    }
  })
  it('summarizeSamples turns readings into metres below the reference streets', () => {
    const fake = [
      { kind: 'upperWacker', ftNavd88: 600 }, { kind: 'upperWacker', ftNavd88: 602 },
      { kind: 'riverwalk', ftNavd88: 581 }, { kind: 'lakeStreet', ftNavd88: 594 }, { kind: 'lakeEdge', ftNavd88: 587 }, { kind: 'loopStreet', ftNavd88: 593.6 },
    ]
    const s = summarizeSamples(fake, { river: 578, lake: 580 })
    expect(s.riverDropM).toBeCloseTo((601 - 578) * FT, 6)
    expect(s.riverwalkDropM).toBeCloseTo((601 - 581) * FT, 6)
    expect(s.lakeDropM).toBeCloseTo((594 - 580) * FT, 6)
    expect(s.lakeEdgeAboveWaterM).toBeCloseTo((587 - 580) * FT, 6)
  })
  it('the model values are within ±0.7 m of the LiDAR medians (D0-2 done-when)', () => {
    const r = sampleChecks(data)
    expect(r.failures).toEqual([])
    expect(Math.abs(-L.RIVER_Y - r.summary.riverDropM)).toBeLessThanOrEqual(0.7)
    expect(Math.abs(-L.LAKE_Y - r.summary.lakeDropM)).toBeLessThanOrEqual(0.7)
    expect(Math.abs(-L.RIVERWALK_Y - r.summary.riverwalkDropM)).toBeLessThanOrEqual(0.7)
    expect(Math.abs(-L.LOWER_Y - r.summary.lowerDropM)).toBeLessThanOrEqual(0.7)
  })
  it('the stored summary matches what the samples give', () => {
    const r = sampleChecks(data)
    for (const k of ['riverDropM', 'riverwalkDropM', 'lakeDropM', 'lakeEdgeAboveWaterM', 'loopStreetFt', 'upperWackerFt', 'lowerDropM']) expect(data.sampleSummary[k], k).toBeCloseTo(r.summary[k], 2)
  })
})

describe('tubeCrossings', () => {
  const sq = (cx, cz, h) => [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]]
  it('finds where a tube polyline crosses a river polygon and a lower road', () => {
    const tubes = [{ id: 1, name: 'T', points: [[0, -100], [0, 100]] }]
    const rivers = [{ id: 'r', outer: sq(0, 0, 20), holes: [] }]
    const lowers = [{ id: 9, name: 'Lower X', layer: -1, points: [[-50, 60], [50, 60]] }]
    const c = tubeCrossings({ tubes, rivers, lowers })
    const river = c.find((x) => x.kind === 'river')
    expect(river.tube).toBe('T'); expect(river.lengthM).toBeCloseTo(40, 6); expect(river.at[1]).toBeCloseTo(0, 6)
    const low = c.find((x) => x.kind === 'lower')
    expect(low.road).toBe('Lower X'); expect(low.at[0]).toBeCloseTo(0, 6); expect(low.at[1]).toBeCloseTo(60, 6)
  })
  it('ignores a tube that misses everything', () => {
    expect(tubeCrossings({ tubes: [{ id: 1, name: 'T', points: [[100, 0], [200, 0]] }], rivers: [{ id: 'r', outer: sq(0, 0, 20), holes: [] }], lowers: [] })).toEqual([])
  })
})

describe('levels.json.tubeDips — D0-3', () => {
  it('lists every river crossing (Red/State, Blue/Lake St, Blue/Congress) and the lower-street crossings, each with a source or "approximate"', () => {
    const d = data.tubeDips
    for (const k of ['red-state-main', 'blue-lake-south', 'blue-congress-south']) expect(d.crossings.map((c) => c.key), k).toContain(k)
    expect(d.crossings.filter((c) => c.kind === 'lower').length).toBeGreaterThanOrEqual(2)
    for (const c of d.crossings) {
      expect(c.source === 'approximate' || !!data.sources[c.source], c.key).toBe(true)
      expect(Number.isFinite(c.railY), c.key).toBe(true)
      const [x, z] = project(c.at.lon, c.at.lat)
      expect(Math.hypot(x, z), c.key).toBeLessThan(6000)
    }
  })
  it('every dip clears the river and the lower decks (tube ceiling < RIVER_Y − 1 under water, < LOWER2_Y − 1 under decks)', () => {
    expect(tubeDipChecks(data)).toEqual([])
  })
  it('tubeDipChecks flags a shallow dip', () => {
    const bad = { ...data, tubeDips: { ...data.tubeDips, crossings: [{ key: 'x', kind: 'river', railY: -9, at: { lat: 41.88, lon: -87.63 }, source: 'approximate' }] } }
    expect(tubeDipChecks(bad).join()).toMatch(/x/)
  })
})

describe('lower-level helpers for the D0-4 ledger', () => {
  it('lowerLevelZone keeps downtown multi-level streets and drops rail underpasses elsewhere', () => {
    const at = (lat, lon) => [{ lat, lon }, { lat: lat + 0.0005, lon }]
    expect(lowerLevelZone({ tags: { highway: 'trunk', layer: '-1', tunnel: 'covered', name: 'East Lower Wacker Drive' }, geometry: at(41.887, -87.625) })).toBe(true)
    expect(lowerLevelZone({ tags: { highway: 'residential', layer: '-1', tunnel: 'yes', name: 'South Laflin Street' }, geometry: at(41.84, -87.66) })).toBe(false)
    expect(lowerLevelZone({ tags: { highway: 'footway', layer: '-1' }, geometry: at(41.887, -87.625) })).toBe(false)
  })
  it('compactLowerWays rounds to 0.1 m and keeps level and width', () => {
    const out = compactLowerWays([{ id: 1, tags: { highway: 'trunk', layer: '-2', name: 'Lower Lower X', lanes: '4' }, geometry: [{ lat: 41.88203, lon: -87.62784 }, { lat: 41.883, lon: -87.62784 }] }])
    expect(out[0].l).toBe(-2)
    expect(out[0].p[0]).toEqual([0, 0])
    expect(out[0].w).toBeGreaterThan(6)
    for (const v of out[0].p.flat()) expect(Math.round(v * 10) / 10).toBe(v)
  })
})
