// app/src/sports/Players.jsx — one instanced draw call for the players, one mesh for the ball.
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { formation, ballAt } from './formations.js'
import { frameToWorld } from './anchors.js'

const MAX = 32
const capsule = new THREE.CapsuleGeometry(0.32, 1.15, 2, 6).translate(0, 0.9, 0)
const playerMat = new THREE.MeshStandardMaterial({ roughness: 0.75 })
const ballGeo = new THREE.SphereGeometry(0.22, 10, 8) // ~2× true size so the arc reads from the stands
const ballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3 })
const FIELD_Y = 0.22

export default function Players({ frame, sport, colors }) {
  const ref = useRef()
  const m = useMemo(() => new THREE.Matrix4(), []), c = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const list = formation(sport, Date.now() / 1000).slice(0, MAX)
    list.forEach((p, i) => {
      const [x, z] = frameToWorld(frame, p.u, p.v)
      mesh.setMatrixAt(i, m.makeTranslation(x, FIELD_Y, z))
      mesh.setColorAt(i, c.set(colors[p.side]))
    })
    mesh.count = list.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[capsule, playerMat, MAX]} frustumCulled={false} castShadow={false} receiveShadow={false} />
}

export function Ball({ frame, sport }) {
  const ref = useRef()
  useFrame(() => {
    const b = ballAt(sport, Date.now() / 1000)
    if (!ref.current) return
    ref.current.visible = !!b
    if (b) { const [x, z] = frameToWorld(frame, b[0], b[2]); ref.current.position.set(x, FIELD_Y + b[1], z) }
  })
  return <mesh ref={ref} geometry={ballGeo} material={ballMat} castShadow={false} />
}
