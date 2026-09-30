// app/src/world/SkyRig.jsx — the living sky: tweened sun, palette-driven light, stars, sky reflections.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import SkyEnvironment from './SkyEnvironment.jsx'
import { paletteFor } from '../lib/skyPalette.js'
import { useStore } from '../state/store.js'
import { stepSun } from '../lib/sunTween.js'
import { facadeUniforms } from './materials/facadeMaterial.js'
import { applySkyGain } from './materials/skyGain.js'
import { createRestTracker } from '../lib/rest.js'
import { REFLECT_LAYER } from './materials/waterSurface.js'
import { atmosphereFor } from '../lib/atmosphere.js'
import * as THREE from 'three'

// the weather of the current view, eased (user fixes): the season rig reads it for snow and ice
export const atmosphereNow = { skyTint: [1, 1, 1], sunScale: 1, skyGain: 0.42, turbidity: 3.2, rayleigh: 1.2, fogMix: 0, fogScale: 1, snow: 0, ice: 0, overcast: 0, tint: new THREE.Color('#b4c6d6') }
const ease = (a, b, k) => a + (b - a) * k

const SKY_GAIN = 0.42

const DIST = 5000
const tmpTint = new THREE.Color(), tmpFog = new THREE.Color()

export default function SkyRig({ target, sunRef, instant = false, shadowMap = 4096, fog = [2600, 17000] }) {
  const { scene } = useThree()
  const sky = useRef(), light = useRef(), hemi = useRef(), stars = useRef()
  useEffect(() => { if (sky.current) applySkyGain(sky.current.material, SKY_GAIN) }, [])
  // the mirrored camera sees only REFLECT_LAYER: sky, stars and both lights must be on it
  useEffect(() => { for (const r of [sky, stars, hemi, light]) r.current?.layers.enable(REFLECT_LAYER) }, [])
  const cur = useRef(target.direction.slice())
  const skyRest = useRef(createRestTracker({ frames: 20, eps: 1e-5 }))
  if (!sunRef.current) sunRef.current = cur.current
  const envSun = useMemo(() => target.direction.map((v) => v * DIST), [target])

  useFrame(({ camera }, dt) => {
    const want = atmosphereFor(useStore.getState().timePreset), A = atmosphereNow, k = instant ? 1 : Math.min(1, dt * 1.5)
    for (const key of ['skyGain', 'sunScale', 'turbidity', 'rayleigh', 'fogScale', 'snow', 'ice', 'overcast']) A[key] = ease(A[key], want[key], k)
    A.skyTint = A.skyTint.map((v, i) => ease(v, want.skyTint[i], k))
    A.fogMix = ease(A.fogMix, want.fogTint ? 0.75 : 0, k)
    if (want.fogTint) A.tint.lerp(tmpTint.set(want.fogTint), k)
    cur.current = instant ? target.direction.slice() : stepSun(cur.current, target.direction, Math.min(dt, 0.1))
    sunRef.current = cur.current
    const [x, y, z] = cur.current
    const elev = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI
    const p = paletteFor(elev)
    sky.current?.material.uniforms.sunPosition.value.set(x * DIST, y * DIST, z * DIST)
    if (sky.current) { const u = sky.current.material.uniforms; u.turbidity.value = A.turbidity; u.rayleigh.value = A.rayleigh; u.mieDirectionalG.value = 0.82 - 0.55 * A.overcast /* cloud hides the sun's disc */; applySkyGain(sky.current.material, A.skyGain, A.skyTint) }
    const lightScale = (1 - 0.6 * A.overcast) * A.sunScale // an overcast sky dims the sun and flattens the shadows
    if (light.current) {
      // shadows cover the area around the camera target (snapped to 50 m so they don't swim)
      const r = useStore.getState().readout
      const fx = Math.round((r.x ?? 0) / 50) * 50, fz = Math.round((r.z ?? 0) / 50) * 50
      light.current.target.position.set(fx, 0, fz)
      light.current.target.updateMatrixWorld()
      light.current.position.set(fx + x * DIST, Math.max(y, 0.02) * DIST, fz + z * DIST)
      light.current.color.copy(p.sunColor)
      light.current.intensity = p.sunIntensity * p.exposure * lightScale
    }
    if (hemi.current) { hemi.current.color.copy(p.hemiSky); hemi.current.groundColor.copy(p.hemiGround); hemi.current.intensity = p.hemiIntensity * p.exposure * (1 + 0.6 * A.overcast) } // overcast (and snow) light comes from the whole sky
    const fogCol = tmpFog.copy(p.fog).lerp(A.tint, A.fogMix * (1 - p.night * 0.7))
    if (scene.fog) { scene.fog.color.copy(fogCol); scene.fog.near = fog[0] * A.fogScale; scene.fog.far = fog[1] * Math.max(0.6, A.fogScale) }
    if (scene.background?.isColor) scene.background.copy(fogCol)
    facadeUniforms.uNight.value = p.night
    if (stars.current) { stars.current.position.copy(camera.position); stars.current.visible = p.stars > 0.05 && A.overcast < 0.4 } // no stars under cloud
    if (sky.current) sky.current.visible = p.night < 0.98
    window.__skyRest = skyRest.current.sample(cur.current)
  })

  return (
    <>
      <Sky ref={sky} sunPosition={envSun} turbidity={3.2} rayleigh={1.2} mieCoefficient={0.003} mieDirectionalG={0.82} distance={45000} />
      <Stars ref={stars} radius={20000} depth={2000} count={6000} factor={120} saturation={0} fade speed={0.3} />
      <fog attach="fog" args={['#b4c6d6', fog[0], fog[1]]} />
      <color attach="background" args={['#04070e']} />
      <hemisphereLight ref={hemi} args={['#cfe1f5', '#5e5850', 1]} />
      <directionalLight
        ref={light}
        castShadow
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-2400}
        shadow-camera-right={2400}
        shadow-camera-top={2400}
        shadow-camera-bottom={-2400}
        shadow-camera-near={100}
        shadow-camera-far={12000}
      />
      {/* Sky-lit reflections for glass + river, captured deterministically every ~2° of sun */}
      <SkyEnvironment direction={target.direction} gain={SKY_GAIN} />
    </>
  )
}
