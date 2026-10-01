// app/src/scan/ScanOverlays.jsx — what the lenses show on the scanned city (P5 · I-5.4): VISIT a landmark heat glow on
// the ground (1 draw), LIVE a light column per neighbourhood, its height the metric chosen in the Live panel (1 instanced
// draw). WORK keeps its isochrones (P4). Both fade in with the sweep and are absent outside Scan.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { landmarkHeat, columnHeights } from './scanMath.js'
import { scanNow } from './ScanController.jsx'

const ACCENT = new THREE.Color('#45d8ff')
const COL_R = 55, COL_MIN = 60, COL_MAX = 900

function HeatPlane({ landmarks }) {
  const mesh = useMemo(() => {
    const pts = landmarks.map((l) => [l.x, l.z]).filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z))
    if (!pts.length) return null
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), pad = 1500
    const bounds = { minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad, minZ: Math.min(...zs) - pad, maxZ: Math.max(...zs) + pad }
    const h = landmarkHeat(pts, bounds, 100, 450)
    const tex = new THREE.DataTexture(Uint8Array.from(h.data, (v) => Math.round(v * 255)), h.cols, h.rows, THREE.RedFormat, THREE.UnsignedByteType)
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true
    const w = h.cols * h.cell, d = h.rows * h.cell
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(bounds.minX + w / 2, 8, bounds.minZ + d / 2)
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4,
      uniforms: { uHeat: { value: tex }, uColor: { value: ACCENT }, uFade: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // texture rows run north (minZ) → south; the plane's uv.y runs south → north after the rotation
      fragmentShader: 'uniform sampler2D uHeat; uniform vec3 uColor; uniform float uFade; varying vec2 vUv; void main() { float h = texture2D(uHeat, vec2(vUv.x, 1.0 - vUv.y)).r; float a = pow(h, 1.4) * uFade; if (a < 0.004) discard; gl_FragColor = vec4(uColor * a * 0.75, 1.0); }',
    })
    const mesh = new THREE.Mesh(g, m)
    mesh.renderOrder = 4
    mesh.frustumCulled = false
    return mesh
  }, [landmarks])
  useEffect(() => () => { if (mesh) { mesh.geometry.dispose(); mesh.material.uniforms.uHeat.value.dispose(); mesh.material.dispose() } }, [mesh])
  useFrame(() => { if (mesh) mesh.material.uniforms.uFade.value = scanNow.sky })
  return mesh ? <primitive object={mesh} /> : null
}

function Columns({ zones, metric }) {
  const mesh = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0)
    const m = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    const im = new THREE.InstancedMesh(g, m, Math.max(1, zones.length))
    im.frustumCulled = false
    im.renderOrder = 5
    return im
  }, [zones.length])
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose() }, [mesh])
  const target = useRef(new Map())
  useEffect(() => { target.current = columnHeights(zones, metric) }, [zones, metric])
  const cur = useRef(new Map())
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  useFrame((_, dt) => {
    mesh.material.opacity = 0.32 * scanNow.sky
    zones.forEach((z, i) => {
      const want = target.current.get(z.id) ?? 0, was = cur.current.get(z.id) ?? 0
      const h = was + (want - was) * Math.min(1, dt * 3) // the columns grow to a new metric, not jump
      cur.current.set(z.id, h)
      const height = (COL_MIN + (COL_MAX - COL_MIN) * h) * scanNow.sky
      m4.makeScale(COL_R, Math.max(0.01, height), COL_R).setPosition(z.label[0], 0, z.label[1])
      mesh.setMatrixAt(i, m4)
    })
    mesh.count = zones.length
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}

export default function ScanOverlays() {
  const scan = useStore((s) => s.scan), lens = useStore((s) => s.lens)
  const hoods = useStore((s) => s.hoods), manifest = useStore((s) => s.manifest), metric = useStore((s) => s.scanMetric)
  const zones = useMemo(() => (hoods ?? []).filter((z) => Array.isArray(z.label)), [hoods])
  if (!scan) return null
  if (lens === 'LIVE' && zones.length) return <Columns zones={zones} metric={metric} />
  if (lens === 'VISIT' && manifest?.landmarks?.length) return <HeatPlane landmarks={manifest.landmarks} />
  return null
}
