// app/src/camera/AtlasRig.jsx — the camera people drive: keyboard, mouse, dock buttons, ⌘K fly-overs.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { clampCamera, glideVector, headingDeg, slideMove, MAX_DIST, WORLD_BOUNDS } from '../lib/cameraMath.js'
import { BOOKMARKS, bookmarkFromUrl } from '../lib/bookmarks.js'
import { introPose, INTRO_SECONDS } from '../lib/introPath.js'
import { crossStreets } from '../lib/grid.js'
import { keyIntent } from '../lib/controls.js'
import { flyPose, flightDuration, flightLift, liftAboveRoofs } from '../lib/flight.js'
import { clearanceAt } from '../lib/clearance.js'
import { createRestTracker } from '../lib/rest.js'
import { VIEW_ORDER, VIEW_NAMES } from '../lib/views.js'
import { followStep, shouldExitFollow } from '../transit/followCam.js'
import { getTrains, getSim } from '../transit/simStore.js'
import { ensureClear } from '../lib/poseClearance.js'
import { FEATURE_CONTROLS } from '../hud/featureControls.js'
import { tourById, tourPoses, tourClock } from '../lib/tourPoses.js'
import { tourAt } from '../lib/tour.js'
import { sessionActive, beginSession, endSession, frame as rideFrame, rideDefById, addLook } from '../ride/rideSession.js'
import { stopRide, handleRideKey } from '../ride/rideActions.js'

// keys that move the camera: during a tour they hand control back (and offer to resume)
const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'PageUp', 'PageDown', 'Equal', 'Minus']

// keys that leave a flight running: the time-of-day brackets, help, and every city-life toggle
const KEEP_FLIGHT = ['BracketLeft', 'BracketRight', 'KeyH', ...FEATURE_CONTROLS.map((c) => c.key)]

const GLIDE_MPS = 140
const BOOST = 3
const ORBIT_RAD_PER_S = (4 * Math.PI) / 180
const TURN_RAD_PER_S = 1.2
const TILT_RAD_PER_S = 0.6
const CLIMB_MPS = 120
const ZOOM_MPS = 400
const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3()
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3()
const pose = (c) => { c.getTarget(tmpT); c.getPosition(tmpP); return { position: tmpP.toArray(), target: tmpT.toArray() } }

export default function AtlasRig() {
  const ref = useRef()
  const keys = useRef(new Set())
  const tourPosesRef = useRef({ id: null, poses: [] })
  const followLast = useRef(null) // the followed train's line and position (P5: survives a live/simulated switch)
  const lastReadout = useRef(0)
  const flightRun = useRef(null)
  const introStart = useRef(null)
  const camRest = useRef(createRestTracker({ frames: 20, eps: 1e-3 }))
  const { gl, camera } = useThree()
  const mode = useStore((s) => s.cameraMode)
  const introDone = useStore((s) => s.introDone)
  const flight = useStore((s) => s.flight)
  const flyTo = useStore((s) => s.flyTo)
  const cam = useStore((s) => s.cam)
  const riding = useStore((s) => Boolean(s.ride))
  const reducedMotion = useRef(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

  // P7: during a ride the ride owns the camera — no orbit input, and the street-level horizon is allowed
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.enabled = introDone && !riding
    c.maxPolarAngle = riding ? Math.PI * 0.999 : Math.PI * 0.47
    c.minDistance = riding ? 0.5 : 60
  }, [introDone, riding])

  // Opening: intro flight for real visitors; ?view= (tests) jumps straight to a pose.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const playIntro = !params.has('view') && !params.has('pose') && !reduced && !useStore.getState().introDone
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

  // Held keys (continuous) + one-shot keys (views, home, north).
  useEffect(() => {
    const typing = (e) => ['INPUT', 'TEXTAREA'].includes(e.target?.tagName) || useStore.getState().paletteOpen
    const down = (e) => {
      if (typing(e) || e.metaKey || e.ctrlKey) return
      const st0 = useStore.getState()
      if (st0.ride) { // P7: Esc or a movement key leaves a path ride; the glide steers with the arrows
        if (e.code === 'Escape') { stopRide(); return }
        if (handleRideKey(e)) { e.preventDefault(); return }
        if (st0.ride.kind !== 'glide' && MOVE_KEYS.includes(e.code)) { stopRide(); return }
      }
      if (st0.follow && shouldExitFollow(e)) { st0.stopFollow(); return } // any key takes back control
      if (st0.tour && MOVE_KEYS.includes(e.code)) { useStore.setState({ tourResume: { ...st0.tour, t: tourClock.t } }); st0.setTour(null) } // a movement key takes back the camera
      keys.current.add(e.code)
      if (e.code.startsWith('Arrow') || e.code === 'PageUp' || e.code === 'PageDown') e.preventDefault()
      const s = useStore.getState()
      if (e.code === 'BracketRight') s.camCommand('view', 1)
      else if (e.code === 'BracketLeft') s.camCommand('view', -1)
      else if (e.code === 'KeyH') s.camCommand('home')
      else if (e.code === 'KeyN') s.camCommand('north')
      else if (e.key === '?') s.setHelpOpen(!s.helpOpen)
      else if (e.code === 'Escape') { s.setHelpOpen(false); s.clearFlight() }
      if (flightRun.current && !KEEP_FLIGHT.includes(e.code)) s.clearFlight() // any other key takes back control
    }
    const up = (e) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [])

  // Mouse: grabbing the city cancels a flight; double-click flies to the spot.
  useEffect(() => {
    const el = gl.domElement
    let drag = null // P7: during a ride, dragging looks around instead of moving the camera
    const cancel = (e) => {
      const s = useStore.getState()
      if (s.ride) { if (e?.type === 'pointerdown') drag = { x: e.clientX, y: e.clientY }; return }
      if (flightRun.current) s.clearFlight(); if (s.follow) s.stopFollow()
    }
    const move = (e) => { if (!drag) return; addLook(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY } }
    const up = () => { drag = null }
    const dbl = (e) => {
      const c = ref.current
      if (!c || useStore.getState().ride) return
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (!ray.ray.intersectPlane(ground, hit)) return
      const cur = pose(c)
      const off = cur.position.map((v, i) => v - cur.target[i])
      const scale = Math.min(1, 700 / Math.hypot(...off)) // move in closer, keep the viewing angle
      useStore.getState().startFlight({ target: [hit.x, 0, hit.z], position: [hit.x + off[0] * scale, Math.max(60, off[1] * scale), hit.z + off[2] * scale] }, crossStreets(hit.x, hit.z, useStore.getState().isWater ?? undefined))
    }
    el.addEventListener('pointerdown', cancel)
    el.addEventListener('wheel', cancel, { passive: true })
    el.addEventListener('dblclick', dbl)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { el.removeEventListener('pointerdown', cancel); el.removeEventListener('wheel', cancel); el.removeEventListener('dblclick', dbl); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [gl, camera])

  // Minimap click → fly there, keeping the current viewing angle.
  useEffect(() => {
    if (!flyTo || !ref.current) return
    const cur = pose(ref.current)
    const off = cur.position.map((v, i) => v - cur.target[i])
    useStore.getState().startFlight({ target: [flyTo.x, cur.target[1], flyTo.z], position: [flyTo.x + off[0], cur.position[1], flyTo.z + off[2]] }, crossStreets(flyTo.x, flyTo.z, useStore.getState().isWater ?? undefined))
    useStore.getState().clearFlyTo()
  }, [flyTo])

  // Dock buttons and one-shot keys.
  useEffect(() => {
    const c = ref.current
    if (!cam || !c) return
    const s = useStore.getState()
    if (cam.type === 'zoom') c.dolly(cam.amount * Math.max(80, c.distance * 0.3), true)
    else if (cam.type === 'turn') c.rotate(cam.amount * (Math.PI / 8), 0, true)
    else if (cam.type === 'tilt') c.rotate(0, cam.amount * (Math.PI / 16), true)
    else if (cam.type === 'north') c.rotateAzimuthTo(0, true)
    else if (cam.type === 'home') s.startFlight(BOOKMARKS.streeterville, 'Home')
    else if (cam.type === 'view') {
      const i = (s.viewIndex + cam.amount + VIEW_ORDER.length) % VIEW_ORDER.length
      s.setViewIndex(i)
      s.startFlight(BOOKMARKS[VIEW_ORDER[i]], VIEW_NAMES[VIEW_ORDER[i]])
    }
  }, [cam])

  // A new flight request: remember where we start.
  useEffect(() => {
    if (!flight || !ref.current) { flightRun.current = null; return }
    const from = pose(ref.current)
    const to = liftAboveRoofs(flight.to, clearanceAt)
    flightRun.current = { from, to, t0: null, dur: flightDuration(from, to), lift: flightLift(from, to, clearanceAt) }
    if (useStore.getState().cameraMode === 'ORBIT') useStore.getState().setCameraMode('FLY')
  }, [flight])

  useFrame((state, dt) => {
    const c = ref.current
    if (!c) return
    const now = state.clock.elapsedTime
    if (!useStore.getState().introDone) {
      if (!useStore.getState().load.ready) { publishReadout(c, now); window.__camRest = false; return } // hold the opening frame, but tell the streamer where we are
      introStart.current ??= now
      const t = (now - introStart.current) / INTRO_SECONDS
      const p = introPose(t)
      c.setLookAt(...p.position, ...p.target, false)
      if (t >= 1) useStore.getState().finishIntro()
      publishReadout(c, now)
      window.__camRest = false
      return
    }
    // P7: a ride drives the camera (its session starts here, where the camera is, so a train boards at the nearest stop)
    const rideNow = useStore.getState().ride
    if (rideNow) {
      if (!sessionActive()) { const def = rideDefById(rideNow.id); if (def) beginSession(def, pose(c)); else useStore.setState({ ride: null }) }
      const rp = sessionActive() ? rideFrame(dt, { keys: keys.current, tunnels: Boolean(state.scene.getObjectByName('tunnels')), clearance: clearanceAt, reducedMotion: reducedMotion.current }) : null
      if (rp) { c.setLookAt(...rp.position, ...rp.target, false); publishReadout(c, now); window.__camRest = false; return }
    } else if (sessionActive()) endSession()
    const fw = useStore.getState().follow
    if (fw) {
      const st = useStore.getState()
      const lookup = (id) => (String(id).startsWith('rn:') ? null : getSim()?.trainById(id, Date.now()))
      const r = st.transitOn ? followStep({ ...fw, last: followLast.current }, getTrains(), undefined, lookup) : { ended: null }
      if (r.ended !== undefined) { followLast.current = null; st.stopFollow(r.ended) } // transit switched off: stop quietly
      else {
        followLast.current = { line: r.train.line, p: r.train.head.p }
        if (r.retarget) useStore.setState({ follow: { ...fw, trainId: r.retarget } }) // live ↔ simulated switch: same line, nearest train
        const cp = ensureClear(r.pose); c.setLookAt(...cp.position, ...cp.target, true); publishReadout(c, now); window.__camRest = false; return // smoothed by camera-controls
      }
    }
    // a guided tour drives the camera: its own clock, pushed to the store a few times a second for the tour bar
    const tr = useStore.getState().tour
    if (tr) {
      const def = tourById(tr.id)
      if (!def) { useStore.getState().setTour(null); return }
      if (tourPosesRef.current.id !== tr.id) tourPosesRef.current = { id: tr.id, poses: tourPoses(def, useStore.getState().manifest) }
      if (tr.from === undefined) { useStore.getState().setTour({ ...tr, from: pose(c) }); return } // the tour flies in from here
      if (tr.playing) tourClock.t += dt
      if (Math.abs(tourClock.t - tr.t) > 0.25) useStore.getState().setTour({ ...tr, t: tourClock.t })
      const at = tourAt(def, tourPosesRef.current.poses, tourClock.t, tr.from)
      const p = liftAboveRoofs(at.pose, clearanceAt)
      c.setLookAt(...p.position, ...p.target, false)
      if (at.done) useStore.getState().setTour({ ...useStore.getState().tour, playing: false }) // hold the last stop until Exit
      publishReadout(c, now)
      window.__camRest = false
      return
    }
    const f = flightRun.current
    if (f) {
      f.t0 ??= now
      const t = (now - f.t0) / f.dur
      const p = liftAboveRoofs(flyPose(f.from, f.to, t, f.lift), clearanceAt)
      c.setLookAt(...p.position, ...p.target, false)
      if (t >= 1) { flightRun.current = null; useStore.getState().clearFlight() }
      publishReadout(c, now)
      window.__camRest = false
      return
    }

    const intent = keyIntent(keys.current)
    const [fwd, right] = intent.move
    const moving = fwd || right || intent.turn || intent.tilt || intent.climb || intent.zoom
    if (moving && mode === 'ORBIT') useStore.getState().setCameraMode('FLY')
    if (fwd || right || intent.climb) {
      const alt = c.camera.position.y
      const speed = GLIDE_MPS * (intent.boost ? BOOST : 1) * Math.max(0.5, alt / 250) * dt
      const keysForGlide = new Set([fwd > 0 && 'KeyW', fwd < 0 && 'KeyS', right > 0 && 'KeyD', right < 0 && 'KeyA'].filter(Boolean))
      const [dx, dz] = glideVector(keysForGlide, c.azimuthAngle)
      const dy = intent.climb * CLIMB_MPS * Math.max(0.6, alt / 300) * dt
      c.getTarget(tmpT); c.getPosition(tmpP)
      const [mx, my, mz] = slideMove([tmpP.x, tmpP.y, tmpP.z], [dx * speed, dy, dz * speed], clearanceAt)
      c.setLookAt(tmpP.x + mx, tmpP.y + my, tmpP.z + mz, tmpT.x + mx, Math.max(0, tmpT.y + my), tmpT.z + mz, false)
    }
    if (intent.turn) c.rotate(-intent.turn * TURN_RAD_PER_S * dt, 0, false)
    if (intent.tilt) c.rotate(0, intent.tilt * TILT_RAD_PER_S * dt, false) // tilt up = toward the horizon
    if (intent.zoom) c.dolly(intent.zoom * ZOOM_MPS * Math.max(0.5, c.distance / 800) * dt, false)
    if (mode === 'ORBIT') c.rotate(ORBIT_RAD_PER_S * dt, 0, false)

    c.getTarget(tmpT); c.getPosition(tmpP)
    const cl = clampCamera(tmpP.toArray(), tmpT.toArray(), WORLD_BOUNDS)
    // drag, scroll and dock zoom can't push the camera into a tower either
    const floor = clearanceAt(cl.position[0], cl.position[2])
    if (cl.position[1] < floor) { cl.position[1] = floor; cl.clamped = true }
    if (cl.clamped) c.setLookAt(...cl.position, ...cl.target, false)
    publishReadout(c, now)
    c.getTarget(tmpT); c.getPosition(tmpP)
    window.__camRest = camRest.current.sample([tmpP.x, tmpP.y, tmpP.z, tmpT.x, tmpT.y, tmpT.z])
  })

  function publishReadout(c, t) {
    if (t - lastReadout.current <= 0.2) return
    lastReadout.current = t
    c.getTarget(tmpT); c.getPosition(tmpP)
    useStore.getState().setReadout({ streets: crossStreets(tmpT.x, tmpT.z, useStore.getState().isWater ?? undefined), altitude: Math.round(tmpP.y), heading: headingDeg(c.azimuthAngle), x: tmpT.x, z: tmpT.z })
  }

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={60}
      maxDistance={MAX_DIST}
      maxPolarAngle={Math.PI * 0.47}
      dollyToCursor
      smoothTime={0.35}
      draggingSmoothTime={0.15}
    />
  )
}
