// app/src/landmarks/ArtOnTheMart.jsx — Art on theMART (A-5): the projection on the Merchandise Mart's river façade,
// 556 × 165 ft, on its sourced schedule (riverSchedules.js). One quad just proud of the wall, drawn only while a
// program runs after dark; the art is procedural (slow colour fields and drifting forms, never a real artwork),
// cross-fading between scenes, and broken by the façade's piers and windows so it reads as light on stone.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { artOnTheMart } from './riverSchedules.js'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FRAG = /* glsl */ `
uniform float uTime; uniform float uFade; uniform float uProgram; uniform vec2 uSize; varying vec2 vUv;
vec3 pal(float t, vec3 a, vec3 b) { return 0.5 + 0.5 * cos(6.2832 * (a * t + b)); }
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
vec3 scene(float k, vec2 p, float t) {
  if (k < 0.5) { float v = n(p * vec2(3.0, 1.2) + vec2(t * 0.05, 0.0)) + 0.5 * n(p * 7.0 - t * 0.04); return pal(v + t * 0.01, vec3(1.0), vec3(0.0, 0.33, 0.67)); }
  if (k < 1.5) { float r = length((p - vec2(0.5 + 0.3 * sin(t * 0.07), 0.5)) * vec2(3.4, 1.0)); return pal(r * 1.5 - t * 0.05, vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2)) * (0.6 + 0.4 * n(p * 5.0 + t * 0.03)); }
  if (k < 2.5) { float s = step(0.5, fract(p.x * 9.0 + 0.6 * sin(p.y * 4.0 + t * 0.2))); return mix(vec3(0.05, 0.15, 0.55), vec3(0.95, 0.75, 0.25), s * (0.5 + 0.5 * n(p * 3.0 + t * 0.05))); }
  float w = sin(p.x * 14.0 + t * 0.4) * 0.5 + 0.5; return pal(w * 0.4 + p.y * 0.6 + t * 0.02, vec3(0.8, 1.0, 1.2), vec3(0.6, 0.2, 0.3));
}
void main() {
  float t = uTime, k = mod(uProgram + floor(t / 45.0), 4.0), f = smoothstep(37.0, 45.0, mod(t, 45.0));
  vec3 c = mix(scene(k, vUv, t), scene(mod(k + 1.0, 4.0), vUv, t), f);
  // the façade breaks the light: piers every 6.1 m stay brighter (stone), windows darker (glass swallows the light)
  vec2 m = vUv * uSize;
  float pier = smoothstep(0.16, 0.22, fract(m.x / 6.1)) * smoothstep(0.98, 0.92, fract(m.x / 6.1));
  float win = pier * smoothstep(0.28, 0.36, fract(m.y / 4.33)) * smoothstep(0.98, 0.9, fract(m.y / 4.33));
  c *= mix(1.0, 0.72, win);
  float edge = smoothstep(0.0, 0.02, vUv.x) * smoothstep(0.0, 0.02, 1.0 - vUv.x) * smoothstep(0.0, 0.04, vUv.y) * smoothstep(0.0, 0.04, 1.0 - vUv.y);
  gl_FragColor = vec4(c * 1.15, 0.85 * edge * uFade);
}`

export default function ArtOnTheMart({ spec }) {
  const { geo, mat, pos, quat } = useMemo(() => {
    const w = spec.halfW * 2, hgt = spec.y1 - spec.y0
    const geo = new THREE.PlaneGeometry(w, hgt)
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uProgram: { value: 0 }, uSize: { value: new THREE.Vector2(w, hgt) } } })
    // the plane faces the river: +Z of the plane along the façade's outward normal (x, z)
    const n = new THREE.Vector3(spec.n[0], 0, spec.n[1]).normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
    const pos = [spec.c[0] + spec.n[0] * 1.4, (spec.y0 + spec.y1) / 2, spec.c[1] + spec.n[1] * 1.4]
    return { geo, mat, pos, quat }
  }, [spec])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  const ref = useRef(), acc = useRef(1), state = useRef({ on: false })
  useFrame(({ clock }, dt) => {
    acc.current += dt
    if (acc.current >= 1) { acc.current = 0; state.current = artOnTheMart(new Date()) }
    const night = facadeUniforms.uNight.value, s = state.current
    const target = s.on && night > 0.35 ? 1 : 0
    mat.uniforms.uFade.value += (target - mat.uniforms.uFade.value) * Math.min(1, dt * 0.8)
    mat.uniforms.uTime.value = s.on ? s.minute * 60 + (clock.elapsedTime % 1) : clock.elapsedTime
    mat.uniforms.uProgram.value = s.program ?? 0
    if (ref.current) ref.current.visible = mat.uniforms.uFade.value > 0.01
  })
  return <mesh ref={ref} geometry={geo} material={mat} position={pos} quaternion={quat} visible={false} renderOrder={2} />
}
