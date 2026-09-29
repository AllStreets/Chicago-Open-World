// app/src/bridges/leafTexture.js — one RGBA float texel pair per leaf: (pivot.xyz, angle), (k.xyz, 0).
import * as THREE from 'three'
export const LEAF_TEX_MIN = 256
export function packLeaves(leaves, anglesByBridge, out = new Float32Array(Math.max(LEAF_TEX_MIN, leaves.length) * 8)) {
  leaves.forEach((l, i) => out.set([l.pivot[0], l.pivot[1], l.pivot[2], anglesByBridge[l.bridge] ?? 0, l.k[0], l.k[1], l.k[2], 0], i * 8))
  return out
}

// The texture the leaves are written into is the shared uniform's own: swapping in a fresh texture from an effect
// can be undone by a re-run cleanup (StrictMode), leaving the shader reading a texture nobody writes.
export function leafTextureFor(uniform, n) {
  if (uniform.value?.image?.width >= n * 2) return uniform.value
  const t = new THREE.DataTexture(new Float32Array(n * 8), n * 2, 1, THREE.RGBAFormat, THREE.FloatType)
  t.needsUpdate = true
  uniform.value = t
  return t
}
