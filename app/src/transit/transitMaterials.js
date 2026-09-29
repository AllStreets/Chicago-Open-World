// app/src/transit/transitMaterials.js — the two transit materials: vertex-coloured structure (steel, concrete,
// ballast with painted ties, lit signs, line-colour accents) and the camera-facing, width-compensated line glow.
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { GLOW_DEFAULTS, GLOW_GLSL } from './glowWidth.js'

export const MAX_LINES = 32
export const NIGHT_BOOST = 2.2   // HDR headroom at night so selective bloom (threshold 0.55) catches the glow
export const ACCENT_NIGHT = 1.4  // girder fascia emissive at night
export const glowUniforms = {
  uNight: facadeUniforms.uNight,
  uViewportH: { value: 1000 },
  uTanHalfFov: { value: Math.tan((42 * Math.PI) / 360) },
  uMinPx: { value: GLOW_DEFAULTS.minPx },
  uBaseHalf: { value: GLOW_DEFAULTS.baseHalfM },
  uLineOn: { value: new Float32Array(MAX_LINES).fill(1) },
  uGhost: { value: 0 }, // Scan (Phase 5) raises this to show subway track
}
export const structureUniforms = { uNight: facadeUniforms.uNight, uAccent: { value: 1 } }

const need = (src, marker, what) => {
  if (!src.includes(marker)) throw new Error(`${what} shader: missing ${marker}`)
  return marker
}

export function patchGlowShader(shader) {
  Object.assign(shader.uniforms, glowUniforms)
  const v = shader.vertexShader, f = shader.fragmentShader
  shader.vertexShader = v
    .replace(need(v, '#include <common>', 'glow'), `#include <common>
attribute float _side;
attribute float _lane;
attribute float _lanes;
attribute float _line;
attribute float _intensity;
attribute float _ghost;
uniform float uViewportH;
uniform float uTanHalfFov;
uniform float uMinPx;
uniform float uBaseHalf;
uniform float uLineOn[${MAX_LINES}];
uniform float uGhost;
varying float vGlowSide;
varying float vGlowOn;
${GLOW_GLSL}`)
    .replace(need(v, '#include <begin_vertex>', 'glow'), `#include <begin_vertex>
{
  vec4 owW = modelMatrix * vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    owW = modelMatrix * batchingMatrix * vec4(transformed, 1.0);
  #endif
  vec3 owTan = normalize(normal); // NORMAL carries the track tangent
  vec3 owToCam = cameraPosition - owW.xyz;
  float owDist = length(owToCam);
  vec3 owAcross = cross(owTan, owToCam / max(owDist, 1e-3));
  float owLen = length(owAcross);
  owAcross = owLen > 1e-4 ? owAcross / owLen : vec3(0.0, 1.0, 0.0);
  float owHw = owGlowHalfWidth(owDist, uTanHalfFov, uViewportH, uMinPx, uBaseHalf);
  transformed += owAcross * (_lane * 2.0 * owHw + _side * owHw);
  vGlowSide = _side;
  vGlowOn = uLineOn[int(_line + 0.5)] * mix(1.0, uGhost, _ghost) * _intensity;
}`)
  shader.fragmentShader = f
    .replace(need(f, '#include <common>', 'glow'), `#include <common>
uniform float uNight;
varying float vGlowSide;
varying float vGlowOn;
${GLOW_GLSL}`)
    .replace(need(f, '#include <opaque_fragment>', 'glow'), `outgoingLight = diffuseColor.rgb * (1.0 + ${NIGHT_BOOST.toFixed(1)} * uNight);
diffuseColor.a = (1.0 - smoothstep(0.35, 1.0, abs(vGlowSide))) * owGlowLevel(uNight) * vGlowOn;
if (diffuseColor.a < 0.004) discard;
#include <opaque_fragment>`)
  return shader
}

export function patchStructureShader(shader) {
  Object.assign(shader.uniforms, structureUniforms)
  const v = shader.vertexShader, f = shader.fragmentShader
  shader.vertexShader = v
    .replace(need(v, '#include <common>', 'structure'), `#include <common>
attribute float _kind;
attribute float _along;
varying float vKind;
varying float vAlong;`)
    .replace(need(v, '#include <begin_vertex>', 'structure'), `#include <begin_vertex>
vKind = _kind;
vAlong = _along;`)
  shader.fragmentShader = f
    .replace(need(f, '#include <common>', 'structure'), `#include <common>
uniform float uNight;
uniform float uAccent;
varying float vKind;
varying float vAlong;`)
    .replace(need(f, '#include <roughnessmap_fragment>', 'structure'), `#include <roughnessmap_fragment>
int owK = int(vKind + 0.5);
if (owK == 2) { // ballast with painted ties every 0.61 m
  float owTie = step(1.0 - 0.2 / 0.61, fract(vAlong / 0.61));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.12, 0.09), owTie * 0.85);
  roughnessFactor = 0.95;
}
if (owK == 3) roughnessFactor = 0.3;`)
    .replace(need(f, '#include <metalnessmap_fragment>', 'structure'), `#include <metalnessmap_fragment>
if (owK == 0 || owK == 3) metalnessFactor = 0.45;`)
    .replace(need(f, '#include <emissivemap_fragment>', 'structure'), `#include <emissivemap_fragment>
if (owK == 4) totalEmissiveRadiance += diffuseColor.rgb * (0.08 + ${ACCENT_NIGHT.toFixed(1)} * uNight) * uAccent;
if (owK == 6) totalEmissiveRadiance += diffuseColor.rgb * (0.25 + 1.2 * uNight);
if (owK == 7) totalEmissiveRadiance += vec3(1.0, 0.85, 0.6) * 0.5 * uNight;`)
  return shader
}

// Additive: overlapping lines add like light (the neon read); NormalBlending is the evaluated fallback (plan override).
export const GLOW_BLENDING = THREE.AdditiveBlending

export function createGlowMaterial() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: GLOW_BLENDING })
  m.onBeforeCompile = (s) => { patchGlowShader(s) }
  m.customProgramCacheKey = () => 'ow-transit-glow-v1'
  return m
}

export function createStructureMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.2 })
  m.onBeforeCompile = (s) => { patchStructureShader(s) }
  m.customProgramCacheKey = () => 'ow-transit-structure-v1'
  return m
}

export function setLineMask(lines, hidden) {
  const a = glowUniforms.uLineOn.value
  a.fill(1)
  for (const l of lines) if (l.index < MAX_LINES) a[l.index] = hidden.includes(l.id) ? 0 : 1
}
