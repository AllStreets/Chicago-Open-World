// app/src/world/riverboats/boatModels.js — F-9: a boat model (pipeline/heroes/scripts/boats.py → world/river-boats/<kind>.glb)
// as the few geometries the fleet instances. The .glb holds `lod0` and `lod1`, one primitive per role material and the
// baked occlusion in COLOR_0. Per LOD the roles become four parts:
//   hull · trim · canopy   the livery: drawn white × occlusion, tinted per boat by instanceColor
//   glass                  dark and glossy; a working boat's (kind `lit`) lit from inside after dusk (uNight)
//   fixed                  every other role merged, its colour (ROLE_RGB) × occlusion baked into the vertex colour
// Reusable for any water (river, lake, harbours): splitBoatModel(gltfScene) → { lod0: parts, lod1: parts }.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const LIVERY_ROLES = ['hull', 'trim', 'canopy']
export const PART_NAMES = [...LIVERY_ROLES, 'glass', 'fixed']
// sRGB: antifouling, non-skid, gelcoat white, rubber black, vinyl, teak, stainless
export const ROLE_RGB = { bottom: '#5a1c1c', deck: '#c9c5ba', cabin: '#ecebe6', dark: '#1d1f22', seat: '#e2dccc', wood: '#8a5a33', metal: '#c3c7cc' }

const colourOf = (hex) => new THREE.Color(hex) // THREE.Color parses hex as sRGB and stores linear under ColorManagement

// position, normal and an RGB colour (occlusion × tint) as plain float attributes in the model's frame, so the parts
// merge. Read before transforming: a quantised (int16, normalised) attribute cannot hold the dequantised metres.
const _v = new THREE.Vector3(), _n = new THREE.Matrix3()
function plain(geometry, matrix, tint) {
  const P = geometry.getAttribute('position'), N = geometry.getAttribute('normal'), C = geometry.getAttribute('color')
  const n = P.count, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3)
  _n.getNormalMatrix(matrix)
  for (let i = 0; i < n; i++) {
    _v.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(matrix)
    pos[i * 3] = _v.x; pos[i * 3 + 1] = _v.y; pos[i * 3 + 2] = _v.z
    if (N) _v.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(_n).normalize(); else _v.set(0, 1, 0)
    nor[i * 3] = _v.x; nor[i * 3 + 1] = _v.y; nor[i * 3 + 2] = _v.z
    const ao = C ? C.getX(i) : 1
    col[i * 3] = ao * tint.r; col[i * 3 + 1] = ao * tint.g; col[i * 3 + 2] = ao * tint.b
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('color', new THREE.BufferAttribute(col, 3))
  if (geometry.index) out.setIndex(Array.from(geometry.index.array))
  return out
}

// gltf.scene → { lod0: { hull, trim, canopy, glass, fixed }, lod1: … } (absent parts left out), triangle counts
export function splitBoatModel(scene) {
  scene.updateMatrixWorld(true)
  const out = {}, white = new THREE.Color(1, 1, 1)
  for (const lod of ['lod0', 'lod1']) {
    const root = scene.getObjectByName(lod)
    if (!root) continue
    const byPart = {}
    root.traverse((o) => {
      if (!o.isMesh) return
      const role = (o.material?.name ?? '').replace(/\.\d+$/, '')
      const part = PART_NAMES.includes(role) ? role : 'fixed'
      const tint = part === 'fixed' ? colourOf(ROLE_RGB[role] ?? '#888888') : white
      ;(byPart[part] ??= []).push(plain(o.geometry, o.matrixWorld, tint))
    })
    const parts = {}
    let tris = 0
    for (const [part, gs] of Object.entries(byPart)) {
      const g = gs.length === 1 ? gs[0] : mergeGeometries(gs, false)
      if (gs.length > 1) for (const x of gs) x.dispose()
      g.computeBoundingSphere()
      parts[part] = g
      tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3
    }
    out[lod] = { parts, tris }
  }
  return out
}

// the materials every boat shares (one set for the whole fleet)
export function boatMaterials() {
  return {
    hull: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 }),
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05 }),
    canopy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: '#16202b', roughness: 0.12, metalness: 0.45, emissive: '#ffd6a0', emissiveIntensity: 0 }), // a working boat's cabin, lit after dusk
    glassDark: new THREE.MeshStandardMaterial({ color: '#16202b', roughness: 0.12, metalness: 0.45 }),                                       // a pleasure boat at its mooring
    fixed: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 }),
  }
}

// a livery colour for each recolourable part: { hull, trim, canopy } sRGB hex → linear THREE.Color
export const liveryColours = (livery) => Object.fromEntries(LIVERY_ROLES.map((r) => [r, colourOf(livery?.[r] ?? '#ffffff')]))
