// app/src/world/boats/fleet.js — F-9: every boat in world/boats.json as instances: per kind, per LOD, one instanced
// mesh per part (hull, trim, canopy, glass, fixed) — at most 5 draw calls a kind and LOD, whatever the count.
// Each boat draws its LOD0 within `lod1At` of the camera, its LOD1 out to `farAt`, nothing beyond.
// Placement record (pipeline/lib/boats.js): { k, x, y, z, h, l } — h turns the model's bow (+X) to (cos h, −sin h).
import * as THREE from 'three'
import { LIVERY_ROLES, liveryColours } from './boatModels.js'

export const DEFAULT_LOD = { lod1At: 220, farAt: 2600 }

// which LOD each boat draws from `eye` (0, 1 or −1 for none)
export function lodFor(boats, eye, { lod1At = DEFAULT_LOD.lod1At, farAt = DEFAULT_LOD.farAt } = {}) {
  return boats.map((b) => { const d = Math.hypot(b.x - eye[0], b.y - eye[1], b.z - eye[2]); return d < lod1At ? 0 : d < farAt ? 1 : -1 })
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0)

// kinds: { kind: { lod0: { parts }, lod1: { parts }, liveries, lit } }; materials: boatMaterials(); onLayer(mesh, lod, part)
// to set shadow / reflection flags. Returns { group, update(eye) → changed?, counts() }.
export function buildFleet(kinds, boats, materials, { lod1At, farAt, onMesh } = {}) {
  const group = new THREE.Group()
  group.name = 'boats'
  const byKind = {}
  for (const [k, model] of Object.entries(kinds)) {
    const list = boats.filter((b) => b.k === k)
    if (!list.length) continue
    const lods = {}
    for (const lod of [0, 1]) {
      const src = model[`lod${lod}`]
      if (!src) continue
      const meshes = {}
      for (const [part, geometry] of Object.entries(src.parts)) {
        const mat = part === 'glass' && !model.lit && materials.glassDark ? materials.glassDark : materials[part]
        const mesh = new THREE.InstancedMesh(geometry, mat, list.length)
        mesh.name = `boats:${k}:lod${lod}:${part}`
        mesh.userData.kind = 'boats'
        mesh.count = 0
        if (LIVERY_ROLES.includes(part)) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3)
        mesh.raycast = () => {}                     // boats never take a hover or a click from the buildings behind
        onMesh?.(mesh, lod, part)
        group.add(mesh)
        meshes[part] = mesh
      }
      lods[lod] = { meshes, tris: src.tris }
    }
    byKind[k] = { list, lods, liveries: (model.liveries ?? []).map(liveryColours), last: '' }
  }

  function update(eye) {
    let changed = false
    for (const K of Object.values(byKind)) {
      const lod = lodFor(K.list, eye, { lod1At, farAt })
      const key = lod.join('')
      if (key === K.last) continue
      K.last = key
      changed = true
      for (const L of [0, 1]) {
        const entry = K.lods[L]
        if (!entry) continue
        let n = 0
        K.list.forEach((b, i) => {
          if (lod[i] !== L) return
          m4.compose(P.set(b.x, b.y, b.z), q.setFromAxisAngle(UP, b.h), S)
          const liv = K.liveries[b.l] ?? K.liveries[0]
          for (const [part, mesh] of Object.entries(entry.meshes)) {
            mesh.setMatrixAt(n, m4)
            if (mesh.instanceColor && liv) mesh.setColorAt(n, liv[part])
          }
          n++
        })
        for (const mesh of Object.values(entry.meshes)) {
          mesh.count = n
          mesh.visible = n > 0
          mesh.instanceMatrix.needsUpdate = true
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
          if (n) mesh.computeBoundingSphere()
        }
      }
    }
    return changed
  }

  // drawn instances and triangles per LOD (tests, ?stats)
  function counts() {
    const c = { lod0: 0, lod1: 0, tris: 0 }
    for (const K of Object.values(byKind)) for (const L of [0, 1]) {
      const e = K.lods[L]
      if (!e) continue
      const n = Object.values(e.meshes)[0]?.count ?? 0
      c[`lod${L}`] += n
      c.tris += n * e.tris
    }
    return c
  }

  function dispose() {
    for (const K of Object.values(byKind)) for (const e of Object.values(K.lods)) for (const m of Object.values(e.meshes)) m.dispose()
  }
  return { group, update, counts, dispose }
}
