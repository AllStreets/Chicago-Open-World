// app/src/world/Trees.jsx — instanced seasonal trees (canopy + trunk).
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { treePalette, chicagoMonth } from '../lib/seasons.js'

const canopyGeo = new THREE.IcosahedronGeometry(1, 0) // 20 tris: ~29k trees stay within budget
canopyGeo.scale(3.5, 3.9, 3.5).translate(0, 7.5, 0)
const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 5.5, 5, 1, true).translate(0, 2.75, 0)
const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })
const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3b2f', roughness: 1 })
const UP = new THREE.Vector3(0, 1, 0)

export default function Trees({ file, onLoaded }) {
  const [trees, setTrees] = useState(null)
  const canopy = useRef(), trunk = useRef()
  const pal = useMemo(() => treePalette(chicagoMonth()), [])
  useEffect(() => {
    fetch(`/world/${file}`).then((r) => r.json()).then((j) => setTrees(j.trees)).catch(() => setTrees([])).finally(onLoaded)
  }, [file, onLoaded])
  useEffect(() => {
    if (!trees?.length || !canopy.current) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color()
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    trees.forEach(([x, z, sc, v], i) => {
      q.setFromAxisAngle(UP, v * 1.7 + i)
      m.compose(p.set(x, 0, z), q, s.set(sc, sc * (0.9 + v * 0.08), sc))
      trunk.current.setMatrixAt(i, m)
      canopy.current.setMatrixAt(i, pal.bare ? zero : m)
      canopy.current.setColorAt(i, c.set(pal.canopy[(i * 7 + v) % pal.canopy.length]))
    })
    for (const r of [canopy, trunk]) { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere() }
    if (canopy.current.instanceColor) canopy.current.instanceColor.needsUpdate = true
  }, [trees, pal])
  if (!trees?.length) return null
  return (
    <>
      <instancedMesh ref={trunk} args={[trunkGeo, trunkMat, trees.length]} receiveShadow />
      <instancedMesh ref={canopy} args={[canopyGeo, canopyMat, trees.length]} castShadow receiveShadow />
    </>
  )
}
