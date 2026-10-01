// pipeline/tests/tubeDips.test.js — D1-5: the subway tubes dive under the sunken river, in the same change that sinks it.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dipProfile, AT_GRADE_Y, SUBWAY_Y, RAMP_SLOPE } from '../lib/transit/grade.js'
import { tubeDipTarget, sunkWater, inPoly } from '../lib/riverLevel.js'

const levels = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'))
const L = levels.levels, CLEAR = levels.tubeDips.tunnelClearM

describe('dipProfile', () => {
  const line = Array.from({ length: 101 }, (_, i) => [i * 10, 0]) // 1 km of subway, a vertex every 10 m
  const flat = line.map(() => SUBWAY_Y)
  const slopeOk = (y) => y.every((v, i) => i === 0 || Math.abs(v - y[i - 1]) <= RAMP_SLOPE * 10 + 1e-6)
  const river = (p) => (p[0] >= 480 && p[0] <= 540 ? -21.3 : Infinity)
  it('reaches the crossing’s depth under the water and ramps at 4 % either side', () => {
    const y = dipProfile(line, flat, { target: river, fixed: () => false })
    expect(y[50]).toBe(-21.3); expect(y[54]).toBe(-21.3)
    expect(y[0]).toBe(SUBWAY_Y); expect(y[100]).toBe(SUBWAY_Y)
    expect(slopeOk(y)).toBe(true)
    expect(Math.max(...y)).toBe(SUBWAY_Y)
  })
  it('a station keeps its platforms level; the dip is as deep as the 4 % ramp from the platform end allows', () => {
    const y = dipProfile(line, flat, { target: river, fixed: (p) => p[0] >= 250 && p[0] <= 400 })
    for (let i = 25; i <= 40; i++) expect(y[i]).toBe(SUBWAY_Y)
    expect(y[48]).toBeCloseTo(SUBWAY_Y - RAMP_SLOPE * 80, 2)
    expect(y[53]).toBeCloseTo(SUBWAY_Y - RAMP_SLOPE * 130, 2) // 130 m from the platform end: not yet the full −21.3
    expect(slopeOk(y)).toBe(true)
  })
  it('never touches track above the tubes (portal ramps, at grade, the L)', () => {
    const ys = line.map((_, i) => (i < 30 ? AT_GRADE_Y : SUBWAY_Y))
    const y = dipProfile(line, ys, { target: () => -30, fixed: () => false })
    for (let i = 0; i < 30; i++) expect(y[i]).toBe(AT_GRADE_Y)
    expect(y[30]).toBe(SUBWAY_Y)
    expect(y[31]).toBe(SUBWAY_Y) // the line falls away from the portal's own level at 4 % before it may dip
    expect(y[60]).toBeLessThan(SUBWAY_Y)
  })
  it('no target anywhere: the profile is unchanged', () => {
    expect(dipProfile(line, flat, { target: () => Infinity, fixed: () => false })).toEqual(flat)
  })
})

describe('tubeDipTarget', () => {
  const water = sunkWater([{ outer: [[0, 0], [400, 0], [400, 60], [0, 60]], holes: [], tags: { natural: 'water', water: 'river' } }])
  const t = tubeDipTarget({ water, riverY: L.RIVER_Y, crossings: [{ kind: 'river', x: 100, z: 30, railY: -21.3 }, { kind: 'lower', x: 100, z: 200, railY: -18.5, layer: -1 }] })
  it('under the water and its walls: the nearest crossing’s depth (or RIVER_Y − 15 with none near)', () => {
    expect(t([100, 30])).toBe(-21.3)
    expect(t([100, -5])).toBe(-21.3) // the dockwall's margin
    expect(t([390, 30])).toBe(-21.3)
    const far = tubeDipTarget({ water, riverY: L.RIVER_Y, crossings: [] })
    expect(far([200, 30])).toBeCloseTo(L.RIVER_Y - 15)
  })
  it('at a lower-deck crossing: its depth; elsewhere none', () => {
    expect(t([105, 200])).toBe(-18.5)
    expect(t([100, 400])).toBe(Infinity)
  })
})

// The built world (D1-5 done-when): every tube vertex under the sunken river has its ceiling more than 1 m under the
// water, and every station platform is still level at SUBWAY_Y.
const transitFile = new URL('../../app/public/world/transit.json', import.meta.url)
const manifestFile = new URL('../../app/public/world/manifest.json', import.meta.url)
const riverFile = new URL('../../app/public/world/river-levels.json', import.meta.url)
const built = existsSync(transitFile) && existsSync(manifestFile) && existsSync(riverFile) ? { t: JSON.parse(readFileSync(transitFile, 'utf8')), m: JSON.parse(readFileSync(manifestFile, 'utf8')), r: JSON.parse(readFileSync(riverFile, 'utf8')) } : null
describe.skipIf(!built?.m?.levels?.river)('the built world: tube ceilings under the river', () => {
  it('no tube ceiling within 1 m of the river (RIVER_Y − 1), anywhere under the sunken water', () => {
    const water = built.r.water.map((outer) => ({ outer, holes: [] }))
    let under = 0
    for (const r of built.t.routes) for (const [x, y, z] of r.path) {
      if (y > SUBWAY_Y + 1e-6) continue
      if (!water.some((p) => inPoly([x, z], p))) continue
      under++
      expect(y + CLEAR, `${r.id} at ${x},${z}`).toBeLessThan(L.RIVER_Y - 1)
    }
    expect(under).toBeGreaterThan(10) // Red under the Main Branch, Blue under the South Branch twice
  })
})
