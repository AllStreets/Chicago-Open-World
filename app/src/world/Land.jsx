// app/src/world/Land.jsx — the city's land mass (global, low-poly) under the streamed tiles.
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useStore } from '../state/store.js'
import { useGroundMaterials } from './materials/useGroundMaterials.js'

function LandMesh({ file, material }) {
  const { scene } = useGLTF(`/world/${file}`, false, true)
  const obj = useMemo(() => { scene.traverse((o) => { if (o.isMesh) { o.material = material; o.receiveShadow = true } }); return scene }, [scene, material])
  useEffect(() => { useStore.getState().markLoaded('land') }, [])
  return <primitive object={obj} />
}

export default function Land({ file }) {
  const mats = useGroundMaterials()
  return mats ? <LandMesh file={file} material={mats.land} /> : null
}
