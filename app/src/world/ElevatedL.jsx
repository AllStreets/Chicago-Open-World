// app/src/world/ElevatedL.jsx — the Loop L's steel bents under the elevated deck.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const post = (x) => new THREE.BoxGeometry(0.5, 7.4, 0.5).translate(x, 3.7, 0)
const bentGeo = mergeGeometries([post(-2.75), post(2.75), new THREE.BoxGeometry(6.4, 0.7, 0.6).translate(0, 7.2, 0)])
const steel = new THREE.MeshStandardMaterial({ color: '#2f3a33', roughness: 0.7, metalness: 0.3 })
const UP = new THREE.Vector3(0, 1, 0)

export default function ElevatedL({ file, onLoaded }) {
  const [cols, setCols] = useState(null)
  const ref = useRef()
  useEffect(() => {
    fetch(`/world/${file}`).then((r) => r.json()).then((j) => setCols(j.columns)).catch(() => setCols([])).finally(onLoaded)
  }, [file, onLoaded])
  useEffect(() => {
    if (!cols?.length || !ref.current) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3()
    // bents stand across the track: rotate the cross beam perpendicular to the direction of travel
    cols.forEach(([x, z, rot], i) => ref.current.setMatrixAt(i, m.compose(p.set(x, 0, z), q.setFromAxisAngle(UP, rot + Math.PI / 2), one)))
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [cols])
  if (!cols?.length) return null
  return <instancedMesh ref={ref} args={[bentGeo, steel, cols.length]} castShadow receiveShadow />
}
