// app/src/world/Scene.jsx — the whole 3D world.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { loadManifest } from '../lib/manifest.js'
import SafeLoad from './SafeLoad.jsx'
import { sunForPreset } from '../lib/sun.js'
import TileStreamer from './TileStreamer.jsx'
import Land from './Land.jsx'
import { loadFacadeTextures } from './materials/facadeMaterial.js'
import { loadGroundTextures } from './materials/groundShader.js'
import { makeIsWater } from '../lib/landMask.js'
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
  const [now, setNow] = useState(() => new Date())
  const sun = useMemo(() => sunForPreset(preset, now), [preset, now])
  const sunRef = useRef(null)
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
      setLoadTotal(3) // land + façade textures + 'tiles-planned'; TileStreamer adds the near tiles
      setManifest(r.manifest)
      useStore.getState().setManifest(r.manifest)
      if (r.manifest.landMask) fetch(`/world/${r.manifest.landMask}`).then((x) => x.json()).then((j) => useStore.getState().setIsWater(makeIsWater(j.rings))).catch(() => {})
    })
    Promise.all([loadFacadeTextures(), loadGroundTextures()]).catch(() => {}).finally(() => useStore.getState().markLoaded('facades'))
  }, [])

  useEffect(() => { if (ready) window.__worldReady = true }, [ready])
  const gl = useThree((s) => s.gl)
  useEffect(() => { if (new URLSearchParams(window.location.search).has('stats')) window.__gl = gl }, [gl])

  return (
    <>
      <SkyRig target={sun} sunRef={sunRef} instant={reducedMotion} shadowMap={QUALITY[quality].shadowMap} fog={QUALITY[quality].fog} />
      <SafeLoad><Suspense fallback={null}><Lake sunRef={sunRef} /></Suspense></SafeLoad>
      {manifest && <SafeLoad onError={() => useStore.getState().markLoaded('land')}><Suspense fallback={null}><Land file={manifest.land} /></Suspense></SafeLoad>}
      {manifest && <TileStreamer manifest={manifest} />}
      <AtlasRig />
      <PostFX />
      <PerfWatch />
    </>
  )
}
