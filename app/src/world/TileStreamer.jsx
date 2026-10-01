// app/src/world/TileStreamer.jsx — streams the city around the camera target:
// LOD0 tiles near, LOD1 tiles in blocks that touch them, whole 2 km blocks beyond.
import { Suspense, useCallback, useEffect, useRef, useState, startTransition } from 'react'
import { useStore } from '../state/store.js'
import { planWorld, admitTiles, retainOutgoing } from '../lib/tilePlan.js'
import { useGroundMaterials } from './materials/useGroundMaterials.js'
import SafeLoad from './SafeLoad.jsx'
import TileContent from './TileContent.jsx'

const NEAR_M = 3000 // what the loading screen waits for; the rest streams in behind the intro
const CONCURRENT = 6 // tiles decoding at once — nearest first, so the city fills in outward

export default function TileStreamer({ manifest }) {
  const mats = useGroundMaterials()
  const [plan, setPlan] = useState(() => new Map())
  const counted = useRef(null)
  const last = useRef(null)
  const readout = useStore((s) => s.readout)
  const ready = useRef(new Set())
  const shown = useRef([]) // what the last render drew: [id, lod, distance][]
  const [, setTick] = useState(0)

  useEffect(() => {
    if (readout.x === undefined) return // wait for the camera's first real pose
    const k = `${Math.round(readout.x / 100)}:${Math.round(readout.z / 100)}`
    if (k === last.current) return
    last.current = k
    // a transition keeps what's on screen until the new detail level has loaded (no blink)
    startTransition(() => setPlan((cur) => {
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
    }))
  }, [readout, manifest])

  const onReady = useCallback((id, lod) => {
    const k = `${id}:${lod}`
    // admit the next tile in the queue; as a transition, so a tile swapping detail keeps its old content until the new is in
    if (!ready.current.has(k)) { ready.current.add(k); startTransition(() => setTick((t) => t + 1)) }
    if (counted.current?.has(id)) useStore.getState().markLoaded(id)
  }, [])
  if (!mats) return null
  const tiles = new Map(manifest.tiles.map((t) => [`t:${t.key}`, t]))
  const blocks = new Map((manifest.blocks ?? []).map((b) => [`b:${b.key}`, b]))
  const tx = readout.x ?? 0, tz = readout.z ?? 0
  const boundsOf = (id) => (tiles.get(id) ?? blocks.get(id)).bounds
  const entries = [...plan.entries()].map(([id, lod]) => {
    const bb = boundsOf(id)
    return [id, lod, Math.hypot((bb.minX + bb.maxX) / 2 - tx, (bb.minZ + bb.maxZ) / 2 - tz)]
  })
  // keep outgoing content until its replacements are in, so a swap of detail never opens a hole
  const kept = retainOutgoing(shown.current, entries, ready.current, boundsOf)
  const draw = admitTiles([...entries, ...kept], ready.current, CONCURRENT)
  // forget load state for content that is really gone (its GPU memory is released after a delay)
  const live = new Set(draw.map(([id]) => id))
  for (const k of [...ready.current]) if (!live.has(k.slice(0, k.lastIndexOf(':')))) ready.current.delete(k)
  shown.current = draw
  window.__tilesIdle = draw.every(([id, lod]) => ready.current.has(`${id}:${lod}`))
  return draw.map(([id, lod]) => {
    const t = tiles.get(id), b = blocks.get(id)
    const file = b ? b.file : lod === 'lod0' ? t.lod0 : t.lod1
    return (
      <SafeLoad key={id} onError={() => onReady(id)}>
        <Suspense fallback={null}>
          <TileContent id={id} file={file} meta={t?.meta} lod={lod} mats={mats} version={manifest.version} onReady={onReady}
            far={lod === 'lod0' && t.lod1 ? { lod1: t.lod1, bounds: t.bounds, top: t.maxHeight ?? 0 } : null} />
        </Suspense>
      </SafeLoad>
    )
  })
}
