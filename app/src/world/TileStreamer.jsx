// app/src/world/TileStreamer.jsx — streams tiles around the camera target (LOD0 near, LOD1 far).
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store.js'
import { planTiles } from '../lib/tilePlan.js'
import { useGroundMaterials } from './materials/useGroundMaterials.js'
import SafeLoad from './SafeLoad.jsx'
import TileContent from './TileContent.jsx'

export default function TileStreamer({ manifest }) {
  const mats = useGroundMaterials()
  const [plan, setPlan] = useState(() => new Map())
  const counted = useRef(false)
  const last = useRef(null)
  const readout = useStore((s) => s.readout)

  useEffect(() => {
    if (readout.x === undefined) return // wait for the camera's first real pose
    const k = `${Math.round(readout.x / 100)}:${Math.round(readout.z / 100)}`
    if (k === last.current) return
    last.current = k
    setPlan((cur) => {
      const next = planTiles([readout.x, readout.z], manifest.tiles, cur)
      if (!counted.current) { counted.current = true; useStore.getState().addLoadTotal(next.size) }
      return next
    })
  }, [readout, manifest])

  const onReady = useCallback((key) => useStore.getState().markLoaded(`tile:${key}`), [])
  if (!mats) return null
  const byKey = new Map(manifest.tiles.map((t) => [t.key, t]))
  return [...plan.entries()].map(([key, lod]) => (
    <SafeLoad key={`${key}:${lod}`} onError={() => onReady(key)}>
      <Suspense fallback={null}>
        <TileContent tile={byKey.get(key)} lod={lod} mats={mats} onReady={onReady} />
      </Suspense>
    </SafeLoad>
  ))
}
