// app/src/world/Scene.jsx — the whole 3D world.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { loadManifest, worldUrl } from '../lib/manifest.js'
import SafeLoad from './SafeLoad.jsx'
import { sunForPreset } from '../lib/sun.js'
import TileStreamer from './TileStreamer.jsx'
import Picker from './Picker.jsx'
import PoiPins from './PoiPins.jsx'
import Land from './Land.jsx'
import { loadFacadeTextures, loadStylePalette } from './materials/facadeMaterial.js'
import { loadGroundTextures } from './materials/groundShader.js'
import { makeIsWater } from '../lib/landMask.js'
import Lake from './Lake.jsx'
import WaterRig from './WaterRig.jsx'
import SkyRig from './SkyRig.jsx'
import AtlasRig from '../camera/AtlasRig.jsx'
import PostFX from './PostFX.jsx'
import PerfWatch from './PerfWatch.jsx'
import { QUALITY } from '../lib/quality.js'
import { loadHeightfield, clearanceAt } from '../lib/clearance.js'
import TransitLayer from '../transit/TransitLayer.jsx'
import Trains from '../transit/Trains.jsx'
import SportsClock from '../sports/SportsClock.jsx'
import SportsLife from '../sports/SportsLife.jsx'
import StationHits from '../transit/StationHits.jsx'
import Landmarks from './Landmarks.jsx'
import TrainAudio from '../transit/TrainAudio.jsx'
import { followNearest } from '../transit/actions.js'
import PerfProbe from './PerfProbe.jsx'

export default function Scene() {
  const [manifest, setManifest] = useState(null)
  const preset = useStore((s) => s.timePreset)
  const ready = useStore((s) => s.load.ready)
  const quality = useStore((s) => s.quality)
  const transit = useStore((s) => s.transit)
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
      loadStylePalette(r.manifest)
      if (r.manifest.heightfield) loadHeightfield(worldUrl(r.manifest.heightfield.file, r.manifest.version), r.manifest.heightfield)
      if (r.manifest.transit) fetch(worldUrl(r.manifest.transit, r.manifest.version)).then((x) => (x.ok ? x.json() : null)).then((j) => j && useStore.getState().setTransit(j)).catch(() => {})
      if (r.manifest.landMask) fetch(`/world/${r.manifest.landMask}`).then((x) => x.json()).then((j) => useStore.getState().setIsWater(makeIsWater(j.rings))).catch(() => {})
    })
    Promise.all([loadFacadeTextures(), loadGroundTextures()]).catch(() => {}).finally(() => useStore.getState().markLoaded('facades'))
  }, [])

  useEffect(() => { if (ready) window.__worldReady = true }, [ready])
  useEffect(() => { // test-only ?follow= (people use ⌘K or a train card)
    const q = new URLSearchParams(window.location.search), f = q.get('follow')
    if (!f || !ready || !transit) return
    const id = setTimeout(() => { followNearest(f); const v = q.get('followView'); if (v) useStore.getState().setFollowView(v) }, 500)
    return () => clearTimeout(id)
  }, [ready, transit])
  const gl = useThree((s) => s.gl)
  const threeScene = useThree((s) => s.scene)
  const threeCamera = useThree((s) => s.camera)
  // test-only ?perf turns the exact draw probe on (it owns renderer.info while on, so ?stats specs that read it stay unaffected)
  useEffect(() => { if (new URLSearchParams(window.location.search).has('perf')) useStore.getState().setPerfOn(true) }, [])
  useEffect(() => { if (new URLSearchParams(window.location.search).has('stats')) { window.__gl = gl; window.__store = useStore; window.__clearanceAt = clearanceAt; window.__scene = threeScene; window.__camera = threeCamera } }, [gl, threeScene, threeCamera])

  return (
    <>
      <SkyRig target={sun} sunRef={sunRef} instant={reducedMotion} shadowMap={QUALITY[quality].shadowMap} fog={QUALITY[quality].fog} />
      {manifest?.lake && <Lake file={manifest.lake} version={manifest.version} />}
      <WaterRig sunRef={sunRef} shore={manifest?.shore ?? null} version={manifest?.version} />
  
      {manifest && <Land file={manifest.land} version={manifest.version} />}
      {manifest && <TileStreamer manifest={manifest} />}
      {manifest && <Landmarks manifest={manifest} />}
      <TransitLayer />
      <StationHits />
      <Picker />
      <PoiPins />
      <TrainAudio />
        {manifest?.trains && <SafeLoad><Suspense fallback={null}><Trains file={manifest.trains} version={manifest.version} /></Suspense></SafeLoad>}
  
      <AtlasRig />
      <PostFX />
      <PerfWatch />
      <PerfProbe />
      <SportsClock />
      <SportsLife />
    </>
  )
}
