import { describe, it, expect } from 'vitest'
import { buildLandmark, LANDMARK_FACADES as F } from '../lib/landmarks.js'
import { classifyFacade, FACADE_FAMILIES } from '../lib/classify.js'

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const pts = (meshes) => meshes.flatMap((m) => { const o = []; for (let i = 0; i < m.mesh.positions.length; i += 3) o.push(m.mesh.positions.slice(i, i + 3)); return o })
const ext = (p, k) => [Math.min(...p.map((q) => q[k])), Math.max(...p.map((q) => q[k]))]
const B = (outer, o = {}) => ({ id: 'l', height: 10, polygons: [{ outer, holes: [] }], centroid: [(outer[0][0] + outer[2][0]) / 2, (outer[0][1] + outer[2][1]) / 2], ...o })

describe('landmarks', () => {
  it('Ferris wheel: a ring in the footprint’s long vertical plane, hub near half height, LED rim, gondolas', () => {
    const { meshes, replace } = buildLandmark(B(rect(-30, -4, 30, 4)), { type: 'wheel', heightM: 60 })
    expect(replace).toBe(true)
    const p = pts(meshes)
    const [y0, y1] = ext(p, 1); expect(y1).toBeGreaterThan(58); expect(y1).toBeLessThan(62)
    const [x0, x1] = ext(p, 0); expect(x1 - x0).toBeGreaterThan(50)
    const [z0, z1] = ext(p, 2); expect(z1 - z0).toBeLessThan(26)
    expect(meshes.some((m) => m.facade === F.led)).toBe(true)
    expect(meshes.filter((m) => m.part === 'gondola').length).toBeGreaterThanOrEqual(1)
  })
  it('Cloud Gate: a 20 m chrome bean with an arch you can walk under', () => {
    const { meshes } = buildLandmark(B(rect(-10, -6.4, 10, 6.4)), { type: 'bean' })
    expect(meshes.every((m) => m.facade === F.chrome)).toBe(true)
    const p = pts(meshes)
    expect(ext(p, 1)[1]).toBeCloseTo(10, 0)
    const [x0, x1] = ext(p, 0); expect(x1 - x0).toBeGreaterThan(19)
    // under the middle of the bean the surface starts ~3.7 m up
    const under = p.filter((q) => Math.abs(q[0]) < 1 && Math.abs(q[2]) < 1)
    expect(Math.min(...under.map((q) => q[1]))).toBeGreaterThan(3)
  })
  it('Buckingham Fountain: a wide pool of water and three stacked basins', () => {
    const { meshes } = buildLandmark({ id: 'f', polygons: [], centroid: [0, 0] }, { type: 'fountain' })
    const water = meshes.filter((m) => m.facade === F.water)
    const [x0, x1] = ext(pts(water), 0); expect(x1 - x0).toBeGreaterThan(80)
    expect(meshes.filter((m) => m.part === 'basin').length).toBe(3)
  })
  it('theatre sign: a tall vertical marquee standing off the street façade', () => {
    const { meshes, replace } = buildLandmark(B(rect(0, 0, 40, -60), { height: 25 }), { type: 'theatreSign', facingBearing: 90 })
    expect(replace).toBeFalsy()
    const sign = meshes.filter((m) => m.part === 'sign')
    const p = pts(sign)
    expect(ext(p, 1)[1] - ext(p, 1)[0]).toBeGreaterThan(15)
    expect(ext(p, 0)[0]).toBeGreaterThan(39) // east face
    expect(sign.every((m) => m.facade === F.marquee)).toBe(true)
  })
  it('museum dome and portico sit on the building', () => {
    const b = B(rect(-50, -20, 50, 20), { height: 24 })
    const d = buildLandmark(b, { type: 'museum', dome: { r: 9, style: 'copper' }, portico: { ends: 2, columns: 8, h: 16 } })
    expect(d.meshes.some((m) => m.part === 'dome')).toBe(true)
    expect(d.meshes.filter((m) => m.part === 'column').length).toBe(16)
    expect(Math.max(...pts(d.meshes.filter((m) => m.part === 'dome')).map((q) => q[1]))).toBeGreaterThan(24 + 8)
  })
  it('castellated water tower: stepped shaft with corner turrets and a lantern', () => {
    const r = buildLandmark(B(rect(-9, -9, 9, 9), { height: 55 }), { type: 'castellated', heightM: 55 })
    expect(r.replace).toBe(true)
    expect(r.pieces.length).toBeGreaterThanOrEqual(3)
    expect(r.meshes.filter((m) => m.part === 'turret').length).toBe(4)
    expect(Math.max(...pts(r.meshes).map((q) => q[1]), ...r.pieces.map((p) => p.top))).toBeCloseTo(55, 0)
  })
})

describe('campus buildings', () => {
  const F2 = Object.fromEntries(FACADE_FAMILIES.map((n, i) => [n, i]))
  it('pre-war college halls are stone, mid-century campus blocks are precast concrete', () => {
    expect(classifyFacade({ height: 20, year: 1925, area: 2000, type: 'university' })).toBe(F2['loop-limestone'])
    expect(classifyFacade({ height: 20, year: 1968, area: 2000, type: 'university' })).toBe(F2['precast-concrete'])
    expect(classifyFacade({ height: 12, year: 1910, area: 900, type: 'college' })).toBe(F2['loop-limestone'])
  })
})

describe('landmark clearings', () => {
  it('the Bean, the fountain and the Great Lawn keep their ground free of trees', () => {
    const bean = buildLandmark(B(rect(-10, -6.4, 10, 6.4)), { type: 'bean' })
    expect(bean.clear?.length).toBe(1)
    const f = buildLandmark({ id: 'f', polygons: [], centroid: [0, 0] }, { type: 'fountain' })
    expect(Math.max(...f.clear[0].map((p) => Math.hypot(...p)))).toBeGreaterThan(45)
    const pav = buildLandmark(B(rect(-15, -15, 15, 15)), { type: 'pavilion', facingBearing: 90, lawn: { dist: 70, L: 118, W: 80, h: 20 } })
    const xs = pav.clear[0].map((p) => p[0])
    expect(Math.max(...xs)).toBeGreaterThan(120)
  })
})
