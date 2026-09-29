import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { toPoolGeometry, createPool, addTileLayer, removeTileLayer, getTransitPools, resetTransitPools, ATTRS, TRANSIT_LAYERS } from '../pools.js'

const geo = (names, n = 3) => {
  const g = new THREE.BufferGeometry()
  for (const a of names) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(n * (['position', 'normal', 'color'].includes(a) ? 3 : 1)).fill(0.5), ['position', 'normal', 'color'].includes(a) ? 3 : 1))
  return g
}

describe('transit pools', () => {
  beforeEach(() => resetTransitPools())
  it('dequantizes normalized attributes and bakes the tile node matrix (meshopt quantization)', () => {
    const g = geo(ATTRS.structure)
    g.setAttribute('position', new THREE.BufferAttribute(new Int16Array([0, 0, 0, 32767, 0, 0, 0, 0, 32767]), 3, true))
    const m = new THREE.Matrix4().makeTranslation(1000, 0, 0).multiply(new THREE.Matrix4().makeScale(500, 500, 500))
    const out = toPoolGeometry(g, m, ATTRS.structure)
    expect(Array.from(out.getAttribute('position').array).map((v) => Math.round(v))).toEqual([1000, 0, 0, 1500, 0, 0, 1000, 0, 500])
    expect(out.getAttribute('position').array).toBeInstanceOf(Float32Array)
    expect(Array.from(out.index.array)).toEqual([0, 1, 2])
    expect(() => toPoolGeometry(geo(['position']), new THREE.Matrix4(), ATTRS.structure)).toThrow(/lacks normal/)
  })
  it('tile layers join one of two batched meshes and leave again', () => {
    const p = getTransitPools()
    expect(p.structure.mesh).toBeInstanceOf(THREE.BatchedMesh); expect(p.glow.mesh).toBeInstanceOf(THREE.BatchedMesh)
    const a = addTileLayer('transit', geo(ATTRS.structure), new THREE.Matrix4(), 'HIGH')
    const b = addTileLayer('stations', geo(ATTRS.structure), new THREE.Matrix4(), 'HIGH')
    const c = addTileLayer('glow', geo(ATTRS.glow), new THREE.Matrix4(), 'HIGH')
    expect(p.structure.count).toBe(2); expect(p.glow.count).toBe(1)
    removeTileLayer(a); removeTileLayer(c)
    expect(p.structure.count).toBe(1); expect(p.glow.count).toBe(0)
    removeTileLayer(b); removeTileLayer(null)
    expect(TRANSIT_LAYERS).toEqual(['transit', 'ties', 'stations', 'glow'])
  })
  it('LOW quality skips tie geometry; unknown layers are ignored', () => {
    expect(addTileLayer('ties', geo(ATTRS.structure), new THREE.Matrix4(), 'LOW')).toBeNull()
    expect(addTileLayer('buildings', geo(ATTRS.structure), new THREE.Matrix4(), 'HIGH')).toBeNull()
    expect(getTransitPools().structure.count).toBe(0)
  })
  it('a full pool grows instead of dropping a tile', () => {
    const pool = createPool(new THREE.MeshBasicMaterial(), { instances: 2, vertices: 4, indices: 4 })
    for (let i = 0; i < 5; i++) pool.add(toPoolGeometry(geo(ATTRS.structure), new THREE.Matrix4(), ATTRS.structure))
    expect(pool.count).toBe(5)
  })
})

describe('pool culling bounds', () => {
  it('bounds cover what was added (a stale empty sphere culls the whole network)', () => {
    resetTransitPools()
    const g = new THREE.BufferGeometry()
    const n = 3
    for (const a of ATTRS.structure) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(n * (a === 'position' || a === 'normal' || a === 'color' ? 3 : 1)), a === 'position' || a === 'normal' || a === 'color' ? 3 : 1))
    g.getAttribute('position').array.set([-500, 7, -412, -400, 7, -412, -450, 11, -400])
    const h = addTileLayer('transit', g, new THREE.Matrix4(), 'HIGH')
    const m = getTransitPools().structure.mesh
    expect(m.boundingSphere?.radius).toBeGreaterThan(40)
    expect(m.boundingSphere.containsPoint(new THREE.Vector3(-450, 9, -410))).toBe(true)
    removeTileLayer(h)
  })
})

