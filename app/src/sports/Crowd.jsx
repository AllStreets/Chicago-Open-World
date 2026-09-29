// app/src/sports/Crowd.jsx — one instanced draw call: camera-facing fan impostors with W flags when waving.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec4 aAnchor;
attribute vec3 aShirt;
attribute float aFlag;
attribute float aIdx;
attribute float aPart;
uniform float uTime, uWave, uCheer, uSplit, uSeats, uFans;
varying vec2 vUv; varying vec3 vShirt; varying float vPart, vSkin;
void main() {
  bool shown = aIdx < uSplit ? aIdx < uSeats : aIdx - uSplit < uFans;
  if (!shown || (aPart > 0.5 && aFlag * uWave < 0.5)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vUv = uv; vShirt = aShirt; vPart = aPart;
  float ph = fract(sin(dot(aAnchor.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vSkin = ph;
  vec3 toCam = cameraPosition - aAnchor.xyz; toCam.y = 0.0;
  vec3 right = normalize(vec3(-toCam.z, 0.0, toCam.x) + vec3(1e-5));
  float bob = 0.03 * sin(uTime * (1.1 + ph) + ph * 40.0) + uCheer * 0.35 * step(0.4, ph);
  vec3 p = position;
  if (aPart > 0.5) p.x += 0.12 * sin(uTime * 5.0 + ph * 30.0) * (p.y - 1.3);
  vec3 world = aAnchor.xyz + right * p.x + vec3(0.0, p.y + bob, 0.0);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uNight, uLevel;
varying vec2 vUv; varying vec3 vShirt; varying float vPart, vSkin;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec3 c;
  if (vPart > 0.5) {                       // the W flag: Cubs blue W on white, stick on the left
    if (vUv.x < 0.06) c = vec3(0.35, 0.3, 0.25);
    else {
      vec2 q = vec2((vUv.x - 0.06) / 0.94, vUv.y);
      float w = min(min(seg(q, vec2(0.12, 0.85), vec2(0.3, 0.15)), seg(q, vec2(0.3, 0.15), vec2(0.5, 0.62))), min(seg(q, vec2(0.5, 0.62), vec2(0.7, 0.15)), seg(q, vec2(0.7, 0.15), vec2(0.88, 0.85))));
      c = mix(vec3(0.0048, 0.034, 0.24), vec3(0.9), step(0.075, w));
    }
  } else {                                 // a seated fan: head and shoulders (quad is 0.56 × 1.2 m)
    vec2 m = vec2((vUv.x - 0.5) * 0.56, vUv.y * 1.2);
    bool head = length(m - vec2(0.0, 1.03)) < 0.11;
    bool body = m.y < 0.92 && abs(m.x) < 0.23 - 0.05 * (m.y / 0.92);
    if (!head && !body) discard;
    c = head ? mix(vec3(0.1, 0.04, 0.02), vec3(0.83, 0.53, 0.35), vSkin) : vShirt;
  }
  c *= mix(0.95, 0.18 + 0.8 * uLevel, uNight);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

function baseGeometry(standing) {
  const pos = [], uv = [], part = []
  const quad = (x0, y0, x1, y1, p) => { pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); for (let i = 0; i < 6; i++) part.push(p) }
  const lift = standing ? 0.55 : 0
  quad(-0.28, lift, 0.28, lift + 1.2, 0)
  quad(0.18, lift + 1.35, 0.93, lift + 1.85, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1))
  return g
}

export default function Crowd({ anchors, split, seatCount, fanCount = 0, shirts, flags, wave = 0, cheer = 0, level = 1, standing = false, center, radius }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uWave: { value: 0 }, uCheer: { value: 0 }, uNight: { value: 0 }, uLevel: { value: 1 }, uSplit: { value: 0 }, uSeats: { value: 0 }, uFans: { value: 0 } }]),
  }), [])
  const geo = useMemo(() => {
    const n = anchors.length / 4, g = baseGeometry(standing)
    const sh = new Float32Array(n * 3), idx = new Float32Array(n), col = new THREE.Color()
    for (let i = 0; i < n; i++) { col.set(shirts[i % shirts.length]); sh[i * 3] = col.r; sh[i * 3 + 1] = col.g; sh[i * 3 + 2] = col.b; idx[i] = i }
    g.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(anchors, 4))
    g.setAttribute('aShirt', new THREE.InstancedBufferAttribute(sh, 3))
    g.setAttribute('aFlag', new THREE.InstancedBufferAttribute(flags.length === n ? flags : new Float32Array(n), 1))
    g.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1))
    g.instanceCount = n
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(center[0], 20, center[1]), radius)
    return g
  }, [anchors, shirts, flags, standing, center, radius])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((st) => {
    const u = mat.uniforms
    u.uTime.value = st.clock.elapsedTime; u.uWave.value = wave; u.uCheer.value = cheer; u.uLevel.value = level
    u.uNight.value = facadeUniforms.uNight.value; u.uSplit.value = split; u.uSeats.value = seatCount; u.uFans.value = fanCount
  })
  return <mesh geometry={geo} material={mat} visible={seatCount + fanCount > 0} castShadow={false} receiveShadow={false} />
}
