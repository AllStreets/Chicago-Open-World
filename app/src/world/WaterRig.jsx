// app/src/world/WaterRig.jsx — drives the one water material: colours from the sky, the green-river date,
// and the ONLY planar reflection pass (mirrored camera, REFLECT_LAYER only, no shadow re-render, ½ res at HIGH).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { QUALITY } from '../lib/quality.js'
import { waterPalette, isGreenRiverDay } from '../lib/waterPalette.js'
import { waterUniforms, REFLECT_LAYER, WATER_PLANE_Y, loadWaterTextures } from './materials/waterSurface.js'
import { mirrorCamera, textureMatrixFor } from './water/mirror.js'

const elevOf = (s) => (Math.asin(Math.max(-1, Math.min(1, s[1]))) * 180) / Math.PI

export default function WaterRig({ sunRef, shore, version }) {
  const { gl, scene, camera, size } = useThree()
  const forcedOff = useMemo(() => new URLSearchParams(window.location.search).get('reflect') === '0', []) // tests only
  const scale = forcedOff ? 0 : QUALITY[useStore((s) => s.quality)].reflection
  const rt = useMemo(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), [])
  const mirror = useMemo(() => { const c = new THREE.PerspectiveCamera(); c.layers.set(REFLECT_LAYER); return c }, [])
  const green = useRef({ at: -Infinity })

  useEffect(() => { loadWaterTextures(shore, version) }, [shore, version])
  useEffect(() => {
    if (!scale) return
    const pr = gl.getPixelRatio()
    rt.setSize(Math.max(1, Math.floor(size.width * pr * scale)), Math.max(1, Math.floor(size.height * pr * scale)))
  }, [scale, size, gl, rt])
  useEffect(() => () => rt.dispose(), [rt])

  useFrame(({ clock }, dt) => {
    const u = waterUniforms, s = sunRef.current
    u.uTime.value += dt * 0.35
    if (s) {
      const p = waterPalette(elevOf(s))
      u.uDeep.value.copy(p.deep); u.uShallow.value.copy(p.shallow); u.uHorizon.value.copy(p.horizon); u.uSky.value.copy(p.sky)
      u.uFoam.value.copy(p.foam); u.uGreenColor.value.copy(p.green); u.uSunColor.value.copy(p.sunColor); u.uNight.value = p.night
      u.uSunDir.value.set(s[0], s[1], s[2])
    }
    if (scene.fog) u.uFar.value.set(scene.fog.near, scene.fog.far)
    if (clock.elapsedTime - green.current.at > 60) { green.current.at = clock.elapsedTime; u.uGreen.value = isGreenRiverDay() ? 1 : 0 }
    u.uReflect.value = scale ? 1 : 0
    if (!scale) return
    mirrorCamera(camera, WATER_PLANE_Y, mirror)
    textureMatrixFor(mirror, u.uTextureMatrix.value)
    const prev = gl.getRenderTarget(), autoShadow = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false // reuse this frame's shadow map; never render the shadow pass twice
    gl.setRenderTarget(rt)
    gl.clear()
    gl.render(scene, mirror)
    gl.setRenderTarget(prev)
    gl.shadowMap.autoUpdate = autoShadow
    u.uReflection.value = rt.texture
  })
  return null
}
