// app/src/landmarks/CentennialArc.jsx — the Centennial Fountain's water cannon (A-11): an 80 ft (24.4 m) arc shot
// toward the far bank for five minutes at the top of each hour in season (riverSchedules.js). One Points draw while
// it runs, nothing between shows.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { centennialArc } from './riverSchedules.js'

const N = 1400
const VERT = /* glsl */ `
uniform float uTime; uniform float uLevel; uniform vec3 uAt; uniform vec2 uDir; uniform vec2 uArc; uniform float uPx;
attribute float aSeed; varying float vA;
void main() {
  float ph = fract(aSeed + uTime / 2.2), s = ph * uArc.x * uLevel;
  // a parabola from the nozzle: rise uArc.y at mid-reach, falling back to the river at the far end
  float u = s / max(uArc.x, 0.001), y = uAt.y + 4.0 * uArc.y * uLevel * u * (1.0 - u);
  vec2 jit = (fract(sin(vec2(aSeed * 91.7, aSeed * 47.3)) * 43758.5453) - 0.5) * (0.25 + 0.9 * u);
  vec3 pos = vec3(uAt.x + uDir.x * s + jit.x, y + jit.y * 0.6, uAt.z + uDir.y * s + jit.y);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp(0.4 * uPx / -mv.z, 1.0, 9.0);
  vA = uLevel * (1.0 - smoothstep(0.85, 1.0, ph)) * 0.55;
  gl_Position = projectionMatrix * mv;
}`
const FRAG = /* glsl */ `
uniform float uNight; varying float vA;
void main() { float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)) * vA; gl_FragColor = vec4(vec3(0.86, 0.93, 1.0) * (0.6 + 0.5 * (1.0 - uNight)), a); }`

export default function CentennialArc({ spec }) {
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry(), seed = new Float32Array(N)
    for (let i = 0; i < N; i++) seed[i] = (i * 0.6180339887) % 1
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uPx: { value: 800 }, uNight: facadeUniforms.uNight, uAt: { value: new THREE.Vector3(spec.at[0], spec.y, spec.at[1]) }, uDir: { value: new THREE.Vector2(spec.dir[0], spec.dir[1]) }, uArc: { value: new THREE.Vector2(spec.reachM, spec.riseM) } },
    })
    return { geo, mat }
  }, [spec])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  const ref = useRef(), acc = useRef(1), on = useRef(false)
  useFrame(({ clock, size, camera }, dt) => {
    acc.current += dt
    if (acc.current >= 1) { acc.current = 0; on.current = centennialArc(new Date()).on }
    const L = mat.uniforms.uLevel
    L.value += ((on.current ? 1 : 0) - L.value) * Math.min(1, dt * 0.6) // the jet builds up and dies away over a few seconds
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uPx.value = size.height / (2 * Math.tan(((camera.fov ?? 50) * Math.PI) / 360))
    if (ref.current) ref.current.visible = L.value > 0.01
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} visible={false} />
}
