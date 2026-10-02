// app/src/world/boats.js — B-8: the harbours' boats (pipeline lib/harbours.js → world harbours.json, one Blender model
// heroes/out/harbour_boat.glb → world boats.glb). Pure helpers: decode the instances, pick a level of detail by distance,
// merge the model's role-named materials into one geometry with a per-vertex role, and the shader patch that recolours
// each boat (hull, stripe/canvas), drops the rig on power boats and the hardtop on sailboats, bobs it on the water and
// lights the masthead at night.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// the Blender script's ROLES, in order (harbour_boat.py)
export const ROLES = ['hull', 'stripe', 'deck', 'cabin', 'glass', 'rail', 'mast', 'canvas', 'light', 'top', 'topglass']
export const SAIL_ONLY = ['mast', 'canvas', 'light'], POWER_ONLY = ['top', 'topglass']
export const LOD0_M = 320, LOD1_M = 3200 // full model within LOD0_M, the 220-triangle model to LOD1_M, nothing beyond
export const STRIDE = 7 // x, z, yaw, scale, kind (0 sail · 1 power), hull colour, trim colour

export function decodeBoats(j) {
  const b = j?.boats
  if (!Array.isArray(b) || b.length % STRIDE) return []
  const out = []
  for (let i = 0; i < b.length; i += STRIDE) out.push({ x: b[i], z: b[i + 1], yaw: b[i + 2], scale: b[i + 3], kind: b[i + 4], hull: b[i + 5], trim: b[i + 6] })
  return out
}

// which boats draw at which level from the camera at (cx, cy, cz): indices into `boats`
export function assignLods(boats, [cx, cy, cz], { near = LOD0_M, far = LOD1_M } = {}) {
  const lod0 = [], lod1 = []
  for (let i = 0; i < boats.length; i++) {
    const b = boats[i], d = Math.hypot(b.x - cx, b.z - cz, cy)
    if (d <= near) lod0.push(i)
    else if (d <= far) lod1.push(i)
  }
  return { lod0, lod1 }
}

// a glTF node (the boat_lod0 / boat_lod1 group) → one non-indexed geometry: position, normal, color (baked AO), aRole
export function mergeRoles(node) {
  const parts = []
  node.updateMatrixWorld(true)
  node.traverse((o) => {
    if (!o.isMesh) return
    const role = ROLES.indexOf(o.material?.name)
    if (role < 0) return
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    g.applyMatrix4(o.matrixWorld)
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k)
    if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3))
    if (g.attributes.color.itemSize === 4 || g.attributes.color.normalized || !(g.attributes.color.array instanceof Float32Array)) {
      const c = g.attributes.color, a = new Float32Array(c.count * 3)
      for (let i = 0; i < c.count; i++) { a[i * 3] = c.getX(i); a[i * 3 + 1] = c.getY(i); a[i * 3 + 2] = c.getZ(i) }
      g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3))
    }
    g.setAttribute('aRole', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(role), 1))
    parts.push(g)
  })
  return parts.length ? mergeGeometries(parts, false) : null
}

const lin = (hex) => new THREE.Color(hex) // THREE.Color takes sRGB hex to the working (linear) space
export const ROLE_COLOURS = {
  hull: '#f2f1ec', stripe: '#1d2f6b', deck: '#cfcabb', cabin: '#ecebe6', glass: '#1a2026', rail: '#c9cdd1', mast: '#b8bdc2',
  canvas: '#1d2f6b', light: '#fff1d6', top: '#efeeea', topglass: '#1a2026',
}
export const roleUniform = () => ROLES.map((r) => lin(ROLE_COLOURS[r]))

const need = (src, m) => { if (!src.includes(m)) throw new Error(`boat shader: missing ${m}`); return m }
export function patchBoatShader(shader, uniforms) {
  let v = shader.vertexShader, f = shader.fragmentShader
  const sail = SAIL_ONLY.map((r) => `r == ${ROLES.indexOf(r)}`).join(' || '), power = POWER_ONLY.map((r) => `r == ${ROLES.indexOf(r)}`).join(' || ')
  v = v.replace(need(v, '#include <common>'), `#include <common>
attribute float aRole;
attribute float aKind;
attribute vec3 aHull;
attribute vec3 aTrim;
attribute float aPhase;
uniform vec3 uRoleCol[${ROLES.length}];
uniform float uBoatTime;
uniform float uNight;
varying vec3 vRoleCol;
varying float vGlow;`)
  v = v.replace(need(v, '#include <begin_vertex>'), `#include <begin_vertex>
int r = int(aRole + 0.5);
if (((${sail}) && aKind > 0.5) || ((${power}) && aKind < 0.5)) transformed = vec3(0.0); // the rig or the hardtop this boat lacks
float bt = uBoatTime + aPhase;
float roll = 0.018 * sin(bt * 0.9), pitch = 0.008 * sin(bt * 0.7 + 1.3);
transformed = vec3(transformed.x, transformed.y * cos(roll) + transformed.z * sin(roll), transformed.z * cos(roll) - transformed.y * sin(roll));
transformed.y += transformed.x * pitch + 0.035 * sin(bt * 1.3);
vec3 rc = uRoleCol[r];
if (r == ${ROLES.indexOf('hull')}) rc = aHull;
if (r == ${ROLES.indexOf('stripe')} || r == ${ROLES.indexOf('canvas')}) rc = aTrim;
vRoleCol = rc;
vGlow = r == ${ROLES.indexOf('light')} ? uNight : 0.0;`)
  f = f.replace(need(f, '#include <common>'), '#include <common>\nvarying vec3 vRoleCol;\nvarying float vGlow;')
  f = f.replace(need(f, '#include <color_fragment>'), '#include <color_fragment>\ndiffuseColor.rgb *= vRoleCol;')
  f = f.replace(need(f, '#include <emissivemap_fragment>'), '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vRoleCol * vGlow * 3.0;')
  shader.vertexShader = v; shader.fragmentShader = f
  Object.assign(shader.uniforms, uniforms)
  return shader
}

export function createBoatMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.45, metalness: 0.05 })
  m.onBeforeCompile = (s) => patchBoatShader(s, uniforms)
  m.customProgramCacheKey = () => 'boat-v1'
  return m
}
