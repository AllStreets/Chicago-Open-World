// app/src/traffic/vehicleModels.js — the Blender road vehicles (pipeline/heroes/scripts/vehicles.py → world/vehicles/<kind>.glb):
// which model a simulated car, bus or truck wears, its paint, and the one material every vehicle shares. Each .glb holds
// `lod0` and `lod1`, one primitive per role material and the baked occlusion in COLOR_0; mergeVehicleRoles turns a LOD into
// one geometry with a per-vertex role, and the shader colours each role (paint and paint2 per vehicle), sets its gloss, and
// lights the lamps and signs (tail lamps brighter under braking). Local frame: +X forward, +Z the right side, origin on the
// road under the vehicle's centre — the frame of the sim (sim.js) and of the box models (models.js) kept for the far range.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { worldUrl } from '../lib/manifest.js'

// vehicles.py ROLES, in order
export const VEHICLE_ROLES = ['paint', 'paint2', 'glass', 'chrome', 'trim', 'tyre', 'rim', 'head', 'tail', 'amber', 'plate', 'interior', 'under', 'stripe_blue', 'stripe_red', 'sign']
const RI = Object.fromEntries(VEHICLE_ROLES.map((r, i) => [r, i]))
// sRGB base colour, roughness, metalness per role (paint and paint2 take the vehicle's own colour)
const ROLE_LOOK = {
  paint: ['#ffffff', 0.3, 0.35], paint2: ['#ffffff', 0.45, 0.15], glass: ['#10161c', 0.06, 0.6], chrome: ['#d6d9dc', 0.14, 1.0],
  trim: ['#17181a', 0.62, 0.05], tyre: ['#141415', 0.9, 0.0], rim: ['#a9adb2', 0.3, 0.85], head: ['#e9eef2', 0.08, 0.3],
  tail: ['#8a0d0d', 0.15, 0.1], amber: ['#c26a0a', 0.15, 0.1], plate: ['#e6e3d6', 0.5, 0.1], interior: ['#26282b', 0.85, 0.0],
  under: ['#1a1b1c', 0.9, 0.1], stripe_blue: ['#2f5ea8', 0.32, 0.2], stripe_red: ['#c8202f', 0.32, 0.2], sign: ['#ffb43a', 0.4, 0.0],
}

// the models each sim type draws with: weights (out of 100), length (m; the lamps sit at its ends), lamp height
export const VARIANTS = {
  car: [
    { kind: 'sedan', w: 28, L: 4.85, lampY: 0.72 }, { kind: 'suv', w: 30, L: 4.9, lampY: 0.88 }, { kind: 'hatch', w: 12, L: 4.25, lampY: 0.75 },
    { kind: 'pickup', w: 10, L: 5.6, lampY: 0.95 }, { kind: 'taxi', w: 12, L: 4.85, lampY: 0.72 }, { kind: 'van', w: 8, L: 5.9, lampY: 0.85 },
  ],
  bus: [{ kind: 'bus', w: 100, L: 12.2, lampY: 0.85 }],
  truck: [{ kind: 'semi', w: 60, L: 16.5, lampY: 0.95 }, { kind: 'boxtruck', w: 40, L: 9.0, lampY: 0.95 }],
}
export const VEHICLE_KINDS = Object.values(VARIANTS).flat().map((v) => v.kind)

// a vehicle's model, deterministic from its colour seed (the sim's v.colour, 0 … 1e6)
export function variantOf(type, seed) {
  const list = VARIANTS[type]
  let r = Math.floor(seed / 7) % 100
  for (const v of list) { if (r < v.w) return v; r -= v.w }
  return list[0]
}

// paints (sRGB): cars in the colours they come in; taxis yellow; vans mostly white; trailers and boxes white to grey
const CAR_PAINTS = ['#e8e8e6', '#1d1f22', '#8a8f96', '#5a1e1e', '#22325a', '#c9c9c4', '#3d4448', '#7a1515', '#2d4a3a', '#b9b2a0', '#0f1013', '#4e5d73', '#f2f2f0', '#2a2c30', '#a7acb2']
const VAN_PAINTS = ['#f2f2f0', '#f2f2f0', '#e8e8e6', '#c9c9c4', '#22325a', '#1d1f22']
const BOX_PAINTS = ['#f1f1ee', '#e9e9e5', '#d9dadc', '#c8ccd0', '#ece6d6', '#f1f1ee']
const lin = (hex) => new THREE.Color(hex)
const PAL = { car: CAR_PAINTS.map(lin), van: VAN_PAINTS.map(lin), box: BOX_PAINTS.map(lin), taxi: [lin('#f0b20f')], bus: [lin('#eceeef')] }
// a vehicle's body colour and its second colour (trailer, box) as shared THREE.Colors — no allocation per frame
export function paintOf(kind, seed) {
  const p = kind === 'taxi' ? PAL.taxi : kind === 'bus' ? PAL.bus : kind === 'van' ? PAL.van : PAL.car
  return p[seed % p.length]
}
export const paint2Of = (seed) => PAL.box[(seed >> 5) % PAL.box.length]

// a glTF LOD node → one non-indexed geometry: position, normal, color (the baked occlusion), aRole
export function mergeVehicleRoles(node) {
  const parts = []
  node.updateMatrixWorld(true)
  node.traverse((o) => {
    if (!o.isMesh) return
    const role = RI[(o.material?.name ?? '').replace(/\.\d+$/, '')]
    if (role === undefined) return
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k)
    // plain floats (a quantised attribute cannot hold the transformed metres)
    for (const k of ['position', 'normal', 'color']) {
      const a = g.attributes[k]
      if (!a) continue
      const out = new Float32Array(a.count * 3)
      for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i) }
      g.setAttribute(k, new THREE.BufferAttribute(out, 3))
    }
    g.applyMatrix4(o.matrixWorld)
    if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3))
    g.setAttribute('aRole', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(role), 1))
    parts.push(g)
  })
  if (!parts.length) return null
  const out = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  out.computeBoundingSphere()
  return out
}

// every kind's two LODs: { sedan: { lod0, lod1 }, … } (a kind whose file is missing is left out). Cached per manifest.
let cache = null
export function loadVehicleModels(entry, version) {
  if (!entry) return Promise.resolve({})
  const key = `${entry.dir}|${version}`
  if (cache?.key === key) return cache.promise
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const promise = Promise.all((entry.kinds ?? []).map((k) => loader.loadAsync(worldUrl(`${entry.dir}/${k}.glb`, version)).then((g) => {
    const lod0 = g.scene.getObjectByName('lod0'), lod1 = g.scene.getObjectByName('lod1')
    const m = { lod0: lod0 && mergeVehicleRoles(lod0), lod1: lod1 && mergeVehicleRoles(lod1) }
    return m.lod0 && m.lod1 ? [k, m] : null
  }).catch((e) => { console.warn(`vehicle ${k} failed`, e); return null }))).then((list) => Object.fromEntries(list.filter(Boolean)))
  cache = { key, promise }
  return promise
}

export const vehicleUniforms = () => ({
  uRoleCol: { value: VEHICLE_ROLES.map((r) => lin(ROLE_LOOK[r][0])) },
  uRoleRough: { value: VEHICLE_ROLES.map((r) => ROLE_LOOK[r][1]) },
  uRoleMetal: { value: VEHICLE_ROLES.map((r) => ROLE_LOOK[r][2]) },
})

const need = (src, m) => { if (!src.includes(m)) throw new Error(`vehicle shader: missing ${m}`); return m }
const N = VEHICLE_ROLES.length
export function patchVehicleShader(shader, uniforms) {
  let v = shader.vertexShader, f = shader.fragmentShader
  v = v.replace(need(v, '#include <common>'), `#include <common>
attribute float aRole;
attribute vec3 aPaint;
attribute vec3 aPaint2;
attribute float aBrake;
uniform vec3 uRoleCol[${N}];
varying vec3 vRoleCol;
varying float vRole;
varying float vBrake;`)
  v = v.replace(need(v, '#include <begin_vertex>'), `#include <begin_vertex>
int vr = int(aRole + 0.5);
vec3 rc = uRoleCol[vr];
if (vr == ${RI.paint}) rc = aPaint;
if (vr == ${RI.paint2}) rc = aPaint2;
vRoleCol = rc; vRole = aRole; vBrake = aBrake;`)
  f = f.replace(need(f, '#include <common>'), `#include <common>
uniform float uRoleRough[${N}];
uniform float uRoleMetal[${N}];
uniform float uNight;
varying vec3 vRoleCol;
varying float vRole;
varying float vBrake;`)
  f = f.replace(need(f, '#include <color_fragment>'), '#include <color_fragment>\ndiffuseColor.rgb *= vRoleCol;\nint fr = int(vRole + 0.5);')
  f = f.replace(need(f, '#include <roughnessmap_fragment>'), '#include <roughnessmap_fragment>\nroughnessFactor = uRoleRough[fr];')
  f = f.replace(need(f, '#include <metalnessmap_fragment>'), '#include <metalnessmap_fragment>\nmetalnessFactor = uRoleMetal[fr];')
  f = f.replace(need(f, '#include <emissivemap_fragment>'), `#include <emissivemap_fragment>
if (fr == ${RI.head}) totalEmissiveRadiance += vec3(1.0, 0.94, 0.82) * (0.15 + 3.2 * uNight);
if (fr == ${RI.tail}) totalEmissiveRadiance += vec3(1.0, 0.06, 0.03) * (0.6 * uNight + 2.2 * vBrake);
if (fr == ${RI.sign}) totalEmissiveRadiance += vRoleCol * (0.35 + 1.6 * uNight);
if (fr == ${RI.amber}) totalEmissiveRadiance += vec3(1.0, 0.45, 0.05) * 0.4 * uNight;
if (fr == ${RI.interior}) totalEmissiveRadiance += vec3(1.0, 0.86, 0.66) * 0.06 * uNight;`)
  shader.vertexShader = v; shader.fragmentShader = f
  Object.assign(shader.uniforms, uniforms)
  return shader
}

// uniforms: vehicleUniforms() plus { uNight }
export function createVehicleMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, metalness: 0.2 })
  m.onBeforeCompile = (s) => patchVehicleShader(s, uniforms)
  m.customProgramCacheKey = () => 'vehicle-v1'
  return m
}

// per-instance attributes a vehicle geometry carries (Traffic fills them per frame)
export function addInstanceAttrs(geometry, cap) {
  const attr = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * size), size); a.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute(name, a); return a }
  return { aPaint: attr('aPaint', 3), aPaint2: attr('aPaint2', 3), aBrake: attr('aBrake', 1) }
}
