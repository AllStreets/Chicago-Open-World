// app/src/world/Ground.jsx — land (city boundary) + river/harbour water.
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'

const landMat = new THREE.MeshStandardMaterial({ color: '#8a8780', roughness: 1 })
const riverMat = new THREE.MeshStandardMaterial({ color: '#2f5a63', roughness: 0.3, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 })

function Flat({ file, material }) {
  const { scene } = useGLTF(`/world/${file}`, false, false)
  const markLoaded = useStore((s) => s.markLoaded)
  const obj = useMemo(() => {
    scene.traverse((o) => { if (o.isMesh) { o.material = material; o.receiveShadow = true } })
    return scene
  }, [scene, material])
  useEffect(() => { markLoaded(file) }, [markLoaded, file])
  return <primitive object={obj} />
}

export default function Ground({ ground }) {
  return (
    <>
      <Flat file={ground.land} material={landMat} />
      <Flat file={ground.river} material={riverMat} />
    </>
  )
}
