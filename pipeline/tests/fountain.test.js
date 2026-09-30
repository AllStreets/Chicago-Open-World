import { describe, it, expect } from 'vitest'
import { buildLandmark, FOUNTAIN, seahorseUnit, SEAHORSE_MOUTH, fountainEmitters, LANDMARK_FACADES as F } from '../lib/landmarks.js'

const pts = (m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) o.push(m.positions.slice(i, i + 3)); return o }
const all = (ms) => ms.flatMap((x) => pts(x.mesh))
const fountain = () => buildLandmark({ id: 'f', polygons: [], centroid: [0, 0] }, { type: 'fountain' })

describe('Buckingham Fountain (E1)', () => {
  it('the 85 m pool and three basins of 31, 18 and 7.3 m', () => {
    const { meshes } = fountain()
    const pool = all(meshes.filter((m) => m.part === 'pool'))
    expect(Math.max(...pool.map((q) => Math.hypot(q[0], q[2])))).toBeCloseTo(42.5, 0)
    const basins = meshes.filter((m) => m.part === 'basin')
    expect(basins).toHaveLength(3)
    const diam = basins.map((b) => 2 * Math.max(...pts(b.mesh).map((q) => Math.hypot(q[0], q[2])))).sort((a, b) => b - a)
    for (const [got, want] of [[diam[0], 31.4], [diam[1], 18.3], [diam[2], 7.3]]) expect(Math.abs(got - want) / want).toBeLessThan(0.03)
  })
  it('the upper lip stands 7.6 m above the lower basin water, in pink marble with scalloped edges', () => {
    const { meshes } = fountain()
    const upper = meshes.filter((m) => m.part === 'basin').map((b) => Math.max(...pts(b.mesh).map((q) => q[1]))).sort((a, b) => b - a)[0]
    expect(upper - FOUNTAIN.basins[0].water).toBeCloseTo(7.6, 1)
    for (const m of meshes.filter((x) => ['basin', 'pedestal', 'rim', 'crown'].includes(x.part))) { expect(m.facade).toBe(F.stone); expect(m.style).toBe('georgia-pink-marble') }
    const rim = pts(meshes.filter((m) => m.part === 'basin')[0].mesh).filter((q) => Math.abs(q[1] - FOUNTAIN.basins[0].rim) < 0.01).map((q) => Math.hypot(q[0], q[2]))
    expect(Math.min(...rim)).toBeLessThan(0.96 * (FOUNTAIN.basins[0].r - 0.4))   // shell lobes pull the rim in
  })
  it('four pairs of bronze seahorses in the pool', () => {
    const horses = fountain().meshes.filter((m) => m.part === 'seahorse')
    expect(horses).toHaveLength(8)
    for (const h of horses) { expect(h.facade).toBe(F.bronze); expect(h.style).toBe('seahorse-bronze') }
  })
  it('the seahorse unit is a single ≤ 6k-triangle figure, ~4–5 m tall, facing +x, mouth where the jets start', () => {
    const u = seahorseUnit(), p = pts(u)
    expect(p.length / 3).toBeLessThanOrEqual(6000)
    const top = Math.max(...p.map((q) => q[1])); expect(top).toBeGreaterThan(3.5); expect(top).toBeLessThan(5.2)
    expect(p.some((q) => Math.hypot(q[0] - SEAHORSE_MOUTH[0], q[1] - SEAHORSE_MOUTH[1], q[2]) < 0.4)).toBe(true)
  })
  it('the seahorse rears (P3): the mouth is the high point forward of the chest, and it stands on its rock', () => {
    const p = pts(seahorseUnit())
    expect(SEAHORSE_MOUTH[1]).toBeGreaterThan(2.8)                       // head up, not drooping to the water
    const nearRock = p.filter((q) => q[1] < 1.3 && Math.hypot(q[0], q[2]) < 1.7).length
    expect(nearRock / p.length).toBeGreaterThan(0.1)                     // the figure sits on the rock at the origin
    expect(Math.min(...p.map((q) => q[0]))).toBeGreaterThan(-3.2)
  })
  it('emitters: a 46 m centre jet, eight seahorse jets arcing inward, ring and lower-basin jets', () => {
    const e = fountainEmitters([0, 0])
    const c = e.filter((x) => x.kind === 'centre'); expect(c).toHaveLength(1)
    expect(c[0].p[1] + c[0].h).toBeCloseTo(46)
    const s = e.filter((x) => x.kind === 'seahorse'); expect(s).toHaveLength(8)
    for (const j of s) expect(j.dir[0] * j.p[0] + j.dir[2] * j.p[2]).toBeLessThan(0)
    expect(e.filter((x) => x.kind === 'ring')).toHaveLength(16)
    expect(e.filter((x) => x.kind === 'lower')).toHaveLength(24)
  })
  it('publishes its emitters and a plaza ring around the pool', () => {
    const r = fountain().runtime
    expect(r.fountain.emitters.length).toBe(49)
    expect(r.plazas[0].avoid[0].r).toBeGreaterThan(FOUNTAIN.poolR)
  })
})

import { setSeahorseMesh } from '../lib/landmarks.js'
describe('Blender seahorse unit (P3 Task 6)', () => {
  it('the fountain uses a pre-loaded Blender unit that fits the slot, and the stand-in otherwise', () => {
    const u = seahorseUnit()
    const fit = { positions: u.positions.slice(), normals: u.normals.slice(), uvs: u.uvs.slice() }
    for (let i = 0; i < 3; i++) fit.positions.push(...u.positions.slice(0, 9)) // a different mesh, same extent
    setSeahorseMesh(fit)
    const tris = (m) => m.mesh.positions.length / 9
    expect(tris(fountain().meshes.find((m) => m.part === 'seahorse'))).toBe(fit.positions.length / 9)
    setSeahorseMesh({ positions: [0, 0, 0, 40, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 0, 0, 0, 0] }) // wrong size
    expect(tris(fountain().meshes.find((m) => m.part === 'seahorse'))).toBe(u.positions.length / 9)
    setSeahorseMesh(null)
  })
})
