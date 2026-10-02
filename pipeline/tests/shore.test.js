// pipeline/tests/shore.test.js
import { describe, it, expect } from 'vitest'
import { bakeShore, SHORE } from '../lib/shore.js'
import { readFileSync } from 'node:fs'
import { shoreChains, sweepChains, profileAt } from '../lib/lakeLevel.js'

describe('shore distance texture (B6)', () => {
  const land = [{ outer: [[0, 0], [20, 0], [20, 40], [0, 40]], holes: [] }]
  const { grid, pixels } = bakeShore({ bounds: { minX: 0, minZ: 0, maxX: 400, maxZ: 40 }, land, water: [] })
  it('4 m cells over the band', () => {
    expect(SHORE).toEqual({ cell: 4, maxDist: 200 })
    expect(grid).toEqual({ minX: 0, minZ: 0, cell: 4, width: 100, height: 10 })
  })
  it('0 on land, grows with distance, saturates at 200 m', () => {
    expect(pixels[5 * 100 + 2]).toBe(0)
    expect(pixels[5 * 100 + 15]).toBe(Math.round((44 / 200) * 255)) // cell centre x=62, nearest land centre x=18
    expect(pixels[5 * 100 + 99]).toBe(255)
  })
  it('mapped water carves the land (harbours and lagoons get their own shore)', () => {
    const r = bakeShore({ bounds: { minX: 0, minZ: 0, maxX: 400, maxZ: 40 }, land, water: [{ outer: [[8, 0], [16, 0], [16, 40], [8, 40]], holes: [] }] })
    expect(r.pixels[5 * 100 + 2]).toBeGreaterThan(0)
  })
})

// D5-1: the lakefront's edges meet the lake with no gap — every land-facing metre is walled, and the swept profile is
// continuous round corners (each segment's faces share their corner vertices with the next segment's).
describe('D5-1: no gap along the shoreline', () => {
  const LAKE_Y = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels.LAKE_Y
  const spec = JSON.parse(readFileSync(new URL('../data/shore.json', import.meta.url), 'utf8'))
  const profiles = Object.fromEntries(Object.entries(spec.profiles).map(([k, v]) => [k, profileAt(v, LAKE_Y)]))
  // an island (Northerly Island's shape, simplified) in the lake: the lake polygon with a hole
  const island = [[0, 0], [300, 0], [340, 120], [300, 600], [60, 640], [0, 300]]
  const lake = { outer: [[-2000, -2000], [2000, -2000], [2000, 2000], [-2000, 2000]], holes: [island] }
  const { chains } = shoreChains({ lakeWater: [lake], within: { minX: -100, maxX: 500, minZ: -100, maxZ: 800 } })
  it('one closed revetment round the island, as long as its shore', () => {
    expect(chains).toHaveLength(1)
    expect(chains[0]).toMatchObject({ kind: 'revetment', closed: true })
    const per = island.reduce((t, p, i) => t + Math.hypot(island[(i + 1) % 6][0] - p[0], island[(i + 1) % 6][1] - p[1]), 0)
    const len = chains[0].pts.reduce((t, q, i) => (i ? t + Math.hypot(q.p[0] - chains[0].pts[i - 1].p[0], q.p[1] - chains[0].pts[i - 1].p[1]) : 0), 0)
    expect(len).toBeCloseTo(per, 3)
  })
  it('the top riser is a closed band: every vertex on the shoreline is shared by the faces either side of it', () => {
    const m = sweepChains(chains, profiles, LAKE_Y).limestone
    const key = (i) => `${m.positions[i].toFixed(3)},${m.positions[i + 1].toFixed(3)},${m.positions[i + 2].toFixed(3)}`
    const top = new Map()
    for (let i = 0; i < m.positions.length; i += 3) if (Math.abs(m.positions[i + 1] - 0.12) < 1e-6) top.set(key(i), (top.get(key(i)) ?? 0) + 1)
    expect(top.size).toBeGreaterThan(5)
    for (const n of top.values()) expect(n).toBeGreaterThanOrEqual(2) // no loose end: shared by two triangles at least
  })
})
