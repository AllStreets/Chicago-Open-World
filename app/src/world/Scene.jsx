// app/src/world/Scene.jsx — the whole 3D world.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store.js'
import { loadManifest, groundFiles } from '../lib/manifest.js'
import SafeLoad from './SafeLoad.jsx'
import { sunForPreset } from '../lib/sun.js'
import City from './City.jsx'
import Trees from './Trees.jsx'
import ElevatedL from './ElevatedL.jsx'
import RoofProps from './RoofProps.jsx'
import Ground from './Ground.jsx'
import Lake from './Lake.jsx'
import SkyRig from './SkyRig.jsx'
import AtlasRig from '../camera/AtlasRig.jsx'
import PostFX from './PostFX.jsx'
import PerfWatch from './PerfWatch.jsx'
import { QUALITY } from '../lib/quality.js'

export default function Scene() {
  const [manifest, setManifest] = useState(null)
  const preset = useStore((s) => s.timePreset)
  const ready = useStore((s) => s.load.ready)
  const quality = useStore((s) => s.quality)
  const failed = useStore((s) => s.load.error !== null)
  const [now, setNow] = useState(() => new Date())
  const sun = useMemo(() => sunForPreset(preset, now), [preset, now])
  const sunRef = useRef(null)
  const markTrees = useMemo(() => () => useStore.getState().markLoaded('trees'), [])
  const markColumns = useMemo(() => () => useStore.getState().markLoaded('columns'), [])
  const markProps = useMemo(() => () => useStore.getState().markLoaded('props'), [])
  const reducedMotion = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])

  useEffect(() => {
    if (preset !== 'LIVE') return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [preset])

  useEffect(() => {
    const { setLoadTotal, setLoadError, setTimePreset } = useStore.getState()
    const t = new URLSearchParams(window.location.search).get('time')?.toUpperCase()
    if (['LIVE', 'DAWN', 'DAY', 'DUSK', 'NIGHT'].includes(t)) setTimePreset(t)
    loadManifest().then((r) => {
      if (!r.ok) { setLoadError(r.error); return }
      const g = r.manifest.ground
      setLoadTotal(r.manifest.tiles.length + Object.keys(g).length + (r.manifest.trees ? 1 : 0) + (r.manifest.columns ? 1 : 0) + (r.manifest.props ? 1 : 0))
      setManifest(r.manifest)
      useStore.getState().setManifest(r.manifest)
    })
  }, [])

  useEffect(() => { if (ready) window.__worldReady = true }, [ready])

  return (
    <>
      <SkyRig target={sun} sunRef={sunRef} instant={reducedMotion} shadowMap={QUALITY[quality].shadowMap} />
      <SafeLoad><Suspense fallback={null}><Lake sunRef={sunRef} /></Suspense></SafeLoad>
      {(manifest || failed) && <Ground ground={groundFiles(manifest)} />}
      {manifest && <City tiles={manifest.tiles} />}
      {manifest?.trees && <Trees file={manifest.trees} onLoaded={markTrees} />}
      {manifest?.columns && <ElevatedL file={manifest.columns} onLoaded={markColumns} />}
      {manifest?.props && <RoofProps file={manifest.props} onLoaded={markProps} />}
      <AtlasRig />
      <PostFX />
      <PerfWatch />
    </>
  )
}
