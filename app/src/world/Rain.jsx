// app/src/world/Rain.jsx — rain (P5 · I-5.3): thin streaks falling around the camera and slanting with the live wind,
// one LineSegments draw beside SeasonRig's snow. It follows the eased atmosphere (atmosphereNow.rain), so weather
// changes fade it in and out; reduced motion slows the fall.
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { atmosphereNow } from './SkyRig.jsx'

export const RAIN_STREAKS = { LOW: 1500, HIGH: 6000, ULTRA: 9000 }
const BOX = [180, 120, 180]
const FALL_MPS = 9, STREAK_S = 0.07

const vert = /* glsl */ `
attribute vec4 aSeed; // xyz: place in the box, w: 0 = the streak's top, 1 = its foot
uniform vec3 uCam; uniform float uTime; uniform vec3 uBox; uniform float uAmount; uniform vec2 uWind; uniform float uFall;
varying float vA;
void main() {
  vec3 vel = vec3(uWind.x, -uFall * (0.85 + 0.3 * aSeed.y), uWind.y);
  vec3 p = aSeed.xyz * uBox + vel * uTime;
  p = mod(p - uCam + 0.5 * uBox, uBox) - 0.5 * uBox + uCam;
  p += vel * ${STREAK_S} * aSeed.w; // the foot trails the top along the fall
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  float keep = step(fract(aSeed.x * 91.7 + aSeed.z * 37.3), uAmount); // fewer streaks in a drizzle
  vA = keep * smoothstep(2.0, 8.0, d) * (1.0 - smoothstep(60.0, 90.0, d));
  gl_Position = projectionMatrix * mv;
}`
const frag = /* glsl */ `
varying float vA;
void main() {
  if (vA < 0.01) discard;
  gl_FragColor = vec4(vec3(0.78, 0.82, 0.88), 0.32 * vA);
}`

export default function Rain() {
  const quality = useStore((s) => s.quality)
  const n = RAIN_STREAKS[quality] ?? RAIN_STREAKS.HIGH
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])
  const lines = useMemo(() => {
    const seed = new Float32Array(n * 8)
    for (let i = 0; i < n; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random()
      seed.set([x, y, z, 0, x, y, z, 1], i * 8)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)) // unused: the shader places each streak
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
    const m = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...BOX) }, uAmount: { value: 0 }, uWind: { value: new THREE.Vector2() }, uFall: { value: FALL_MPS } } })
    const l = new THREE.LineSegments(g, m)
    l.frustumCulled = false
    l.renderOrder = 6
    l.visible = false
    return l
  }, [n])
  useEffect(() => () => { lines.geometry.dispose(); lines.material.dispose() }, [lines])
  useFrame(({ camera, clock }) => {
    const A = atmosphereNow
    lines.visible = A.rain > 0.02
    if (!lines.visible) return
    const u = lines.material.uniforms
    u.uCam.value.copy(camera.position); u.uTime.value = clock.elapsedTime; u.uAmount.value = A.rain
    u.uWind.value.set(A.wind[0], A.wind[1]); u.uFall.value = reduced ? FALL_MPS * 0.4 : FALL_MPS
  })
  return <primitive object={lines} />
}
