// app/src/world/RoofProps.jsx — instanced water towers, HVAC units and mechanical penthouses.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const leg = (x, z) => new THREE.BoxGeometry(0.2, 3, 0.2).translate(x, 1.5, z)
const towerGeo = mergeGeometries([
  new THREE.CylinderGeometry(2.1, 2.1, 4.2, 14).translate(0, 5.1, 0),
  new THREE.ConeGeometry(2.3, 1.4, 14).translate(0, 7.9, 0),
  leg(1.4, 1.4), leg(-1.4, 1.4), leg(1.4, -1.4), leg(-1.4, -1.4),
])
const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const MATS = [
  new THREE.MeshStandardMaterial({ color: '#6b4a33', roughness: 1 }),              // weathered cedar tank
  new THREE.MeshStandardMaterial({ color: '#9aa0a3', roughness: 0.55, metalness: 0.4 }), // HVAC
  new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.8 }),             // penthouse
]
const GEOS = [towerGeo, boxGeo, boxGeo]
const UP = new THREE.Vector3(0, 1, 0)

function Kind({ type, items }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
    items.forEach(([, x, y, z, rot, sx, sy, sz], i) => ref.current.setMatrixAt(i, m.compose(p.set(x, y, z), q.setFromAxisAngle(UP, rot), s.set(sx, sy, sz))))
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  // only water towers are tall enough for their shadow to read; HVAC boxes and penthouses skip the shadow pass
  return <instancedMesh ref={ref} args={[GEOS[type], MATS[type], items.length]} castShadow={type === 0} receiveShadow />
}

export default function RoofProps({ props }) {
  if (!props?.length) return null
  return [0, 1, 2].map((t) => {
    const items = props.filter((p) => p[0] === t)
    return items.length ? <Kind key={t} type={t} items={items} /> : null
  })
}
