// app/src/ride/RideVehicles.jsx — the bus you ride and the hang-glider you fly (P7): one small mesh each, drawn only
// during that ride (+1 draw call). The L ride's train is a V4 consist in the instanced train renderer (0 calls).
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { vehiclePose } from './rideSession.js'

// boxes with vertex colours merged into one geometry
function boxes(parts) {
  const geos = parts.map(([w, h, d, x, y, z, col]) => {
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed()
    const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) c.toArray(a, i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(a, 3))
    return g
  })
  const pos = [], nor = [], col = []
  for (const g of geos) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); col.push(...g.attributes.color.array); g.dispose() }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return out
}

// A CTA New Flyer XD40 in outline: 12.2 m × 2.6 m × 3.2 m, white with the blue and red stripe and a dark window band;
// +X is forward (the front at x = +6.1).
export function busGeometry() {
  return boxes([
    [12.2, 2.3, 2.58, 0, 0.75, 0, '#e8eaec'],      // body
    [11.6, 1.05, 2.6, 0.1, 2.2, 0, '#1d2630'],     // windows
    [12.0, 0.18, 2.6, 0, 1.5, 0, '#2f5ea8'],       // blue stripe
    [12.0, 0.12, 2.6, 0, 1.36, 0, '#c8202f'],      // red stripe
    [11.8, 0.32, 2.5, 0, 3.0, 0, '#d9dcdf'],       // roof pods
    [0.06, 1.5, 2.3, 6.11, 1.95, 0, '#141b22'],    // windscreen
    [1.0, 0.9, 2.62, 3.9, 0.3, 0, '#111111'],      // front wheels
    [1.0, 0.9, 2.62, -3.2, 0.3, 0, '#111111'],     // rear wheels
  ])
}
// A hang-glider: a 10 m delta of dark fabric with thin cyan leading edges, the pilot hanging below; +X forward.
export function gliderGeometry() {
  const nose = [3.2, 0, 0], tl = [-1.6, 0.25, -5], tr = [-1.6, 0.25, 5], up = (p, d) => [p[0], p[1] + d, p[2]]
  const tri = [], col = []
  const add = (pts, c) => { for (const p of pts) { tri.push(...p); col.push(...c) } }
  add([nose, tl, tr], [0.1, 0.12, 0.16])
  for (const tip of [tl, tr]) add([nose, tip, up(tip, 0.14), nose, up(tip, 0.14), up(nose, 0.14)], [0.27, 0.85, 1.0]) // leading edge
  const wing = new THREE.BufferGeometry()
  wing.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3))
  wing.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  wing.computeVertexNormals()
  const body = boxes([[0.5, 1.6, 0.5, 0.2, -1.4, 0, '#2a2f38'], [0.06, 1.2, 0.06, 0.6, -0.6, 0, '#9aa0a8']]) // pilot, control frame
  const out = new THREE.BufferGeometry()
  for (const k of ['position', 'normal', 'color']) out.setAttribute(k, new THREE.Float32BufferAttribute([...wing.attributes[k].array, ...body.attributes[k].array], 3))
  wing.dispose(); body.dispose()
  return out
}

const eu = new THREE.Euler(0, 0, 0, 'YZX')
export default function RideVehicles() {
  const kind = useStore((s) => (s.ride && (s.ride.kind === 'bus' || s.ride.kind === 'glide') ? s.ride.kind : null))
  const mesh = useMemo(() => {
    if (!kind) return null
    const geo = kind === 'bus' ? busGeometry() : gliderGeometry()
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'bus' ? 0.45 : 0.8, metalness: kind === 'bus' ? 0.2 : 0, side: kind === 'glide' ? THREE.DoubleSide : THREE.FrontSide })
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = true
    m.frustumCulled = false
    return m
  }, [kind])
  useEffect(() => () => { if (mesh) { mesh.geometry.dispose(); mesh.material.dispose() } }, [mesh])
  useFrame(() => {
    if (!mesh) return
    const p = vehiclePose()
    mesh.visible = Boolean(p)
    if (!p) return
    mesh.position.set(p.pos[0], p.pos[1], p.pos[2])
    mesh.rotation.copy(eu.set(p.kind === 'glide' ? -p.roll : 0, p.yaw, p.pitch))
  })
  return mesh ? <primitive object={mesh} /> : null
}
