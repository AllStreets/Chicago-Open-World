// app/src/world/Land.jsx — the city's land mass (global, low-poly) under the streamed tiles.
// Loaded imperatively (no Suspense): it always reports done, loaded or not, so it can never hold the loading screen.
import { useEffect, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useStore } from '../state/store.js'
import { useGroundMaterials } from './materials/useGroundMaterials.js'

export default function Land({ file }) {
  const mats = useGroundMaterials()
  const [scene, setScene] = useState(null)
  useEffect(() => {
    let alive = true
    new GLTFLoader().loadAsync(`/world/${file}`)
      .then((g) => { if (alive) setScene(g.scene) })
      .catch((e) => console.warn('land failed', e))
      .finally(() => useStore.getState().markLoaded('land'))
    return () => { alive = false }
  }, [file])
  useEffect(() => {
    if (!scene || !mats) return
    scene.traverse((o) => { if (o.isMesh) { o.material = mats.land; o.receiveShadow = true } })
  }, [scene, mats])
  return scene && mats ? <primitive object={scene} /> : null
}
