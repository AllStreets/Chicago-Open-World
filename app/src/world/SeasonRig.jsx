// app/src/world/SeasonRig.jsx — the SNOW view's winter (user fixes 2026-09-29): snow falling around the camera (one
// Points draw; fewer flakes on LOW), snow settling on roofs, parks and the land, the lake frozen from the shore out.
// It follows the eased atmosphere, so switching views fades the winter in and out.
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { atmosphereNow } from './SkyRig.jsx'
import { facadeUniforms } from './materials/facadeMaterial.js'
import { groundUniforms } from './materials/groundShader.js'
import { waterUniforms } from './materials/waterSurface.js'
import { useGroundMaterials } from './materials/useGroundMaterials.js'

export const SNOW_FLAKES = { LOW: 8000, HIGH: 26000, ULTRA: 36000 }
const BOX = [520, 300, 520] // the volume of falling snow that travels with the camera

const vert = /* glsl */ `
attribute vec3 aSeed;
uniform vec3 uCam; uniform float uTime; uniform vec3 uBox; uniform float uAmount; uniform float uPx; uniform vec2 uWind;
varying float vA;
void main() {
  // each flake falls ~1.1 m/s with a slow sideways drift, wrapping inside a box centred on the camera
  vec3 p = aSeed * uBox;
  p.y -= uTime * (0.9 + 0.5 * aSeed.x);
  p.x += sin(uTime * 0.6 + aSeed.z * 40.0) * 2.5 + uTime * uWind.x; // P5: the live wind carries the snow
  p.z += cos(uTime * 0.5 + aSeed.x * 40.0) * 2.0 + uTime * uWind.y;
  p = mod(p - uCam + 0.5 * uBox, uBox) - 0.5 * uBox + uCam;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  gl_PointSize = clamp(uPx * 420.0 / d, 1.5, 9.0);
  vA = uAmount * smoothstep(8.0, 30.0, d) * (1.0 - smoothstep(300.0, 450.0, d)); // not in your face, fading into the haze
  gl_Position = projectionMatrix * mv;
}`
const frag = /* glsl */ `
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, r) * vA * 0.85;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a);
}`

export default function SeasonRig() {
  const quality = useStore((s) => s.quality)
  const mats = useGroundMaterials()
  const n = SNOW_FLAKES[quality] ?? SNOW_FLAKES.HIGH
  const points = useMemo(() => {
    const seed = new Float32Array(n * 3)
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)) // unused: the shader places each flake
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    const m = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...BOX) }, uAmount: { value: 0 }, uPx: { value: 1 }, uWind: { value: new THREE.Vector2(0.7, 0) } } })
    const p = new THREE.Points(g, m)
    p.frustumCulled = false
    p.renderOrder = 6
    return p
  }, [n])
  useEffect(() => () => { points.geometry.dispose(); points.material.dispose() }, [points])
  const landBase = useMemo(() => (mats?.land ? mats.land.color.clone() : null), [mats])
  const snowCol = useMemo(() => new THREE.Color('#dfe4ec'), [])
  useFrame(({ camera, clock, gl }) => {
    const A = atmosphereNow
    facadeUniforms.uSnow.value = A.snow
    groundUniforms.uSnow.value = A.snow
    waterUniforms.uIce.value = A.ice
    if (landBase && mats?.land) mats.land.color.copy(landBase).lerp(snowCol, A.snow * 0.85)
    points.visible = A.snow > 0.02
    if (!points.visible) return
    const u = points.material.uniforms
    u.uCam.value.copy(camera.position); u.uTime.value = clock.elapsedTime; u.uAmount.value = A.snow; u.uPx.value = gl.getPixelRatio(); u.uWind.value.set(A.wind[0], A.wind[1])
  })
  return <primitive object={points} />
}
