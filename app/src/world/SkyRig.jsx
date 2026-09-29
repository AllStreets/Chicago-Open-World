// app/src/world/SkyRig.jsx — the living sky: tweened sun, palette-driven light, stars, sky reflections.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import SkyEnvironment from './SkyEnvironment.jsx'
import { paletteFor } from '../lib/skyPalette.js'
import { stepSun } from '../lib/sunTween.js'
import { facadeUniforms } from './materials/facadeMaterial.js'
import { applySkyGain } from './materials/skyGain.js'

const SKY_GAIN = 0.42

const DIST = 5000

export default function SkyRig({ target, sunRef, instant = false, shadowMap = 4096, fog = [2600, 17000] }) {
  const { scene } = useThree()
  const sky = useRef(), light = useRef(), hemi = useRef(), stars = useRef()
  useEffect(() => { if (sky.current) applySkyGain(sky.current.material, SKY_GAIN) }, [])
  const cur = useRef(target.direction.slice())
  if (!sunRef.current) sunRef.current = cur.current
  const envSun = useMemo(() => target.direction.map((v) => v * DIST), [target])

  useFrame(({ camera }, dt) => {
    cur.current = instant ? target.direction.slice() : stepSun(cur.current, target.direction, Math.min(dt, 0.1))
    sunRef.current = cur.current
    const [x, y, z] = cur.current
    const elev = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI
    const p = paletteFor(elev)
    sky.current?.material.uniforms.sunPosition.value.set(x * DIST, y * DIST, z * DIST)
    if (light.current) {
      light.current.position.set(x * DIST, Math.max(y, 0.02) * DIST, z * DIST)
      light.current.color.copy(p.sunColor)
      light.current.intensity = p.sunIntensity * p.exposure
    }
    if (hemi.current) { hemi.current.color.copy(p.hemiSky); hemi.current.groundColor.copy(p.hemiGround); hemi.current.intensity = p.hemiIntensity * p.exposure }
    if (scene.fog) scene.fog.color.copy(p.fog)
    if (scene.background?.isColor) scene.background.copy(p.fog)
    facadeUniforms.uNight.value = p.night
    if (stars.current) { stars.current.position.copy(camera.position); stars.current.visible = p.stars > 0.05 }
    if (sky.current) sky.current.visible = p.night < 0.98
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
