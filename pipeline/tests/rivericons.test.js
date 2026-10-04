// pipeline/tests/rivericons.test.js — the river's icons (Workstream A): every sculpt keeps to its building, reaches its
// sourced height, faces out where it is a wall, and stays inside the triangle budget (H8/H10 of the hero standard).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { riverSculpt, RIVER_SCULPTS, edgesOf, offsetRing, exposedEdges, letters, faceRun } from '../lib/rivericons.js'
import { applyHero } from '../lib/heroes.js'
import { ringCentroid, signedArea } from '../lib/geom.js'
import { mesh } from '../lib/meshkit.js'
import { auditGap, trisOf } from '../lib/gaps.js'

const H = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const hero = (k) => H.find((h) => h.key === k)
const rect = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]]
const piece = (outer, top, base = 0) => ({ outer, holes: [], base, top })
const tris = (ms) => ms.reduce((n, m) => n + m.positions.length / 9, 0)
const ys = (ms) => ms.flatMap((m) => m.positions.filter((_, i) => i % 3 === 1))
const xz = (ms) => ms.flatMap((m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) o.push([m.positions[i], m.positions[i + 2]]); return o })
const max = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity), min = (a) => a.reduce((m, v) => Math.min(m, v), Infinity)
// a building as build-world hands it to applyHero: OSM outline plus parts
function building(outer, parts = [], height = 0) {
  const c = ringCentroid(outer)
  return { id: 'w1', osmId: 1, polygons: [{ outer, holes: [] }], centroid: c, area: Math.abs(signedArea(outer)), height, parts: parts.map((p) => ({ holes: [], base: 0, ...p })) }
}
const run = (key, b) => applyHero(b, hero(key))
// every vertex within `pad` metres of the outline's bounding box (no floating pavilions, nothing in the next block)
function inside(ms, outer, pad) {
  const x = outer.map((p) => p[0]), z = outer.map((p) => p[1])
  return xz(ms).every(([a, b]) => a >= min(x) - pad && a <= max(x) + pad && b >= min(z) - pad && b <= max(z) + pad)
}

describe('rivericons module (A-2)', () => {
  it('routes a sculpt it does not know to a no-op', () => {
    expect(riverSculpt('no-such-icon', { pieces: [], spec: {} })).toBeNull()
    const b = building(rect(0, 0, 20, 20), [], 30)
    const r = applyHero(b, { key: 'x', name: 'X', match: { osmId: 1 }, crowns: [], sculpt: 'no-such-icon' })
    expect(r.extraMeshes).toEqual([]); expect(r.pieces[0].top).toBe(30)
  })
  it('every river hero names a sculpt the module has, or none', () => {
    const river = H.filter((h) => h.sculpt && !['tribune', 'wrigley', 'willis', 'carbide', 'marina', 'aqua'].includes(h.sculpt) && !h.sculpt.startsWith('lp'))
    for (const h of river) expect([h.key, Boolean(RIVER_SCULPTS[h.sculpt])]).toEqual([h.key, true])
  })
  it('edges face out and an offset ring grows outward', () => {
    const r = rect(0, 0, 10, 10)
    for (const e of edgesOf(r)) expect(Math.hypot(...[e.mid[0] + e.n[0], e.mid[1] + e.n[1]])).toBeGreaterThan(Math.hypot(...e.mid))
    const g = offsetRing(r, 1)
    expect(Math.abs(signedArea(g))).toBeCloseTo(144, 0)
  })
  it('exposed edges start above a neighbour\'s roof', () => {
    const ex = exposedEdges([piece(rect(0, 0, 10, 10), 100), piece(rect(10, 0, 10, 10), 40)])
    const shared = ex.filter((e) => Math.abs(e.mid[0] - 5) < 0.01)
    expect(shared.map((e) => [e.y0, e.y1])).toEqual([[40, 100]])
  })
  it('roof lettering reads left to right from outside', () => {
    const out = mesh(), w = letters(out, 'MORTON SALT', [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 1)
    expect(w).toBeCloseTo(66, 6)
    const x = out.positions.filter((_, i) => i % 3 === 0)
    expect(min(x)).toBeGreaterThanOrEqual(0); expect(max(x)).toBeLessThanOrEqual(66)
    for (let i = 2; i < out.normals.length; i += 3) expect(out.normals[i]).toBeCloseTo(1, 6)
  })
})

describe('Tier 1 (A-3): crowns and massing', () => {
  it('Trump: the spire tops out at 423.2 m, the podium returns at 60 m, fins stop below the roof', () => {
    const o = rect(0, 0, 77, 96)
    const b = building(o, [{ outer: rect(0, 0, 63, 82), top: 120 }, { outer: rect(0, 0, 50, 67), top: 200 }, { outer: rect(0, 0, 36, 53), top: 345 }, { outer: rect(0, -5, 20, 26), top: 357 }, { outer: rect(2, -12, 2.9, 2.9), top: 380 }, { outer: rect(2, -12, 1.4, 1.4), top: 423 }])
    const r = run('trump', b)
    expect(max(ys(r.extraMeshes))).toBeCloseTo(423.2, 1)
    expect(r.pieces.some((p) => p.top === 60 && Math.abs(signedArea(p.outer)) > 7000)).toBe(true)
    expect(max(ys(r.extraMeshes.filter((m) => m.part === 'fins')))).toBeLessThan(352)
    expect(tris(r.extraMeshes)).toBeLessThan(15000)
  })
  it('St. Regis: three frustum stacks to their OSM heights, the blow-through floor at 300 m, under 15 k triangles', () => {
    const b = building(rect(0, 0, 106, 47), [{ outer: rect(-40, -4, 27, 28), top: 349 }, { outer: rect(-13, 1, 27, 27), top: 259 }, { outer: rect(12, 4, 27, 28), top: 179 }, { outer: rect(38, 7, 27, 33), top: 59 }], 0)
    const r = run('stregis', b)
    expect(max(ys(r.extraMeshes))).toBeCloseTo(363, 0)
    const gap = r.extraMeshes.find((m) => m.part === 'blow-through')
    expect(min(ys([gap]))).toBeCloseTo(300, 1); expect(max(ys([gap]))).toBeCloseTo(307.2, 1)
    expect(r.pieces.filter((p) => p.hidden).length).toBe(3) // the stacks draw themselves
    // the blow-through is never see-through: a floor slab facing up at 300 m, a soffit facing down at 307.2 m, a solid
    // inner wall and columns (kept in LOD1), and a fine steel grille of vertical fins across the open faces
    const slabs = r.extraMeshes.find((m) => m.part === 'gap-slabs'), grille = r.extraMeshes.find((m) => m.part === 'grille')
    const ny = (m, y) => { const o = []; for (let i = 0; i < m.positions.length; i += 9) if (Math.abs(m.positions[i + 1] - y) < 0.01 && Math.abs(m.positions[i + 4] - y) < 0.01 && Math.abs(m.positions[i + 7] - y) < 0.01) o.push(m.normals[i + 1]); return o }
    expect(ny(slabs, 300).length).toBeGreaterThan(0); expect(ny(slabs, 300).every((n) => n > 0.99)).toBe(true)
    expect(ny(slabs, 307.2).length).toBeGreaterThan(0); expect(ny(slabs, 307.2).every((n) => n < -0.99)).toBe(true)
    expect(slabs.lod0Only || gap.lod0Only).toBe(false)
    // flat steel at the corners and every ~4.5 m along the edges, kept at LOD1 (user, 2026-10-02), and the whole
    // storey closed to every sight line at LOD1 (without the grille) as at LOD0
    const steel = r.extraMeshes.find((m) => m.part === 'gap-steel')
    expect(steel.lod0Only).toBe(false); expect(steel.style).toBe('stregis-steel')
    expect(tris([steel]) / 8).toBeGreaterThanOrEqual(Math.floor((0.89 * 2 * (27 + 28)) / 4.5)) // a plate per ~4.5 m of the waist perimeter, a column per corner
    expect(min(ys([steel]))).toBeCloseTo(300, 1); expect(max(ys([steel]))).toBeCloseTo(307.2, 1)
    const stack = rect(-40, -4, 27 * 0.85, 28 * 0.85), lod1 = r.extraMeshes.filter((m) => !m.lod0Only)
    const g = { outer: stack, holes: [], y0: 300, y1: 307.2, kind: 'storey' }
    expect(auditGap(lod1.flatMap(trisOf), g)).toMatchObject({ through: 0, hollow: 0 })
    expect(auditGap(r.extraMeshes.flatMap(trisOf), g)).toMatchObject({ through: 0, hollow: 0 })
    expect(grille.style).toBe('stregis-grille')
    expect(tris([grille]) / 6).toBeGreaterThan(150) // ~0.5 m fin spacing round a ~100 m plate
    expect(min(ys([grille]))).toBeCloseTo(300, 1); expect(max(ys([grille]))).toBeCloseTo(307.2, 1)
    // a frustum's widest belt is the OSM plate, its waist 89 % of it
    expect(inside(r.extraMeshes, rect(0, 0, 106, 47), 0.5)).toBe(true)
    expect(tris(r.extraMeshes)).toBeLessThan(15000)
  })
  it('333 W Wacker: 149 m, the striped serpentine and granite base to 16.5 m, columns under the curved river front', () => {
    const arc = Array.from({ length: 12 }, (_, i) => { const a = -Math.PI / 2 - (i / 11) * (Math.PI / 2); return [60 + 95 * Math.cos(a), 60 + 95 * Math.sin(a)] })
    const o = [...arc, [60, 60]]
    const r = run('wacker333', building(o, [], 148))
    expect(max(r.pieces.map((p) => p.top))).toBeCloseTo(149, 1)
    expect(max(ys(r.extraMeshes.filter((m) => m.part.startsWith('base'))))).toBeCloseTo(16.5, 1)
    expect(r.extraMeshes.find((m) => m.part === 'river-columns').positions.length).toBeGreaterThan(0)
    expect(tris(r.extraMeshes)).toBeLessThan(15000)
  })
  it('330 N Wabash: the glass lobby set back under the slab, mullions on the 5 ft module, 211.8 m', () => {
    const r = run('wabash330', building(rect(0, 0, 36.6, 82.3), [], 211.84))
    const lobby = r.pieces.find((p) => p.top === 7.9)
    expect(Math.abs(signedArea(lobby.outer))).toBeLessThan(36.6 * 82.3 * 0.9)
    expect(max(r.pieces.map((p) => p.top))).toBeCloseTo(211.84, 1)
    const n = r.extraMeshes.find((m) => m.part === 'mullions').positions.length / 9 / 6 // 6 triangles a thin (uncapped) fin
    expect(n).toBeGreaterThan((2 * (36.6 + 82.3)) / 1.524 - 4)
  })
  it('35 E Wacker: four corner tempietti on the 92 m block, the belvedere dome to 159.4 m, floodlit row', () => {
    const b = building(rect(0, 0, 51, 44), [{ outer: rect(-3, -2, 22, 26), top: 160.65 }, { outer: rect(0, 0, 51, 44), top: 87.4 }])
    const r = run('jewelers35', b)
    expect(max(ys(r.extraMeshes))).toBeCloseTo(159.4, 1)
    const temples = r.extraMeshes.find((m) => m.part === 'temples')
    expect(min(ys([temples]))).toBeCloseTo(92, 1)
    expect(inside(r.extraMeshes, rect(0, 0, 51, 44), 1.5)).toBe(true)
    expect(hero('jewelers35').look.crownLight.toM).toBeGreaterThanOrEqual(159)
    expect(tris(r.extraMeshes)).toBeLessThan(15000)
  })
  it('London Guarantee: the tholos to 102.9 m on the 79 m roof, a colonnade on the river corner', () => {
    const o = [[-29, 11], [-11, -14], [-7, -18], [8, -10], [20, -10], [20, 18.6], [3.6, 18.5], [-3, 27.6]]
    const r = run('londonhouse', building(o, [{ outer: rect(3, -3, 8.8, 8.8), top: 97 }], 97))
    expect(max(ys(r.extraMeshes))).toBeCloseTo(102.9, 1)
    expect(r.pieces[0].top).toBe(79)
    const col = ys(r.extraMeshes.filter((m) => m.part === 'colonnades'))
    expect(max(col)).toBeGreaterThan(78); expect(min(col)).toBeLessThan(1)
    expect(inside(r.extraMeshes, o, 3)).toBe(true)
  })
  it('Mather Tower: three octagonal stages over the 93 m box, the gilded cupola to 158.8 m, inside the 30 × 20 m lot', () => {
    const r = run('mather', building(rect(0, 0, 33, 30), [{ outer: rect(0, 0, 11, 11), top: 158 }, { outer: rect(0, 0, 33, 30), top: 87.4 }]))
    expect(r.pieces.map((p) => p.top)).toEqual([93, 117, 133, 145])
    expect(max(ys(r.extraMeshes))).toBeCloseTo(158.8, 1)
    expect(inside(r.extraMeshes, rect(0, 0, 33, 30), 1)).toBe(true)
    expect(tris(r.extraMeshes)).toBeLessThan(15000)
  })
  it('Reid Murdoch: the clock tower at 53 m centred on the river front, four lit faces', () => {
    const r = run('reidmurdoch', building(rect(0, 0, 93, 40), [], 41.8))
    expect(max(r.pieces.map((p) => p.top))).toBe(53)
    const tower = r.pieces.find((p) => p.top === 53), c = ringCentroid(tower.outer)
    expect(Math.abs(c[0])).toBeLessThan(1); expect(c[1]).toBeGreaterThan(10) // on the south (river) face
    expect(r.extraMeshes.filter((m) => m.part === 'clock')).toHaveLength(1)
    expect(r.extraMeshes.find((m) => m.part === 'clock').facade).toBe(27) // lit at night
  })
})

describe('Tier 1 heavy (A-4)', () => {
  it('Merchandise Mart: the block at 78 m, 56 chiefs\' heads on the 104 m tower, and the Art on theMART surface', () => {
    const b = building(rect(0, 0, 222, 102), [{ outer: rect(20, 33, 32, 45), top: 104 }, { outer: rect(-102, -39, 16, 16), top: 72.2 }, { outer: rect(-60, 42, 15, 15), top: 83.6 }], 72.2)
    const r = run('mart', b)
    expect(r.pieces.find((p) => Math.abs(signedArea(p.outer)) > 20000).top).toBe(78)
    expect(r.pieces.find((p) => p.top === 92)).toBeTruthy()
    const heads = r.extraMeshes.find((m) => m.part === 'chiefs-heads')
    expect(heads.positions.length / 9 / 8).toBe(56)
    const art = r.runtime.artOnTheMart
    expect(art.n[1]).toBeCloseTo(1, 3) // facing the river (south)
    expect(art.halfW * 2).toBeCloseTo(169.5, 1); expect(art.y1 - art.y0).toBeCloseTo(50.3, 1)
    expect(tris(r.extraMeshes)).toBeLessThan(40000)
  })
  it('Civic Opera: the tower at 169.2 m, a portico 12 m tall open under the building along Wacker', () => {
    const b = building(rect(0, 0, 64, 120), [{ outer: rect(-4, 50, 58, 32), top: 83.6 }, { outer: rect(-4, -40, 49, 31), top: 83.6 }, { outer: rect(-8, 5, 37, 80), top: 53.2 }, { outer: rect(8, 5, 23, 57), top: 171 }, { outer: rect(28, 5, 7.7, 113), top: 83.6 }])
    const r = run('civicopera', b)
    expect(max(r.pieces.map((p) => p.top))).toBeCloseTo(169.2, 1)
    expect(r.pieces.filter((p) => p.base === 12).length).toBeGreaterThan(0)
    const piers = r.extraMeshes.find((m) => m.part === 'portico-piers')
    expect(max(ys([piers]))).toBeCloseTo(12, 1)
    expect(r.extraMeshes.find((m) => m.part === 'portico-lanterns').facade).toBe(27)
  })
  it('Old Post Office: the expressway bores under the building, the roof park on the 58 m roofs', () => {
    const b = building(rect(0, 715, 108, 238), [{ outer: rect(0, 791, 82, 106), top: 34.2 }, { outer: rect(0, 649, 82, 102), top: 34.2 }, { outer: rect(-18, 712, 81, 29.4), top: 34.2 }], 65.5)
    const r = run('oldpostoffice', b)
    const over = r.pieces.find((p) => p.base === 7.2)
    expect(over).toBeTruthy(); expect(over.top).toBe(58)
    expect(r.extraMeshes.find((m) => m.part === 'roof-park').positions.length).toBeGreaterThan(0)
  })
  it('150 N Riverside: a 12 m core for 31.7 m, the plate from 42 m to 221 m, the screen to 229 m', () => {
    const r = run('riverside150', building(rect(0, 0, 37, 75), [], 229))
    const core = r.pieces.find((p) => p.top === 31.7)
    const xs = core.outer.map((p) => p[0])
    expect(max(xs) - min(xs)).toBeCloseTo(12, 1)
    expect(r.pieces.find((p) => p.base === 42 && p.top === 221)).toBeTruthy()
    expect(max(r.pieces.map((p) => p.top))).toBe(229)
    expect(tris(r.extraMeshes)).toBeLessThan(15000)
  })
  it('River Point: 223 m, the base arch on the east face and the inverted crown arch', () => {
    const o = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return [22 * Math.cos(a), 37 * Math.sin(a)] })
    const r = run('riverpoint', building(o, [], 222))
    const arch = r.extraMeshes.find((m) => m.part === 'arches')
    expect(min(ys([arch]))).toBeLessThan(1); expect(max(ys([arch]))).toBeGreaterThan(222)
    expect(max(r.pieces.map((p) => p.top))).toBe(223)
  })
  it('House of Blues: the saddle roof is high at its ends and low at its sides', () => {
    const r = run('houseofblues', building(rect(0, 0, 51, 30), [], 10))
    const roof = r.extraMeshes.find((m) => m.part === 'saddle-roof')
    expect(max(ys([roof]))).toBeCloseTo(19.02, 1); expect(min(ys([roof]))).toBeCloseTo(9.02, 1)
  })
})

describe('Tier 2 and 3 (A-6, A-7)', () => {
  it('110 N Wacker: tridents 16.8 m tall under a 17 m overhang on the river face', () => {
    const b = building(rect(0, 0, 42, 97), [{ outer: rect(0, 0, 42, 97), top: 248 }], 248)
    const r = run('110wacker', b)
    const lo = r.pieces.filter((p) => (p.base ?? 0) === 0), hi = r.pieces.filter((p) => p.base === 16.8)
    expect(min(lo.flatMap((p) => p.outer.map((q) => q[0])))).toBeCloseTo(-21 + 17, 1) // the ground floor stops 17 m short of the river (west)
    expect(min(hi.flatMap((p) => p.outer.map((q) => q[0])))).toBeCloseTo(-21, 1)
    expect(max(ys(r.extraMeshes.filter((m) => m.part === 'tridents')))).toBeLessThanOrEqual(16.81)
  })
  it('Wolf Point and Salesforce: slab tops and crowns at their sourced heights', () => {
    expect(max(run('salesforce', building(rect(0, 0, 37, 64), [], 255)).pieces.map((p) => p.top))).toBe(255)
    const e = run('wolfpointeast', building(rect(0, 0, 57, 24), [], 207))
    expect(e.pieces.map((p) => p.top)).toEqual([186, 204])
    const w = run('wolfpointwest', building(rect(0, 0, 31, 59), [], 150))
    expect(w.pieces.map((p) => p.top).sort()).toEqual([139, 148])
  })
  it('Salt Shed: a gable from 4.5 m eaves to the 21 m ridge, MORTON SALT on the slope', () => {
    const r = run('saltshed', building(rect(0, 0, 67, 72), [{ outer: rect(0, 0, 28, 31), top: 15 }]))
    expect(max(ys(r.extraMeshes))).toBeCloseTo(22.6, 1)
    const sign = r.extraMeshes.find((m) => m.part === 'morton-salt-sign')
    expect(min(ys([sign]))).toBeGreaterThan(4.5); expect(max(ys([sign]))).toBeLessThan(21)
  })
  it('NBC Tower: three setbacks, the spire to 191 m', () => {
    const r = run('nbc', building(rect(0, 0, 76, 43), [], 151.5))
    expect(r.pieces.map((p) => p.top)).toEqual([80, 114, 130, 151.5])
    expect(max(ys(r.extraMeshes))).toBeCloseTo(191, 1)
  })
  it('the Wacker wall: Leo Burnett\'s colonnade, 77 W\'s pediment, 225 W\'s lanterns, LaSalle-Wacker\'s beacon', () => {
    const leo = run('leoburnett', building(rect(0, 0, 45, 60), [{ outer: rect(0, 0, 45, 60), top: 193.55 }]))
    expect(max(ys(leo.extraMeshes))).toBeCloseTo(193.6, 1)
    const w77 = run('wacker77', building(rect(0, 0, 51, 44), [], 203.61))
    expect(max(ys(w77.extraMeshes))).toBeCloseTo(203.6 + 11, 1)
    const w225 = run('wacker225', building(rect(0, 0, 34, 75), [], 132))
    expect(max(ys(w225.extraMeshes))).toBeCloseTo(143, 1)
    const lw = run('lasallewacker', building(rect(0, 0, 43, 45), [], 156))
    expect(lw.pieces.map((p) => p.top)).toEqual([78, 124, 148])
    expect(max(ys(lw.extraMeshes))).toBeCloseTo(156, 1)
  })
})

describe('Rail bridges and small icons (A-10, A-11)', () => {
  const syn = (k) => { const h = hero(k), c = [0, 0]; return { ...building(rect(0, 0, 4, 4)), centroid: c, h } }
  it('the Kinzie leaf stands raised at 60°, the Canal St towers reach 56.4 m, the Air Line counterweights hang high', () => {
    const k = run('kinzierr', syn('kinzierr'))
    expect(max(ys(k.extraMeshes))).toBeGreaterThan(3 + 51.8 * Math.sin(Math.PI / 3) - 1)
    const c = run('canalrr', syn('canalrr'))
    expect(max(ys(c.extraMeshes))).toBeCloseTo(59.4, 1)
    const a = run('stcharlesairline', syn('stcharlesairline'))
    const w = a.extraMeshes.find((m) => m.part === 'counterweight')
    expect(max(ys([w]))).toBeCloseTo(33, 1); expect(min(ys([w]))).toBeCloseTo(33 - 17.2, 1)
    for (const r of [k, c, a]) expect(tris(r.extraMeshes)).toBeLessThan(15000)
  })
  it('the Harbor Lock chamber is 600 × 80 ft, the Centennial arc reaches 80 ft from the steps', () => {
    const l = run('harborlock', building(rect(1783, -730, 78, 12), [], 10))
    const walls = l.extraMeshes.find((m) => m.part === 'lock-walls'), x = xz([walls]).map((p) => p[0])
    expect(max(x) - min(x)).toBeCloseTo(182.9 + 8, 0)
    const f = run('centennialfountain', syn('centennialfountain'))
    expect(f.runtime.centennialArc.reachM).toBeCloseTo(24.4, 1)
  })
})

describe('river heroes data (H1, H11)', () => {
  const RIVER = ['trump', 'stregis', 'wacker333', 'wabash330', 'jewelers35', 'londonhouse', 'mather', 'reidmurdoch', 'mart', 'civicopera', 'oldpostoffice', 'riverside150', 'riverpoint', 'houseofblues', '110wacker', 'salesforce', 'wolfpointeast', 'wolfpointwest', 'boeing', 'riversideplaza', 'unionstation', 'rivercity', 'michigan333', 'lasalle300', 'nbc', 'saltshed', 'wardcatalog', 'leoburnett', 'sheraton', 'hyattregency', 'swissotel', 'equitable', 'church17', 'wacker77', 'wacker225', 'builders', 'lasallewacker', 'hotel71', 'kinzierr', 'canalrr', 'stcharlesairline', 'harborlock', 'centennialfountain', 'pingtomboathouse']
  it('every river icon has a name, ⌘K aliases, one match and https sources', () => {
    for (const k of RIVER) {
      const h = hero(k)
      expect([k, Boolean(h)]).toEqual([k, true])
      expect(h.aliases?.length, k).toBeGreaterThan(0)
      expect((h.sources ?? []).some((s) => /^https:\/\//.test(s)), k).toBe(true)
      const m = h.match
      expect(Boolean(m.osmId || m.synthetic), k).toBe(true)
      if (h.sculptParams) expect([k, (h.sculptParams.source ?? []).length > 0 || typeof h.sculptParams.source === 'string']).toEqual([k, true])
    }
  })
  it('match ids are unique (one building per icon)', () => {
    const ids = RIVER.map((k) => hero(k).match.osmId).filter(Boolean).map(String).map((s) => s.replace(/^w/, ''))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// the face-run helper finds the long run of a footprint's face toward a bearing (the Mart's river façade)
describe('faceRun', () => {
  it('measures the south face of a rectangle', () => {
    const r = faceRun(rect(0, 0, 100, 40), 180)
    expect(r.len).toBeCloseTo(100, 6); expect(r.n[1]).toBeCloseTo(1, 6)
  })
})
