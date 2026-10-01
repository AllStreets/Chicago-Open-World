// app/src/world/materials/groundShader.js — one material for every ground surface (roads, sidewalks,
// parks, pitches, beaches, rail, paving): a texture array picked by the per-vertex layer index.
import * as THREE from 'three'
import { loadLayerArray } from './textureArray.js'
import { facadeUniforms } from './facadeMaterial.js'
import { scanUniforms, SCAN_HEAD, SCAN_GROUND, SCAN_GROUND_DERIV } from '../../scan/scanShader.js'

// Order matches pipeline GROUND_LAYERS: roads, sidewalks, parks, pitches, beaches, rail, paving (brick plazas and
// paths, user 2026-09-30 — the sidewalk texture gives its grain, the shader lays the brick), dockwall and riprap (D1:
// the sunken river's walls — weathered concrete and sheet pile downtown, dark rubble-faced banks upriver)
export const GROUND_TEXTURES = ['asphalt', 'sidewalk', 'grass', 'pitch', 'sand', 'gravel', 'sidewalk', 'sidewalk', 'gravel']
export const GROUND_LAYER_COUNT = GROUND_TEXTURES.length
const TINTS = ['#8a8a8a', '#bebbb4', '#d6e8c4', '#ffffff', '#fff7e6', '#6b6258', '#ffffff', '#8c8a83', '#5e5a52']
// Depth priority where layers overlap (roads over sidewalks over rail over pitches over parks/beaches).
// Far blocks quantize heights to ~0.1 m, so the order is applied as a tiny clip-space bias instead.
export const LAYER_RANK = [5, 4, 1, 2, 1, 3, 4.5, 0, 0]
const greyArray = () => { const t = new THREE.DataArrayTexture(new Uint8Array(4 * GROUND_LAYER_COUNT).fill(140), 1, 1, GROUND_LAYER_COUNT); t.needsUpdate = true; return t }

export const groundUniforms = {
  uGround: { value: greyArray() },
  uSize: { value: [12, 6, 16, 40, 10, 12, 6, 6, 8] },
  uTint: { value: TINTS.map((c) => new THREE.Color(c)) },
  uNight: facadeUniforms.uNight, // shared with the façades so street light follows the sky
  uLayerRank: { value: LAYER_RANK },
  uLayerBias: { value: 4e-6 },
  uSnow: { value: 0 }, // user fixes: snow on the parks, walks and beaches; streets stay slushy grey
}

const need = (src, m) => { if (!src.includes(m)) throw new Error(`ground shader: missing ${m}`); return m }

export function patchGroundShader(shader) {
  let v = shader.vertexShader, f = shader.fragmentShader
  v = v.replace(need(v, '#include <common>'), `#include <common>\nattribute float _layer;\nvarying float vLayer;\nvarying vec2 vGUv;\nuniform float uLayerRank[${GROUND_LAYER_COUNT}];\nuniform float uLayerBias;`)
  v = v.replace(need(v, '#include <project_vertex>'), '#include <project_vertex>\ngl_Position.z -= uLayerBias * uLayerRank[int(_layer + 0.5)] * gl_Position.w;')
  v = v.replace(need(v, '#include <worldpos_vertex>'), '#include <worldpos_vertex>\nvLayer = _layer;\nvGUv = uv;\nvGWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
  v = v.replace('varying vec2 vGUv;', 'varying vec2 vGUv;\nvarying vec3 vGWPos;')
  f = f.replace(need(f, '#include <common>'), `#include <common>
uniform sampler2DArray uGround;
uniform float uSize[${GROUND_LAYER_COUNT}];
uniform vec3 uTint[${GROUND_LAYER_COUNT}];
uniform float uNight;
uniform float uSnow;
varying float vLayer;
varying vec2 vGUv;
varying vec3 vGWPos;
${SCAN_HEAD}`)
  f = f.replace(need(f, '#include <map_fragment>'), `#include <map_fragment>
int li = int(vLayer + 0.5);
vec3 gcol = texture(uGround, vec3(vGUv / uSize[li], float(li))).rgb * uTint[li];
if (li == 6) { // brick and red-granite pavers in a running bond (0.9 × 0.45 m), mortar fading with distance
  vec2 bk = vGUv / vec2(0.9, 0.45);
  bk.x += 0.5 * mod(floor(bk.y), 2.0);
  vec2 fb = fract(bk);
  float fw = max(fwidth(bk.x), fwidth(bk.y));
  float mortar = (1.0 - smoothstep(0.0, 0.07 + fw, fb.x)) + (1.0 - smoothstep(0.0, 0.12 + fw, fb.y));
  mortar = min(mortar, 1.0) * (1.0 - smoothstep(0.15, 0.6, fw));
  float hv = fract(sin(dot(floor(bk), vec2(12.9898, 78.233))) * 43758.5453);
  float lum = dot(gcol, vec3(0.333));
  gcol = mix(vec3(0.4, 0.19, 0.14), vec3(0.5, 0.26, 0.19), hv) * (0.85 + 0.3 * lum) * mix(1.0, 0.72, mortar); // deep red granite: the sun and tone mapping lift it
}
diffuseColor.rgb *= gcol;
if (li >= 7) gcol *= 0.82 + 0.18 * smoothstep(-7.0, 0.0, vGWPos.y); // the river's walls: damp and darker toward the water
// asphalt 0 · sidewalk 1 · grass 2 · pitch 3 · sand 4 · gravel 5 · paving 6 · dockwall 7 · riprap 8: streets are
// ploughed to a slushy grey; vertical walls hold no snow
float snowK = uSnow * (li == 0 ? 0.3 : li >= 7 ? 0.0 : 0.9);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.9, 0.95) * (0.93 + 0.07 * gcol.g), snowK);`)
  f = f.replace(need(f, '#include <emissivemap_fragment>'), `#include <emissivemap_fragment>
if (li == 0) totalEmissiveRadiance += vec3(1.0, 0.68, 0.36) * uNight * 0.07; // sodium street light`)
  f = f.replace(need(f, '#include <dithering_fragment>'), `#include <dithering_fragment>\n${SCAN_GROUND}`) // P5: Scan
  f = f.replace(need(f, 'void main() {'), `void main() {\n${SCAN_GROUND_DERIV}`)
  shader.vertexShader = v; shader.fragmentShader = f
  Object.assign(shader.uniforms, groundUniforms, scanUniforms)
  return shader
}

export function createGroundMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  m.onBeforeCompile = patchGroundShader
  m.customProgramCacheKey = () => 'ground-v6' // paving layer (user 2026-09-30); P5: Scan; D1: dockwall + riprap
  return m
}

export async function loadGroundTextures() {
  const res = await fetch('/textures/ground/ground.json').catch(() => null)
  const g = res && res.ok ? await res.json() : null
  if (!g) return
  groundUniforms.uGround.value = await loadLayerArray(GROUND_TEXTURES.map((n) => `/textures/${g[n]?.file ?? 'ground/asphalt.jpg'}`), 512)
  groundUniforms.uSize.value = GROUND_TEXTURES.map((n) => g[n]?.sizeM ?? 12)
}
