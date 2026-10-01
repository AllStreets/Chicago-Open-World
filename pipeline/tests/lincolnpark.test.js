// pipeline/tests/lincolnpark.test.js — "the cool stone structures in Lincoln Park" (user request).
import { describe, it, expect } from 'vitest'
import { chessPavilion, couchTomb, lilyPool, wavelandClock } from '../lib/lincolnpark.js'
import { buildLandmark } from '../lib/landmarks.js'

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const B = (outer, o = {}) => ({ id: 't', height: 6, polygons: [{ outer, holes: [] }], centroid: [(outer[0][0] + outer[2][0]) / 2, (outer[0][1] + outer[2][1]) / 2], area: Math.abs((outer[2][0] - outer[0][0]) * (outer[2][1] - outer[0][1])), ...o })
const pts = (ms) => ms.flatMap((m) => { const o = []; for (let i = 0; i < m.mesh.positions.length; i += 3) o.push(m.mesh.positions.slice(i, i + 3)); return o })
const part = (r, p) => r.meshes.filter((m) => m.part === p)
const hi = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity), lo = (a) => a.reduce((m, v) => Math.min(m, v), Infinity)
const tris = (r) => r.meshes.reduce((n, m) => n + m.mesh.positions.length / 9, 0)

describe('the Chess Pavilion (Webster & Gilbertson, 1957)', () => {
  const r = chessPavilion(B(rect(0, 0, 32, 8)), {})
  it('a thin flat roof on limestone end walls, with the five-foot king and queen flanking it', () => {
    for (const p of ['platform', 'end-walls', 'roof', 'tables', 'king', 'queen', 'reliefs']) expect(part(r, p).length, p).toBeGreaterThan(0)
    const roof = pts(part(r, 'roof')).map((q) => q[1])
    expect(lo(roof)).toBeGreaterThan(2.6); expect(hi(roof) - lo(roof)).toBeLessThan(0.6)
    for (const k of ['king', 'queen']) { const y = pts(part(r, k)).map((q) => q[1]); expect(hi(y) - lo(y), k).toBeGreaterThan(1.4) }
    // they stand at opposite ends, outside the end walls
    const kx = pts(part(r, 'king')).map((q) => q[0]), qx = pts(part(r, 'queen')).map((q) => q[0])
    expect(Math.min(hi(kx), hi(qx))).toBeLessThan(0.5); expect(Math.max(lo(kx), lo(qx))).toBeGreaterThan(31.5)
  })
  it('is all limestone and concrete rows, and replaces the plain shelter box', () => {
    expect(r.replace).toBe(true)
    expect(new Set(r.meshes.map((m) => m.style))).toEqual(new Set(['lp-limestone', 'lp-concrete', 'gothic-shadow']))
    expect(tris(r)).toBeLessThan(15000)
  })
})

describe('the Couch Tomb (1858)', () => {
  const r = couchTomb(B(rect(0, 0, 6, 4.5)), {})
  it('a limestone vault: plinth, block, a heavy cornice and attic, an iron door', () => {
    for (const p of ['plinth', 'vault', 'cornice', 'attic', 'door']) expect(part(r, p).length, p).toBeGreaterThan(0)
    const y = pts(r.meshes).map((q) => q[1]); expect(hi(y)).toBeGreaterThan(4); expect(hi(y)).toBeLessThan(6)
    expect(part(r, 'door')[0].style).toBe('tomb-iron')
  })
})

describe('the Alfred Caldwell Lily Pool (1938)', () => {
  const r = lilyPool(B([[0, 0], [1, 0], [1, 1]], { centroid: [100, 100] }), { lengthM: 110, widthM: 22 })
  it('a long pool edged with stratified limestone ledges, a waterfall, the prairie pavilion and a council ring', () => {
    for (const p of ['pool', 'ledges', 'falls', 'pavilion-piers', 'pavilion-roof', 'council-ring']) expect(part(r, p).length, p).toBeGreaterThan(0)
    const pool = pts(part(r, 'pool')), zs = pool.map((q) => q[2])
    expect(hi(zs) - lo(zs)).toBeGreaterThan(90) // it runs north–south
    // ledges are thin stacked courses: many distinct course heights below a metre and a half
    const ly = new Set(pts(part(r, 'ledges')).map((q) => q[1].toFixed(2)))
    expect(ly.size).toBeGreaterThan(5); expect(hi([...ly].map(Number))).toBeLessThan(2.2)
    expect(r.clear.length).toBe(1) // the pool itself stays clear of trees
  })
  it('on the mapped pond: ledges follow its real banks, the falls at its north end, the water drawn just above the grass', () => {
    const pond = Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * Math.PI * 2; return [200 + 19 * Math.cos(a), 300 + 53 * Math.sin(a)] })
    const m = lilyPool({ polygons: [{ outer: pond, holes: [] }], centroid: [200, 300], area: Math.PI * 19 * 53 }, {})
    expect(part(m, 'pool')).toHaveLength(1)
    const L = pts(part(m, 'ledges'))
    // every ledge stone sits on the bank: within a few metres outside the water's edge, never out in the pond
    for (const [x, , z] of L) { const e = ((x - 200) / 19) ** 2 + ((z - 300) / 53) ** 2; expect(e).toBeGreaterThan(0.75) }
    const f = pts(part(m, 'falls')), fz = f.reduce((a, q) => a + q[2], 0) / f.length
    expect(fz).toBeLessThan(300 - 45) // north is −z
    expect(m.clear).toEqual([])
  })
  it('the council ring is a closed circle of stone seats', () => {
    const c = pts(part(r, 'council-ring')), cx = c.reduce((a, q) => a + q[0], 0) / c.length, cz = c.reduce((a, q) => a + q[2], 0) / c.length
    const d = c.map((q) => Math.hypot(q[0] - cx, q[2] - cz))
    expect(lo(d)).toBeGreaterThan(2); expect(hi(d)).toBeLessThan(6)
  })
})

describe('the Waveland Clock Tower (1931)', () => {
  const b = B(rect(0, 0, 60, 20), { pieces: [{ outer: rect(0, 0, 60, 20), holes: [], base: 0, top: 9 }] })
  const r = wavelandClock(b, {})
  it('a seven-storey brick and limestone Gothic tower rising from the fieldhouse, a clock on each face', () => {
    expect(r.replace).toBeFalsy()
    for (const p of ['tower', 'quoins', 'clock', 'belfry', 'pinnacles', 'parapet']) expect(part(r, p).length, p).toBeGreaterThan(0)
    const y = pts(r.meshes).map((q) => q[1]); expect(hi(y)).toBeGreaterThan(30); expect(hi(y)).toBeLessThan(42)
    expect(part(r, 'clock')[0].style).toBe('waveland-clock')
  })
})

describe('registered builders', () => {
  it('buildLandmark knows all four', () => {
    for (const type of ['chessPavilion', 'couchTomb', 'lilyPool', 'wavelandClock']) expect(() => buildLandmark(B(rect(0, 0, 20, 8), { pieces: [{ outer: rect(0, 0, 20, 8), holes: [], base: 0, top: 8 }] }), { type })).not.toThrow()
  })
})
