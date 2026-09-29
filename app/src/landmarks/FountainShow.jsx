// app/src/landmarks/FountainShow.jsx — Buckingham's jets (and the Crown Fountain spouts) as one GPU Points draw.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { fountainShow } from './fountainSchedule.js'
import { buildParticles, KIND } from './jets.js'

const VERT = /* glsl */ `
uniform float uTime; uniform vec4 uP[64]; uniform vec4 uD[64]; uniform float uFloor[64]; uniform vec4 uLevels; uniform vec2 uCrown; uniform float uPx;
attribute float aEmitter; attribute float aSeed; varying float vA;
const float G = 9.81;
void main() {
  int i = int(aEmitter + 0.5); vec4 P = uP[i], D = uD[i]; int kind = int(D.w + 0.5);
  float level = kind == 0 ? uLevels.x : kind == 1 ? uLevels.y : kind == 2 ? uLevels.z : kind == 3 ? uLevels.w : (kind == 4 ? uCrown.x : uCrown.y);
  float h = P.w * level;
  if (h < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float spread = kind == 0 ? 0.06 : 0.08;
  // lateral jitter from a real hash: fract(seed·k) tracks the phase, so the offsets swept into a zig-zag line
  vec2 jit = fract(sin(vec2(aSeed * 127.1, aSeed * 311.7)) * 43758.5453) - 0.5;
  vec3 d = normalize(vec3(D.x + jit.x * spread, D.y, D.z + jit.y * spread));
  float v = sqrt(2.0 * G * h), vy = v * D.y;
  float T = (vy + sqrt(vy * vy + 2.0 * G * max(0.0, P.y - uFloor[i]))) / G;
  float ph = fract(aSeed + uTime / T), tau = ph * T;
  vec3 pos = P.xyz + d * v * tau - vec3(0.0, 0.5 * G * tau * tau, 0.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp(0.35 * uPx / -mv.z, 1.0, 10.0);
  vA = (1.0 - smoothstep(0.85, 1.0, ph)) * 0.5;
  gl_Position = projectionMatrix * mv;
}`
const FRAG = /* glsl */ `
uniform vec3 uColour; uniform float uColourMix; uniform float uNight; varying float vA;
void main() {
  float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)) * vA;
  vec3 water = vec3(0.85, 0.92, 1.0) * (0.55 + 0.45 * (1.0 - uNight));
  gl_FragColor = vec4(mix(water, uColour * (1.0 + uNight), uColourMix), a);
}`
const kindCode = (e) => (e.kind === 'crown' ? KIND.crown + (e.tower ?? 0) : KIND[e.kind])

export default function FountainShow({ emitters, crownLevels = null }) {
  const quality = useStore((s) => s.quality)
  const { geo, mat } = useMemo(() => {
    const b = buildParticles(emitters), geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.emitter.length * 3), 3))
    geo.setAttribute('aEmitter', new THREE.BufferAttribute(b.emitter, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(b.seed, 1))
    const pad = (arr, f) => Array.from({ length: 64 }, (_, i) => (emitters[i] ? f(emitters[i]) : arr))
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 }, uPx: { value: 800 }, uNight: facadeUniforms.uNight,
        uP: { value: pad(new THREE.Vector4(), (e) => new THREE.Vector4(e.p[0], e.p[1], e.p[2], e.h)) },
        uD: { value: pad(new THREE.Vector4(), (e) => new THREE.Vector4(e.dir[0], e.dir[1], e.dir[2], kindCode(e))) },
        uFloor: { value: pad(0, (e) => e.floor) },
        uLevels: { value: new THREE.Vector4() }, uCrown: { value: new THREE.Vector2() },
        uColour: { value: new THREE.Color(1, 1, 1) }, uColourMix: { value: 0 },
      },
    })
    return { geo, mat }
  }, [emitters])
  const cone = useRef(), centre = emitters.find((e) => e.kind === 'centre'), acc = useRef(1)
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat]) // a new emitter set frees the old buffers
  const coneGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.9, 1, 12, 1, true).translate(0, 0.5, 0), [])
  useEffect(() => () => coneGeo.dispose(), [coneGeo])
  useFrame(({ clock, size, camera }, dt) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uPx.value = size.height / (2 * Math.tan(((camera.fov ?? 50) * Math.PI) / 360))
    acc.current += dt
    if (acc.current < 0.5) return
    acc.current = 0
    const s = fountainShow(new Date(), { dark: facadeUniforms.uNight.value > 0.35, previewStart: useStore.getState().fountainPreview })
    const L = s.levels
    mat.uniforms.uLevels.value.set(L.centre, L.seahorse, L.ring, L.lower)
    if (crownLevels) mat.uniforms.uCrown.value.set(crownLevels.current[0], crownLevels.current[1])
    mat.uniforms.uColourMix.value = s.colour ? 0.75 : 0
    if (s.colour) mat.uniforms.uColour.value.setRGB(...s.colour)
    if (cone.current && centre) { cone.current.visible = L.centre > 0; cone.current.scale.set(1, Math.max(0.01, centre.h * L.centre), 1) }
  })
  if (quality === 'LOW') return centre ? (
    <mesh ref={cone} geometry={coneGeo} position={[centre.p[0], centre.p[1], centre.p[2]]}>
      <meshStandardMaterial color="#dfeaf2" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  ) : null
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
