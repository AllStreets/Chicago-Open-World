// E3-2: the United Center board — the Bulls / Blackhawks colour rule, the face and ribbon drawing, and the crown's
// geometry (two meshes: at most two draw calls; one at LOW).
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { crownStyle, ribbonText, drawCrownFace, crownCubeGeometry, crownRibbonGeometry, faceV0For, BULLS_RED, HAWKS_RED } from '../arenaCrown.js'
import { drawBoard } from '../scoreboard.js'
import { censusScene } from '../../lib/drawCensus.js'

const recorder = () => {
  const calls = [], props = {}
  const ctx = new Proxy({}, { get: (_, k) => (k in props ? props[k] : (...a) => calls.push([k, ...a])), set: (_, k, v) => { props[k] = v; calls.push(['set', k, v]); return true } })
  return { ctx, calls }
}
const crown = { center: [-3846.7, 150], roofY: 39, mast: 5, face: { w: 20, h: 10 }, faceY: 49, ribbon: { ring: [[-3930, 90], [-3765, 90], [-3765, 212], [-3930, 212]], top: 29.4, h: 2.2 } }

describe('crownStyle', () => {
  const g = (teams) => ({ id: 'g', teams })
  it('Bulls by default: idle, the next game, a Bulls game, the Sky', () => {
    expect(crownStyle(undefined)).toBe('bulls')
    expect(crownStyle({ state: 'idle', game: null, next: g(['blackhawks']) })).toBe('bulls')
    expect(crownStyle({ state: 'live', game: g(['bulls']) })).toBe('bulls')
    expect(crownStyle({ state: 'live', game: g(['sky']) })).toBe('bulls')
    expect(crownStyle({ state: 'pregame', game: g(['blackhawks']) })).toBe('bulls')
  })
  it('Blackhawks colours for a Blackhawks game, live or final', () => {
    expect(crownStyle({ state: 'live', game: g(['blackhawks']) })).toBe('blackhawks')
    expect(crownStyle({ state: 'postgame', game: g(['blackhawks']) })).toBe('blackhawks')
  })
})

describe('the board face (drawBoard style bulls / blackhawks)', () => {
  const lines = { title: 'UNITED CENTER', rows: [{ abbr: 'MIL', score: 71 }, { abbr: 'CHI', score: 78 }], status: 'Q3' }
  it('Bulls red frame and band, BULLS, the matchup, the score and a live status', () => {
    const { ctx, calls } = recorder()
    drawBoard(ctx, lines, 'bulls', 1024, 512)
    const txt = calls.filter((c) => c[0] === 'fillText').map((c) => c[1])
    expect(txt).toEqual(expect.arrayContaining(['BULLS', 'MIL', '71', 'CHI', '78', '● Q3']))
    expect(calls.filter((c) => c[0] === 'set' && c[1] === 'fillStyle').map((c) => c[2])).toContain(BULLS_RED)
    expect(calls.some((c) => c[0] === 'quadraticCurveTo')).toBe(true) // the horns
  })
  it('Blackhawks styling: the BLACKHAWKS band in Hawks red with feather stripes', () => {
    const { ctx, calls } = recorder()
    drawBoard(ctx, { ...lines, status: 'FINAL' }, 'blackhawks', 1024, 512)
    expect(calls.filter((c) => c[0] === 'fillText').map((c) => c[1])).toEqual(expect.arrayContaining(['BLACKHAWKS', 'FINAL']))
    expect(calls.filter((c) => c[0] === 'set' && c[1] === 'fillStyle').map((c) => c[2])).toContain(HAWKS_RED)
  })
  it('idle: the next game large, its date below', () => {
    const { ctx, calls } = recorder()
    drawCrownFace(ctx, { title: 'UNITED CENTER', rows: [], status: 'NEXT MIL · TUE OCT 21 7:00 PM' }, 'bulls', 1024, 512)
    expect(calls.filter((c) => c[0] === 'fillText').map((c) => c[1])).toEqual(expect.arrayContaining(['NEXT MIL', 'TUE OCT 21 7:00 PM']))
  })
})

describe('ribbonText', () => {
  it('says next, live and final the way the plan reads them', () => {
    expect(ribbonText({ title: 'UNITED CENTER', rows: [], status: 'NEXT MIL · TUE 7:00 PM' })).toMatch(/^NEXT MIL · TUE 7:00 PM .*GO BULLS/)
    expect(ribbonText({ title: 'UNITED CENTER', rows: [{ abbr: 'MIL', score: 71 }, { abbr: 'CHI', score: 78 }], status: 'Q3' })).toMatch(/^LIVE · Q3 · CHI 78–71 MIL/)
    expect(ribbonText({ title: 'UNITED CENTER', rows: [{ abbr: 'MIL', score: 97 }, { abbr: 'CHI', score: 104 }], status: 'FINAL' }, 'blackhawks')).toMatch(/^FINAL · CHI 104–97 MIL .*GO HAWKS GO/)
  })
})

describe('crown geometry', () => {
  const cube = crownCubeGeometry(crown, faceV0For(512))
  const rib = crownRibbonGeometry(crown)
  it('the cube stands on the roof, centred, within its face size; faces sample the face, the rest a swatch', () => {
    const p = cube.position
    let minY = Infinity, maxY = -Infinity, maxR = 0
    for (let i = 0; i < p.length; i += 3) { minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]); maxR = Math.max(maxR, Math.abs(p[i] - crown.center[0]), Math.abs(p[i + 2] - crown.center[1])) }
    expect(minY).toBeCloseTo(crown.roofY - 0.6, 5)
    expect(maxY).toBeCloseTo(crown.faceY + crown.face.h / 2 + 0.5, 5)
    expect(maxR).toBeLessThan(crown.face.w / 2 + 0.2)
    const v0 = faceV0For(512), uv = cube.uv
    let faceVerts = 0
    for (let i = 0; i < uv.length; i += 2) if (uv[i + 1] >= v0 - 1e-6) faceVerts++; else expect(uv[i + 1]).toBeLessThan(v0)
    expect(faceVerts).toBe(16) // four faces × four corners
  })
  it('the ribbon rings the parapet below its top and under the cube, its texture tiling by length', () => {
    const p = rib.position
    for (let i = 0; i < p.length; i += 3) expect(p[i + 1]).toBeLessThanOrEqual(crown.faceY)
    expect(Math.max(...rib.uv.filter((_, i) => i % 2 === 0))).toBeGreaterThan(1) // the tile repeats round the arena
  })
  it('its words read left to right from outside, whichever way the ring was drawn', () => {
    for (const ring of [crown.ribbon.ring, [...crown.ribbon.ring].reverse()]) {
      const g = crownRibbonGeometry({ ...crown, ribbon: { ...crown.ribbon, ring } }), p = g.position
      for (let q = 0; q < 4; q++) { // the four parapet quads: corners 0 (u0) → 1 (u1) along the bottom edge
        const a = [p[q * 12], p[q * 12 + 2]], b = [p[q * 12 + 3], p[q * 12 + 5]], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const out = [mid[0] - crown.center[0], mid[1] - crown.center[1]], right = [out[1], -out[0]] // looking in (−out), right = (oz, −ox)
        expect((b[0] - a[0]) * right[0] + (b[1] - a[1]) * right[1]).toBeGreaterThan(0)
      }
    }
  })
  it('two meshes — at most two draw calls; one at LOW (no ribbon)', () => {
    const mk = (g) => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.BufferAttribute(g.position, 3)); b.setIndex(g.index); return new THREE.Mesh(b, new THREE.MeshBasicMaterial()) }
    const scene = new THREE.Scene(), grp = new THREE.Group(); grp.name = 'arenaCrown'
    grp.add(mk(cube), mk(rib)); scene.add(grp); scene.updateMatrixWorld()
    const cam = new THREE.PerspectiveCamera(60, 1.6, 1, 5000); cam.position.set(crown.center[0] + 400, 200, crown.center[1] + 400); cam.lookAt(crown.center[0], 40, crown.center[1]); cam.updateMatrixWorld()
    expect(censusScene(scene, cam)).toEqual({ arenaCrown: 2 })
  })
})
