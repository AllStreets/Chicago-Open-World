// app/src/world/City.jsx — loads every manifest tile; one shared material.
import { Suspense, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import SafeLoad from './SafeLoad.jsx'

export const buildingMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 })

function Tile({ file }) {
  const { scene } = useGLTF(`/world/${file}`, false, false)
  const markLoaded = useStore((s) => s.markLoaded)
  const obj = useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) { o.material = buildingMaterial; o.castShadow = true; o.receiveShadow = true }
    })
    return scene
  }, [scene])
  useEffect(() => { markLoaded(file) }, [markLoaded, file])
  return <primitive object={obj} />
}

export default function City({ tiles }) {
  const fail = (file) => (err) => { console.warn(`tile failed: ${file}`, err); useStore.getState().markLoaded(file) }
  return tiles.map((t) => (
    <SafeLoad key={t.key} onError={fail(t.file)}>
      <Suspense fallback={null}>
        <Tile file={t.file} />
      </Suspense>
    </SafeLoad>
  ))
}
