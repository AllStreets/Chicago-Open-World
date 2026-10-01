// app/src/world/materials/groundShader.js — one material for every ground surface (roads, sidewalks,
// parks, pitches, beaches, rail): a texture array picked by the per-vertex layer index.
import * as THREE from 'three'
import { loadLayerArray } from './textureArray.js'
import { facadeUniforms } from './facadeMaterial.js'
import { scanUniforms, SCAN_HEAD, SCAN_GROUND, SCAN_GROUND_DERIV } from '../../scan/scanShader.js'

// Order matches pipeline GROUND_LAYERS: roads, sidewalks, parks, pitches, beaches, rail
export const GROUND_TEXTURES = ['asphalt', 'sidewalk', 'grass', 'pitch', 'sand', 'gravel']
const TINTS = ['#8a8a8a', '#bebbb4', '#d6e8c4', '#ffffff', '#fff7e6', '#6b6258']
// Depth priority where layers overlap (roads over sidewalks over rail over pitches over parks/beaches).
// Far blocks quantize heights to ~0.1 m, so the order is applied as a tiny clip-space bias instead.
export const LAYER_RANK = [5, 4, 1, 2, 1, 3]
const greyArray = () => { const t = new THREE.DataArrayTexture(new Uint8Array(4 * 6).fill(140), 1, 1, 6); t.needsUpdate = true; return t }

export const groundUniforms = {
  uGround: { value: greyArray() },
  uSize: { value: [12, 6, 16, 40, 10, 12] },
  uTint: { value: TINTS.map((c) => new THREE.Color(c)) },
  uNight: facadeUniforms.uNight, // shared with the façades so street light follows the sky
  uLayerRank: { value: LAYER_RANK },
  uLayerBias: { value: 4e-6 },
  uSnow: { value: 0 }, // user fixes: snow on the parks, walks and beaches; streets stay slushy grey
}

const need = (src, m) => { if (!src.includes(m)) throw new Error(`ground shader: missing ${m}`); return m }

export function patchGroundShader(shader) {
  let v = shader.vertexShader, f = shader.fragmentShader
  v = v.replace(need(v, '#include <common>'), '#include <common>\nattribute float _layer;\nvarying float vLayer;\nvarying vec2 vGUv;\nuniform float uLayerRank[6];\nuniform float uLayerBias;')
  v = v.replace(need(v, '#include <project_vertex>'), '#include <project_vertex>\ngl_Position.z -= uLayerBias * uLayerRank[int(_layer + 0.5)] * gl_Position.w;')
  v = v.replace(need(v, '#include <worldpos_vertex>'), '#include <worldpos_vertex>\nvLayer = _layer;\nvGUv = uv;\nvGWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
  v = v.replace('varying vec2 vGUv;', 'varying vec2 vGUv;\nvarying vec3 vGWPos;')
  f = f.replace(need(f, '#include <common>'), `#include <common>
uniform sampler2DArray uGround;
uniform float uSize[6];
uniform vec3 uTint[6];
uniform float uNight;
uniform float uSnow;
varying float vLayer;
varying vec2 vGUv;
varying vec3 vGWPos;
${SCAN_HEAD}`)
  f = f.replace(need(f, '#include <map_fragment>'), `#include <map_fragment>
int li = int(vLayer + 0.5);
vec3 gcol = texture(uGround, vec3(vGUv / uSize[li], float(li))).rgb * uTint[li];
diffuseColor.rgb *= gcol;
// asphalt 0 · sidewalk 1 · grass 2 · pitch 3 · sand 4 · gravel 5: streets are ploughed to a slushy grey
float snowK = uSnow * (li == 0 ? 0.3 : 0.9);
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
  m.customProgramCacheKey = () => 'ground-v4' // P5: Scan
  return m
}

export async function loadGroundTextures() {
  const res = await fetch('/textures/ground/ground.json').catch(() => null)
  const g = res && res.ok ? await res.json() : null
  if (!g) return
  groundUniforms.uGround.value = await loadLayerArray(GROUND_TEXTURES.map((n) => `/textures/${g[n]?.file ?? 'ground/asphalt.jpg'}`), 512)
  groundUniforms.uSize.value = GROUND_TEXTURES.map((n) => g[n]?.sizeM ?? 12)
}
