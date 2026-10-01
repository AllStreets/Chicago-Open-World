// pipeline/tests/riverLevel.test.js — D1: the river system, its walls, the sunken-floor ground cut, the corridor mask.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { riverLevels, sunkWater, wallRuns, wallMesh, runsByTile, cutMeshOutside, cutMeshInside, soffitOver, corridorMask, inCorridor, LOCK_TOP, polyIndex, applySkirts, skirtBase } from '../lib/riverLevel.js'
import { bufferPolyline } from '../lib/ribbon.js'
import { flatMesh } from '../lib/ground.js'
import { signedArea } from '../lib/geom.js'
import { tileKeyFor } from '../lib/tiles.js'

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const W = (outer, tags, holes = []) => ({ outer, holes, tags: { natural: 'water', ...tags } })
const area = (m) => { let a = 0; for (let i = 0; i < m.positions.length; i += 9) { const [ax, az, bx, bz, cx, cz] = [m.positions[i], m.positions[i + 2], m.positions[i + 3], m.positions[i + 5], m.positions[i + 6], m.positions[i + 8]]; a += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2 } return a }

describe('riverLevels (D1-8 flag)', () => {
  const data = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'))
  it('reads RIVER_Y and RIVERWALK_Y from levels.json', () => {
    expect(riverLevels(data)).toMatchObject({ river: data.levels.RIVER_Y, riverwalk: data.levels.RIVERWALK_Y })
  })
  it('LEVELS_RIVER=0 (or no levels file) builds the flat world', () => {
    expect(riverLevels(data, { LEVELS_RIVER: '0' })).toBeNull()
    expect(riverLevels(null)).toBeNull()
  })
})

describe('sunkWater: the river system', () => {
  const river = W(rect(0, 0, 400, 60), { water: 'river' })
  const slip = W(rect(100, 60, 160, 160), { water: 'harbour', name: 'Ogden Slip' })
  const basin = W(rect(400, 0, 460, 60), { water: 'basin' })
  const lock = W(rect(460, 10, 600, 50), { water: 'lock' })
  const harbour = W(rect(600, 60, 900, 400), { water: 'harbour', name: 'DuSable Harbor' }) // 10 m off the lock
  const pond = W(rect(0, 300, 50, 350), { water: 'pond' })
  const fountain = W(rect(100, -0.5, 104, -4), { water: 'basin', amenity: 'fountain' })
  const raised = W(rect(200, -1, 210, -9), { water: 'basin', layer: '1' })
  const sunk = sunkWater([river, slip, basin, lock, harbour, pond, fountain, raised])
  it('takes the river, the slips and basins opening onto it, and the lock (transitively)', () => {
    expect(sunk).toEqual(expect.arrayContaining([river, slip, basin, lock]))
  })
  it('leaves the lake harbours, ponds, fountains and raised pools at their own level', () => {
    for (const p of [harbour, pond, fountain, raised]) expect(sunk).not.toContain(p)
  })
})

describe('wallRuns: dockwalls close every land–river edge (D1-1)', () => {
  const R = -6.3
  const a = W(rect(0, 0, 200, 60), { water: 'river' }), b = W(rect(200, 0, 400, 60), { water: 'river' }) // two relations meeting on a shared edge
  const isle = W(rect(500, -100, 800, 200), { water: 'river' }, [rect(600, 0, 700, 100)])
  it('walls every edge with land outside — none where two river polygons meet', () => {
    const runs = wallRuns({ water: [a, b], riverY: R })
    const len = runs.reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0)
    expect(len).toBeCloseTo(2 * 400 + 2 * 60, 3) // the outline of the union, not the shared seam
    expect(runs.every((r) => r.top === 0 && r.bottom === R - 0.5 && r.kind === 'dockwall')).toBe(true)
  })
  it('closes the whole perimeter: every metre of every land edge is walled, including round an island', () => {
    const runs = wallRuns({ water: [isle], riverY: R })
    const len = runs.reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0)
    expect(len).toBeCloseTo(2 * 300 + 2 * 300 + 4 * 100, 3)
    // each wall faces the water: a point 1 m in front of its face is in the river
    for (const r of runs) {
      const m = [(r.a[0] + r.b[0]) / 2 - r.n[0], (r.a[1] + r.b[1]) / 2 - r.n[1]]
      const inIsle = m[0] > 600 && m[0] < 700 && m[1] > 0 && m[1] < 100
      expect(m[0] > 500 && m[0] < 800 && m[1] > -100 && m[1] < 200 && !inIsle).toBe(true)
    }
  })
  it('the wall quads cover every run from street level to below the water, facing the water', () => {
    const runs = wallRuns({ water: [a], riverY: R })
    const m = wallMesh(runs)
    expect(m.positions.length / 18).toBe(runs.length) // two triangles per run
    const ys = m.positions.filter((_, i) => i % 3 === 1)
    expect(Math.max(...ys)).toBe(0); expect(Math.min(...ys)).toBeCloseTo(R - 0.5)
    // triangle winding agrees with the stored normal (front faces look into the channel)
    for (let i = 0; i < m.positions.length; i += 9) {
      const p = (k) => m.positions.slice(i + k * 3, i + k * 3 + 3), e1 = p(1).map((v, j) => v - p(0)[j]), e2 = p(2).map((v, j) => v - p(0)[j])
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      const n = m.normals.slice(i, i + 3)
      expect(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]).toBeGreaterThan(0)
    }
  })
  it('a sunken floor beside the water: the river face stops at the floor, the floor gets a retaining wall to the street', () => {
    const walk = { outer: rect(0, -20, 200, 0), holes: [], y: -5.3 }
    const runs = wallRuns({ water: [a], zones: [walk], riverY: R })
    const face = runs.filter((r) => r.kind === 'zone-edge')
    expect(face.length).toBeGreaterThan(0)
    expect(face.every((r) => r.top === -5.3)).toBe(true)
    expect(face.reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0)).toBeCloseTo(200, 3)
    const back = runs.filter((r) => r.kind === 'retaining')
    expect(back.reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0)).toBeCloseTo(200 + 20 + 20, 3) // back and both ends
    expect(back.every((r) => r.top === 0 && r.bottom < -5.3)).toBe(true)
  })
  it('the lock is walled all round and its walls stand above the lake', () => {
    const lock = W(rect(400, 10, 540, 50), { water: 'lock' })
    const runs = wallRuns({ water: [W(rect(0, 0, 400, 60), { water: 'river' }), lock], riverY: R }).filter((r) => r.kind === 'lock')
    expect(runs.every((r) => r.top === LOCK_TOP)).toBe(true)
    expect(runs.reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0)).toBeCloseTo(140 * 2 + 40, 3) // not the side open to the river
  })
  it('an edge only partly against other water is walled where it meets land (probed every 2 m)', () => {
    const lock = W(rect(400, 10, 540, 50), { water: 'lock' })
    const east = wallRuns({ water: [W(rect(0, 0, 400, 60), { water: 'river' }), lock], riverY: R }).filter((r) => r.kind === 'dockwall' && r.a[0] === 400 && r.b[0] === 400)
    expect(east.reduce((s, r) => s + Math.abs(r.b[1] - r.a[1]), 0)).toBeCloseTo(20, 3) // z 0–10 and 50–60
  })
  it('runsByTile cuts long runs and keys each piece by its middle', () => {
    const m = runsByTile([{ a: [0, 10], b: [1000, 10], n: [0, 1], top: 0, bottom: -6.8 }], tileKeyFor)
    expect([...m.keys()].sort()).toEqual(['0_0', '1_0'])
    expect([...m.values()].flat().reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0)).toBeCloseTo(1000, 6)
  })
})

describe('the street-level ground over a sunken floor', () => {
  const zone = { outer: rect(40, -50, 60, 50), holes: [] }
  it('cutMeshOutside removes exactly the zone from a ribbon and keeps its uvs', () => {
    const road = bufferPolyline([[0, 0], [100, 0]], 5, 0.12)
    const cut = cutMeshOutside(road, [zone])
    expect(area(road)).toBeCloseTo(1000, 3)
    expect(area(cut)).toBeCloseTo(800, 3)
    expect(new Set(cut.positions.filter((_, i) => i % 3 === 1))).toEqual(new Set([0.12]))
    // uv u runs along the road (= x here): every vertex keeps u ≈ x
    for (let i = 0; i < cut.positions.length / 3; i++) expect(cut.uvs[i * 2]).toBeCloseTo(cut.positions[i * 3], 4)
    // up-facing winding kept
    for (let i = 0; i < cut.positions.length; i += 9) {
      const [ax, az, bx, bz, cx, cz] = [cut.positions[i], cut.positions[i + 2], cut.positions[i + 3], cut.positions[i + 5], cut.positions[i + 6], cut.positions[i + 8]]
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
      expect(ny).toBeGreaterThan(0)
    }
  })
  it('cutMeshInside is the complement; a park polygon is cut the same way', () => {
    const park = flatMesh([{ outer: rect(0, -10, 100, 10), holes: [] }], 0.08)
    expect(area(cutMeshInside(park, [zone])) + area(cutMeshOutside(park, [zone]))).toBeCloseTo(2000, 3)
  })
  it('a bridge ribbon over a sunken floor gets a down-facing soffit under it', () => {
    const deck = bufferPolyline([[0, 0], [100, 0]], 5, 0.12)
    const s = soffitOver(deck, [zone], -0.9)
    expect(area(s)).toBeCloseTo(200, 3)
    expect(s.normals.filter((_, i) => i % 3 === 1).every((v) => v === -1)).toBe(true)
    expect(new Set(s.positions.filter((_, i) => i % 3 === 1))).toEqual(new Set([-0.9]))
  })
})

describe('river-front building skirts (D1-3)', () => {
  const R = -6.3
  const water = [W(rect(0, 0, 400, 60), { water: 'river' })]
  const walk = { outer: rect(0, 60, 200, 80), holes: [], y: -5.3 }
  const bld = (id, ring, pieces) => ({ id, polygons: [{ outer: ring, holes: [] }], pieces: pieces ?? [{ outer: ring, holes: [], base: 0, top: 30 }] })
  const all = [
    bld('on-bank', rect(250, -40, 300, -1.5)),            // 1.5 m from the water
    bld('on-walk', rect(50, 82, 100, 120)),               // 2 m behind the Riverwalk
    bld('inland', rect(250, -100, 300, -20)),             // 20 m back
    bld('podium', rect(300, -30, 340, -2), [{ outer: rect(300, -30, 340, -2), holes: [], base: 0, top: 10 }, { outer: rect(310, -25, 330, -5), holes: [], base: 10, top: 80 }]),
  ]
  const opts = { waterIdx: polyIndex(water), zoneIdx: polyIndex([walk]), riverY: R }
  const n = applySkirts(all, opts)
  it('every river-adjacent footprint reaches the water; one beside the Riverwalk reaches its floor; inland ones are untouched', () => {
    expect(n).toBe(3)
    const by = Object.fromEntries(all.map((b) => [b.id, b]))
    expect(Math.min(...by['on-bank'].pieces.map((p) => p.base))).toBe(R - 0.5)
    expect(Math.min(...by['on-walk'].pieces.map((p) => p.base))).toBe(-5.3)
    expect(by.inland.pieces[0].base).toBe(0); expect(by.inland.skirtBase).toBeUndefined()
  })
  it('only the ground-level pieces grow down (a tower on a podium keeps its base)', () => {
    const p = all.find((b) => b.id === 'podium').pieces
    expect(p[0].base).toBe(R - 0.5); expect(p[1].base).toBe(10)
  })
  it('skirtBase checks every edge, not just the corners', () => {
    const long = bld('long', [[-50, -2], [450, -2], [450, -50], [-50, -50]])
    expect(skirtBase(long, opts)).toBe(R - 0.5)
  })
})

describe('corridorMask (D1-6)', () => {
  const river = W(rect(0, 0, 1000, 60), { water: 'river' })
  const mask = corridorMask([river], { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 })
  it('marks the river and its banks, not the city a block away or the lake', () => {
    expect(inCorridor(mask, 500, 30)).toBe(true)
    expect(inCorridor(mask, 500, 120)).toBe(true) // 60 m off the bank
    expect(inCorridor(mask, 500, 400)).toBe(false)
    expect(inCorridor(mask, 1500, 30)).toBe(false)
  })
  it('is compact (row runs)', () => {
    expect(mask.runs.length % 3).toBe(0)
    expect(mask.runs.length / 3).toBeLessThan(20)
    expect(Math.abs(signedArea(rect(0, 0, 1, 1)))).toBe(1)
  })
})
