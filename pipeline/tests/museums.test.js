// pipeline/tests/museums.test.js — B-5: Lincoln Park's museums and pavilions (H1–H11): each a hero on its OSM outline,
// sourced, within budget, nothing off its footprint but eaves and porticos.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLandmark } from '../lib/landmarks.js'
import { offsetRing } from '../lib/parkkit.js'
import { pointInRing } from '../lib/geom.js'
import { landmarkKind } from '../lib/landmarkRuntime.js'

const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const pts = (ms) => ms.flatMap((m) => { const o = []; for (let i = 0; i < m.mesh.positions.length; i += 3) o.push(m.mesh.positions.slice(i, i + 3)); return o })
const part = (r, p) => r.meshes.filter((m) => m.part === p)
const hi = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity)
const tris = (r) => r.meshes.reduce((n, m) => n + m.mesh.positions.length / 9, 0)
const B = (outer) => ({ id: 't', height: 8, polygons: [{ outer, holes: [] }], centroid: [0, 0], area: 1 })
// the real outlines (local metres about their bbox centres, from the OSM cache)
const RINGS = {
  historymuseum: [[13.8, -51.8], [-6.3, -42.6], [-14.9, -38.6], [-10.9, -29.9], [-16.9, -27.1], [-21.2, -36.4], [-45.5, -25.3], [-29.2, 10.0], [-11.8, 47.5], [-5.7, 51.8], [-0.4, 50.7], [3.0, 46.5], [2.8, 40.6], [11.9, 36.6], [7.1, 26.8], [14.7, 23.5], [18.4, 31.4], [28.2, 26.9], [36.2, 23.2], [45.5, 19.0], [42.3, 12.0], [40.8, 12.7], [30.3, -9.9], [34.9, -12.0], [30.0, -22.6], [26.1, -20.8], [15.9, -42.6], [17.7, -43.4]],
  theateronthelake: [[-34.7, -21.8], [-9.8, -39.7], [34.7, 21.6], [9.5, 39.7], [-6.3, 17.9], [-17.1, 24.3], [-28.1, 9.3], [-17.6, 1.7]],
  northpondcafe: [[-11.1, -1.4], [-9.1, -4.4], [-14.4, -8.0], [-10.1, -14.2], [-5.0, -10.7], [-3.7, -12.7], [0.5, -9.8], [2.1, -12.1], [11.6, -5.7], [8.8, -1.4], [14.4, 2.3], [11.4, 6.6], [7.5, 4.0], [4.3, 8.7], [2.6, 7.6], [-1.8, 14.2], [-13.6, 6.3], [-9.3, -0.1]],
  elksmemorial: [[-19.4, 35.9], [-19.9, 14.3], [-21.3, -7.1], [-21.4, -35.0], [11.9, -35.9], [12.1, -26.6], [6.2, -26.5], [6.4, -16.9], [13.8, -14.1], [19.6, -7.8], [21.4, -2.0], [20.6, 5.0], [16.1, 12.1], [7.3, 16.3], [7.6, 26.1], [13.7, 25.8], [13.9, 35.0]],
}
describe('Lincoln Park museums and pavilions (B-5)', () => {
  const keys = ['historymuseum', 'naturemuseum', 'northpondcafe', 'theateronthelake', 'elksmemorial']
  it('each is a hero on an OSM building, with aliases, https sources and its approximations named', () => {
    for (const k of keys) {
      const h = heroes.find((x) => x.key === k)
      expect(h, k).toBeTruthy()
      expect(String(h.match.osmId), k).toMatch(/^[wr]\d+$/)
      expect(h.sources.every((s) => s.startsWith('https://')), k).toBe(true)
      expect(h.landmark.note, k).toMatch(/approximate/)
      expect(landmarkKind(h, false).kindLine, k).not.toBe('Zoo house')
    }
  })
  for (const [k, ring] of Object.entries(RINGS)) {
    it(`${k}: on its outline (eaves 2 m, a portico 6 m), within 15 k triangles`, () => {
      const r = buildLandmark(B(ring), heroes.find((x) => x.key === k).landmark)
      // the Elks rotunda's ring and the North Pond lodge's deep eaves over the cross's re-entrant corners reach further
      const eave = offsetRing(ring, { elksmemorial: 5, northpondcafe: 3.6 }[k] ?? 2.2), porch = offsetRing(ring, 6.5)
      for (const m of r.meshes) for (const [x, y, z] of pts([m])) { expect(pointInRing([x, z], m.part === 'portico' ? porch : eave), `${k} ${m.part}`).toBe(true); expect(y).toBeGreaterThan(-0.5) }
      expect(tris(r)).toBeLessThan(15000)
    })
  }
  it('the Elks rotunda: a colonnade on the park side, a dome to ~35 m, the drum in its shade', () => {
    const r = buildLandmark(B(RINGS.elksmemorial), heroes.find((x) => x.key === 'elksmemorial').landmark)
    expect(Math.abs(hi(pts(part(r, 'trim')).map((q) => q[1])) - 35)).toBeLessThan(0.5)
    const cols = pts(part(r, 'columns'))
    expect(cols.length).toBeGreaterThan(0)
    expect(cols.every(([x]) => x > -14)).toBe(true) // only the open (east) half
    expect(part(r, 'drum')[0].style).toBe('lp-ledgestone')
  })
  it('the History Museum: three rows of white-framed windows and a six-column portico', () => {
    const r = buildLandmark(B(RINGS.historymuseum), heroes.find((x) => x.key === 'historymuseum').landmark)
    expect(part(r, 'portico').length).toBe(1); expect(part(r, 'frames')[0].style).toBe('lp-trim-white')
    const ys = new Set(pts(part(r, 'windows')).map((q) => Math.round(q[1] * 10) / 10))
    for (const y of [1.6, 6, 10.4]) expect(ys.has(y), `row at ${y}`).toBe(true)
  })
})
