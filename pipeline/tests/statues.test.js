// pipeline/tests/statues.test.js
import { describe, it, expect } from 'vitest'
import { statueFallback, statueMesh, plinth } from '../lib/statues.js'
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)

describe('statues', () => {
  for (const kind of ['ceres', 'lincoln', 'grant', 'goethe', 'seahorse']) {
    it(`${kind} fallback has the requested height and ≤ 3 k tris`, () => {
      const m = statueFallback(kind, { at: [0, 0], base: 100, heightM: 9.4 })
      expect(Math.min(...ys(m))).toBeCloseTo(100, 1)
      expect(Math.max(...ys(m))).toBeCloseTo(109.4, 0)
      expect(m.positions.length / 9).toBeLessThanOrEqual(3000)
    })
  }
  it('uses the fallback when the Blender export is absent', async () => {
    const r = await statueMesh({ kind: 'ceres', file: 'heroes/out/__missing__.glb', heightM: 9.4 }, { at: [0, 0], base: 175 })
    expect(r.source).toBe('fallback')
    expect(Math.max(...ys(r.mesh))).toBeCloseTo(184.4, 0)
  })
  it('plinth is a closed box', () => {
    const m = plinth({ at: [0, 0], base: 0, w: 3, h: 2 })
    expect(m.positions.length / 9).toBe(12)
  })
})

import { placeStatue } from '../lib/statues.js'
describe('placeStatue (build-time, synchronous)', () => {
  it('places a pre-loaded export on its base, scaled to heightM, turned by the bearing', () => {
    const pre = { positions: [0, 0, 0, 1, 0, 0, 0, 2, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 0, 0, 0, 0] }
    const r = placeStatue({ kind: 'ceres', heightM: 9.4 }, { at: [100, -50], base: 175, bearingDeg: 90 }, pre)
    expect(r.source).toBe('blender')
    const ys = r.mesh.positions.filter((_, i) => i % 3 === 1)
    expect(Math.min(...ys)).toBeCloseTo(175); expect(Math.max(...ys)).toBeCloseTo(184.4)
    expect(r.mesh.positions[3]).toBeCloseTo(100); expect(r.mesh.positions[5]).toBeCloseTo(-50 + 4.7) // local +X → south, ×4.7
  })
  it('falls back to the stand-in without a pre-loaded export', () => {
    expect(placeStatue({ kind: 'ceres', heightM: 9.4 }, { at: [0, 0], base: 175 }, null).source).toBe('fallback')
  })
})

import { buildLandmark } from '../lib/landmarks.js'
describe('statues landmark (Task 9)', () => {
  it('statues landmark places one plinth + figure per item, within 30 k tris total', async () => {
    const b = { polygons: [{ outer: [[-5, -5], [5, -5], [5, 5], [-5, 5]], holes: [] }], centroid: [0, 0], area: 100, height: 0 }
    const r = await buildLandmark(b, { type: 'statues', items: [
      { kind: 'lincoln', local: [0, 0], heightM: 3.7, plinthH: 2, bearingDeg: 0, file: 'heroes/out/__missing__.glb' },
      { kind: 'grant', local: [40, 0], heightM: 5, plinthH: 6, bearingDeg: 90, file: 'heroes/out/__missing__.glb' },
    ] })
    expect(r.meshes.filter((m) => m.part === 'plinth')).toHaveLength(2)
    expect(r.meshes.filter((m) => m.part === 'figure')).toHaveLength(2)
    expect(r.meshes.reduce((n, { mesh }) => n + mesh.positions.length / 9, 0)).toBeLessThanOrEqual(30000)
  })
})
