// app/src/traffic/Traffic.jsx — draws the traffic sim (sim.js): one instanced mesh each for cars, buses and trucks,
// one for every head- and tail-lamp pair (lit after dusk, tail lamps brighter under braking), and the traffic signals
// within range — poles in one mesh, the lit lamps in another. Six draw calls; the sim runs within ~1.5 km.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { worldUrl } from '../lib/manifest.js'
import { QUALITY } from '../lib/quality.js'
import { chicagoClock } from '../lib/chicagoTime.js'
import { presetDate } from '../lib/sun.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { decodeRoadGraph, buildNetwork, pointOnLink } from './graph.js'
import { createTraffic, TYPES, CAP, RANGE_M } from './sim.js'
import { carGeometry, busGeometry, truckGeometry, lampGeometry, signalPoleGeometry, SIGNAL_LAMP_Y, SIGNAL_RGB, PAINTS } from './models.js'

const ROAD_Y = 0.13 // on the road ribbons (pipeline GROUND_Y.roads 0.12)
const REFRESH_S = 1, SIGNAL_MAX = 2400
const VEHICLE_CAP = { car: 3000, bus: 260, truck: 700 }
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
  float size = length(instanceMatrix[1].xyz), width = length(instanceMatrix[2].xyz);
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
      state.current.sim = createTraffic(net, { cap: CAP[useStore.getState().quality] ?? CAP.HIGH })
      state.current.last = -1e9
      if (new URLSearchParams(window.location.search).has('stats')) window.__traffic = state.current
    }).catch(() => {})
    return () => { dead = true }
  }, [file, version])
  useEffect(() => { state.current.sim?.setCap(CAP[quality] ?? CAP.HIGH) }, [quality])
  useEffect(() => () => { for (const m of Object.values(meshes)) { m.geometry.dispose(); m.material.dispose() } }, [meshes])

  useFrame(({ camera, clock }, dt) => {
    const st = state.current, sim = st.sim, vis = on && !!sim
    for (const m of Object.values(meshes)) m.visible = vis
    if (!vis) return
    const t0 = performance.now(), now = clock.elapsedTime
    // the range follows the point the camera looks down on
    if (now - st.last > REFRESH_S) {
      st.last = now
      const dir = camera.getWorldDirection(P), alt = Math.max(camera.position.y, 1)
      const reach = dir.y < -0.05 ? Math.min(alt / -dir.y, 1200) * 0.6 : 400
      sim.refresh(camera.position.x + dir.x * reach, camera.position.z + dir.z * reach, sceneHour(useStore.getState().timePreset))
      st.signals = signalsInRange(st.net, camera.position.x, camera.position.z)
      placePoles(meshes.poles, st.signals)
    }
    sim.step(dt)
    // vehicles
    const night = facadeUniforms.uNight.value, buckets = { car: 0, bus: 0, truck: 0 }
    let li = 0
    const lk = meshes.lamps.geometry.attributes.aKind, lg = meshes.lamps.geometry.attributes.aGain
    for (const v of sim.vehicles) {
      const mesh = meshes[v.type], i = buckets[v.type]
      if (i >= VEHICLE_CAP[v.type]) continue
      buckets[v.type]++
      mesh.setMatrixAt(i, m4.compose(P.set(v.x, ROAD_Y, v.z), q.setFromEuler(e.set(0, v.yaw, 0)), S.set(1, 1, 1)))
      if (v.type === 'bus') col.setRGB(0.92, 0.92, 0.9); else if (v.type === 'truck') col.copy(paints[(v.colour >> 3) % paints.length]); else col.copy(paints[v.colour % paints.length])
      mesh.setColorAt(i, col)
      // lamps: headlights and tail lights after dusk; brake lights any time
      const T = TYPES[v.type], brake = v.acc < -0.6 || (v.v < 0.3)
      const fx = Math.cos(v.yaw), fz = -Math.sin(v.yaw), h = T.length / 2 + 0.03, y = ROAD_Y + (v.type === 'car' ? 0.62 : 0.85)
      if (night > 0.05) {
        meshes.lamps.setMatrixAt(li, m4.compose(P.set(v.x + fx * h, y, v.z + fz * h), q.setFromEuler(e.set(0, v.yaw, 0)), S.set(1, 1.1, T.width)))
        lk.setX(li, 0); lg.setX(li, night); li++
      }
      const tail = night * 0.55 + (brake ? 0.75 : 0)
      if (tail > 0.05) {
        meshes.lamps.setMatrixAt(li, m4.compose(P.set(v.x - fx * h, y, v.z - fz * h), q.setFromEuler(e.set(0, v.yaw + Math.PI, 0)), S.set(1, 0.8, T.width)))
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
    out.push({ link: l, x: p.x, z: p.z, yaw: Math.atan2(-p.dz, p.dx) })
    if (out.length >= SIGNAL_MAX) break
  }
  return out
}
function placePoles(mesh, list) {
  list.forEach((s, i) => mesh.setMatrixAt(i, m4.compose(P.set(s.x, ROAD_Y, s.z), q.setFromEuler(e.set(0, s.yaw, 0)), S.set(1, 1, 1))))
  mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true
}
function lightSignals(mesh, list, sim) {
  list.forEach((s, i) => {
    const state = sim.signalAt(s.link) ?? 'red', fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw), d = -0.21 // just in front of the head
    mesh.setMatrixAt(i, m4.compose(P.set(s.x + fx * d, ROAD_Y + SIGNAL_LAMP_Y[state], s.z + fz * d), q.setFromEuler(e.set(0, s.yaw, 0)), S.set(1, 1, 1)))
    mesh.setColorAt(i, col.setRGB(...SIGNAL_RGB[state]))
  })
  mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}
