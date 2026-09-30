// app/src/world/materials/waterSurface.js — the one water material (B.2): Lake Michigan, the river, harbours
// and lagoons. One shared planar reflection, a per-vertex calm factor, a baked shoreline, a horizon fade.
import * as THREE from 'three'
import { worldUrl } from '../../lib/manifest.js'

export const REFLECT_LAYER = 2 // what the mirrored camera renders: buildings, the elevated L, sky, stars, lights
export const WATER_PLANE_Y = 0.03 // mirror plane between the lake (0.02) and polygon water (0.04)

const px = (r, g, b) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1); t.needsUpdate = true; return t }

export const waterUniforms = {
  uTime: { value: 0 },
  uSize: { value: 2.5 },
  uNormals: { value: px(128, 128, 255) },
  uReflection: { value: px(0, 0, 0) },
  uReflect: { value: 0 },
  uTextureMatrix: { value: new THREE.Matrix4() },
  uShore: { value: px(255, 255, 255) },
  uShoreOn: { value: 0 },
  uShoreRect: { value: new THREE.Vector4(0, 0, 1, 1) },
  uDeep: { value: new THREE.Color('#22586f') },
  uShallow: { value: new THREE.Color('#2f6c77') },
  uFoam: { value: new THREE.Color('#dfe8e6') },
  uHorizon: { value: new THREE.Color('#c3d6e8') },
  uSky: { value: new THREE.Color('#cfe1f5') },
  uGreenColor: { value: new THREE.Color('#1f9e5a') },
  uGreen: { value: 0 },
  uNight: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color('#ffffff') },
  uFar: { value: new THREE.Vector2(2600, 17000) },
  uFlash: { value: new THREE.Vector4(0, 0, 0, 0) }, // the fireworks' light on the lake (rgb + intensity)
  uFlashAt: { value: new THREE.Vector3(0, 0, 0) },
  uIce: { value: 0 }, // user fixes: the SNOW view freezes the lake from the shore out, and the river in floes
}

export const WATER_VERTEX = /* glsl */ `
attribute float _calm;
uniform mat4 uTextureMatrix;
varying vec3 vWorld;
varying vec4 vReflUv;
varying float vCalm;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vCalm = _calm;
  vReflUv = uTextureMatrix * world;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const WATER_FRAGMENT = /* glsl */ `
uniform sampler2D uNormals;
uniform sampler2D uReflection;
uniform sampler2D uShore;
uniform float uTime;
uniform float uSize;
uniform float uReflect;
uniform float uShoreOn;
uniform float uGreen;
uniform float uNight;
uniform vec4 uShoreRect;
uniform vec2 uFar;
uniform float uIce;
uniform vec4 uFlash;
uniform vec3 uFlashAt;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uHorizon;
uniform vec3 uSky;
uniform vec3 uGreenColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vWorld;
varying vec4 vReflUv;
varying float vCalm;

vec3 waveNormal(vec2 p, float calm) {
  float t = uTime * mix(0.3, 1.0, calm);
  vec2 uv0 = p / 103.0 + vec2(t / 17.0, t / 29.0);
  vec2 uv1 = p / 107.0 - vec2(t / -19.0, t / 31.0);
  vec2 uv2 = p / vec2(8907.0, 9803.0) + vec2(t / 101.0, t / 97.0);
  vec2 uv3 = p / vec2(1091.0, 1027.0) - vec2(t / 109.0, t / -113.0);
  vec4 noise = texture2D(uNormals, uv0) + texture2D(uNormals, uv1) + texture2D(uNormals, uv2) + texture2D(uNormals, uv3);
  vec3 n = (noise * 0.5 - 1.0).xzy;
  float amp = 1.5 * mix(0.2, 1.0, calm);
  return normalize(n * vec3(amp, 1.0, amp));
}

void main() {
  float calm = clamp(vCalm, 0.0, 1.0);
  float isRiver = 1.0 - step(0.05, abs(vCalm - 0.6));
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  vec3 N = waveNormal(vWorld.xz * uSize, calm);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec2 ruv = vReflUv.xy / vReflUv.w + N.xz * (0.03 * calm + 0.005);
  vec3 refl = mix(uSky, texture2D(uReflection, ruv).rgb, uReflect);
  vec2 suv = (vWorld.xz - uShoreRect.xy) * uShoreRect.zw;
  float inBand = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0) * uShoreOn;
  float shoreD = mix(1.0, texture2D(uShore, clamp(suv, 0.0, 1.0)).r, inBand);
  shoreD = mix(shoreD, 1.0, isRiver);
  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.35, shoreD));
  body = mix(body, uGreenColor, uGreen * isRiver);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 180.0) * (1.0 - uNight) * step(0.0, uSunDir.y);
  vec3 col = mix(body, refl, fres) + uSunColor * spec * 1.2;
  float foam = (1.0 - smoothstep(0.0, 0.04, shoreD)) * (0.35 + 0.35 * calm) * inBand;
  col = mix(col, uFoam, foam);
  // ice: pale blue-white plates with dark cracks, reaching ~2 km out from the lakeshore; the river in broken floes
  if (uIce > 0.001) {
    vec4 nz = texture2D(uNormals, vWorld.xz / 380.0) + texture2D(uNormals, vWorld.xz / 97.0 + 0.37);
    float crack = smoothstep(0.035, 0.0, abs(nz.x - nz.z));
    float plate = 0.5 + 0.5 * nz.y - 0.5;
    vec3 ice = mix(vec3(0.78, 0.85, 0.92), vec3(0.9, 0.93, 0.97), plate) * (1.0 - 0.35 * crack);
    ice *= mix(vec3(1.0), vec3(0.16, 0.18, 0.24), uNight); // ice is lit, not glowing: it darkens with the sky
    float reach = mix(1.0 - smoothstep(0.55, 0.95, shoreD), step(0.45, nz.y * 0.5 + 0.25 + 0.2 * nz.w), isRiver);
    col = mix(col, ice, uIce * reach);
  }
  // fireworks: the bursts shimmer on the water below them, strongest at a grazing view (fresnel)
  if (uFlash.w > 0.001) { float fd = length(uFlashAt.xz - vWorld.xz); col += uFlash.rgb * uFlash.w * (0.02 + 0.14 * fres) * (320.0 * 320.0) / (fd * fd + 320.0 * 320.0); }
  col = mix(col, uHorizon, smoothstep(uFar.x, uFar.y, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createWaterMaterial() {
  return new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, fog: false, lights: false })
}

export const waterMaterial = createWaterMaterial()

const loader = new THREE.TextureLoader()
let normalsRequested = false
export function loadWaterTextures(shore, version) {
  if (!normalsRequested) {
    normalsRequested = true
    loader.load('/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; waterUniforms.uNormals.value = t })
  }
  if (!shore) { waterUniforms.uShoreOn.value = 0; return }
  loader.load(worldUrl(shore.file, version), (t) => {
    t.flipY = false // image row 0 is the north edge (minZ)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    t.needsUpdate = true
    waterUniforms.uShore.value = t
    waterUniforms.uShoreRect.value.set(shore.minX, shore.minZ, 1 / (shore.width * shore.cell), 1 / (shore.height * shore.cell))
    waterUniforms.uShoreOn.value = 1
  })
}
