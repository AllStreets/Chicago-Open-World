// D4-1: the ramp portals — the street opens over each ramp's trench (always, not only in the U view), walls rise into
// parapets, a header with the street's name closes it where the tunnel begins, and traffic shows in the trench.
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { splitPortals, buildPortals, buildLowerDecks, cutMask, cutDepth, portalDepth, placeSigns, shownPieces, openBelowY, PORTAL } from '../lowerLevels.js'
import { setCutMask, portalOpenDepth, patchCutaway, cutUniforms } from '../materials/cutaway.js'
import { NAMED_RAMPS, drawSignAtlas } from '../lowerPortals.js'
import { portalMeshes } from '../LowerLevels.jsx'

// Lower Wacker at −5.1 for 300 m, then a 65 m ramp up to the street (its mouth at x = 365)
const j = {
  v: 1, y: { 1: -5.1, 2: -9.5 }, slab: 0.9, clear: 4.19, columnM: 9.75, grade: 0.08,
  ways: [
    { id: 1, n: 'East Lower Wacker Drive', lv: 1, w: 13.2, p: [[0, 0, -5.1], [300, 0, -5.1], [365, 0, 0.1]] },
    { id: 2, n: 'North Lower Michigan Avenue', lv: 1, w: 12, p: [[150, 0, -5.1], [150, 200, -5.1]] },
  ],
}
const oy = openBelowY(j) // −3.9: deeper than this the ramp is under the street's slab
const xCross = 300 + (65 * (oy + 5.1)) / 5.2 // where the ramp comes out from under the slab

describe('splitPortals: each ramp’s open stretch, from the street mouth down to the slab', () => {
  const { covered, portals } = splitPortals(j)
  it('cuts the ramp exactly where it passes under the street’s slab', () => {
    expect(portals).toHaveLength(1)
    const p = portals[0]
    expect(p.id).toBe(1)
    expect(p.p[0][0]).toBeCloseTo(xCross, 3)
    expect(p.p[0][2]).toBeCloseTo(oy, 6)
    expect(p.p[p.p.length - 1]).toEqual([365, 0, 0.1])
    expect(p.ends).toEqual(['deep', 'mouth'])
  })
  it('leaves the rest to the deck mesh, which no longer draws the open stretch', () => {
    const lw = covered.ways.filter((w) => w.id === 1)
    expect(Math.max(...lw.flatMap((w) => w.p.map((q) => q[0])))).toBeCloseTo(xCross, 3)
    const m = buildLowerDecks(j)
    for (let i = 0; i < m.position.length; i += 3) expect(m.position[i]).toBeLessThan(xCross + 1)
  })
  it('a dip shallower than minDip (a garage apron) is not a portal; level streets never are', () => {
    const k = { ...j, ways: [...j.ways, { id: 3, lv: 1, w: 5, p: [[0, 50, 0.1], [5, 50, -0.4], [10, 50, 0.1]] }] }
    expect(splitPortals(k).portals.map((p) => p.id)).toEqual([1])
  })
  it('Traffic checks its vehicles against the decks and the portals together', () => {
    const shown = shownPieces(j)
    expect(shown.filter((w) => w.id === 1).length).toBe(2)
  })
})

describe('the portal mesh: trench, parapets, header, sign and the tunnel’s dark', () => {
  const named = [{ key: 'test', text: 'LOWER WACKER DR', at: [365, 0] }]
  const b = buildPortals(j, named)
  const ys = []; for (let i = 1; i < b.mesh.position.length; i += 3) ys.push(b.mesh.position[i])
  it('the parapet stands a metre over the street; the trench goes down to the slab', () => {
    expect(Math.max(...ys)).toBeCloseTo(0.12 + PORTAL.parapet, 3)
    expect(Math.min(...ys)).toBeLessThan(oy)
  })
  it('one header where the tunnel begins, with the sign on it, at the OSM ramp end ±5 m', () => {
    expect(b.stats.headers).toBe(1)
    expect(b.signs).toHaveLength(1)
    expect(b.signs[0]).toMatchObject({ key: 'test', text: 'LOWER WACKER DR' })
    expect(b.signs[0].x).toBeCloseTo(xCross, 3) // on the header …
    expect(b.signs[0].d).toBeLessThanOrEqual(5) // … of the portal whose mouth is the named ramp end
    expect(placeSigns(splitPortals(j).portals, [{ key: 'far', text: 'X', at: [380, 0] }])).toEqual([])
  })
  it('signs first, then the throats (left out by draw range while the decks are drawn)', () => {
    expect(b.dark.throatStart).toBe(6)
    expect(b.dark.index.length).toBe(12)
    expect(b.dark.rows).toBe(2)
  })
  it('is lean: a few hundred triangles for a ramp', () => {
    expect(b.stats.triangles).toBeLessThan(400)
  })
  it('two meshes, neither pickable nor casting shadows; no atlas without a 2D canvas (tests)', () => {
    const p = portalMeshes(j, named, null)
    for (const m of [p.trench, p.dark]) { expect(m.castShadow).toBe(false); expect(m.raycast()).toBeUndefined() }
    expect(p.dark.material.map).toBeNull()
    expect(drawSignAtlas([{ text: 'X', frac: 1 }], null)).toBeNull()
  })
})

describe('the street opens over the trench, always (cutMask portal channel)', () => {
  afterEach(() => { setCutMask(null); cutUniforms.uCut.value = 0 })
  const mask = cutMask(j)
  it('open over the trench, closed at the mouth (held back) and past the header', () => {
    expect(portalDepth(mask, 340, 0)).toBeGreaterThan(2)
    expect(portalDepth(mask, 340, 6.6 + 1.5)).toBeLessThan(0) // beside it
    expect(portalDepth(mask, 365 - PORTAL.mouthInset + 1.5, 0)).toBeLessThan(0.5)
    expect(portalDepth(mask, xCross - 2, 0)).toBeLessThan(0)
    expect(portalDepth(mask, 150, 100)).toBeLessThan(0) // nowhere near a ramp
  })
  it('the U cut-away still covers decks and ramps', () => {
    expect(cutDepth(mask, 150, 0)).toBeGreaterThan(3)
    expect(cutDepth(mask, 340, 0)).toBeGreaterThan(3)
  })
  it('Traffic reads it with U off', () => {
    setCutMask(mask)
    expect(cutUniforms.uCut.value).toBe(0)
    expect(portalOpenDepth(340, 0)).toBeGreaterThan(2)
    expect(portalOpenDepth(150, 100)).toBeLessThan(0)
    setCutMask(null)
    expect(portalOpenDepth(340, 0)).toBe(-Infinity)
  })
  it('the ground shader discards over a portal whatever U does', () => {
    const shader = { vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}', fragmentShader: '#include <common>\nvoid main() {\n#include <dithering_fragment>\n}', uniforms: {} }
    patchCutaway(shader)
    expect(shader.fragmentShader).toMatch(/if \(cutM\.y > 0\.0\) discard;/)
    expect(shader.fragmentShader.indexOf('cutM.y > 0.0')).toBeLessThan(shader.fragmentShader.indexOf('if (uCut > 0.0)'))
  })
})

describe('the named ramps (D4-1)', () => {
  it('include the plan’s five: Columbus, Stetson, Michigan, Franklin and Lake St', () => {
    const keys = NAMED_RAMPS.map((r) => r.key)
    for (const k of ['columbus', 'stetson', 'michigan', 'franklin', 'lake']) expect(keys).toContain(k)
    for (const r of NAMED_RAMPS) { expect(r.text).toMatch(/^LOWER /); expect(r.at.every(Number.isFinite)).toBe(true); expect(r.osm).toBeGreaterThan(0) }
  })
})

const APP = existsSync(`${process.cwd()}/public/world`) ? process.cwd() : `${process.cwd()}/app`
const shipped = `${APP}/public/world/lower-levels.json`
describe.skipIf(!existsSync(shipped))('the shipped portals (D4-1 done-when)', () => {
  const lj = JSON.parse(readFileSync(shipped, 'utf8'))
  const { portals } = splitPortals(lj)
  it('every named ramp has its portal at the OSM ramp end ±5 m, signed', () => {
    const placed = placeSigns(portals, NAMED_RAMPS)
    expect(placed.map((s) => s.key).sort()).toEqual(NAMED_RAMPS.map((r) => r.key).sort())
    for (const s of placed) expect(s.d).toBeLessThanOrEqual(5)
  })
  it('every portal’s street mouth is an OSM ramp end (±5 m)', () => {
    const ends = lj.ways.flatMap((w) => [w.p[0], w.p[w.p.length - 1]])
    for (const p of portals) p.ends.forEach((e, i) => {
      if (e !== 'mouth') return
      const q = i ? p.p[p.p.length - 1] : p.p[0]
      expect(Math.min(...ends.map((o) => Math.hypot(o[0] - q[0], o[1] - q[1])))).toBeLessThanOrEqual(5)
    })
  })
  it('stay lean: ≤ 12 k triangles for every portal in the city; the decks still within their 60 k', () => {
    expect(buildPortals(lj, NAMED_RAMPS).stats.triangles).toBeLessThanOrEqual(12_000)
    expect(buildLowerDecks(lj).stats.triangles).toBeLessThanOrEqual(60_000)
  })
})
