// app/src/bridges/BridgeLights.jsx — every bridge lamp and nav light as one additive Points draw.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { liveLift } from './BridgeLeaves.jsx'
import { lightColour, lightPosition } from './lights.js'

export default function BridgeLights({ sidecar }) {
  const { geo, mat } = useMemo(() => {
    const n = sidecar.lights.length, geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uNight: facadeUniforms.uNight },
      vertexShader: 'attribute vec3 aColor; varying vec3 vC; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(1400.0 / -mv.z, 3.5, 16.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uNight; varying vec3 vC; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vC * a * uNight * 2.0, a * uNight); }',
    })
    return { geo, mat }
  }, [sidecar])
  const last = useRef(null)
  useFrame(() => {
    if (last.current === liveLift.angles) return
    last.current = liveLift.angles
    const pos = geo.attributes.position.array, col = geo.attributes.aColor.array
    sidecar.lights.forEach((L, i) => {
      const a = L.leaf != null ? liveLift.angles[sidecar.leaves[L.leaf].bridge] ?? 0 : 0
      pos.set(lightPosition(L, sidecar.leaves, liveLift.angles), i * 3); col.set(lightColour(L.kind, a), i * 3)
    })
    geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true
    geo.computeBoundingSphere()
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
