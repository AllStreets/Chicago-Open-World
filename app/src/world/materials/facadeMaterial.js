// app/src/world/materials/facadeMaterial.js — one shader for every building.
import * as THREE from 'three'
import { loadLayerArray } from './textureArray.js'
import { createStyleTexture } from './stylePalette.js'
import { worldUrl } from '../../lib/manifest.js'

const greyArray = () => { const t = new THREE.DataArrayTexture(new Uint8Array(4 * 8).fill(150), 1, 1, 8); t.needsUpdate = true; return t }
const greyTex = () => { const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255]), 1, 1); t.needsUpdate = true; return t }

const FIELD_LAYERS = 8
const turfArray = () => {
  const d = new Uint8Array(4 * FIELD_LAYERS)
  for (let i = 0; i < FIELD_LAYERS; i++) d.set([74, 132, 52, 255], i * 4)
  const t = new THREE.DataArrayTexture(d, 1, 1, FIELD_LAYERS); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t
}
const vec4s = () => Array.from({ length: FIELD_LAYERS }, () => new THREE.Vector4(0, 0, 0, 0))

export const facadeUniforms = {
  uAlbedo: { value: greyArray() },
  uWin: { value: greyArray() },
  uRoof: { value: greyTex() },
  uTile: { value: Array.from({ length: 8 }, () => new THREE.Vector4(18, 15.2, 4, 4)) },
  uNight: { value: 0 },
  uLitBoost: { value: 1 },
  uReady: { value: 0 },
  uStylePal: { value: createStyleTexture([{ key: 'none' }]) },
  uStyleRows: { value: 1 },
  uTime: { value: 0 },
  uCrown: { value: new THREE.Vector4(0, 0, 0, 1) },
  uCrownB: { value: new THREE.Vector4(1, 0, 0, 1) },
  uFieldTex: { value: turfArray() },
  uFieldFrame: { value: vec4s() },
  uVenueLight: { value: vec4s() },
}

// Painted fields (V5): layer `slot` of uFieldTex covers the frame u0…u1 × v0…v1 (metres).
export function setFieldFrames(entries) {
  for (const v of facadeUniforms.uFieldFrame.value) v.set(0, 0, 0, 0)
  for (const { slot, frame: f } of entries) facadeUniforms.uFieldFrame.value[slot].set(f.u0, f.v1, 1 / (f.u1 - f.u0), 1 / (f.v1 - f.v0))
}
// Per-venue light level (game state): inside radius of a registered venue the floodlights, field glow and
// fascia use `level`; elsewhere venue surfaces keep their legacy always-lit look.
export function setVenueLights(entries) {
  for (const v of facadeUniforms.uVenueLight.value) v.set(0, 0, 0, 0)
  for (const e of entries) facadeUniforms.uVenueLight.value[e.slot].set(e.center[0], e.center[1], e.radius, e.level)
}

const need = (src, marker) => {
  if (!src.includes(marker)) throw new Error(`facade shader: missing ${marker}`)
  return marker
}

const VERT_HEAD = /* glsl */ `
attribute float _facade;
attribute float _seed;
attribute float _style;
varying float vStyle;
varying float vFacade;
varying float vSeed;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec2 vMUv;
`
const VERT_BODY = /* glsl */ `
vFacade = _facade;
vSeed = _seed;
vStyle = _style;
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
uniform sampler2D uStylePal;
uniform float uStyleRows;
varying float vStyle;
vec4 styleTexel(int si, int col) { return texelFetch(uStylePal, ivec2(col, si), 0); }
vec3 styleBase(float style) { return styleTexel(int(style + 0.5), 0).rgb; }   // V6: a row's base colour
varying float vFacade;
varying float vSeed;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec2 vMUv;
uniform sampler2DArray uFieldTex;
uniform vec4 uFieldFrame[8];
uniform vec4 uVenueLight[8];
// −1 outside every registered venue (legacy look), else that venue's light level 0…1 (set by the sports clock).
float venueLevel(vec2 p) {
  for (int i = 0; i < 8; i++) { vec4 v = uVenueLight[i]; if (v.z > 0.0 && distance(p, v.xy) < v.z) return v.w; }
  return -1.0;
}
float owHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float uTime;
uniform vec4 uCrown;
uniform vec4 uCrownB;
// Crown Fountain LED face (façade 27): procedural, never a real person's likeness.
// c.x face id, c.y pucker 0..1, c.z smile 0..1.
vec3 crownFace(vec2 uv, vec4 c) {
  vec3 skin = mix(vec3(0.36, 0.22, 0.15), vec3(0.93, 0.76, 0.62), owHash(vec2(c.x, 1.7)));
  vec2 p = (uv - vec2(0.5, 0.55)) * vec2(1.0, 1.55);
  float head = step(length(p * vec2(1.0, 0.8)), 0.42);
  vec2 e = vec2(abs(p.x) - 0.15, p.y - 0.1);
  float eyes = step(length(e * vec2(1.0, 2.2)), 0.05);
  float mw = mix(0.16, 0.05, c.y) + 0.04 * c.z;
  vec2 m = vec2(p.x, p.y + 0.2 + 0.03 * c.z * (1.0 - clamp(p.x * p.x / (mw * mw), 0.0, 1.0)));
  float mouth = step(abs(m.x), mw) * step(abs(m.y), mix(0.02, 0.05, c.y));
  vec3 col = mix(vec3(0.02, 0.03, 0.05), skin * (0.9 + 0.1 * sin(uTime * 0.7 + c.x)), head);
  col = mix(col, vec3(0.05), eyes * head);
  return mix(col, vec3(0.35, 0.08, 0.08), mouth * head);
}
// Pointed lancet windows in 4.2 m bays, a tall lower tier and a clerestory above (sacred walls).
float lancet(vec2 uv, float y) {
  float bx = abs(fract(uv.x / 4.2) - 0.5) * 4.2;
  float wy = mod(y - 2.4, 8.5);
  if (y < 2.4 || wy > 6.2) return 0.0;
  float hw = wy < 4.9 ? 0.6 : 0.6 * (1.0 - (wy - 4.9) / 1.3);
  return step(bx, hw);
}
// Venue surfaces (façade 9+): stadium seats, turf, clay, paint, steel, lamps, boards, walls, marquee, ivy.
// The style selector rides in the seed (see pipeline/lib/venue.js STYLE).
// fwRow / fwAisle: screen-space footprints, taken by the caller in uniform control flow.
vec3 venueAlbedo(int vi, float s, vec2 uv, vec3 wp, vec3 n, vec3 grain, vec3 roofAlb, float fwRow, float fwAisle, vec4 uvGrad) {
  if (vi == 25) {   // dressed stone and marble: colour from _STYLE, ashlar joints, faint veining
    float joint = step(fract(wp.y / 0.9), 0.03) + step(fract(uv.x / 1.8), 0.015);
    float vein = smoothstep(0.55, 0.6, owHash(floor(uv * 3.0))) * 0.05;
    return styleBase(vStyle) * (0.92 + 0.12 * grain.r) * (1.0 - 0.14 * min(joint, 1.0)) + vein;
  }
  if (vi == 26) {   // open steel grid deck / lattice: bars over the dark gap below
    vec2 g = abs(fract(wp.xz / 0.12) - 0.5);
    return mix(vec3(0.05, 0.06, 0.07), styleBase(vStyle), step(0.36, max(g.x, g.y)));
  }
  if (vi == 27) return styleBase(vStyle);                          // lamp glass, lenses, lit skylights
  if (vi == 28) return crownFace(uv, s < 0.5 ? uCrown : uCrownB);  // Crown Fountain towers
  if (vi == 29) return styleBase(vStyle) * (0.85 + 0.3 * grain.g); // bronze, Cor-Ten, stainless
  if ((vi == 12 || vi == 13) && vStyle > 0.5) return styleBase(vStyle) * (0.94 + 0.08 * grain.r);
  if (vi == 18 && vStyle > 0.5) return mix(styleBase(vStyle) * 0.6, styleBase(vStyle), owHash(floor(vec2(uv.x, wp.y) * 3.0))) * (0.85 + 0.3 * grain.g);
  if (vi == 9) {
    vec3 c = s < 0.25 ? vec3(0.10, 0.27, 0.17) : s < 0.5 ? vec3(0.10, 0.14, 0.30) : s < 0.75 ? vec3(0.48, 0.09, 0.09) : vec3(0.16, 0.30, 0.52);
    float row = fract(wp.y / 0.42);
    float riser = smoothstep(0.6, 0.7, row);
    float aisle = step(fract(uv.x / 17.0), 0.06);
    vec3 conc = vec3(0.56, 0.55, 0.53);
    // rows fade to an even tone with distance so risers never shimmer
    riser = mix(riser, 0.3, smoothstep(0.25, 0.6, fwRow));
    vec3 a = mix(c * (0.85 + 0.3 * owHash(floor(vec2(uv.x / 0.55, wp.y / 0.42)))), c * 0.55, riser);
    return mix(a, conc * 0.8, aisle * (1.0 - smoothstep(0.3, 0.8, fwAisle)));
  }
  if (vi == 24) {   // painted field: layer "slot" of the canvas-painted texture array, in field-frame metres
    int slot = clamp(int(s * 8.0), 0, 7);
    vec4 fr = uFieldFrame[slot];
    if (fr.z <= 0.0) return mix(vec3(0.16, 0.38, 0.12), vec3(0.2, 0.45, 0.15), 0.5) * (0.9 + 0.2 * grain.g);
    vec2 sc = vec2(fr.z, -fr.w);
    vec2 st = clamp(vec2((uv.x - fr.x) * fr.z, (fr.y - uv.y) * fr.w), 0.0, 1.0);
    return textureGrad(uFieldTex, vec3(st, float(slot)), uvGrad.xy * sc, uvGrad.zw * sc).rgb * (0.94 + 0.12 * grain.g);
  }
  if (vi == 10) {
    vec2 q = floor(uv / 9.0);
    float band = s < 0.5 ? mod(q.x + q.y, 2.0) : mod(q.x, 2.0);
    return mix(vec3(0.16, 0.38, 0.12), vec3(0.2, 0.45, 0.15), band) * (0.9 + 0.2 * grain.g);
  }
  if (vi == 11) return (s < 0.5 ? vec3(0.66, 0.42, 0.26) : vec3(0.50, 0.34, 0.24)) * (0.88 + 0.24 * grain.r);
  if (vi == 12) return s < 0.25 ? vec3(0.95) : s < 0.5 ? vec3(0.09, 0.13, 0.30) : vec3(0.88, 0.36, 0.08);
  if (vi == 13) return s < 0.25 ? vec3(0.11, 0.27, 0.18) : s < 0.5 ? vec3(0.52, 0.54, 0.57) : s < 0.75 ? vec3(0.9) : vec3(0.1, 0.13, 0.24);
  if (vi == 14) return vec3(0.93, 0.93, 0.88);
  if (vi == 15) {
    if (s < 0.5) {   // hand-turned scoreboard: dark green with white number plates
      vec2 c = fract(uv / vec2(1.5, 1.3));
      float plate = step(0.18, c.x) * step(c.x, 0.82) * step(0.22, c.y) * step(c.y, 0.78) * step(0.5, owHash(floor(uv / vec2(1.5, 1.3))));
      return mix(vec3(0.08, 0.24, 0.15), vec3(0.92), plate);
    }
    return vec3(0.04, 0.05, 0.06);
  }
  if (vi == 16) {
    if (n.y > 0.6) return roofAlb;
    float y = wp.y;
    if (s < 0.125) {  // brick base, green steel above with open concourse bays
      if (y < 9.0) return vec3(0.50, 0.23, 0.17) * (0.85 + 0.2 * step(0.1, fract(y / 0.3)) * step(0.05, fract((uv.x + step(0.5, fract(y / 0.6)) * 0.6) / 1.2)));
      float bay = step(0.18, fract(uv.x / 7.0)) * step(0.3, fract(y / 5.0)) * step(fract(y / 5.0), 0.8);
      return mix(vec3(0.12, 0.29, 0.19), vec3(0.03, 0.05, 0.04), bay);
    }
    if (s < 0.275) {  // limestone
      float joint = step(fract(y / 1.1), 0.04) + step(fract(uv.x / 2.2), 0.02);
      return vec3(0.70, 0.66, 0.57) * (0.93 + 0.1 * grain.r) * (1.0 - 0.18 * min(joint, 1.0));
    }
    if (s < 0.425) {  // glass and steel bands
      float band = step(fract(y / 4.5), 0.28);
      float mull = step(fract(uv.x / 2.0), 0.05);
      return mix(mix(vec3(0.22, 0.29, 0.35), vec3(0.6, 0.62, 0.64), mull), vec3(0.64, 0.66, 0.68), band);
    }
    if (s < 0.575) {  // precast concrete with ramp openings
      // long concourse slots between thin piers, like a ballpark's open ramps
      float open = step(0.05, fract(uv.x / 12.0)) * step(0.5, fract(y / 6.5)) * step(fract(y / 6.5), 0.78);
      return mix(vec3(0.6, 0.6, 0.58) * (0.92 + 0.12 * grain.r), vec3(0.1, 0.11, 0.13), open);
    }
    // arena: brick podium, cream band, dark glass ribbon
    if (y < 11.0) return vec3(0.36, 0.15, 0.11) * (0.9 + 0.15 * grain.r);
    if (y < 13.0) return vec3(0.62, 0.58, 0.52);
    float mull = step(fract(uv.x / 2.4), 0.06);
    return mix(vec3(0.16, 0.2, 0.24), vec3(0.55, 0.56, 0.58), mull);
  }
  if (vi == 17) return vec3(0.64, 0.07, 0.06);
  if (vi == 21) return vec3(0.95);                                          // mirror-polished steel
  if (vi == 22) return vec3(0.1, 0.27, 0.31) * (0.85 + 0.3 * grain.b);        // fountain water
  if (vi == 23) return vec3(0.9, 0.9, 0.88);                                 // white steel carrying LEDs
  if (vi == 19) {   // sacred walls: limestone, brick, grey stone, cream brick, with lancet windows
    if (n.y > 0.6) return roofAlb;
    bool stone = s < 0.225 || (s > 0.475 && s < 0.725);
    vec3 c = s < 0.225 ? vec3(0.66, 0.61, 0.51) : s < 0.475 ? vec3(0.44, 0.2, 0.14) : s < 0.725 ? vec3(0.47, 0.47, 0.46) : vec3(0.66, 0.53, 0.34);
    float course = stone ? step(fract(wp.y / 0.62), 0.05) : step(fract(wp.y / 0.26), 0.12);
    c *= (0.9 + 0.18 * grain.r) * (1.0 - 0.12 * course);
    return mix(c, vec3(0.09, 0.1, 0.13), lancet(uv, wp.y));
  }
  if (vi == 20) {   // roofing: slate, verdigris copper, gold leaf, terracotta
    float row = step(fract(uv.y / 0.34), 0.14);
    if (s < 0.225) return vec3(0.25, 0.27, 0.31) * (0.9 + 0.2 * grain.r) * (1.0 - 0.2 * row);
    if (s < 0.475) return mix(vec3(0.24, 0.47, 0.39), vec3(0.32, 0.55, 0.46), grain.g) * (1.0 - 0.1 * row);
    if (s < 0.725) return vec3(0.74, 0.5, 0.12) * (0.9 + 0.2 * grain.r);
    return vec3(0.62, 0.32, 0.2) * (0.9 + 0.2 * grain.r) * (1.0 - 0.15 * row);
  }
  if (vi == 18) {   // ivy on brick
    float leaf = owHash(floor(vec2(uv.x, wp.y) * 3.0));
    return mix(vec3(0.12, 0.30, 0.10), vec3(0.22, 0.42, 0.14), leaf) * (0.85 + 0.3 * grain.g);
  }
  return vec3(0.6);
}
`
const FRAG_MAP = /* glsl */ `
bool isVenue = vFacade > 8.5;                            // 9+ = stadium surfaces
int vi = int(vFacade + 0.5);
bool isParapet = vFacade > 7.5 && !isVenue;              // index 8 = parapet coping
int fi = (isParapet || isVenue) ? 4 : vi;
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
float fwRow = fwidth(vWPos.y / 0.42), fwAisle = fwidth(vMUv.x / 17.0) * 17.0;   // before any branch
vec4 uvGrad = vec4(dFdx(vMUv), dFdy(vMUv));
int si = int(vStyle + 0.5);
si = float(si) < uStyleRows ? si : 0;                   // stale tiles vs palette: unstyled, never garbage
bool styled = si > 0;
vec4 S0 = vec4(0.0), S1 = vec4(0.0), S2 = vec4(0.0), S3 = vec4(0.0), S4 = vec4(0.0);
float S6a = 0.0;
if (styled) {                                            // palette reads only where a look applies (texelFetch needs no derivatives)
  S0 = styleTexel(si, 0); S1 = styleTexel(si, 1); S2 = styleTexel(si, 2); S3 = styleTexel(si, 3); S4 = styleTexel(si, 4);
  S6a = styleTexel(si, 6).a;
}
if (isVenue) { alb = venueAlbedo(vi, vSeed, vMUv, vWPos, vWNormal, gravel, roofAlb, fwRow, fwAisle, uvGrad); win = 0.0; }
alb = mix(vec3(0.62, 0.6, 0.57), alb, uReady);
win *= uReady;
if (!isVenue && !styled) {
  alb *= mix(0.55, 1.0, smoothstep(0.0, 14.0, vWPos.y)); // ground contact
  alb *= 0.88 + 0.24 * vSeed;                            // per-building variation
}
if (fi == 3 && !styled) {                                // curtain glass: bronze-black, green, silver, blue
  float g = fract(vSeed * 3.7);
  vec3 tint = g < 0.28 ? vec3(0.30, 0.28, 0.27) : g < 0.5 ? vec3(0.62, 0.8, 0.74) : g < 0.78 ? vec3(0.86, 0.9, 0.98) : vec3(0.72, 0.8, 0.95);
  alb *= tint;
}
if (styled && !isRoof && !isParapet && !isVenue) {       // sourced colours (V2 · F1–F8)
  vec2 cf = fract(tuv * T.zw);
  float mull = 1.0 - step(0.06, cf.x) * step(cf.x, 0.94);
  float span = step(cf.y, 0.2);
  vec3 body = S4.a > S6a ? mix(S0.rgb, S4.rgb, smoothstep(S6a, S4.a, vWPos.y)) : S0.rgb;
  vec3 lookC = mix(mix(body, S3.rgb, span), S1.rgb, win);
  lookC = mix(lookC, S2.rgb, mull * (1.0 - span) * 0.9);
  float lum = dot(wallAlb, vec3(0.299, 0.587, 0.114));
  alb = lookC * clamp(lum / 0.45, 0.8, 1.2) * mix(0.55, 1.0, smoothstep(0.0, 14.0, vWPos.y));
}
if (styled && isVenue && vi == 16 && !isRoof) {          // hero-owned stadium and museum walls: recolour, keep the pattern
  float lum = dot(alb, vec3(0.299, 0.587, 0.114));
  alb = S0.rgb * clamp(0.55 + 0.9 * lum, 0.5, 1.3);
}
diffuseColor.rgb *= alb;
`
const FRAG_ROUGH = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.06, win * 0.95);
if (styled && !isRoof && !isParapet) roughnessFactor = mix(S1.a, 0.06, win * 0.95);
if (isVenue && vi == 21) roughnessFactor = 0.05;
if (isVenue && vi == 22) roughnessFactor = 0.1;
if (isVenue && vi == 23) roughnessFactor = 0.4;
if (isVenue && vi == 29) roughnessFactor = 0.35;
if (isVenue && vi == 26) roughnessFactor = 0.55;
if (isVenue && vi == 27) roughnessFactor = 0.2;
`
const FRAG_METAL = /* glsl */ `
metalnessFactor = mix(metalnessFactor, 0.9, win * 0.85);
if (styled && !isRoof && !isParapet) metalnessFactor = mix(S2.a, 0.9, win * 0.85);
if (isVenue && vi == 21) metalnessFactor = 1.0;
if (isVenue && vi == 29) metalnessFactor = 0.85;
if (isVenue && vi == 26) metalnessFactor = 0.6;
`
const FRAG_EMISSIVE = /* glsl */ `
if (styled && uNight > 0.001) {                          // crown and façade night lighting (F9)
  vec4 C5 = styleTexel(si, 5), C6 = styleTexel(si, 6);
  float band = step(C6.r, vWPos.y) * step(vWPos.y, C6.g);
  if (C6.b > 0.5 && C6.b < 1.5) totalEmissiveRadiance += diffuseColor.rgb * C5.rgb * C5.a * (0.35 + 0.65 * smoothstep(C6.r, C6.g, vWPos.y)) * band * uNight;
  else if (C6.b > 1.5) totalEmissiveRadiance += C5.rgb * C5.a * band * uNight * uLitBoost;
}
float lv = venueLevel(vWPos.xz);
float lvL = lv < 0.0 ? 1.0 : lv;   // legacy venue light, until the sports clock registers the venue
float lvA = max(lv, 0.0);          // architectural light: registered venues only
if (isVenue && vi == 28) totalEmissiveRadiance += diffuseColor.rgb * (0.55 + 1.3 * uNight) * uLitBoost;
if (isVenue && vi == 27) totalEmissiveRadiance += diffuseColor.rgb * (0.25 + 3.5 * uNight) * uLitBoost;
if (isVenue && uNight > 0.001) {
  if (vi == 14) totalEmissiveRadiance += vec3(1.0, 0.96, 0.88) * 3.2 * uNight * uLitBoost * lvL;
  // under the floodlights: the field and stands glow as if lit for a night game
  if ((vi >= 10 && vi <= 12) || vi == 24) totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.98, 0.92) * 0.85 * uNight * lvL;
  if (vi == 9 || vi == 18) totalEmissiveRadiance += diffuseColor.rgb * 0.35 * uNight * (0.3 + 0.7 * lvL);
  if (vi == 16 && vWNormal.y < 0.6 && lvA > 0.0) {
    float y = vWPos.y;
    if (vSeed >= 0.575) {            // arena fascia (D14): uplit brick podium, cream band, glowing glass ribbon
      float mull = step(fract(vMUv.x / 2.4), 0.06);
      vec3 glow = y < 11.0 ? diffuseColor.rgb * vec3(1.0, 0.82, 0.6) * 1.1 : y < 13.0 ? diffuseColor.rgb * 0.6 : vec3(1.0, 0.86, 0.62) * 0.55 * (1.0 - mull);
      totalEmissiveRadiance += glow * lvA * uNight * uLitBoost;
    } else if (vSeed >= 0.275 && vSeed < 0.425) {   // glass and steel: lit concourse glass (Wintrust, Soldier Field risers)
      float band = step(fract(y / 4.5), 0.28), mull = step(fract(vMUv.x / 2.0), 0.05);
      totalEmissiveRadiance += vec3(1.0, 0.9, 0.72) * 0.45 * (1.0 - band) * (1.0 - mull) * lvA * uNight * uLitBoost;
    } else if (vSeed >= 0.125 && vSeed < 0.275) {   // limestone colonnade uplight (D4), strongest at the base
      totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.9, 0.74) * 0.7 * (1.0 - 0.6 * smoothstep(0.0, 22.0, y)) * lvA * uNight;
    }
  }
  if (vi == 15 && vSeed > 0.5) {
    vec2 c = floor(vMUv / vec2(0.8, 0.6));
    totalEmissiveRadiance += mix(vec3(0.2, 0.45, 1.0), vec3(1.0, 0.8, 0.4), owHash(c)) * (0.25 + 0.5 * owHash(c + 7.0)) * uNight * uLitBoost;
  }
  if (vi == 19 && vWNormal.y < 0.6) {   // stained glass: about two thirds of congregations light up
    float lw = lancet(vMUv, vWPos.y);
    vec2 bay = vec2(floor(vMUv.x / 4.2), floor((vWPos.y - 2.4) / 8.5));
    float on = step(0.34, owHash(floor(vWPos.xz / 60.0)));
    vec3 glass = mix(mix(vec3(0.9, 0.25, 0.2), vec3(0.25, 0.4, 1.0), owHash(bay)), vec3(1.0, 0.75, 0.3), owHash(bay + 3.7) * 0.6);
    totalEmissiveRadiance += glass * lw * on * 0.7 * uNight * uLitBoost;
  }
  if (vi == 20 && vSeed > 0.475 && vSeed < 0.725) totalEmissiveRadiance += vec3(1.0, 0.75, 0.35) * 0.12 * uNight; // floodlit gold domes
  if (vi == 23) {   // the wheel's LEDs: a slow rainbow around the rim
    vec3 hue = clamp(abs(mod(fract(vMUv.x) * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    totalEmissiveRadiance += mix(hue, vec3(1.0), 0.25) * 1.6 * uNight * uLitBoost;
  }
  if (vi == 22) totalEmissiveRadiance += vec3(0.35, 0.6, 1.0) * 0.22 * uNight;   // floodlit fountain
  if (vi == 17) totalEmissiveRadiance += (vec3(1.0, 0.18, 0.12) * 0.5 + vec3(1.0, 0.95, 0.85) * step(0.55, owHash(floor(vMUv * vec2(3.0, 4.0)))) * 0.8) * uNight * uLitBoost;
}
if (!isRoof && !isParapet && !isVenue && uNight > 0.001) {
  vec2 cell = floor(tuv * T.zw);
  vec2 cf = fract(tuv * T.zw);
  // inset rectangle inside each cell: frames/mullions stay dark (matters for all-glass walls)
  float inset = smoothstep(0.03, 0.09, cf.x) * smoothstep(0.03, 0.09, 1.0 - cf.x)
              * smoothstep(0.05, 0.12, cf.y) * smoothstep(0.08, 0.18, 1.0 - cf.y);
  float h = owHash(cell + vec2(vSeed * 173.0, vSeed * 91.0));
  float floorH = owHash(vec2(cell.y, vSeed * 57.0));          // whole office floors light together
  bool isResidential = fi == 6 || (fi == 2 && vWPos.y < 22.0); // three-flats, walk-ups: homes, not offices
  float busy = isResidential ? mix(0.12, 0.38, fract(vSeed * 7.31)) : mix(0.05, 0.5, fract(vSeed * 7.31));
  float lit = step(h * 0.55 + floorH * 0.45, busy * (0.45 + 0.55 * uNight));
  vec3 warm = vec3(1.0, 0.72, 0.45), cool = vec3(0.78, 0.86, 1.0);
  vec3 wc = mix(warm, cool, step(isResidential ? 0.93 : 0.7, owHash(vec2(cell.y, vSeed * 13.0))));
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
  m.customProgramCacheKey = () => 'facade-v10'
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

// Sourced building colours (V2): absent or unreachable styles.json leaves the one-row default — the city renders as before.
export async function loadStylePalette(manifest) {
  if (!manifest?.styles) return false
  try {
    const r = await fetch(worldUrl(manifest.styles, manifest.version))
    if (!r.ok) { console.warn(`styles.json HTTP ${r.status} — default colours`); return false }
    const j = await r.json()
    facadeUniforms.uStylePal.value = createStyleTexture(j.styles)
    facadeUniforms.uStyleRows.value = j.styles.length
    return true
  } catch (e) {
    console.warn('styles.json unavailable — default colours', e)
    return false
  }
}
