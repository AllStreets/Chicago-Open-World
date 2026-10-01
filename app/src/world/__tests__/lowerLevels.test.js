// D2-2 / D2-3: the lower decks (one self-lit mesh, drawn only when it can be seen, never picked) and the U cut-away.
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import * as THREE from 'three'
import { buildLowerDecks, cutMask, cutDepth, hideThroughDecks, LOWER } from '../lowerLevels.js'
import { lowerMesh, nearLower, wantsLowerView, SHOW } from '../LowerLevels.jsx'
import { cutUniforms, setCutMask, isCutOpen, patchCutaway } from '../materials/cutaway.js'
import { censusScene } from '../../lib/drawCensus.js'
import { readLowerLevels } from '../../lib/levels.js'

// a straight Lower Wacker piece 300 m long at −5.1 with a 70 m ramp up to the street at its east end, and a cross street
const Y = { 1: -5.1, 2: -9.5 }
const j = {
  v: 1, y: Y, slab: 0.9, clear: 4.19, columnM: 9.75, grade: 0.08,
  ways: [
    { id: 1, n: 'East Lower Wacker Drive', lv: 1, w: 13.2, p: [[0, 0, -5.1], [300, 0, -5.1], [365, 0, 0.1]] },
    { id: 2, n: 'North Lower Michigan Avenue', lv: 1, w: 12, p: [[150, 0, -5.1], [150, 200, -5.1]] },
  ],
}
const tris = (m) => m.index.length / 3
const ys = (m) => { const out = []; for (let i = 1; i < m.position.length; i += 3) out.push(m.position[i]); return out }

describe('the lower decks (D2-2)', () => {
  const m = buildLowerDecks(j)
  it('build roadway, walls, soffit, columns and lamps — all under the street', () => {
    expect(tris(m)).toBeGreaterThan(200)
    expect(Math.max(...ys(m))).toBeLessThanOrEqual(0.12 + LOWER.markLift + 1e-6)
    expect(Math.min(...ys(m))).toBeGreaterThanOrEqual(-5.1 - 0.31)
    expect(m.stats.columns).toBeGreaterThan(20)
    expect(m.stats.lamps).toBeGreaterThan(20)
  })
  it('columns stand every 32 ft (9.75 m) on the level stretch, none on the open ramp', () => {
    const caps = []
    for (let i = 0; i < m.lit.length; i += 4) if (m.lit[i] > 1 && m.lit[i] < 2) caps.push(m.position[i * 3]) // accent column tops, one per quad
    const row = [...new Set(caps.map((x) => Math.round(x * 10) / 10))].sort((a, b) => a - b)
    expect(row[1] - row[0]).toBeCloseTo(9.75, 0)
    expect(Math.max(...row)).toBeLessThan(300 + 1)
  })
  it('the soffit (the upper deck’s underside) is at −SLAB_M and faces down; lamps glow', () => {
    expect(ys(m).some((y) => Math.abs(y + 0.9) < 1e-6)).toBe(true)
    expect(Math.max(...m.lit)).toBe(3)
  })
  it('a cross street keeps its mouth: no wall piece stands across Lower Michigan where it meets Lower Wacker', () => {
    // wall quads are vertical: find wall vertices at the north side of Lower Wacker (z = +6.9) between x 145 and 155
    let blocked = 0
    for (let i = 0; i < m.position.length; i += 3) {
      const [x, y, z] = [m.position[i], m.position[i + 1], m.position[i + 2]]
      if (Math.abs(z - (6.6 + LOWER.wallPad)) < 0.05 && x > 147 && x < 153 && y > -0.5) blocked++ // a wall top (the soffit, at −0.9, may span it)
    }
    expect(blocked).toBe(0)
  })
  it('a third-level ramp never pokes up through a level-1 roadway', () => {
    const k = { ...j, ways: [...j.ways, { id: 3, lv: 2, w: 5, p: [[100, 2, 0.1], [180, 2, -9.5], [280, 2, -9.5]] }] }
    const h = hideThroughDecks(k).ways.filter((w) => w.id === 3).flatMap((w) => w.p)
    expect(h.every((q) => q[2] <= -5.1 - LOWER.ownSlab + 1e-6)).toBe(true)
  })
})

describe('drawn only when it can be seen; never picked (D2-2)', () => {
  const { mesh } = lowerMesh(j)
  const box = { minX: 0, minZ: -10, maxX: 365, maxZ: 200 }
  it('near and low: drawn; from the air (or far away): not', () => {
    expect(nearLower([150, 60, 300], box)).toBe(true)
    expect(nearLower([150, SHOW.belowM + 1, 300], box)).toBe(false)
    expect(nearLower([150, 60, 200 + SHOW.withinM + 50], box)).toBe(false)
  })
  it('one draw call when visible, none when hidden (draw census)', () => {
    const scene = new THREE.Scene(), group = new THREE.Group()
    group.add(mesh); scene.add(group); scene.updateMatrixWorld()
    const cam = new THREE.PerspectiveCamera(60, 1.6, 1, 5000); cam.position.set(150, 200, 400); cam.lookAt(150, -5, 0); cam.updateMatrixWorld()
    expect(censusScene(scene, cam)['lower-levels']).toBe(1)
    expect(Object.values(censusScene(scene, cam)).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3)
    group.visible = false
    expect(censusScene(scene, cam)['lower-levels']).toBeUndefined()
  })
  it('is not pickable: a ray straight down through the deck hits nothing', () => {
    const r = new THREE.Raycaster(new THREE.Vector3(150, 50, 0), new THREE.Vector3(0, -1, 0))
    expect(r.intersectObject(mesh)).toEqual([])
  })
  it('U from far away asks for the lower-levels view; over them it stays put', () => {
    expect(wantsLowerView({ position: [5000, 400, 5000], target: [5000, 0, 5000] }, box)).toBe(true)
    expect(wantsLowerView({ position: [150, 300, 400], target: [150, 0, 100] }, box)).toBe(false)
  })
})

describe('the U cut-away (D2-3)', () => {
  afterEach(() => { setCutMask(null); cutUniforms.uCut.value = 0 })
  const mask = cutMask(j)
  it('the mask is positive over the lower decks (walls included) and negative off them', () => {
    expect(cutDepth(mask, 150, 0)).toBeGreaterThan(3)
    expect(cutDepth(mask, 150, 6.6)).toBeGreaterThan(0)
    expect(cutDepth(mask, 50, 40)).toBeLessThan(0)
    expect(cutDepth(mask, 5000, 0)).toBeLessThan(0)
  })
  it('with U off nothing opens; with U on the street over a deck opens (and Traffic leaves it empty)', () => {
    setCutMask(mask)
    expect(isCutOpen(150, 0)).toBe(false)
    cutUniforms.uCut.value = 1
    expect(isCutOpen(150, 0)).toBe(true)
    expect(isCutOpen(50, 40)).toBe(false)
  })
  it('patches a standard shader: street-level fragments over the mask are discarded, the rest keep the old path', () => {
    const shader = { vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}', fragmentShader: '#include <common>\nvoid main() {\n#include <dithering_fragment>\n}', uniforms: {} }
    patchCutaway(shader)
    expect(shader.fragmentShader).toMatch(/discard/)
    expect(shader.fragmentShader).toMatch(/vCutW\.y > -1\.0/)
    expect(shader.uniforms.uCut).toBe(cutUniforms.uCut)
    expect(shader.vertexShader).toMatch(/vCutW = \(modelMatrix/)
  })
})

describe('the manifest decides (flag / fallback)', () => {
  it('no levels.lower → nothing under the street, and U is unavailable', () => {
    expect(readLowerLevels({ levels: { river: { y: -6.3 } } })).toBeNull()
    expect(readLowerLevels(null)).toBeNull()
    expect(readLowerLevels({ levels: { lower: { file: 'lower-levels.json', y: -5.1, y2: -9.5 } } })).toEqual({ file: 'lower-levels.json', y: -5.1, y2: -9.5 })
  })
})

const APP = existsSync(`${process.cwd()}/public/world`) ? process.cwd() : `${process.cwd()}/app`
const shipped = `${APP}/public/world/lower-levels.json`
describe.skipIf(!existsSync(shipped))('the shipped lower levels', () => {
  it('fit the plan’s triangle budget (≤ 60 k) in one mesh', () => {
    const m = buildLowerDecks(JSON.parse(readFileSync(shipped, 'utf8')))
    expect(m.stats.triangles).toBeLessThanOrEqual(60_000)
    expect(m.stats.columns).toBeGreaterThan(500)
  })
})
