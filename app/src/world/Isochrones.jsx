// app/src/world/Isochrones.jsx — the WORK lens's reach map (P4 · I-4.4): one ground quad sampling a texture of commute
// minutes to the office; shells at 15, 30 and 45 min, cyan → amber → red, with a gentle outward pulse (static on LOW).
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { officeModel, ISO_BOUNDS } from './workState.js'

const B = ISO_BOUNDS
export default function Isochrones() {
  const on = useStore((s) => s.lens === 'WORK'), office = useStore((s) => s.office), transit = useStore((s) => s.transit), hoods = useStore((s) => s.hoods), quality = useStore((s) => s.quality)
  const model = on ? officeModel(office, transit, hoods) : null
  const tex = useMemo(() => {
    if (!model) return null
    const { cols, rows, minutes } = model.grid, data = new Float32Array(cols * rows * 4)
    for (let i = 0; i < minutes.length; i++) data[i * 4] = minutes[i]
    const t = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat, THREE.FloatType)
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true
    return t
  }, [model])
  const mesh = useMemo(() => {
    const g = new THREE.PlaneGeometry(B.maxX - B.minX, B.maxZ - B.minZ).rotateX(-Math.PI / 2).translate((B.minX + B.maxX) / 2, 2.5, (B.minZ + B.maxZ) / 2)
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, // normal blending: additive light vanishes on a bright day polygonOffsetFactor: -6, polygonOffsetUnits: -6,
      uniforms: { uMin: { value: null }, uTime: { value: 0 }, uAnim: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D uMin; uniform float uTime; uniform float uAnim; varying vec2 vUv;
        vec3 shell(float m){ return m < 15.0 ? vec3(0.27, 0.85, 1.0) : m < 30.0 ? vec3(1.0, 0.78, 0.3) : vec3(1.0, 0.36, 0.3); }
        void main(){
          float m = texture2D(uMin, vec2(vUv.x, 1.0 - vUv.y)).r;
          if (m > 45.0) discard;
          float edge = 0.0;
          for (int i = 1; i <= 3; i++) { float b = float(i) * 15.0; edge = max(edge, 1.0 - smoothstep(0.0, 0.9, abs(m - b))); }
          float pulse = uAnim * 0.5 * (1.0 + sin(m * 0.5 - uTime * 2.0));
          float fill = m < 15.0 ? 0.24 : m < 30.0 ? 0.17 : 0.11; // each band shaded, nearer bands stronger
          float a = fill + 0.5 * edge + 0.08 * pulse * (1.0 - m / 45.0);
          gl_FragColor = vec4(shell(m), a);
        }`,
    })
    const mesh = new THREE.Mesh(g, m)
    mesh.renderOrder = 3; mesh.frustumCulled = false
    return mesh
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose() }, [mesh])
  useEffect(() => () => tex?.dispose(), [tex])
  useEffect(() => { mesh.material.uniforms.uMin.value = tex; mesh.material.uniforms.uAnim.value = quality === 'LOW' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 1 }, [mesh, tex, quality])
  useFrame(({ clock }) => { mesh.material.uniforms.uTime.value = clock.elapsedTime })
  return on && tex ? <primitive object={mesh} /> : null
}
