// app/src/bridges/BridgeLights.jsx — every bridge lamp, nav light and gate flasher as one additive Points draw.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { liveLift } from './BridgeLeaves.jsx'
import { lightColour, lightPosition } from './lights.js'
import { gatePoints, gateActive } from '../landmarks/showClock.js'
import { gateFlash } from '../audio/score.js'

const GATE_RED = [1.0, 0.1, 0.06]

export default function BridgeLights({ sidecar }) {
  const gates = useMemo(() => sidecar.bridges.map((b) => gatePoints(b)), [sidecar])
  const { geo, mat } = useMemo(() => {
    const n = sidecar.lights.length + gates.length * 4, geo = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    gates.forEach((g, i) => g.forEach((p, k) => pos.set(p, (sidecar.lights.length + i * 4 + k) * 3)))
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    // gate flashers read in daylight too (uGate lifts their alpha); lanterns and nav lights stay night-only
    geo.setAttribute('aDay', new THREE.BufferAttribute(Float32Array.from({ length: n }, (_, i) => (i >= sidecar.lights.length ? 1 : 0)), 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uNight: facadeUniforms.uNight },
      vertexShader: 'attribute vec3 aColor; attribute float aDay; varying vec3 vC; varying float vDay; void main(){ vC = aColor; vDay = aDay; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(1400.0 / -mv.z, 3.5, 16.0) * (1.0 + aDay * 0.4); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uNight; varying vec3 vC; varying float vDay; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); float k = max(uNight, vDay * 0.85); gl_FragColor = vec4(vC * a * k * 2.0, a * k); }',
    })
    return { geo, mat }
  }, [sidecar, gates])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  const last = useRef(null)
  useFrame(({ clock }) => {
    const col = geo.attributes.aColor.array
    if (last.current !== liveLift.angles) {
      last.current = liveLift.angles
      const pos = geo.attributes.position.array
      sidecar.lights.forEach((L, i) => {
        const a = L.leaf != null ? liveLift.angles[sidecar.leaves[L.leaf].bridge] ?? 0 : 0
        pos.set(lightPosition(L, sidecar.leaves, liveLift.angles), i * 3); col.set(lightColour(L.kind, a), i * 3)
      })
      geo.attributes.position.needsUpdate = true
      geo.computeBoundingSphere()
    }
    // the gates flash, alternating, while a lift is under way at that bridge (and for 8 s before its leaves move)
    const order = liveLift.order ?? [], el = liveLift.elapsed
    sidecar.bridges.forEach((b, i) => {
      const idx = order.indexOf(b.key), angle = liveLift.angles[b.key] ?? 0
      const active = idx >= 0 && el != null && gateActive(idx, el, angle, liveLift.T ?? undefined)
      const [l, r] = gateFlash(angle, active || angle > 0.001, clock.elapsedTime)
      const base = (sidecar.lights.length + i * 4) * 3
      for (let k = 0; k < 4; k++) { const on = k % 2 ? r : l; col.set(on ? GATE_RED : [0, 0, 0], base + k * 3) }
    })
    geo.attributes.aColor.needsUpdate = true
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
