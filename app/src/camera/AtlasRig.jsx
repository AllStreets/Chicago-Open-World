// app/src/camera/AtlasRig.jsx — FLY / ORBIT camera over the city.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { clampCamera, glideVector, headingDeg, MAX_DIST } from '../lib/cameraMath.js'
import { bookmarkFromUrl } from '../lib/bookmarks.js'
import { introPose, INTRO_SECONDS } from '../lib/introPath.js'
import { crossStreets } from '../lib/grid.js'

const GLIDE_MPS = 140
const BOOST = 3
const ORBIT_RAD_PER_S = (4 * Math.PI) / 180
const ROTATE_RAD_PER_S = 1.2
const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3()

export default function AtlasRig() {
  const ref = useRef()
  const keys = useRef(new Set())
  const lastReadout = useRef(0)
  const mode = useStore((s) => s.cameraMode)
  const setReadout = useStore((s) => s.setReadout)
  const setCameraMode = useStore((s) => s.setCameraMode)

  const introDone = useStore((s) => s.introDone)
  const introStart = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const playIntro = !params.has('view') && !reduced && !useStore.getState().introDone
    if (!playIntro) {
      useStore.getState().finishIntro()
      const b = bookmarkFromUrl(window.location.search)
      ref.current?.setLookAt(...b.position, ...b.target, false)
      return
    }
    const p0 = introPose(0)
    ref.current?.setLookAt(...p0.position, ...p0.target, false)
    const skip = () => {
      if (useStore.getState().introDone) return
      const e = introPose(1)
      ref.current?.setLookAt(...e.position, ...e.target, false)
      useStore.getState().finishIntro()
    }
    const evs = ['keydown', 'pointerdown', 'wheel']
    evs.forEach((ev) => window.addEventListener(ev, skip, { once: true }))
    return () => evs.forEach((ev) => window.removeEventListener(ev, skip))
  }, [])

  useEffect(() => {
    const typing = (e) => ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)
    const down = (e) => { if (!typing(e)) keys.current.add(e.code) }
    const up = (e) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [])

  useFrame((state, dt) => {
    const c = ref.current
    if (!c) return
    if (!useStore.getState().introDone) {
      if (!useStore.getState().load.ready) return // hold on the opening frame while the city streams in
      introStart.current ??= state.clock.elapsedTime
      const t = (state.clock.elapsedTime - introStart.current) / INTRO_SECONDS
      const p = introPose(t)
      c.setLookAt(...p.position, ...p.target, false)
      if (t >= 1) useStore.getState().finishIntro()
      publishReadout(c, state.clock.elapsedTime)
      return
    }
    const k = keys.current
    const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? BOOST : 1
    const [dx, dz] = glideVector(k, c.azimuthAngle)
    const anyInput = dx || dz || k.has('ArrowUp') || k.has('ArrowDown') || k.has('ArrowLeft') || k.has('ArrowRight')
    if (anyInput && mode === 'ORBIT') setCameraMode('FLY')
    if (dx || dz) {
      const alt = c.camera.position.y
      const speed = GLIDE_MPS * boost * Math.max(0.5, alt / 250) * dt
      c.getTarget(tmpT); c.getPosition(tmpP)
      c.setLookAt(tmpP.x + dx * speed, tmpP.y, tmpP.z + dz * speed, tmpT.x + dx * speed, tmpT.y, tmpT.z + dz * speed, false)
    }
    if (k.has('ArrowUp')) c.rotate(0, -ROTATE_RAD_PER_S * 0.5 * dt, false)
    if (k.has('ArrowDown')) c.rotate(0, ROTATE_RAD_PER_S * 0.5 * dt, false)
    if (k.has('ArrowLeft')) c.rotate(ROTATE_RAD_PER_S * dt, 0, false)
    if (k.has('ArrowRight')) c.rotate(-ROTATE_RAD_PER_S * dt, 0, false)
    if (mode === 'ORBIT') c.rotate(ORBIT_RAD_PER_S * dt, 0, false)

    c.getTarget(tmpT); c.getPosition(tmpP)
    const cl = clampCamera(tmpP.toArray(), tmpT.toArray())
    if (cl.clamped) {
      c.setLookAt(...cl.position, ...cl.target, false)
    }

    publishReadout(c, state.clock.elapsedTime)
  })

  function publishReadout(c, t) {
    if (t - lastReadout.current <= 0.2) return
    lastReadout.current = t
    c.getTarget(tmpT); c.getPosition(tmpP)
    setReadout({ streets: crossStreets(tmpT.x, tmpT.z), altitude: Math.round(tmpP.y), heading: headingDeg(c.azimuthAngle), x: tmpT.x, z: tmpT.z })
  }

  return (
    <CameraControls
      ref={ref}
      makeDefault
      enabled={introDone}
      minDistance={60}
      maxDistance={MAX_DIST}
      maxPolarAngle={Math.PI * 0.47}
      dollyToCursor
      smoothTime={0.35}
      draggingSmoothTime={0.15}
    />
  )
}
