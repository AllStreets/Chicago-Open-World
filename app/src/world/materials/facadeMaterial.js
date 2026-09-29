// app/src/world/materials/facadeMaterial.js — one shader for every building.
import * as THREE from 'three'
import { loadLayerArray } from './textureArray.js'

const greyArray = () => { const t = new THREE.DataArrayTexture(new Uint8Array(4 * 8).fill(150), 1, 1, 8); t.needsUpdate = true; return t }
const greyTex = () => { const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255]), 1, 1); t.needsUpdate = true; return t }

export const facadeUniforms = {
  uAlbedo: { value: greyArray() },
  uWin: { value: greyArray() },
  uRoof: { value: greyTex() },
  uTile: { value: Array.from({ length: 8 }, () => new THREE.Vector4(18, 15.2, 4, 4)) },
  uNight: { value: 0 },
  uLitBoost: { value: 1 },
  uReady: { value: 0 },
}

const need = (src, marker) => {
  if (!src.includes(marker)) throw new Error(`facade shader: missing ${marker}`)
  return marker
}

const VERT_HEAD = /* glsl */ `
attribute float _facade;
attribute float _seed;
varying float vFacade;
varying float vSeed;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec2 vMUv;
`
const VERT_BODY = /* glsl */ `
vFacade = _facade;
vSeed = _seed;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);
vMUv = uv;
`
const FRAG_HEAD = /* glsl */ `
uniform sampler2DArray uAlbedo;
uniform sampler2DArray uWin;
uniform sampler2D uRoof;
uniform vec4 uTile[8];
uniform float uNight;
uniform float uLitBoost;
uniform float uReady;
varying float vFacade;
varying float vSeed;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec2 vMUv;
float owHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`
const FRAG_MAP = /* glsl */ `
bool isParapet = vFacade > 7.5;                          // index 8 = parapet coping
int fi = isParapet ? 4 : int(vFacade + 0.5);
vec4 T = uTile[fi];
bool isRoof = vWNormal.y > 0.6;
vec2 tuv = vMUv / T.xy;
vec2 gx = dFdx(tuv), gy = dFdy(tuv);
vec3 st = vec3(fract(tuv.x), 1.0 - fract(tuv.y), float(fi));
vec3 wallAlb = textureGrad(uAlbedo, st, gx, gy).rgb;
float win = textureGrad(uWin, st, gx, gy).r;
vec3 gravel = texture(uRoof, vWPos.xz / 12.0).rgb;
// per-building roof finish: gravel ballast, dark tar/EPDM, white TPO with seams, green roof
float rk = fract(vSeed * 5.13);
vec2 seam = abs(fract(vWPos.xz / vec2(3.0, 12.0)) - 0.5);
float seams = smoothstep(0.47, 0.5, max(seam.x, seam.y));
vec3 roofAlb = rk < 0.4 ? gravel * 0.85
  : rk < 0.62 ? gravel * vec3(0.32, 0.33, 0.36)
  : rk < 0.9 ? mix(vec3(0.84, 0.85, 0.83), vec3(0.62, 0.63, 0.62), seams) * (0.9 + 0.1 * gravel.r)
  : mix(vec3(0.27, 0.42, 0.2), vec3(0.36, 0.5, 0.26), gravel.g);
vec3 coping = vec3(0.58, 0.56, 0.52) * (0.9 + 0.2 * gravel.r);
vec3 alb = isRoof ? roofAlb : (isParapet ? coping : wallAlb);
win = (isRoof || isParapet) ? 0.0 : win;
alb = mix(vec3(0.62, 0.6, 0.57), alb, uReady);
win *= uReady;
alb *= mix(0.55, 1.0, smoothstep(0.0, 14.0, vWPos.y));   // ground contact
alb *= 0.88 + 0.24 * vSeed;                              // per-building variation
if (fi == 3) {                                           // curtain glass: bronze-black, green, silver, blue
  float g = fract(vSeed * 3.7);
  vec3 tint = g < 0.28 ? vec3(0.30, 0.28, 0.27) : g < 0.5 ? vec3(0.62, 0.8, 0.74) : g < 0.78 ? vec3(0.86, 0.9, 0.98) : vec3(0.72, 0.8, 0.95);
  alb *= tint;
}
diffuseColor.rgb *= alb;
`
const FRAG_ROUGH = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.06, win * 0.95);
`
const FRAG_METAL = /* glsl */ `
metalnessFactor = mix(metalnessFactor, 0.9, win * 0.85);
`
const FRAG_EMISSIVE = /* glsl */ `
if (!isRoof && !isParapet && uNight > 0.001) {
  vec2 cell = floor(tuv * T.zw);
  vec2 cf = fract(tuv * T.zw);
  // inset rectangle inside each cell: frames/mullions stay dark (matters for all-glass walls)
  float inset = smoothstep(0.03, 0.09, cf.x) * smoothstep(0.03, 0.09, 1.0 - cf.x)
              * smoothstep(0.05, 0.12, cf.y) * smoothstep(0.08, 0.18, 1.0 - cf.y);
  float h = owHash(cell + vec2(vSeed * 173.0, vSeed * 91.0));
  float floorH = owHash(vec2(cell.y, vSeed * 57.0));          // whole office floors light together
  float busy = mix(0.05, 0.5, fract(vSeed * 7.31));           // some towers dark, some busy
  float lit = step(h * 0.55 + floorH * 0.45, busy * (0.45 + 0.55 * uNight));
  vec3 warm = vec3(1.0, 0.72, 0.45), cool = vec3(0.78, 0.86, 1.0);
  vec3 wc = mix(warm, cool, step(0.7, owHash(vec2(cell.y, vSeed * 13.0))));
  float level = 0.45 + 0.55 * owHash(cell * 1.7 + 3.1);
  totalEmissiveRadiance += wc * win * inset * lit * uNight * level * 0.9 * uLitBoost;
}
`

export function patchFacadeShader(shader) {
  let v = shader.vertexShader, f = shader.fragmentShader
  v = v.replace(need(v, '#include <common>'), `#include <common>\n${VERT_HEAD}`)
  v = v.replace(need(v, '#include <worldpos_vertex>'), `#include <worldpos_vertex>\n${VERT_BODY}`)
  f = f.replace(need(f, '#include <common>'), `#include <common>\n${FRAG_HEAD}`)
  f = f.replace(need(f, '#include <map_fragment>'), `#include <map_fragment>\n${FRAG_MAP}`)
  f = f.replace(need(f, '#include <roughnessmap_fragment>'), `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
  f = f.replace(need(f, '#include <metalnessmap_fragment>'), `#include <metalnessmap_fragment>\n${FRAG_METAL}`)
  f = f.replace(need(f, '#include <emissivemap_fragment>'), `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`)
  shader.vertexShader = v
  shader.fragmentShader = f
  Object.assign(shader.uniforms, facadeUniforms)
  return shader
}

export function createFacadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0.02 })
  m.onBeforeCompile = patchFacadeShader
  m.customProgramCacheKey = () => 'facade-v4'
  return m
}

export async function loadFacadeTextures() {
  const res = await fetch('/textures/facades/facades.json').catch(() => null)
  const list = res && res.ok ? await res.json() : null
  if (!list) { console.warn('facades.json missing — flat façades'); return }
  const size = 1024
  const [alb, win] = await Promise.all([
    loadLayerArray(list.map((f) => `/textures/${f.albedo}`), size),
    loadLayerArray(list.map((f) => `/textures/${f.win}`), size, { srgb: false, fallback: 0 }), // missing mask = no windows
  ])
  // roof gravel loads on its own so it can never hold up the façades
  new THREE.TextureLoader().loadAsync('/textures/ground/gravel.jpg').then((roof) => {
    roof.wrapS = roof.wrapT = THREE.RepeatWrapping; roof.colorSpace = THREE.SRGBColorSpace; roof.anisotropy = 8
    facadeUniforms.uRoof.value = roof
  }).catch(() => {})
  facadeUniforms.uAlbedo.value = alb
  facadeUniforms.uWin.value = win
  list.forEach((f) => facadeUniforms.uTile.value[f.index].set(f.tileW, f.tileH, f.bays, f.floors))
  facadeUniforms.uReady.value = 1
}
