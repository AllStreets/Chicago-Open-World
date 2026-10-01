// pipeline/tests/icons.test.js — the Tribune Tower and the Wrigley Building, gone all out (user request).
import { describe, it, expect } from 'vitest'
import { tribuneDetail, wrigleyClockTower, skybridge, pointedArch, carbideDetail, willisDetail } from '../lib/icons.js'

const sq = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]]
const ys = (ms, part) => ms.filter((m) => !part || m.part === part).flatMap(({ mesh }) => mesh.positions.filter((_, i) => i % 3 === 1))
const hi = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity), lo = (a) => a.reduce((m, v) => Math.min(m, v), Infinity)
const tris = (ms) => ms.reduce((n, { mesh }) => n + mesh.positions.length / 9, 0)
function frontFacing(m) {
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions.slice(i, i + 9), n = m.normals.slice(i, i + 3)
    const u = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], v = [p[6] - p[0], p[7] - p[1], p[8] - p[2]]
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] <= 0) return false
  }
  return true
}

describe('Tribune Tower detail', () => {
  const ms = tribuneDetail({ tower: sq(0, 0, 30, 32), towerBase: 23, towerTop: 118, crownTop: 141, entranceFace: [1, 0], base: sq(10, 0, 93, 69) })
  it('vertical pier ribs run the shaft from the base to the crown', () => {
    const r = ys(ms, 'piers'); expect(lo(r)).toBeCloseTo(23, 0); expect(hi(r)).toBeCloseTo(118, 0)
  })
  it('a pointed Gothic entrance arch on the Michigan Avenue face, about three storeys tall', () => {
    const a = ys(ms, 'entrance'); expect(lo(a)).toBeCloseTo(0, 0); expect(hi(a)).toBeGreaterThan(11); expect(hi(a)).toBeLessThan(18)
  })
  it('lancet tracery and lantern pinnacles stay within the 141 m crown', () => {
    expect(ms.some((m) => m.part === 'tracery')).toBe(true)
    expect(hi(ys(ms, 'pinnacles'))).toBeLessThanOrEqual(141.01)
  })
  it('every part faces out and the whole stays under 30 k triangles', () => {
    for (const { mesh, part } of ms) expect([part, frontFacing(mesh)]).toEqual([part, true])
    expect(tris(ms)).toBeLessThan(30000)
  })
})

describe('Wrigley Building clock tower', () => {
  const ms = wrigleyClockTower({ at: [0, 0], side: 17, base: 96, top: 133.5, bearingDeg: 0 })
  it('four clock faces, ~6 m across, on the clock stage', () => {
    const faces = ms.filter((m) => m.part === 'clock')
    expect(faces).toHaveLength(4)
    const y = ys(faces); expect(hi(y) - lo(y)).toBeCloseTo(6.0, 0)
  })
  it('tiers narrow upward to a cupola and finial at exactly the tower top', () => {
    for (const part of ['stage', 'belfry', 'octagon', 'cupola', 'finial']) expect(ms.some((m) => m.part === part), part).toBe(true)
    expect(hi(ys(ms))).toBeCloseTo(133.5, 1)
    expect(lo(ys(ms))).toBeCloseTo(96, 1)
  })
  it('faces out, under 15 k triangles', () => {
    for (const { mesh, part } of ms) expect([part, frontFacing(mesh)]).toEqual([part, true])
    expect(tris(ms)).toBeLessThan(15000)
  })
})

describe('skybridge', () => {
  it('spans the gap between two faces at the given floor', () => {
    const m = skybridge({ from: [0, 0], to: [0, -20], width: 6, y0: 12, y1: 16 })
    const zs = m.positions.filter((_, i) => i % 3 === 2)
    expect(lo(zs)).toBeCloseTo(-20); expect(hi(zs)).toBeCloseTo(0)
    expect(lo(m.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(12)
  })
})

describe('pointed arch', () => {
  it('springs from both jambs and meets at one apex on the centre line, the outer edge wider and higher', () => {
    const { inner, outer } = pointedArch(4.5, 9, 1.3)
    expect(inner[0]).toEqual([-4.5, 9]); expect(inner.at(-1)[0]).toBeCloseTo(4.5); expect(inner.at(-1)[1]).toBeCloseTo(9)
    const apex = (pts) => pts.reduce((a, p) => (p[1] > a[1] ? p : a))
    expect(apex(inner)[0]).toBeCloseTo(0, 5); expect(apex(outer)[0]).toBeCloseTo(0, 5)
    expect(apex(inner)[1]).toBeCloseTo(9 + 9 * Math.sin(Math.PI / 3), 3)
    expect(apex(outer)[1]).toBeGreaterThan(apex(inner)[1]); expect(outer[0][0]).toBeCloseTo(-5.8)
    expect(inner).toHaveLength(outer.length)
  })
})

describe('Willis Tower detail (user: the other icons to the same standard)', () => {
  // three of the nine 23 m tubes: a tall one, a middle one beside it, a short one beside that
  const tube = (i, top) => ({ outer: sq(i * 23, 0, 23, 23), holes: [], base: 0, top })
  const pieces = [tube(0, 442), tube(1, 269), tube(2, 205)]
  const ms = willisDetail({ pieces, belts: [[119, 131], [263, 271], [361, 369], [427, 439]], ledge: { face: [-1, 0], y: 412 } })
  const part = (p) => ms.filter((m) => m.part === p)
  it('black mullion fins on every exposed face, none buried where two tubes meet', () => {
    const fins = part('fins')[0].mesh, P = []
    for (let i = 0; i < fins.positions.length; i += 3) P.push(fins.positions.slice(i, i + 3))
    // the wall shared by tubes 0 and 1 (x = 11.5) carries fins only above the shorter tube's roof
    const shared = P.filter((p) => Math.abs(p[0] - 11.5) < 0.6 && Math.abs(p[2]) < 11)
    expect(shared.length).toBeGreaterThan(0)
    expect(lo(shared.map((p) => p[1]))).toBeGreaterThanOrEqual(269 - 1e-6)
    expect(hi(P.map((p) => p[1]))).toBeCloseTo(442, 0)
  })
  it('the mechanical belts wrap each tube that reaches them, and stop at its roof', () => {
    const b = ys(ms, 'belts')
    expect(hi(b)).toBeCloseTo(439, 0)
    const shortTube = part('belts')[0].mesh.positions.filter((_, i) => i % 3 === 0).some((x) => x > 40)
    expect(shortTube).toBe(true) // tube 2 (x 34.5–57.5) reaches the first belt
  })
  it('the Skydeck Ledge: four glass boxes out from the 103rd floor on the west face', () => {
    const l = part('ledge')
    expect(l[0].style).toBe('willis-ledge')
    const xs = l[0].mesh.positions.filter((_, i) => i % 3 === 0)
    expect(lo(xs)).toBeLessThan(-11.5 - 1); expect(hi(xs)).toBeLessThanOrEqual(-11.5 + 1e-6)
    expect(lo(ys(l))).toBeCloseTo(412, 0)
    for (const m of ms) expect(frontFacing(m.mesh), m.part).toBe(true)
  })
})

describe('Carbide & Carbon detail (user: the other icons to the same standard)', () => {
  const r = carbideDetail({ tower: sq(0, 0, 40, 26), bodyTop: 137, graniteTop: 9, setbacks: [[118, 0.78], [131, 0.6]], key: 'carbidecarbon' })
  const xs = (ms, part) => ms.filter((m) => m.part === part).flatMap(({ mesh }) => mesh.positions.filter((_, i) => i % 3 === 0))
  it('steps back twice into the gold-crowned tower: each tier narrower, the last ending at the body top', () => {
    expect(r.tiers).toHaveLength(2)
    expect(r.tiers.map((t) => [t.base, t.top])).toEqual([[118, 131], [131, 137]])
    expect(r.shaftTop).toBe(118)
    const w = (t) => hi(t.outer.map((p) => p[0])) - lo(t.outer.map((p) => p[0]))
    expect(w(r.tiers[0])).toBeCloseTo(40 * 0.78); expect(w(r.tiers[1])).toBeCloseTo(40 * 0.6)
  })
  it('a polished black granite base, dark green terra-cotta piers up the shaft, gold-leaf caps and a gold crown', () => {
    const style = (p) => r.meshes.find((m) => m.part === p)?.style
    expect(style('granite')).toBe('cc-granite'); expect(hi(ys(r.meshes, 'granite'))).toBeCloseTo(9, 0)
    expect(style('piers')).toBe('carbidecarbon')
    expect(lo(ys(r.meshes, 'piers'))).toBeCloseTo(9, 0); expect(hi(ys(r.meshes, 'piers'))).toBeCloseTo(118, 0)
    for (const p of ['pier-caps', 'gold-piers', 'gold-bands']) expect(style(p), p).toBe('gold-leaf')
    expect(lo(ys(r.meshes, 'gold-piers'))).toBeGreaterThanOrEqual(118 - 1e-6); expect(hi(ys(r.meshes, 'gold-bands'))).toBeCloseTo(137, 0)
  })
  it('stays on its footprint (a metre of relief at most) and every face points outward', () => {
    for (const p of ['granite', 'piers', 'pier-caps', 'gold-piers', 'gold-bands']) { const x = xs(r.meshes, p); expect(lo(x), p).toBeGreaterThan(-21.01); expect(hi(x), p).toBeLessThan(21.01) }
    for (const m of r.meshes) expect(frontFacing(m.mesh), m.part).toBe(true)
    expect(tris(r.meshes)).toBeLessThan(20000)
  })
})
