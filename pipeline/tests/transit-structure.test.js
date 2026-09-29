import { describe, it, expect } from 'vitest'
import { createMesh, KIND } from '../lib/transit/meshkit.js'
import { elevatedPiece, embankmentPiece, atGradePiece, portalPiece, catenary, bentsMesh, junctionBox, GIRDER_BOTTOM, PORTAL } from '../lib/transit/structure.js'

const straight = (y, L = 100) => Array.from({ length: 11 }, (_, i) => [(i * L) / 10, y, 0])
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)
const xs = (m) => m.positions.filter((_, i) => i % 3 === 0)
const has = (m, k) => m.kind.includes(k)
const finite = (m) => m.positions.every(Number.isFinite) && m.normals.every(Number.isFinite)
const red = [0.565, 0.004, 0.03]

describe('track structure', () => {
  it('CTA elevated: girders, ties every 0.61 m, rails, third rail, walkway, line-colour fascia', () => {
    const m = createMesh(), ties = createMesh()
    elevatedPiece(m, ties, { pts: straight(7.2), operator: 'cta', colours: [red] })
    expect(ties.positions.length / 3 / 12).toBe(164) // top + bottom quad per tie; 100 m / 0.61 m
    for (const k of [KIND.steel, KIND.rail, KIND.accent]) expect(has(m, k)).toBe(true)
    expect(Math.max(...ys(m))).toBeCloseTo(7.25, 2) // third rail top
    expect(Math.min(...ys(m))).toBeCloseTo(7.2 - GIRDER_BOTTOM, 5)
    const i = m.kind.indexOf(KIND.accent)
    expect(m.colors.slice(i * 3, i * 3 + 3)).toEqual(red)
    expect(finite(m) && finite(ties)).toBe(true)
  })
  it('the fascia cycles through every line sharing the track', () => {
    const m = createMesh(), blue = [0, 0.35, 0.73]
    elevatedPiece(m, createMesh(), { pts: straight(7.2), operator: 'cta', colours: [red, blue] })
    const accents = new Set(m.kind.map((k, i) => (k === KIND.accent ? m.colors.slice(i * 3, i * 3 + 3).join() : null)).filter(Boolean))
    expect(accents.size).toBe(2)
  })
  it('Metra viaduct: through girders and a ballast deck, no ties', () => {
    const m = createMesh(), ties = createMesh()
    elevatedPiece(m, ties, { pts: straight(5.8), operator: 'metra', colours: [] })
    expect(ties.positions).toHaveLength(0); expect(has(m, KIND.ballast)).toBe(true)
    expect(Math.max(...ys(m))).toBeCloseTo(6.7, 2); expect(Math.min(...ys(m))).toBeCloseTo(4.5, 2)
  })
  it('embankment walls reach the ground; at-grade beds sit on it', () => {
    const e = createMesh(); embankmentPiece(e, { pts: straight(5.8), operator: 'metra' })
    expect(Math.min(...ys(e))).toBe(0); expect(has(e, KIND.concrete) && has(e, KIND.ballast)).toBe(true)
    const g = createMesh(); atGradePiece(g, { pts: straight(0.35), operator: 'cta' })
    expect(Math.max(...ys(g))).toBeCloseTo(0.4, 2); expect(Math.min(...ys(g))).toBeGreaterThanOrEqual(-0.12)
  })
  it('a subway portal: trench walls to the parapet and a headwall over the tunnel mouth', () => {
    const pts = Array.from({ length: 17 }, (_, i) => [i * 10, +(0.35 - i * 0.4).toFixed(2), 0]) // 0.35 → −6.05
    const m = createMesh(); portalPiece(m, { pts, operator: 'cta' })
    expect(Math.max(...ys(m))).toBeCloseTo(PORTAL.parapet, 5)
    // the headwall spans wider than the trench walls (|z| ≤ 2.8), right where the track passes −4.6 m (x = 130)
    const verts = Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions.slice(i * 3, i * 3 + 3))
    expect(verts.some(([x, , z]) => Math.abs(z) > 2.9 && Math.abs(x - 130) < 0.5)).toBe(true)
  })
  it('catenary masts and wires ride above the track', () => {
    const m = createMesh(); catenary(m, { pts: straight(0.35, 200) })
    expect(Math.max(...ys(m))).toBeCloseTo(0.35 + 6.2, 1)
  })
  it('bents stand on the street and stop under the girders; low bents are skipped', () => {
    const m = createMesh()
    bentsMesh(m, [{ a: [0, -3.5], b: [0, 3.5], y: 7.2, dir: [1, 0] }])
    expect(Math.min(...ys(m))).toBe(0); expect(Math.max(...ys(m))).toBeCloseTo(7.2 - GIRDER_BOTTOM, 5)
    const low = createMesh(); bentsMesh(low, [{ a: [0, -3.5], b: [0, 3.5], y: 2, dir: [1, 0] }])
    expect(low.positions).toHaveLength(0)
  })
  it('a Loop junction box spans its square on a 9 m grid, with a tower cab', () => {
    const m = createMesh(); junctionBox(m, { x: 0, z: 0, y: 7.2, size: 36, tower: true })
    expect(Math.min(...xs(m))).toBeCloseTo(-18.3, 5); expect(Math.max(...xs(m))).toBeCloseTo(18.3, 5)
    expect(Math.min(...ys(m))).toBe(0); expect(Math.max(...ys(m))).toBeCloseTo(11.1, 5)
    expect(has(m, KIND.glass)).toBe(true)
  })
})
