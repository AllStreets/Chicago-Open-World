import { describe, it, expect } from 'vitest'
import { buildLandmark, LANDMARK_FACADES as F } from '../lib/landmarks.js'
import { unproject } from '../../shared/project.js'

export const ll = ([x, z]) => { const [lon, lat] = unproject(x, z); return { lat, lon } }
export const pts = (ms) => ms.flatMap((x) => { const o = []; for (let i = 0; i < x.mesh.positions.length; i += 3) o.push(x.mesh.positions.slice(i, i + 3)); return o })
export const ymax = (ms) => Math.max(...pts(ms).map((q) => q[1]))
export const synth = (c, r = 20) => ({ id: 's', polygons: [{ outer: Array.from({ length: 24 }, (_, i) => [c[0] + r * Math.cos((i / 24) * 2 * Math.PI), c[1] + r * Math.sin((i / 24) * 2 * Math.PI)]), holes: [] }], centroid: c, height: 0 })
export const box = (x0, z0, x1, z1, h) => ({ id: 'b', polygons: [{ outer: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], holes: [] }], centroid: [(x0 + x1) / 2, (z0 + z1) / 2], height: h })

describe('Crown Fountain', () => {
  const r = buildLandmark(synth([340, 60]), { type: 'crownFountain', towers: [ll([339.5, 34.5]), ll([340.5, 86])] })
  it('two 15.2 m glass-block towers across a 71 × 15 m black granite pool', () => {
    const towers = r.meshes.filter((m) => m.part === 'tower')
    expect(towers).toHaveLength(2); expect(ymax(towers)).toBeCloseTo(15.2)
    expect(towers.every((m) => m.facade === F.stone && m.style === 'crown-glass-block')).toBe(true)
    const zs = pts(r.meshes.filter((m) => m.part === 'pool')).map((q) => q[2])
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(71, 0)
  })
  it('an LED face on each tower, facing the pool, each with its own face uniform', () => {
    const s = r.meshes.filter((m) => m.part === 'screen')
    expect(s.map((m) => m.facade)).toEqual([F.face, F.face]); expect(s.map((m) => m.seed)).toEqual([0.25, 0.75])
    expect(Math.max(...s[0].mesh.uvs)).toBeCloseTo(1); expect(Math.min(...s[0].mesh.uvs)).toBeCloseTo(0)
    expect(s[0].mesh.normals[2]).toBeGreaterThan(0.9)   // the north tower's face looks south, down the pool
  })
  it('a spout from each mouth, and a plaza that keeps people out of the towers', () => {
    expect(r.runtime.crown.spouts.map((x) => x.tower)).toEqual([0, 1])
    expect(r.runtime.crown.spouts.every((x) => x.kind === 'crown')).toBe(true)
    expect(r.runtime.plazas[0].avoid).toHaveLength(2)
  })
})

describe('Lurie Garden', () => {
  const r = buildLandmark(synth([506, 66], 50), { type: 'lurie', L: 100, W: 100, bearing: 90 })
  it('a 15 ft (4.6 m) Shoulder Hedge, dark and light plates, and the seam boardwalk', () => {
    expect(ymax(r.meshes.filter((m) => m.part === 'hedge'))).toBeCloseTo(4.6)
    expect(r.meshes.filter((m) => m.part === 'planting').map((m) => m.style).sort()).toEqual(['lurie-dark-plate', 'lurie-light-plate'])
    expect(r.meshes.some((m) => m.part === 'seam')).toBe(true)
  })
})

describe('BP Bridge', () => {
  const path = [[572, -118], [600, -95], [630, -138], [660, -98], [692, -146], [722, -120]].map(ll)
  const r = buildLandmark(synth([645, -115]), { type: 'bpBridge', path, rise: 4.4 })
  it('a serpentine deck rising over Columbus Drive, clad in stainless steel', () => {
    const skin = r.meshes.filter((m) => m.part === 'skin')
    expect(skin[0].facade).toBe(F.bronze); expect(skin[0].style).toBe('gehry-stainless')
    expect(ymax(r.meshes)).toBeGreaterThan(6); expect(ymax(r.meshes)).toBeLessThan(6.8)
    const deck = pts(r.meshes.filter((m) => m.part === 'deck'))
    expect(deck.some((q) => Math.hypot(q[0] - 572, q[2] + 118) < 2.5)).toBe(true)
    expect(deck.some((q) => Math.hypot(q[0] - 722, q[2] + 120) < 2.5)).toBe(true)
  })
})

describe('Art Institute', () => {
  const r = buildLandmark(box(314, 151, 561, 397, 22), { type: 'artInstitute', facingBearing: 270, lions: [ll([308, 288]), ll([308, 312])], canopy: { at: ll([492, 206]), bearing: 90, L: 100, W: 110, y: 24 } })
  it('two bronze lions on plinths, looking west down Michigan Avenue', () => {
    const lions = r.meshes.filter((m) => m.part === 'lion')
    expect(lions).toHaveLength(2)
    for (const l of lions) { expect(l.facade).toBe(F.bronze); expect(Math.min(...pts([l]).map((q) => q[0]))).toBeLessThan(308 - 1.5) }
  })
  it('the Modern Wing "flying carpet" floats at its height', () => {
    const c = pts(r.meshes.filter((m) => m.part === 'modern-wing-canopy'))
    expect(Math.max(...c.map((q) => q[1]))).toBeCloseTo(24.35)
  })
})
