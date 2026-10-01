// pipeline/tests/lowerLevels.test.js — D2-1: the multi-level streets as compact centrelines (lower-levels.json).
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { isLowerWay, levelOf, buildLowerLevels, RAMP_GRADE, MOUTH_Y, MAX_BYTES, streetsIn } from '../lib/lowerLevels.js'
import { project } from '../../shared/project.js'

const levels = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'))
const L = levels.levels, CLEAR = levels.tubeDips.tunnelClearM

// a little street network inside the downtown zone: lat steps of 0.0009° ≈ 100 m north–south along one avenue
const LON = -87.625, lat = (k) => 41.885 + k * 0.0009
const way = (id, nodes, tags) => ({ type: 'way', id, nodes, tags, geometry: nodes.map((n) => ({ lat: lat(n), lon: LON })) })
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const P = (k) => project(LON, lat(k))

describe('which ways are lower streets', () => {
  it('layer < 0 or "Lower …" inside the zone; not passages, bascules, footways or the South Side underpasses', () => {
    expect(isLowerWay(way(1, [0, 1], { highway: 'trunk', layer: '-1', tunnel: 'covered' }))).toBe(true)
    expect(isLowerWay(way(2, [0, 1], { highway: 'tertiary', name: 'North Lower Michigan Avenue', tunnel: 'yes', layer: '0' }))).toBe(true)
    expect(isLowerWay(way(3, [0, 1], { highway: 'secondary', layer: '-1', tunnel: 'building_passage' }))).toBe(false)
    expect(isLowerWay(way(4, [0, 1], { highway: 'tertiary', name: 'North Lower Michigan Avenue', bridge: 'movable', layer: '1' }))).toBe(false)
    expect(isLowerWay(way(5, [0, 1], { highway: 'footway', layer: '-1' }))).toBe(false)
    expect(isLowerWay({ ...way(6, [0, 1], { highway: 'primary', layer: '-1' }), geometry: [{ lat: 41.80, lon: -87.63 }, { lat: 41.801, lon: -87.63 }] })).toBe(false)
  })
  it('levels: layer −1 → 1, deeper → 2; "Lower Lower" → 2; an absolute level tag wins over the relative layer', () => {
    expect(levelOf({ layer: '-1' })).toBe(1)
    expect(levelOf({ layer: '-3' })).toBe(2)
    expect(levelOf({ layer: '-2', level: '-1', name: 'East Randolph Drive' })).toBe(1)
    expect(levelOf({ layer: '-2', name: 'Lower Lower East Randolph Street' })).toBe(2)
    expect(levelOf({ layer: '0', tunnel: 'yes', name: 'North Lower Michigan Avenue' })).toBe(1)
  })
})

describe('ramps and levels along the network', () => {
  // street 0–1 · ramp 1–3 (200 m, layer −1) · Lower 3–5 · a level-2 way 5–7 · a dead-end service lane 5–6′
  const roads = [
    way(10, [0, 1], { highway: 'secondary', name: 'Upper Street' }),
    way(11, [1, 2, 3], { highway: 'secondary', layer: '-1', tunnel: 'yes' }),
    way(12, [3, 4, 5], { highway: 'trunk', layer: '-1', tunnel: 'covered', name: 'East Lower Wacker Drive', lanes: '3' }),
    way(13, [5, 6, 7], { highway: 'service', layer: '-2', tunnel: 'yes', name: 'Lower Lower Test Drive' }),
  ]
  const out = buildLowerLevels({ roads, levels: L })
  const byId = (id) => out.ways.find((w) => w.id === id)
  it('a ramp starts on the street and falls at the ramp grade to LOWER_Y, with the knee as its own point', () => {
    const r = byId(11)
    expect(r.p[0][2]).toBeCloseTo(MOUTH_Y, 1)
    const knee = r.p.find((p) => Math.abs(p[2] - L.LOWER_Y) < 0.05)
    expect(dist(knee, P(1))).toBeCloseTo((MOUTH_Y - L.LOWER_Y) / RAMP_GRADE, 0)
    for (let i = 1; i < r.p.length; i++) expect(Math.abs(r.p[i][2] - r.p[i - 1][2]) / dist(r.p[i], r.p[i - 1])).toBeLessThanOrEqual(RAMP_GRADE + 0.01)
    expect(r.p.at(-1)[2]).toBeCloseTo(L.LOWER_Y)
  })
  it('the Lower Wacker level stays at LOWER_Y; its width comes from the lanes', () => {
    const w = byId(12)
    expect(w.lv).toBe(1)
    expect(w.p.every((p) => Math.abs(p[2] - L.LOWER_Y) < 0.05)).toBe(true)
    expect(w.w).toBeCloseTo(9.9)
  })
  it('the third level climbs to the level above where it joins it, then runs at LOWER2_Y', () => {
    const w = byId(13)
    expect(w.lv).toBe(2)
    expect(w.p[0][2]).toBeCloseTo(L.LOWER_Y, 1)
    expect(w.p.at(-1)[2]).toBeCloseTo(L.LOWER2_Y, 1)
  })
  it('a lower bascule deck (Lower Michigan across DuSable) is not a ramp: the lower street stays level up to it', () => {
    const r2 = [way(20, [0, 1], { highway: 'tertiary', name: 'North Lower Michigan Avenue', bridge: 'movable', layer: '1' }), way(21, [1, 2], { highway: 'tertiary', name: 'North Lower Michigan Avenue', tunnel: 'yes', layer: '0' })]
    const o = buildLowerLevels({ roads: r2, levels: L })
    expect(o.ways).toHaveLength(1)
    expect(o.ways[0].p.every((p) => Math.abs(p[2] - L.LOWER_Y) < 0.05)).toBe(true)
  })
  it('a short side ramp never lifts the main roadway: the junction stays on its level and the ramp meets it there', () => {
    // main Lower Wacker 30–33 (300 m, layer −1); a 20 m ramp from the street (way 41, node 40) joins it at node 31
    const at = (k, dLon = 0) => ({ lat: lat(k), lon: LON + dLon })
    const r3 = [
      { type: 'way', id: 30, nodes: [30, 31, 32, 33], tags: { highway: 'trunk', layer: '-1', name: 'East Lower Wacker Drive' }, geometry: [at(0), at(1), at(2), at(3)] },
      { type: 'way', id: 41, nodes: [40, 31], tags: { highway: 'service', layer: '-1' }, geometry: [at(1, 0.00024), at(1)] }, // ≈ 20 m
      { type: 'way', id: 42, nodes: [40, 43], tags: { highway: 'secondary', name: 'Upper' }, geometry: [at(1, 0.00024), at(1, 0.001)] },
    ]
    const o = buildLowerLevels({ roads: r3, levels: L })
    const main = o.ways.find((w) => w.id === 30), ramp = o.ways.find((w) => w.id === 41)
    expect(main.p.every((p) => Math.abs(p[2] - L.LOWER_Y) < 0.05)).toBe(true)
    expect(ramp.p[0][2]).toBeCloseTo(MOUTH_Y, 1)
    expect(ramp.p.at(-1)[2]).toBeCloseTo(L.LOWER_Y, 1)
  })
  it('no deck over open water, and the output is deterministic', () => {
    const mid = P(4), water = [[[mid[0] - 50, mid[1] - 20], [mid[0] + 50, mid[1] - 20], [mid[0] + 50, mid[1] + 20], [mid[0] - 50, mid[1] + 20]]]
    const o = buildLowerLevels({ roads, levels: L, water })
    expect(o.ways.filter((w) => w.id === 12).flatMap((w) => w.p).some((p) => Math.abs(p[1] - mid[1]) < 19 && Math.abs(p[0] - mid[0]) < 49)).toBe(false)
    expect(JSON.stringify(buildLowerLevels({ roads: [...roads].reverse(), levels: L }))).toBe(JSON.stringify(out))
  })
})

// The built world (D2-1 done-when): the shipped file has the famous lower streets, at their levels, inside its budget,
// and no subway tube runs up into a lower deck.
const lowerFile = new URL('../../app/public/world/lower-levels.json', import.meta.url)
const transitFile = new URL('../../app/public/world/transit.json', import.meta.url)
const built = existsSync(lowerFile) ? { raw: readFileSync(lowerFile, 'utf8') } : null
describe.skipIf(!built)('the built world: lower-levels.json', () => {
  const j = built && JSON.parse(built.raw)
  const named = (re, lv) => j.ways.filter((w) => re.test(w.n ?? '') && w.lv === lv)
  it('has Lower Wacker, Lower Michigan, Lower Columbus and Lower Lower Randolph, each on its level', () => {
    expect(named(/Lower Wacker Drive/, 1).length).toBeGreaterThanOrEqual(25)
    expect(named(/Lower Michigan/, 1).length).toBeGreaterThanOrEqual(4)
    expect(named(/Columbus/, 1).length).toBeGreaterThanOrEqual(10)
    expect(named(/Lower Lower East Randolph/, 2).length).toBeGreaterThanOrEqual(2)
    expect(streetsIn(j).length).toBeGreaterThan(40)
  })
  it(`is at most ${MAX_BYTES / 1000} KB`, () => {
    expect(built.raw.length).toBeLessThanOrEqual(MAX_BYTES)
  })
  it('every point sits between the street and its level; level runs are at their level', () => {
    for (const w of j.ways) for (const p of w.p) {
      expect(p[2]).toBeLessThanOrEqual(MOUTH_Y + 0.05)
      expect(p[2]).toBeGreaterThanOrEqual(j.y[w.lv] - 0.05)
    }
    const flat = j.ways.flatMap((w) => w.p.filter((p) => Math.abs(p[2] - j.y[w.lv]) < 0.05))
    expect(flat.length / j.ways.flatMap((w) => w.p).length).toBeGreaterThan(0.6)
  })
  it.skipIf(!existsSync(transitFile))('no subway tube ceiling comes within 1 m of the underside of a lower deck above it', () => {
    const t = JSON.parse(readFileSync(transitFile, 'utf8'))
    const segs = j.ways.flatMap((w) => w.p.slice(1).map((b, i) => ({ a: w.p[i], b, half: w.w / 2 + 1 })))
    let near = 0
    for (const r of t.routes) for (const [x, y, z] of r.path) {
      if (y > -4) continue // at grade or on the L
      for (const s of segs) {
        const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l2 = dx * dx + dz * dz || 1
        const u = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2))
        if (Math.hypot(x - s.a[0] - u * dx, z - s.a[1] - u * dz) > s.half) continue
        near++
        const deckY = s.a[2] + u * (s.b[2] - s.a[2])
        expect(y + CLEAR, `${r.id} under ${x.toFixed(0)},${z.toFixed(0)}`).toBeLessThan(deckY - L.SLAB_M - 1)
      }
    }
    expect(near).toBeGreaterThan(0) // State and Dearborn and the Blue Line pass under Lower Wacker
  })
})
