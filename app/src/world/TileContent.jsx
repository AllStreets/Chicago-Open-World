// app/src/world/TileContent.jsx — one streamed tile or 2 km block: meshes by name → shared materials,
// plus (LOD0 only) the tile's trees, rooftop props and L columns.
import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { buildingMaterial, leafMaterial } from './City.jsx'
import { createGroundMaterial } from './materials/groundShader.js'
import Trees from './Trees.jsx'
import RoofProps from './RoofProps.jsx'
import { worldUrl } from '../lib/manifest.js'
import { disposeObject } from './dispose.js'
import { waterMaterial, REFLECT_LAYER } from './materials/waterSurface.js'
import { TRANSIT_LAYERS, addTileLayer, removeTileLayer } from '../transit/pools.js'
import { registerTilePois, unregisterTilePois } from './poiRegistry.js'
import { fetchTileSidecar } from '../lib/tileSidecar.js'

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
      if (TRANSIT_LAYERS.includes(layer)) { o.visible = false; return } // drawn by the transit pools
      o.receiveShadow = true
      o.castShadow = false
      if (layer === 'buildings') { o.material = buildingMaterial; o.castShadow = lod === 'lod0'; o.layers.enable(REFLECT_LAYER); o.userData = { tileId: id, lod, metaUrl: meta ? worldUrl(meta, version) : null } } // P4 picking
      else if (layer === 'leaves') { o.material = leafMaterial; o.castShadow = false; o.layers.enable(REFLECT_LAYER) } // a raised leaf would cast its closed shadow
      else if (layer === 'ground') o.material = groundMaterial
      else if (layer === 'water') { o.material = waterMaterial; o.receiveShadow = false }
      else o.material = mats.land
    })
    return scene
  }, [scene, mats, lod, id, meta, version])
  // hand this tile's track, stations and glow to the shared batched meshes; take them back on unmount
  useEffect(() => {
    const handles = []
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      const layer = o.name || o.parent?.name
      if (o.isMesh && TRANSIT_LAYERS.includes(layer)) handles.push(addTileLayer(layer, o.geometry, o.matrixWorld))
    })
    return () => handles.forEach(removeTileLayer)
  }, [scene])
  useEffect(() => { onReady?.(id, lod) }, [onReady, id, lod])
  useEffect(() => {
    if (lod !== 'lod0' || !meta) return
    let alive = true
    fetchTileSidecar(worldUrl(meta, version)).then((j) => alive && setSide(j)).catch(() => {}) // v1 or compact v2 (X-0a)
    return () => { alive = false }
  }, [meta, lod, version])
  useEffect(() => { retain(url); return () => release(url, scene) }, [scene, url])
  // this tile's places join the pins while it is shown at full detail (P4)
  useEffect(() => { if (!side?.pois?.length) return undefined; registerTilePois(id, side.pois); return () => unregisterTilePois(id) }, [side, id])
  return (
    <>
      <primitive object={obj} />
      {side?.trees?.length > 0 && <Trees trees={side.trees} />}
      {side?.props?.length > 0 && <RoofProps props={side.props} />}
    </>
  )
}
