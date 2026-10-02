// app/src/traffic/Traffic.jsx — draws the traffic sim (sim.js): one instanced mesh each for cars, buses and trucks,
// one for every head- and tail-lamp pair (lit after dusk, tail lamps brighter under braking), and the traffic signals
// within range — poles in one mesh, the lit lamps in another. Six draw calls; the sim runs within ~1.5 km.
// D3-2: vehicles ride at their roadway's height — up and down the ramps, on Lower Wacker and the other lower decks
// (the same six meshes: no extra draw call). Those under the street are drawn only while the lower decks are
// (LowerLevels.jsx: the U cut-away, a ride, or a low camera close by), with their headlights on at any hour. Every
// vehicle waits short of a raised bascule (or one about to lift) and none is left on a rising leaf.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { worldUrl } from '../lib/manifest.js'
import { QUALITY } from '../lib/quality.js'
import { chicagoClock } from '../lib/chicagoTime.js'
import { presetDate } from '../lib/sun.js'
import { isCutOpen, cutUniforms, portalOpenDepth } from '../world/materials/cutaway.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { lowerShared } from '../world/LowerLevels.jsx'
import { shownPieces } from '../world/lowerLevels.js'
import { liveLift } from '../bridges/BridgeLeaves.jsx'
import { vehiclePose } from '../ride/rideSession.js'
import { decodeRoadGraph, buildNetwork, pointOnLink, bridgeCrossings, closedBridges, deckHides, hiddenAt, DEEP_M } from './graph.js'
import { createTraffic, TYPES, CAP, RANGE_M } from './sim.js'
import { skipInCube } from '../landmarks/cubeFaces.js'
import { carGeometry, busGeometry, truckGeometry, lampGeometry, signalPoleGeometry, SIGNAL_LAMP_Y, SIGNAL_RGB, PAINTS } from './models.js'

const IDLE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('traffic') === 'idle'

const ROAD_Y = 0.13 // on the road ribbons (pipeline GROUND_Y.roads 0.12); a vehicle's own y is measured from here
const RIBBON_Y = 0.12 // pipeline GROUND_Y.roads: the street the link heights are measured from
const UNDER_DECK_M = -1.5 // under the street's slab: headlights on at any hour
const RAISED_RAD = 0.02 // a leaf this far off its deck has nobody on it
const PORTAL_EDGE_M = 0.5 // D4-1: a street car this far over a ramp portal's opening is not drawn (the street is open there)
const PORTAL_TAIL_M = 3 // … and a ramp's vehicles are drawn in its open trench (and just into the tunnel's dark) whatever the decks do
const RIDE_CLEAR_M = 9 // half the ride bus plus a car
const UNDER_CAM_M = -0.5 // the camera itself is under the street (a drive, the Riverwalk at river level)
const LOWER_NEAR_M = 450 // from down there the roadway falls into the dark within a few hundred metres
const REFRESH_S = 1, SIGNAL_MAX = 2400
const VEHICLE_CAP = { car: 3500, bus: 300, truck: 800 } // ULTRA's 3200 plus the lower decks' share
const LAMP_CAP = (VEHICLE_CAP.car + VEHICLE_CAP.bus + VEHICLE_CAP.truck) * 2

// the hour the scene shows: the live Chicago clock, or the time a preset stands for
export function sceneHour(preset, now = new Date()) {
  const c = chicagoClock(preset === 'LIVE' ? now : presetDate(preset, now))
  return c.hour + c.minute / 60
}

// a lamp pair as a camera-facing glow at the vehicle's nose or tail, lit only from the side it points to.
// instanceMatrix: x axis = the way the lamps point, y scale = glow size, z scale = the vehicle's width
const LAMP_VERT = /* glsl */ `
attribute float aKind;
attribute float aGain;
varying vec2 vUv;
varying float vKind;
varying float vGain;
void main() {
  vUv = uv; vKind = aKind;
  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 fwd = normalize(instanceMatrix[0].xyz);
  float grow = max(1.0, length(cameraPosition - (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz) / 110.0); // a few pixels at any range
  float size = length(instanceMatrix[1].xyz) * grow, width = length(instanceMatrix[2].xyz) * min(grow, 2.0);
  float facing = dot(fwd, normalize(cameraPosition - c));
  vGain = aGain * smoothstep(-0.05, 0.35, facing);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = c + right * position.x * (width + size) + up * position.y * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`
const LAMP_FRAG = /* glsl */ `
uniform float uNight;
varying vec2 vUv;
varying float vKind;
varying float vGain;
void main() {
  vec2 a = (vUv - vec2(0.25, 0.5)) * vec2(2.0, 1.0), b = (vUv - vec2(0.75, 0.5)) * vec2(2.0, 1.0);
  float g = exp(-dot(a, a) * 18.0) + exp(-dot(b, b) * 18.0) + 0.25 * exp(-dot(vUv - 0.5, vUv - 0.5) * 6.0);
  vec3 col = vKind < 0.5 ? vec3(1.0, 0.9, 0.72) * 2.4 : vec3(1.0, 0.07, 0.03) * 1.8;
  float k = vGain * g;
  if (k < 0.01) discard;
  gl_FragColor = vec4(col * k, 1.0);
}`

function lampMaterial() {
  return new THREE.ShaderMaterial({ vertexShader: LAMP_VERT, fragmentShader: LAMP_FRAG, uniforms: { uNight: facadeUniforms.uNight }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })
}

function instanced(geometry, material, cap, colours = false) {
  const m = new THREE.InstancedMesh(geometry, material, cap)
  m.count = 0
  m.frustumCulled = false // instances span the range; the count is the limit
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  if (colours) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage) }
  m.raycast = () => {}
  return m
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), col = new THREE.Color()
const paints = PAINTS.map((c) => new THREE.Color(c))

export default function Traffic({ file, version }) {
  const on = useStore((s) => s.trafficOn)
  const quality = useStore((s) => s.quality)
  const state = useRef({ net: null, sim: null, last: -1e9, lastSig: -1e9, signals: [], simMs: 0 })
  const meshes = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 })
    const out = {
      car: instanced(carGeometry(), mat, VEHICLE_CAP.car, true),
      bus: instanced(busGeometry(), mat, VEHICLE_CAP.bus, true),
      truck: instanced(truckGeometry(), mat, VEHICLE_CAP.truck, true),
      lamps: instanced(lampGeometry(), lampMaterial(), LAMP_CAP),
      poles: instanced(signalPoleGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.3 }), SIGNAL_MAX),
      sigLamps: instanced(new THREE.PlaneGeometry(0.3, 0.3).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ toneMapped: false }), SIGNAL_MAX, true),
    }
    const lg = out.lamps.geometry, cap = LAMP_CAP
    lg.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage))
    lg.setAttribute('aGain', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage))
    out.lamps.renderOrder = 3
    return out
  }, [])

  useEffect(() => {
    if (!file) return
    let dead = false
    fetch(worldUrl(file, version)).then((r) => (r.ok ? r.arrayBuffer() : null)).then((buf) => {
      if (dead || !buf) return
      const net = buildNetwork(decodeRoadGraph(buf))
      state.current.net = net
      state.current.decks = null
      // the raised-bridge holds (bridges.json, the same file the leaves come from)
      const bf = useStore.getState().manifest?.bridges
      if (bf) fetch(worldUrl(bf, version)).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!dead && j && state.current.net === net) bridgeCrossings(net, j.bridges) }).catch(() => {})
      state.current.sim = createTraffic(net, { cap: CAP[useStore.getState().quality] ?? CAP.HIGH })
      state.current.last = -1e9
      if (new URLSearchParams(window.location.search).has('stats')) window.__traffic = state.current
    }).catch(() => {})
    return () => { dead = true }
  }, [file, version])
  useEffect(() => { state.current.sim?.setCap(CAP[quality] ?? CAP.HIGH) }, [quality])
  useEffect(() => () => { for (const m of Object.values(meshes)) { m.geometry.dispose(); m.material.dispose() } }, [meshes])
  useEffect(() => skipInCube([meshes.car, meshes.bus, meshes.truck, meshes.poles]), [meshes]) // the Bean's 128 px faces: lamps only

  useFrame(({ camera, clock }, dt) => {
    const st = state.current, sim = st.sim, vis = on && !!sim
    for (const m of Object.values(meshes)) m.visible = vis
    if (!vis) return
    const t0 = performance.now(), now = clock.elapsedTime
    // the range follows the point the camera looks down on
    // ?traffic=idle (tests only): the seeded vehicles placed once and held still, so reference shots are deterministic
    const idle = IDLE && st.frozen
    // D3-2: the lower decks carry traffic only while they are drawn, and then all in range in the U cut-away, only
    // near the camera when it is under the street itself (a drive, the Riverwalk), none otherwise — from above, the
    // street hides them (the ramps keep theirs either way). And which ramp stretches the deck mesh leaves out.
    const lowerOn = lowerShared.visible
    const lowerMode = !lowerOn ? 'off' : cutUniforms.uCut.value > 0.5 ? 'all' : camera.position.y < UNDER_CAM_M ? 'near' : 'off'
    if (lowerShared.json && st.decks !== lowerShared.json) { st.decks = lowerShared.json; deckHides(st.net, shownPieces(lowerShared.json), RIBBON_Y) }
    if (lowerMode !== st.lowerMode) { st.lowerMode = lowerMode; if (!idle) st.last = -1e9 }
    // raised bridges: closed a little before the leaves move, and while they're up
    const closed = closedBridges(liveLift), raised = new Set()
    for (const [k, a] of Object.entries(liveLift.angles ?? {})) if (a > RAISED_RAD) raised.add(k)
    sim.setBridges(closed, raised)
    if (!idle && now - st.last > REFRESH_S) {
      st.last = now
      const dir = camera.getWorldDirection(P), alt = Math.max(camera.position.y, 1)
      const reach = dir.y < -0.05 ? Math.min(alt / -dir.y, 1200) * 0.6 : 400
      sim.refresh(camera.position.x + dir.x * reach, camera.position.z + dir.z * reach, sceneHour(useStore.getState().timePreset),
        lowerMode === 'all' ? true : lowerMode === 'near' ? { x: camera.position.x, z: camera.position.z, r: LOWER_NEAR_M } : false)
      st.signals = signalsInRange(st.net, camera.position.x, camera.position.z)
      placePoles(meshes.poles, st.signals)
    }
    if (IDLE) st.frozen = true
    if (!idle) sim.step(dt)
    // vehicles
    const night = facadeUniforms.uNight.value, buckets = { car: 0, bus: 0, truck: 0 }
    const rideBus = vehiclePose() // the bus you ride (a bus or a drive): no traffic vehicle drawn inside it
    const clearOfRide = (v) => !rideBus || rideBus.kind !== 'bus' || Math.abs(v.y + ROAD_Y - rideBus.pos[1]) > 2.5 || Math.hypot(v.x - rideBus.pos[0], v.z - rideBus.pos[2]) > RIDE_CLEAR_M
    let li = 0
    const lk = meshes.lamps.geometry.attributes.aKind, lg = meshes.lamps.geometry.attributes.aGain
    for (const v of sim.vehicles) {
      const mesh = meshes[v.type], i = buckets[v.type]
      if (i >= VEHICLE_CAP[v.type]) continue
      const l = v.link, T = TYPES[v.type], under = v.y < -DEEP_M
      if (!l.ys && (isCutOpen(v.x, v.z) || portalOpenDepth(v.x, v.z) > PORTAL_EDGE_M)) continue // D2-3 / D4-1: none on a street that is open
      if (under && !lowerOn && portalOpenDepth(v.x, v.z) < -PORTAL_TAIL_M) continue // under the street (not in a portal's trench), the decks not drawn
      if (l.hide && (hiddenAt(l, v.s) || hiddenAt(l, v.s - T.length))) continue // where the deck mesh leaves a ramp out
      if (!clearOfRide(v)) continue
      buckets[v.type]++
      const y0 = ROAD_Y + v.y
      mesh.setMatrixAt(i, m4.compose(P.set(v.x, y0, v.z), q.setFromEuler(e.set(0, v.yaw, v.pitch, 'YZX')), S.set(1, 1, 1)))
      if (v.type === 'bus') col.setRGB(0.92, 0.92, 0.9); else if (v.type === 'truck') col.copy(paints[(v.colour >> 3) % paints.length]); else col.copy(paints[v.colour % paints.length])
      mesh.setColorAt(i, col)
      // lamps: headlights and tail lights after dusk; brake lights any time
      const brake = v.acc < -0.6 || (v.v < 0.3)
      // under the deck the lamps are on at any hour (the decks are dark)
      const lit = v.y < UNDER_DECK_M ? Math.max(night, 0.85) : night
      const cp = Math.cos(v.pitch), fx = Math.cos(v.yaw) * cp, fz = -Math.sin(v.yaw) * cp, fy = Math.sin(v.pitch), h = T.length / 2 + 0.03, y = y0 + (v.type === 'car' ? 0.62 : 0.85)
      if (lit > 0.05) {
        meshes.lamps.setMatrixAt(li, m4.compose(P.set(v.x + fx * h, y + fy * h, v.z + fz * h), q.setFromEuler(e.set(0, v.yaw, 0)), S.set(1, 1.1, T.width)))
        lk.setX(li, 0); lg.setX(li, lit); li++
      }
      const tail = lit * 0.55 + (brake ? 0.75 : 0)
      if (tail > 0.05) {
        meshes.lamps.setMatrixAt(li, m4.compose(P.set(v.x - fx * h, y - fy * h, v.z - fz * h), q.setFromEuler(e.set(0, v.yaw + Math.PI, 0)), S.set(1, 0.8, T.width)))
        lk.setX(li, 1); lg.setX(li, tail); li++
      }
    }
    for (const k of ['car', 'bus', 'truck']) {
      const m = meshes[k]
      m.count = buckets[k]; m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    meshes.lamps.count = li; meshes.lamps.instanceMatrix.needsUpdate = true; lk.needsUpdate = true; lg.needsUpdate = true
    // the lit lamp in each signal head, a few times a second
    if (now - st.lastSig > 0.2) { st.lastSig = now; lightSignals(meshes.sigLamps, st.signals, sim) }
    st.simMs = st.simMs * 0.95 + (performance.now() - t0) * 0.05
  })

  const shadows = QUALITY[quality].shadows
  return (
    <>
      <primitive object={meshes.car} castShadow={shadows} receiveShadow />
      <primitive object={meshes.bus} castShadow={shadows} receiveShadow />
      <primitive object={meshes.truck} castShadow={shadows} receiveShadow />
      <primitive object={meshes.lamps} />
      <primitive object={meshes.poles} receiveShadow />
      <primitive object={meshes.sigLamps} />
    </>
  )
}

// every signalled approach within range: its pole on the right-hand kerb at the stop line, facing the traffic
function signalsInRange(net, cx, cz) {
  const out = []
  for (const l of net.links) {
    if (l.signal < 0) continue
    const p = pointOnLink(l, l.stopAt, l.half + 0.9)
    if (Math.hypot(p.x - cx, p.z - cz) > RANGE_M) continue
    out.push({ link: l, x: p.x, z: p.z, y: ROAD_Y + p.y, yaw: Math.atan2(-p.dz, p.dx) })
    if (out.length >= SIGNAL_MAX) break
  }
  return out
}
function placePoles(mesh, list) {
  list.forEach((s, i) => mesh.setMatrixAt(i, m4.compose(P.set(s.x, s.y, s.z), q.setFromEuler(e.set(0, s.yaw, 0)), S.set(1, 1, 1))))
  mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true
}
function lightSignals(mesh, list, sim) {
  list.forEach((s, i) => {
    const state = sim.signalAt(s.link) ?? 'red', fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw), d = -0.21 // just in front of the head
    mesh.setMatrixAt(i, m4.compose(P.set(s.x + fx * d, s.y + SIGNAL_LAMP_Y[state], s.z + fz * d), q.setFromEuler(e.set(0, s.yaw, 0)), S.set(1, 1, 1)))
    mesh.setColorAt(i, col.setRGB(...SIGNAL_RGB[state]))
  })
  mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}
