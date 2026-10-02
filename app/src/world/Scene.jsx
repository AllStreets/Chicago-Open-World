// app/src/world/Scene.jsx — the whole 3D world.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { loadManifest, worldUrl } from '../lib/manifest.js'
import { readLevels } from '../lib/levels.js'
import SafeLoad from './SafeLoad.jsx'
import { sunForPreset } from '../lib/sun.js'
import TileStreamer from './TileStreamer.jsx'
import Picker from './Picker.jsx'
import SeasonRig from './SeasonRig.jsx'
import Rain from './Rain.jsx'
import ScanController from '../scan/ScanController.jsx'
import ScanOverlays from '../scan/ScanOverlays.jsx'
import RideVehicles from '../ride/RideVehicles.jsx'
import { startRide } from '../ride/rideActions.js'
import { seekRide } from '../ride/rideSession.js'
import Fireworks from '../landmarks/Fireworks.jsx'
import PoiPins from './PoiPins.jsx'
import Beacons from './Beacons.jsx'
import WorldLabels from './WorldLabels.jsx'
import NeighborhoodZones from './NeighborhoodZones.jsx'
import Isochrones from './Isochrones.jsx'
import Land from './Land.jsx'
import { loadFacadeTextures, loadStylePalette } from './materials/facadeMaterial.js'
import { loadGroundTextures } from './materials/groundShader.js'
import { makeIsWater } from '../lib/landMask.js'
import Lake from './Lake.jsx'
import Boats from './Boats.jsx'
import RiverBoats from './RiverBoats.jsx'
import WaterRig from './WaterRig.jsx'
import SkyRig from './SkyRig.jsx'
import AtlasRig from '../camera/AtlasRig.jsx'
import PostFX from './PostFX.jsx'
import PerfWatch from './PerfWatch.jsx'
import { QUALITY } from '../lib/quality.js'
import { loadHeightfield, clearanceAt } from '../lib/clearance.js'
import Tunnels from '../transit/Tunnels.jsx'
import LowerLevels from './LowerLevels.jsx'
import Traffic from '../traffic/Traffic.jsx'
import { getSim } from '../transit/simStore.js'
import TransitLayer from '../transit/TransitLayer.jsx'
import Trains from '../transit/Trains.jsx'
import SportsClock from '../sports/SportsClock.jsx'
import SportsLife from '../sports/SportsLife.jsx'
import StationHits from '../transit/StationHits.jsx'
import Landmarks from './Landmarks.jsx'
import TrainAudio from '../transit/TrainAudio.jsx'
import RideAudio from '../ride/RideAudio.jsx'
import { audioLevels } from '../audio/levels.js'
import { followNearest } from '../transit/actions.js'
import { getTracker } from '../transit/liveStore.js'
import { getTrains } from '../transit/simStore.js'
import PerfProbe from './PerfProbe.jsx'
import { PRESETS } from '../lib/atmosphere.js'
import { WEATHER_MODES } from '../weather/weatherState.js'

export default function Scene() {
  const [manifest, setManifest] = useState(null)
  const levels = useMemo(() => readLevels(manifest), [manifest]) // D1-8: absent = the flat world
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
    if (PRESETS.includes(t)) setTimePreset(t) // every view, SUNNY and SNOW included (tests only)
    const w = new URLSearchParams(window.location.search).get('weather')?.toUpperCase()
    if (WEATHER_MODES.includes(w)) useStore.getState().setWeatherMode(w) // P5, tests only (people use the Weather button)
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
  useEffect(() => { // test-only ?ride=<id>&rideView=side&rideAt=<s metres> (people use the Ride button, L or ⌘K)
    const q = new URLSearchParams(window.location.search), id = q.get('ride')
    if (!id || !ready || !transit) return
    const t = setTimeout(() => {
      if (!startRide(id)) return
      const v = q.get('rideView'), at = Number(q.get('rideAt'))
      if (v) useStore.setState((s) => ({ ride: s.ride && { ...s.ride, view: v } }))
      if (Number.isFinite(at) && q.has('rideAt')) setTimeout(() => seekRide(at), 300)
    }, 500)
    return () => clearTimeout(t)
  }, [ready, transit])
  const gl = useThree((s) => s.gl)
  const threeScene = useThree((s) => s.scene)
  const threeCamera = useThree((s) => s.camera)
  // test-only ?perf turns the exact draw probe on (it owns renderer.info while on, so ?stats specs that read it stay unaffected)
  useEffect(() => { if (new URLSearchParams(window.location.search).has('perf')) useStore.getState().setPerfOn(true) }, [])
  useEffect(() => { if (new URLSearchParams(window.location.search).has('stats')) { window.__gl = gl; window.__store = useStore; window.__clearanceAt = clearanceAt; window.__scene = threeScene; window.__camera = threeCamera; window.__live = { tracker: getTracker, trains: getTrains }; window.__getSim = getSim; window.__audio = audioLevels } }, [gl, threeScene, threeCamera])

  return (
    <>
      <SkyRig target={sun} sunRef={sunRef} instant={reducedMotion} shadowMap={QUALITY[quality].shadowMap} fog={QUALITY[quality].fog} />
      {manifest?.lake && <Lake file={manifest.lake} version={manifest.version} />}
      <WaterRig sunRef={sunRef} shore={manifest?.shore ?? null} version={manifest?.version} levels={levels} />
      {manifest?.harbours && <Boats entry={manifest.harbours} version={manifest.version} />}
  
      {manifest && <Land file={manifest.land} version={manifest.version} />}
      {manifest && <TileStreamer manifest={manifest} />}
      {manifest && <Landmarks manifest={manifest} />}
      <TransitLayer />
      <Tunnels />
      <LowerLevels />
      {manifest?.traffic && <Traffic file={manifest.traffic} version={manifest.version} />}
      {manifest?.riverBoats && <RiverBoats file={manifest.riverBoats} version={manifest.version} />}
      <StationHits />
      <Picker />
      <SeasonRig />
      <Rain />
      <ScanController />
      <ScanOverlays />
      <RideVehicles />
      <Fireworks />
      <PoiPins />
      <Beacons />
      <WorldLabels />
      <NeighborhoodZones />
      <Isochrones />
      <TrainAudio />
      <RideAudio />
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
