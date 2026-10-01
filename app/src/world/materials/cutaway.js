// app/src/world/materials/cutaway.js — the U "Lower levels" cutaway (D2-3): over the multi-level streets the street
// surface (roads, sidewalks, plazas and the land under them) dissolves away, leaving a thin CHI-cyan section line round
// the opening, so Lower Wacker and the other lower decks show through like an architect's cut-away drawing.
// Only street-level surfaces (y > −1) inside the mask open; with uCut = 0 (U off) every shader takes the old path, so
// the street level renders exactly as before. The mask is cutMask() from lowerLevels.js, uploaded once.
import * as THREE from 'three'
import { cutDepth, portalDepth } from '../lowerLevels.js'

const empty = () => { const t = new THREE.DataTexture(new Uint8Array([0, 0]), 1, 1, THREE.RGFormat, THREE.UnsignedByteType); t.needsUpdate = true; return t }

export const cutUniforms = {
  uCut: { value: 0 },                                  // 0 = the street as it is, 1 = fully opened (animated by LowerLevels.jsx)
  uCutMask: { value: empty() },
  uCutBox: { value: new THREE.Vector4(0, 0, 0, 0) },   // x0, z0, 1 / width m, 1 / height m (0 → no mask)
  uCutRange: { value: 4 },
  uCutColor: { value: new THREE.Color('#45d8ff') },    // --accent
}

let active = null
// install a cutMask() raster as the shaders' mask (null removes it): R = the U cut-away, G = the ramp portals (D4-1)
export function setCutMask(mask) {
  active = mask
  const old = cutUniforms.uCutMask.value
  if (!mask) { cutUniforms.uCutMask.value = empty(); cutUniforms.uCutBox.value.set(0, 0, 0, 0) } else {
    const rg = new Uint8Array(mask.width * mask.height * 2)
    for (let i = 0; i < mask.width * mask.height; i++) { rg[i * 2] = mask.data[i]; rg[i * 2 + 1] = mask.portal?.[i] ?? 0 }
    const t = new THREE.DataTexture(rg, mask.width, mask.height, THREE.RGFormat, THREE.UnsignedByteType)
    t.unpackAlignment = 2
    t.magFilter = t.minFilter = THREE.LinearFilter
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    t.needsUpdate = true
    cutUniforms.uCutMask.value = t
    cutUniforms.uCutBox.value.set(mask.x0, mask.z0, 1 / (mask.width * mask.cell), 1 / (mask.height * mask.cell))
    cutUniforms.uCutRange.value = mask.range
  }
  old.dispose()
}
// is the street at (x, z) opened right now? (Traffic leaves the upper deck's cars out of the opening)
export const isCutOpen = (x, z) => cutUniforms.uCut.value > 0.5 && cutDepth(active, x, z) > 0
// D4-1: is (x, z) over a ramp portal's opening (the street there is always open)? metres inside it (> 0)
export const portalOpenDepth = (x, z) => (active?.portal ? portalDepth(active, x, z) : -Infinity)

const HEAD = /* glsl */ `
uniform float uCut;
uniform sampler2D uCutMask;
uniform vec4 uCutBox;
uniform float uCutRange;
uniform vec3 uCutColor;
varying vec3 vCutW;
vec2 cutDepthAt(vec2 p) {
  vec2 cuv = (p - uCutBox.xy) * uCutBox.zw;
  if (uCutBox.z == 0.0 || cuv.x <= 0.0 || cuv.y <= 0.0 || cuv.x >= 1.0 || cuv.y >= 1.0) return vec2(-uCutRange);
  return texture2D(uCutMask, cuv).rg * 2.0 * uCutRange - uCutRange;
}`
// at the top of main(): how far inside the U opening (x) and a ramp portal's opening (y) this fragment is
const OPEN = /* glsl */ `
vec2 cutM = vCutW.y > -1.0 ? cutDepthAt(vCutW.xz) : vec2(-uCutRange);
float cutD = uCut > 0.0 ? cutM.x : -uCutRange;`
// at the end (after every derivative and texture read): open the street — a per-pixel dissolve while U fades in —
// and draw the section line just outside the opening
const LINE = /* glsl */ `
if (cutM.y > 0.0) discard; // D4-1: the street is always open over a ramp's trench
if (uCut > 0.0) {
  float cutH = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
  if (cutD > 0.0 && cutH < uCut) discard;
  if (cutD > -0.9 && cutD <= 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, uCutColor, uCut * smoothstep(-0.9, -0.5, cutD) * 0.9);
}`

const need = (src, m) => { if (!src.includes(m)) throw new Error(`cutaway shader: missing ${m}`); return m }

// patch a MeshStandardMaterial-family shader (call inside onBeforeCompile, after any other patch)
export function patchCutaway(shader) {
  let v = shader.vertexShader, f = shader.fragmentShader
  v = v.replace(need(v, '#include <common>'), '#include <common>\nvarying vec3 vCutW;')
  v = v.replace(need(v, '#include <project_vertex>'), '#include <project_vertex>\nvCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
  f = f.replace(need(f, '#include <common>'), `#include <common>\n${HEAD}`)
  f = f.replace(need(f, 'void main() {'), `void main() {\n${OPEN}`)
  f = f.replace(need(f, '#include <dithering_fragment>'), `#include <dithering_fragment>\n${LINE}`)
  shader.vertexShader = v; shader.fragmentShader = f
  Object.assign(shader.uniforms, cutUniforms)
  return shader
}
