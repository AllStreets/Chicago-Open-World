// app/src/world/TileContent.jsx — one streamed tile: layers by mesh name → materials, plus its trees/props/L.
import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { buildingMaterial } from './City.jsx'
import Trees from './Trees.jsx'
import RoofProps from './RoofProps.jsx'
import ElevatedL from './ElevatedL.jsx'

const LAYER_MAT = { water: 'river' } // tile layer name → ground material key when they differ

export default function TileContent({ tile, lod, mats, onReady }) {
  const url = `/world/${lod === 'lod0' ? tile.lod0 : tile.lod1}`
  const { scene } = useGLTF(url, false, true)
  const [side, setSide] = useState(null)
  const obj = useMemo(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      const layer = o.name || o.parent?.name
      if (layer === 'buildings' || layer === 'parapets') { o.material = buildingMaterial; o.castShadow = lod === 'lod0'; o.receiveShadow = true; return }
      o.material = mats[LAYER_MAT[layer] ?? layer] ?? mats.land
      o.receiveShadow = true
      o.castShadow = layer === 'elevated'
    })
    return scene
  }, [scene, mats, lod])
  useEffect(() => { onReady?.(tile.key) }, [onReady, tile.key])
  useEffect(() => {
    if (lod !== 'lod0') return
    let alive = true
    fetch(`/world/${tile.meta}`).then((r) => r.json()).then((j) => alive && setSide(j)).catch(() => {})
    return () => { alive = false }
  }, [tile.meta, lod])
  useEffect(() => () => {
    scene.traverse((o) => o.isMesh && o.geometry.dispose())
    useGLTF.clear(url)
  }, [scene, url])
  return (
    <>
      <primitive object={obj} />
      {side?.trees?.length > 0 && <Trees trees={side.trees} />}
      {side?.props?.length > 0 && <RoofProps props={side.props} />}
      {side?.columns?.length > 0 && <ElevatedL columns={side.columns} />}
    </>
  )
}
