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
  it('Cloud Gate: 20 × 13 × 10 m, a 3.7 m arch you can walk under, the omphalos apex at 8.2 m', () => {
    const r = buildLandmark(B(rect(-10, -6.4, 10, 6.4)), { type: 'bean' })
    expect(r.meshes).toHaveLength(0)
    const [d] = r.detached
    expect(d.key).toBe('cloudgate')
    const p = []; for (let i = 0; i < d.mesh.positions.length; i += 3) p.push([...d.mesh.positions.slice(i, i + 3), ...d.mesh.normals.slice(i, i + 3)])
    const [x0, x1] = ext(p, 0), [z0, z1] = ext(p, 2)
    expect(Math.max(x1 - x0, z1 - z0)).toBeCloseTo(20, 0)
    expect(Math.min(x1 - x0, z1 - z0)).toBeCloseTo(13, 0)
    expect(ext(p, 1)[1]).toBeCloseTo(10, 1)
    expect(ext(p, 1)[0]).toBeLessThan(0.3)                                                  // rests on its ends
    const apex = p.filter((q) => Math.hypot(q[0], q[2]) < 0.8 && q[1] < 9.5)
    expect(Math.min(...apex.map((q) => q[1]))).toBeCloseTo(8.2, 0)
    expect(apex.every((q) => q[4] < -0.5)).toBe(true)                                        // the cavity faces down
    const under = p.filter((q) => Math.hypot(q[0], q[2]) < 3 && q[1] < 9)
    expect(under.every((q) => q[1] > 3.5)).toBe(true)                                        // headroom under the arch
    const topV = p.filter((q) => Math.hypot(q[0], q[2]) < 0.8 && q[1] > 9.5)
    expect(topV.every((q) => q[4] > 0.9)).toBe(true)
    expect(r.runtime.plazas[0].avoid[0].r).toBe(11)
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
  it('the Water Tower in full (user: icons to the Tribune/Wrigley standard): pepper-box turrets on the base and the shaft, crenellations, lancets, an octagonal lantern and cupola', () => {
    const r = buildLandmark(B(rect(-9, -9, 9, 9), { height: 55 }), { type: 'castellated', heightM: 55 })
    const part = (p) => r.meshes.filter((m) => m.part === p)
    expect(part('shaft-turret')).toHaveLength(4)
    // every turret ends in a pepper-box cap above its crenellated rim
    expect(part('caps').length).toBe(1)
    const merl = pts(part('merlons'))
    expect(new Set(merl.map((q) => Math.round(q[1]))).size).toBeGreaterThanOrEqual(3) // battlements at several levels
    // the stage above the square shaft is an octagon, then the open lantern, the cupola and the finial at the very top
    expect(r.pieces.some((p) => p.outer.length === 8)).toBe(true)
    for (const p of ['lantern', 'lantern-arches', 'cupola', 'finial', 'lancets', 'doorways']) expect(part(p).length, p).toBeGreaterThan(0)
    expect(part('lancets')[0].style).toBe('gothic-shadow')
    const fin = pts(part('finial'))
    expect(Math.max(...fin.map((q) => q[1]))).toBeCloseTo(55, 0)
    expect(Math.hypot(...[fin.reduce((a, q) => a + q[0], 0) / fin.length, fin.reduce((a, q) => a + q[2], 0) / fin.length])).toBeLessThan(0.5)
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
