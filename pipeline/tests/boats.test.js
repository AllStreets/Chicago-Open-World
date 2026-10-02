// pipeline/tests/boats.test.js — F-9: the boats as placements of the scripted Blender models (lib/boats.js), the
// models themselves (heroes/out/boats: lod0 + lod1, role materials, baked occlusion, within the triangle budget) and
// the river's tour boats and water taxis laid against the river (data/riverboats.json).
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { BOAT_KINDS, placeBoat, boatCorners, pickKind, mooredInSlip, riverAxis, riverBoat, riverBoats, boatsJson, boatSource, writeBoats } from '../lib/boats.js'

const ROLES = ['hull', 'trim', 'canopy', 'bottom', 'deck', 'cabin', 'glass', 'metal', 'dark', 'seat', 'wood']
const LOD0_MAX = 6000, LOD1_MAX = 700
const lcg = (seed) => { let h = seed; return () => { h = (h * 9301 + 49297) % 233280; return h / 233280 } }
// a straight river 60 m wide along x (z 0…60)
const isWater = ([x, z]) => z > 0 && z < 60 && x > -400 && x < 400

describe('placements', () => {
  it('turn the bow (+X) to the given direction', () => {
    const p = placeBoat('tourboat', [10, 20], [0, -1], { y: -6.3 })
    expect(Math.cos(p.h)).toBeCloseTo(0, 3)
    expect(-Math.sin(p.h)).toBeCloseTo(-1, 3)
    const c = boatCorners(p)
    expect(Math.max(...c.map((q) => q[1])) - Math.min(...c.map((q) => q[1]))).toBeCloseTo(BOAT_KINDS.tourboat.L, 1)
    expect(p.y).toBe(-6.3)
  })
  it('liveries wrap, kinds are known', () => {
    expect(placeBoat('watertaxi', [0, 0], [1, 0], { y: 0, livery: 5 }).l).toBe(5 % BOAT_KINDS.watertaxi.liveries.length)
    expect(() => placeBoat('submarine', [0, 0], [1, 0], { y: 0 })).toThrow()
  })
  it('a marina mix is deterministic and respects the slip length', () => {
    const a = Array.from({ length: 20 }, (r = lcg(3)) => r)
    const r1 = lcg(7), r2 = lcg(7)
    const s1 = a.map(() => mooredInSlip([0, 0], [0, 1], { y: 0, rnd: r1, maxL: 12 }))
    const s2 = a.map(() => mooredInSlip([0, 0], [0, 1], { y: 0, rnd: r2, maxL: 12 }))
    expect(s1).toEqual(s2)
    for (const b of s1) expect(BOAT_KINDS[b.k].L).toBeLessThanOrEqual(12)
    const kinds = new Set(Array.from({ length: 60 }, (r = lcg(11)) => pickKind(r, [['a', 1], ['b', 1]])))
    expect(kinds.size).toBeGreaterThan(0)
  })
})

describe('the river boats', () => {
  it('find the river axis', () => {
    const d = riverAxis(isWater, [0, 30])
    expect(Math.abs(d[0])).toBeGreaterThan(0.99)
  })
  it('moor against the bank toward `side`, under way on the axis, and never on land', () => {
    const m = riverBoat({ key: 't', kind: 'tourboat', mode: 'moored', at: [0, 20], side: 0, bow: 90 }, { isWater, y: -6.3 })
    expect(m.ok).toBe(true)
    expect(m.boat.z).toBeLessThan(10) // the north bank is z = 0
    expect(Math.cos(m.boat.h)).toBeGreaterThan(0.99) // bow east
    const u = riverBoat({ key: 'u', kind: 'watertaxi', mode: 'underway', at: [0, 12], across: 0, bow: 270 }, { isWater, y: -6.3 })
    expect(u.boat.z).toBeCloseTo(30, 0)
    expect(Math.cos(u.boat.h)).toBeLessThan(-0.99)
    const land = riverBoat({ key: 'x', kind: 'tourboat', mode: 'underway', at: [395, 30], bow: 90 }, { isWater, y: -6.3 })
    expect(land.ok).toBe(false)
  })
  it('data/riverboats.json: generic boats with an `about`, kinds known, deterministic', () => {
    const spec = JSON.parse(readFileSync(new URL('../data/riverboats.json', import.meta.url), 'utf8'))
    expect(spec.sources.length).toBeGreaterThan(0)
    for (const b of spec.boats) { expect(BOAT_KINDS[b.kind], b.key).toBeTruthy(); expect(b.about, b.key).toBeTruthy(); expect(['moored', 'underway']).toContain(b.mode) }
    expect(spec.boats.filter((b) => b.kind === 'tourboat').length).toBeGreaterThanOrEqual(3)
    const r = riverBoats({ boats: [{ key: 'a', kind: 'runabout', mode: 'underway', at: [0, 30], bow: 90 }] }, { isWater, y: 0 })
    expect(riverBoats({ boats: [{ key: 'a', kind: 'runabout', mode: 'underway', at: [0, 30], bow: 90 }] }, { isWater, y: 0 })).toEqual(r)
  })
  it('boats.json lists only the kinds used, in a stable order', () => {
    const j = boatsJson([placeBoat('yacht', [5, 1], [1, 0], { y: 0 }), placeBoat('cruiser', [1, 1], [1, 0], { y: 0 })])
    expect(Object.keys(j.kinds)).toEqual(['cruiser', 'yacht'])
    expect(j.boats.map((b) => b.k)).toEqual(['cruiser', 'yacht'])
    expect(j.lod1At).toBeLessThan(j.farAt)
  })
})

describe('the Blender models (heroes/out/boats)', async () => {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  for (const kind of Object.keys(BOAT_KINDS)) {
    it(`${kind}: lod0 + lod1, role materials, baked occlusion, within budget, about its stated size`, async () => {
      expect(existsSync(boatSource(kind))).toBe(true)
      const doc = await io.read(boatSource(kind))
      const meshes = Object.fromEntries(doc.getRoot().listMeshes().map((m) => [m.getName(), m]))
      expect(Object.keys(meshes).sort()).toEqual(['lod0', 'lod1'])
      const tris = (m) => m.listPrimitives().reduce((t, p) => t + p.getIndices().getCount() / 3, 0)
      expect(tris(meshes.lod0)).toBeLessThanOrEqual(LOD0_MAX)
      expect(tris(meshes.lod1)).toBeLessThanOrEqual(LOD1_MAX)
      expect(tris(meshes.lod1)).toBeLessThan(tris(meshes.lod0) / 3)
      for (const p of meshes.lod0.listPrimitives()) {
        expect(ROLES).toContain(p.getMaterial().getName())
        expect(p.getAttribute('COLOR_0'), `${kind} COLOR_0`).toBeTruthy()
      }
      expect(meshes.lod0.listPrimitives().map((p) => p.getMaterial().getName())).toEqual(expect.arrayContaining(['hull', 'trim', 'glass']))
      let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
      const P = meshes.lod0.listPrimitives().map((p) => p.getAttribute('POSITION'))
      for (const a of P) { const mn = a.getMin([]), mx = a.getMax([]); lo = lo.map((v, i) => Math.min(v, mn[i])); hi = hi.map((v, i) => Math.max(v, mx[i])) }
      expect(hi[0] - lo[0]).toBeGreaterThan(BOAT_KINDS[kind].L * 0.95)   // x: length (bow at +x)
      expect(hi[0] - lo[0]).toBeLessThan(BOAT_KINDS[kind].L * 1.08)
      expect(hi[2] - lo[2]).toBeLessThan(BOAT_KINDS[kind].B * 1.1)        // z: beam
      expect(lo[1]).toBeLessThan(0)                                       // the hull goes below the waterline (y = 0)
    })
  }
  it('writeBoats copies the used models (meshopt) and writes boats.json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'boats-'))
    try {
      const e = await writeBoats(dir, [placeBoat('runabout', [0, 0], [1, 0], { y: -6.3 })])
      expect(e).toEqual({ file: 'boats.json', count: 1 })
      const j = JSON.parse(readFileSync(join(dir, 'boats.json'), 'utf8'))
      expect(j.kinds.runabout.file).toBe('boats/runabout.glb')
      expect(existsSync(join(dir, 'boats', 'runabout.glb'))).toBe(true)
      expect(existsSync(join(dir, 'boats', 'tourboat.glb'))).toBe(false)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
