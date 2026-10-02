// pipeline/tests/harbours.test.js — B-8: the harbours' floating docks, slips and moorings, and the boats in them.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { layoutHarbour, layoutHarbours, boatsJson, BOAT_LENGTH_M } from '../lib/harbours.js'
import { inPoly } from '../lib/riverLevel.js'
import { bearing } from '../lib/meshkit.js'

const cfg = JSON.parse(readFileSync(new URL('../data/harbours.json', import.meta.url), 'utf8'))
const LAKE_Y = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels.LAKE_Y
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const poly = { outer: rect(0, 0, 600, 250), holes: [] }
const H = (layout, extra = {}) => ({ key: `t-${layout}`, name: 'Test Harbor', layout, sail: 0.5, maxBoats: 400, dockShare: 0.5, ...extra })

describe('harbour docks (B-8)', () => {
  const r = layoutHarbour(poly, H('docks'), cfg, { lakeY: LAKE_Y })
  const ys = r.meshes.find((m) => m.part === 'harbour-docks').positions.filter((_, i) => i % 3 === 1)
  it('float on the lake: the deck stands `freeboard` over LAKE_Y', () => {
    expect(Math.max(...ys)).toBeCloseTo(LAKE_Y + cfg.dock.freeboard, 6)
    expect(Math.min(...ys)).toBeGreaterThan(LAKE_Y - 0.2)
  })
  it('stay inside the harbour, clear of its walls, with guide piles down into the water', () => {
    for (const part of ['harbour-docks', 'harbour-fingers']) { const d = r.meshes.find((m) => m.part === part).positions; for (let i = 0; i < d.length; i += 3) expect(inPoly([d[i], d[i + 2]], poly)).toBe(true) }
    expect(r.meshes.find((m) => m.part === 'harbour-fingers').lod0Only).toBe(true) // the fingers and piles only close by
    expect(r.meshes.find((m) => m.part === 'harbour-docks').lod0Only).toBe(false)
    const p = r.meshes.find((m) => m.part === 'harbour-piles').positions.filter((_, i) => i % 3 === 1)
    expect(Math.min(...p)).toBeLessThan(LAKE_Y)
  })
  it('fill their slips with boats that never overlap and lie inside the harbour', () => {
    expect(r.boats.length).toBeGreaterThan(40)
    for (const b of r.boats) expect(inPoly([b.x, b.z], poly)).toBe(true)
    for (let i = 0; i < r.boats.length; i++) for (let j = i + 1; j < r.boats.length; j++) expect(Math.hypot(r.boats[i].x - r.boats[j].x, r.boats[i].z - r.boats[j].z)).toBeGreaterThan(3.5)
  })
  it('is the same every build (deterministic)', () => {
    expect(layoutHarbour(poly, H('docks'), cfg, { lakeY: LAKE_Y }).boats).toEqual(r.boats)
  })
})

describe('mooring fields', () => {
  const r = layoutHarbour(poly, H('moorings'), cfg, { lakeY: LAKE_Y })
  it('every moored boat points into the wind (within the jitter)', () => {
    expect(r.boats.length).toBeGreaterThan(20)
    const w = bearing(cfg.mooring.windBearingDeg), want = Math.atan2(-w[1], w[0])
    for (const b of r.boats) {
      let d = Math.abs(b.yaw - want) % (2 * Math.PI)
      if (d > Math.PI) d = 2 * Math.PI - d
      expect(d).toBeLessThanOrEqual((cfg.mooring.jitterDeg * Math.PI) / 180 + 1e-9)
    }
    expect(r.meshes.length).toBe(0) // no docks in a mooring field
  })
  it('caps the boats at maxBoats; a mixed harbour has docks and moorings', () => {
    expect(layoutHarbour(poly, H('moorings', { maxBoats: 10 }), cfg, { lakeY: LAKE_Y }).boats.length).toBeLessThanOrEqual(14)
    const m = layoutHarbour(poly, H('mixed'), cfg, { lakeY: LAKE_Y })
    expect(m.boats.some((b) => b.mooring)).toBe(true); expect(m.boats.some((b) => !b.mooring)).toBe(true)
  })
})

describe('the data and the app file', () => {
  it('data/harbours.json: Belmont and Diversey (B21, B23) and the other in-bounds harbours, sourced', () => {
    for (const k of ['belmont', 'diversey', 'dusable', 'monroe']) expect(cfg.harbours.find((h) => h.key === k)).toBeTruthy()
    for (const h of cfg.harbours) expect(h.source).toMatch(/^https:\/\//)
  })
  it('boats.json packs seven numbers per boat and the recolour palette', () => {
    const hs = layoutHarbours(cfg, (id) => (id === 17766386 ? [{ ...poly, bbox: { minX: 0, maxX: 600, minZ: 0, maxZ: 250 } }] : []), { lakeY: LAKE_Y })
    expect(hs.map((h) => h.key)).toEqual(['belmont'])
    const j = boatsJson(hs, cfg, { lakeY: LAKE_Y, model: 'boats.glb' })
    expect(j.boats.length).toBe(hs[0].boats.length * 7)
    expect(j.lengthM).toBe(BOAT_LENGTH_M); expect(j.palette.hull.length).toBeGreaterThan(3)
    expect(j.y).toBe(LAKE_Y)
  })
})
