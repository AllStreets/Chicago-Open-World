// app/src/world/TileContent.jsx — one streamed tile or 2 km block: meshes by name → shared materials,
// plus (LOD0 only) the tile's trees, rooftop props and L columns.
import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { buildingMaterial } from './City.jsx'
import { createGroundMaterial } from './materials/groundShader.js'
import Trees from './Trees.jsx'
import RoofProps from './RoofProps.jsx'
import ElevatedL from './ElevatedL.jsx'
import { worldUrl } from '../lib/manifest.js'
import { disposeObject } from './dispose.js'

export const groundMaterial = createGroundMaterial()

// Release a tile's GPU memory only if it stays gone for a while. Disposing immediately made tiles
// re-suspend (blink out) whenever React remounted them — StrictMode in dev, plan churn while flying.
const RELEASE_MS = 8000
const pendingRelease = new Map()
function retain(url) { clearTimeout(pendingRelease.get(url)); pendingRelease.delete(url) }
function release(url, scene) {
  clearTimeout(pendingRelease.get(url))
  pendingRelease.set(url, setTimeout(() => {
    pendingRelease.delete(url)
    disposeObject(scene)
    useGLTF.clear(url)
  }, RELEASE_MS))
}

export default function TileContent({ id, file, meta, lod, mats, version, onReady }) {
  const url = worldUrl(file, version)
  const { scene } = useGLTF(url, false, true)
  const [side, setSide] = useState(null)
  const obj = useMemo(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      const layer = o.name || o.parent?.name
      o.receiveShadow = true
      o.castShadow = false
      if (layer === 'buildings') { o.material = buildingMaterial; o.castShadow = lod === 'lod0' }
      else if (layer === 'ground') o.material = groundMaterial
      else if (layer === 'water') o.material = mats.river
      else if (layer === 'elevated') { o.material = mats.elevated; o.castShadow = true }
      else o.material = mats.land
    })
    return scene
  }, [scene, mats, lod])
  useEffect(() => { onReady?.(id, lod) }, [onReady, id, lod])
  useEffect(() => {
    if (lod !== 'lod0' || !meta) return
    let alive = true
    fetch(worldUrl(meta, version)).then((r) => r.json()).then((j) => alive && setSide(j)).catch(() => {})
    return () => { alive = false }
  }, [meta, lod, version])
  useEffect(() => { retain(url); return () => release(url, scene) }, [scene, url])
  return (
    <>
      <primitive object={obj} />
      {side?.trees?.length > 0 && <Trees trees={side.trees} />}
      {side?.props?.length > 0 && <RoofProps props={side.props} />}
      {side?.columns?.length > 0 && <ElevatedL columns={side.columns} />}
    </>
  )
}
