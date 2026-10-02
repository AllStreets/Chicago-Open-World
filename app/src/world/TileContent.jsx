// app/src/world/TileContent.jsx — one streamed tile or 2 km block: meshes by name → shared materials,
// plus (LOD0 only) the tile's trees, rooftop props and L columns. A LOD0 tile far from the camera draws its
// LOD1 buildings in place of its own (lib/farDetail.js); everything else stays the LOD0 tile's.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
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
import { isFar, anyLeafLifted } from '../lib/farDetail.js'
import { liveLift } from '../bridges/BridgeLeaves.jsx'
import SafeLoad from './SafeLoad.jsx'
import { mirrorSkippable } from './water/mirrorCull.js'

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

export default function TileContent({ id, file, meta, lod, mats, version, onReady, far: farSpec }) {
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
  // far detail: this LOD0 tile's own LOD1 buildings stand in while the camera is far away (lib/farDetail.js)
  const camera = useThree((s) => s.camera)
  const own = useMemo(() => {
    const out = { buildings: [], leaves: [] }
    scene.traverse((o) => { const layer = o.name || o.parent?.name; if (o.isMesh && out[layer]) out[layer].push(o) })
    return out
  }, [scene])
  const standInFile = lod === 'lod0' ? farSpec?.lod1 : null
  const farNow = (was) => {
    if (!standInFile) return false
    if (own.leaves.length && anyLeafLifted(liveLift.angles)) return false // its LOD1 copy shows the leaves closed
    const p = camera.position
    return isFar([p.x, p.y, p.z], farSpec.bounds, farSpec.top, was)
  }
  const [far, setFar] = useState(() => farNow(false))
  const farRef = useRef(far)
  useFrame(() => {
    if (!standInFile) return
    const f = farNow(farRef.current)
    if (f !== farRef.current) { farRef.current = f; setFar(f) }
  })
  const [standIn, setStandIn] = useState(null) // 'ready' | 'failed'
  const showStandIn = far && standIn === 'ready'
  useEffect(() => {
    for (const o of own.buildings) o.visible = !showStandIn
    for (const o of own.leaves) o.visible = !showStandIn
  }, [own, showStandIn])
  // a far 2 km block may stay out of the water's mirror (water/mirrorCull.js)
  useEffect(() => (lod === 'block' ? mirrorSkippable(own.buildings) : undefined), [lod, own])
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
  // ready once what this frame should show is in: a tile that starts far waits for its stand-in (the perf probe and
  // the screenshot tests measure only after every planned tile is ready)
  const waiting = far && !standIn
  useEffect(() => { if (!waiting) onReady?.(id, lod) }, [onReady, id, lod, waiting])
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
      {standInFile && (far || standIn) && (
        <SafeLoad onError={() => setStandIn('failed')}>
          <Suspense fallback={null}>
            <FarStandIn id={id} file={standInFile} meta={meta} version={version} show={showStandIn} onLoaded={setStandIn} />
          </Suspense>
        </SafeLoad>
      )}
      {side?.trees?.length > 0 && <Trees trees={side.trees} />}
      {side?.props?.length > 0 && <RoofProps props={side.props} />}
    </>
  )
}

// The tile's LOD1 buildings, loaded as their own copy (a '#far' cache key: never the scene object a LOD1 TileContent
// of the same tile mounts and disposes). Only the buildings draw — and, unlike a LOD1 tile, they cast the shadow the
// full-detail tile would have cast. Ground, water and glow stay the LOD0 tile's.
function FarStandIn({ id, file, meta, version, show, onLoaded }) {
  const url = `${worldUrl(file, version)}#far`
  const { scene } = useGLTF(url, false, true)
  useMemo(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      if ((o.name || o.parent?.name) !== 'buildings') { o.visible = false; return }
      o.material = buildingMaterial; o.castShadow = true; o.receiveShadow = true; o.layers.enable(REFLECT_LAYER)
      o.userData = { tileId: id, lod: 'lod1', metaUrl: meta ? worldUrl(meta, version) : null } // P4 picking
    })
  }, [scene, id, meta, version])
  useEffect(() => { onLoaded('ready') }, [onLoaded])
  useEffect(() => { retain(url); return () => release(url, scene) }, [scene, url])
  return <primitive object={scene} visible={show} />
}
