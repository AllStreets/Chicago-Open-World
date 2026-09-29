// app/src/transit/trainMaterial.js — one standard material for every car model (kinds pick stainless, glass,
// signs and lamps) plus the additive light sprites. Night light follows uNight, the city's day/night signal.
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'

export const trainUniforms = { uNight: facadeUniforms.uNight }
export const LIGHT = { head: 3.6, sign: 1.8, window: 0.9, tail: 1.8 }
const need = (src, marker) => { if (!src.includes(marker)) throw new Error(`train shader: missing ${marker}`); return marker }

export function patchTrainShader(shader) {
  Object.assign(shader.uniforms, trainUniforms)
  const v = shader.vertexShader, f = shader.fragmentShader
  shader.vertexShader = v
    .replace(need(v, '#include <common>'), `#include <common>
attribute float _kind;
attribute vec3 aLine;
attribute float aLead;
varying float vKind;
varying vec3 vLine;
varying float vLead;
varying float vLocalX;`)
    .replace(need(v, '#include <begin_vertex>'), `#include <begin_vertex>
vKind = _kind; vLine = aLine; vLead = aLead;
vLocalX = position.x;`)
  shader.fragmentShader = f
    .replace(need(f, '#include <common>'), `#include <common>
uniform float uNight;
varying float vKind;
varying vec3 vLine;
varying float vLead;
varying float vLocalX;`)
    .replace(need(f, '#include <roughnessmap_fragment>'), `#include <roughnessmap_fragment>
int owK = int(vKind + 0.5);
if (owK == 9) roughnessFactor = 0.32;   // brushed stainless
if (owK == 7) roughnessFactor = 0.08;   // glass
if (owK == 13) roughnessFactor = 0.45;  // painted livery`)
    .replace(need(f, '#include <metalnessmap_fragment>'), `#include <metalnessmap_fragment>
if (owK == 9) metalnessFactor = 0.85;
if (owK == 7) metalnessFactor = 0.0;`)
    .replace(need(f, '#include <emissivemap_fragment>'), `#include <emissivemap_fragment>
if (owK == 7) totalEmissiveRadiance += vec3(1.0, 0.88, 0.7) * ${LIGHT.window.toFixed(2)} * uNight;
if (owK == 6) totalEmissiveRadiance += vLine * (0.6 + ${LIGHT.sign.toFixed(2)} * uNight);
if (owK == 11 && vLead > 0.5 && vLocalX > 0.0) totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * (0.4 + ${LIGHT.head.toFixed(2)} * uNight);
if (owK == 12 && vLead < -0.5 && vLocalX > 0.0) totalEmissiveRadiance += vec3(1.0, 0.08, 0.05) * (0.2 + ${LIGHT.tail.toFixed(2)} * uNight);`)
  return shader
}

export function createTrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 })
  m.onBeforeCompile = (s) => { patchTrainShader(s) }
  m.customProgramCacheKey = () => 'ow-train-v1'
  return m
}

export function createLightsMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uNight: facadeUniforms.uNight },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
attribute float aMode;
varying vec2 vUv;
varying float vMode;
void main() {
  vUv = uv; vMode = aMode;
  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 wp;
  if (aMode < 0.5) { // headlight flare: a camera-facing sprite
    float size = length(instanceMatrix[0].xyz);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    wp = c + (right * position.x + up * position.y) * size;
  } else {           // spill: lies flat on the track ahead of the train
    wp = (instanceMatrix * vec4(position.x, 0.0, position.y, 1.0)).xyz;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uNight;
varying vec2 vUv;
varying float vMode;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - r), 2.0) * uNight;
  if (a < 0.003) discard;
  vec3 col = vMode < 0.5 ? vec3(1.0, 0.95, 0.85) * 2.5 : vec3(1.0, 0.82, 0.55) * 0.5;
  gl_FragColor = vec4(col * a, a);
}`,
  })
}
