// app/src/world/SkyEnvironment.jsx — deterministic sky reflections for glass and water.
// Captures a dedicated sky scene through PMREM whenever the sun moves ~2° (envKey).
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from 'three-stdlib'
import { applySkyGain } from './materials/skyGain.js'
import { paletteFor } from '../lib/skyPalette.js'
import { envKey } from '../lib/envKey.js'
import { useStore } from '../state/store.js'
import { atmosphereFor } from '../lib/atmosphere.js'
import { applyWeather, sunVeil } from '../weather/weatherState.js'

// the weather's veil over the sun, in quarter steps: a change recaptures the reflections without the sun's disc
const veilOf = (s) => Math.round(sunVeil(applyWeather(atmosphereFor(s.timePreset), s.weather, s.weatherMode, s.timePreset, s.quality)) * 4) / 4

export default function SkyEnvironment({ direction, gain }) {
  const { gl, scene } = useThree()
  const rig = useMemo(() => {
    const envScene = new THREE.Scene()
    const sky = new Sky()
    sky.scale.setScalar(1000)
    sky.material.uniforms.turbidity.value = 3.2
    sky.material.uniforms.rayleigh.value = 1.2
    sky.material.uniforms.mieCoefficient.value = 0.003
    sky.material.uniforms.mieDirectionalG.value = 0.82
    applySkyGain(sky.material, gain)
    const nightMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false })
    const night = new THREE.Mesh(new THREE.SphereGeometry(900, 16, 8), nightMat)
    envScene.add(sky, night)
    return { envScene, sky, nightMat, pmrem: new THREE.PMREMGenerator(gl), rt: null }
  }, [gl, gain])

  const key = envKey(direction)
  const veil = useStore(veilOf)
  useEffect(() => {
    const [x, y, z] = direction
    rig.sky.material.uniforms.sunPosition.value.set(x, y, z).multiplyScalar(5000)
    applySkyGain(rig.sky.material, gain, null, null, 1 - veil) // glass and water don't mirror a sun hidden by rain or fog
    const p = paletteFor((Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI)
    rig.nightMat.color.copy(p.fog)
    rig.nightMat.opacity = p.night * 0.95
    const rt = rig.pmrem.fromScene(rig.envScene, 0, 1, 3000)
    rig.rt?.dispose()
    rig.rt = rt
    scene.environment = rt.texture
  }, [key, veil]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { rig.rt?.dispose(); rig.pmrem.dispose(); scene.environment = null }, [rig, scene])
  return null
}
