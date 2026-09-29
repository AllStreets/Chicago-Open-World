// app/src/world/TileStreamer.jsx — streams the city around the camera target:
// LOD0 tiles near, LOD1 tiles in blocks that touch them, whole 2 km blocks beyond.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store.js'
import { planWorld } from '../lib/tilePlan.js'
import { useGroundMaterials } from './materials/useGroundMaterials.js'
import SafeLoad from './SafeLoad.jsx'
import TileContent from './TileContent.jsx'

const NEAR_M = 3000 // what the loading screen waits for; the rest streams in behind the intro

export default function TileStreamer({ manifest }) {
  const mats = useGroundMaterials()
  const [plan, setPlan] = useState(() => new Map())
  const counted = useRef(null)
  const last = useRef(null)
  const readout = useStore((s) => s.readout)

  useEffect(() => {
    if (readout.x === undefined) return // wait for the camera's first real pose
    const k = `${Math.round(readout.x / 100)}:${Math.round(readout.z / 100)}`
    if (k === last.current) return
    last.current = k
    setPlan((cur) => {
      const next = planWorld([readout.x, readout.z], manifest, cur)
      if (!counted.current) {
        const boundsOf = (id) => (id.startsWith('t:') ? manifest.tiles.find((t) => `t:${t.key}` === id) : manifest.blocks.find((b) => `b:${b.key}` === id)).bounds
        const near = [...next.keys()].filter((id) => {
          const b = boundsOf(id)
          return Math.hypot((b.minX + b.maxX) / 2 - readout.x, (b.minZ + b.maxZ) / 2 - readout.z) < NEAR_M
        })
        counted.current = new Set(near)
        useStore.getState().addLoadTotal(near.length)
        useStore.getState().markLoaded('tiles-planned')
      }
      // a counted tile that leaves the plan before loading must not hold the loading screen forever
      if (counted.current) for (const id of counted.current) if (!next.has(id)) queueMicrotask(() => useStore.getState().markLoaded(id))
      return next
    })
  }, [readout, manifest])

  const onReady = useCallback((id) => { if (counted.current?.has(id)) useStore.getState().markLoaded(id) }, [])
  if (!mats) return null
  const tiles = new Map(manifest.tiles.map((t) => [`t:${t.key}`, t]))
  const blocks = new Map((manifest.blocks ?? []).map((b) => [`b:${b.key}`, b]))
  return [...plan.entries()].map(([id, lod]) => {
    const t = tiles.get(id), b = blocks.get(id)
    const file = b ? b.file : lod === 'lod0' ? t.lod0 : t.lod1
    return (
      <SafeLoad key={`${id}:${lod}`} onError={() => onReady(id)}>
        <Suspense fallback={null}>
          <TileContent id={id} file={file} meta={t?.meta} lod={lod} mats={mats} onReady={onReady} />
        </Suspense>
      </SafeLoad>
    )
  })
}
