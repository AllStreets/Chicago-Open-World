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

// sculpt pass (user, 2026-09-30: "it reads as a plain slab"): a thin cantilevered canopy on slender supports, open
// sides, rows of stone chess tables with stools, and Gilbertson's carved chess pieces in relief on the end walls
describe('the Chess Pavilion, sculpted', () => {
  const r = chessPavilion(B(rect(0, 0, 32, 8)), {}) // long axis along x, centre (16, 4)
  const P = (p) => pts(part(r, p))
  const endWall = P('end-walls'), wallOuter = hi(endWall.map((q) => Math.abs(q[0] - 16)))
  it('the roof is a thin canopy that cantilevers past its end walls and far out over the open long sides', () => {
    const roof = P('roof'), rx = roof.map((q) => Math.abs(q[0] - 16)), rz = roof.map((q) => Math.abs(q[2] - 4))
    expect(hi(rx) - wallOuter).toBeGreaterThan(1) // overhangs the carved end walls
    const wz = hi(endWall.map((q) => Math.abs(q[2] - 4)))
    expect(hi(rz) - wz).toBeGreaterThan(1) // and the walls stop well short of the long edges
    // a thin edge: at the very rim the roof is under 0.2 m deep
    const rim = roof.filter((q) => Math.abs(q[2] - 4) > hi(rz) - 0.01).map((q) => q[1])
    expect(hi(rim) - lo(rim)).toBeLessThan(0.2)
  })
  it('stands on slender columns down its spine: nothing else rises above table height between the end walls', () => {
    const cols = P('columns')
    expect(cols.length).toBeGreaterThan(0)
    const roofLo = lo(P('roof').map((q) => q[1]))
    expect(hi(cols.map((q) => q[1]))).toBeGreaterThan(roofLo - 0.05)
    // slender: every column is under 0.3 m across, on the centre line
    const xs = [...new Set(cols.map((q) => Math.round(q[0])))]
    expect(xs.length).toBeGreaterThanOrEqual(2)
    for (const q of cols) expect(Math.abs(q[2] - 4)).toBeLessThan(0.15)
    const clusters = []
    for (const q of [...cols].sort((a, b) => a[0] - b[0])) { const c = clusters.at(-1); if (c && q[0] - c[1] < 0.5) c[1] = q[0]; else clusters.push([q[0], q[0]]) }
    for (const [a, b] of clusters) expect(b - a).toBeLessThan(0.3)
    // open sides: between the end walls, only the columns rise above 1 m
    const inner = wallOuter - 1
    for (const m of r.meshes) {
      if (['roof', 'columns', 'end-walls', 'reliefs', 'piece-reliefs', 'king', 'queen'].includes(m.part)) continue
      for (const q of pts([m])) if (Math.abs(q[0] - 16) < inner) expect(q[1], m.part).toBeLessThan(1)
    }
  })
  it('rows of stone chess tables, a checkerboard on each, a stool at either side', () => {
    const boards = part(r, 'boards'), stools = P('stools'), tops = P('tables')
    expect(boards.length).toBe(1)
    const sq = boards[0].mesh.positions.length / 18 // two triangles a dark square
    const tables = sq / 32
    expect(Number.isInteger(tables)).toBe(true); expect(tables).toBeGreaterThanOrEqual(10)
    expect(boards[0].style).toBe('gothic-shadow')
    // the board sits on the table top at chess-table height
    const by = P('boards').map((q) => q[1]); expect(lo(by)).toBeGreaterThan(0.7); expect(hi(by)).toBeLessThan(1)
    expect(hi(tops.map((q) => q[1]))).toBeLessThan(hi(by) + 0.001)
    // two stools to a table, lower than the table
    const feet = stools.filter((q) => q[1] < 0.21 + 1e-6)
    expect(feet.length).toBeGreaterThan(0)
    expect(hi(stools.map((q) => q[1]))).toBeLessThan(lo(by) - 0.1)
    const seatY = hi(stools.map((s) => s[1])), seats = []
    for (const s of stools) if (s[1] === seatY && !seats.some((c) => Math.hypot(c[0] - s[0], c[2] - s[2]) < 0.5)) seats.push(s)
    expect(seats.length).toBe(tables * 2)
  })
  it('the end walls carry chess pieces in relief: real geometry standing proud of the stone, a king at one end, a knight at the other', () => {
    const rel = part(r, 'piece-reliefs')
    expect(rel.length).toBe(1)
    const q = pts(rel), m = rel[0].mesh
    for (const e of [-1, 1]) {
      const side = q.filter((p) => Math.sign(p[0] - 16) === e)
      const proud = side.map((p) => Math.abs(p[0] - 16) - wallOuter)
      expect(hi(proud), `end ${e}`).toBeGreaterThan(0.06) // carved out of the face, not painted on it
      expect(lo(proud), `end ${e}`).toBeGreaterThan(-0.01)
      const ys = side.map((p) => p[1]); expect(hi(ys) - lo(ys), `end ${e}`).toBeGreaterThan(1.6) // a giant piece
    }
    // side faces: normals lying in the wall's plane (the relief's depth), not only the front
    let sideFaces = 0
    for (let i = 0; i < m.normals.length; i += 3) if (Math.abs(m.normals[i]) < 0.05) sideFaces++
    expect(sideFaces).toBeGreaterThan(30)
    // the two silhouettes differ: the king is mirror-symmetric, the knight's head faces one way
    const unmirrored = (e) => {
      const s = q.filter((p) => Math.sign(p[0] - 16) === e)
      return s.filter((p) => !s.some((o) => Math.abs(o[2] - (8 - p[2])) < 1e-3 && Math.abs(o[1] - p[1]) < 1e-3)).length / s.length
    }
    expect(Math.max(unmirrored(-1), unmirrored(1))).toBeGreaterThan(0.3)
    expect(Math.min(unmirrored(-1), unmirrored(1))).toBe(0)
  })
  it('stays a modest model', () => {
    expect(tris(r)).toBeLessThan(20000)
    // the real plan (OSM, 7.4 × 18.9 m) too
    expect(tris(chessPavilion(B(rect(0, 0, 18.9, 7.4)), { roofM: 3 }))).toBeLessThan(8000)
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
