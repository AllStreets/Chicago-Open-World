// app/src/transit/pools.js — every streamed tile's transit meshes drawn by two batched meshes, so the whole
// network costs ≤ 3 draw calls (structure, its shadow, glow) however many tiles are loaded (B.1.6).
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { createStructureMaterial, createGlowMaterial } from './transitMaterials.js'

export const TRANSIT_LAYERS = ['transit', 'ties', 'stations', 'glow']
export const POOL_OF = { transit: 'structure', ties: 'structure', stations: 'structure', glow: 'glow' }
export const ATTRS = {
  structure: ['position', 'normal', 'color', '_kind', '_along'],
  glow: ['position', 'normal', 'color', '_side', '_lane', '_lanes', '_line', '_intensity', '_ghost'],
}
const CAP = { structure: { instances: 2048, vertices: 1_500_000, indices: 3_000_000 }, glow: { instances: 4096, vertices: 400_000, indices: 800_000 } }
const GET = ['getX', 'getY', 'getZ', 'getW']

// Tiles are meshopt-quantized (normalized ints + a node transform); pools need one plain Float32 layout.
export function toPoolGeometry(src, matrix, names) {
  const g = new THREE.BufferGeometry()
  for (const n of names) {
    const a = src.getAttribute(n)
    if (!a) throw new Error(`transit pool: tile mesh lacks ${n}`)
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a[GET[k]](i)
    g.setAttribute(n, new THREE.BufferAttribute(out, a.itemSize))
  }
  const count = g.getAttribute('position').count
  g.setIndex(new THREE.BufferAttribute(src.index ? Uint32Array.from(src.index.array) : Uint32Array.from({ length: count }, (_, i) => i), 1))
  g.applyMatrix4(matrix)
  return g
}

export function createPool(material, cap) {
  const mesh = new THREE.BatchedMesh(cap.instances, cap.vertices, cap.indices, material)
  const size = { instances: cap.instances, vertices: cap.vertices, indices: cap.indices }
  // BatchedMesh keeps whole-mesh bounds for culling; they go stale as tiles come and go, and an empty
  // sphere culls the entire network. Recompute on every change (cheap: per-geometry boxes are cached).
  const refreshBounds = () => { mesh.computeBoundingBox(); mesh.computeBoundingSphere() }
  const pool = {
    mesh, count: 0,
    add(geometry) {
      const v = geometry.getAttribute('position').count, i = geometry.index.count
      let gid
      try { gid = mesh.addGeometry(geometry) } catch {
        mesh.optimize()
        try { gid = mesh.addGeometry(geometry) } catch {
          size.vertices = Math.ceil((size.vertices + v) * 1.5); size.indices = Math.ceil((size.indices + i) * 1.5)
          mesh.setGeometrySize(size.vertices, size.indices)
          gid = mesh.addGeometry(geometry)
        }
      }
      if (pool.count >= size.instances) { size.instances *= 2; mesh.setInstanceCount(size.instances) }
      const iid = mesh.addInstance(gid)
      pool.count++
      refreshBounds()
      return { gid, iid }
    },
    remove(h) {
      if (!h) return
      mesh.deleteInstance(h.iid); mesh.deleteGeometry(h.gid); pool.count--
      refreshBounds()
    },
  }
  return pool
}

let pools = null
export function getTransitPools() {
  pools ??= { structure: createPool(createStructureMaterial(), CAP.structure), glow: createPool(createGlowMaterial(), CAP.glow) }
  return pools
}
export function resetTransitPools() { pools = null }

export function addTileLayer(layer, geometry, matrix, quality = useStore.getState().quality) {
  const which = POOL_OF[layer]
  if (!which) return null
  if (layer === 'ties' && quality === 'LOW') return null // LOW: no tie geometry; the deck still reads as track
  return { which, h: getTransitPools()[which].add(toPoolGeometry(geometry, matrix, ATTRS[which])) }
}
export function removeTileLayer(handle) { if (handle) getTransitPools()[handle.which].remove(handle.h) }
