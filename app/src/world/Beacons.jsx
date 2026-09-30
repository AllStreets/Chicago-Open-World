// app/src/world/Beacons.jsx — VISIT's landmark beacons (P4 · I-4.2): thin additive light pillars over the curated
// landmarks, coloured by category, faint by day (≤ 15 %) and full at night (B.1.1); one InstancedMesh. Each gets a
// label; clicking it dives to the landmark and opens its card.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { LANDMARKS, inWorld } from '../data/landmarks.js'
import { facadeUniforms } from './materials/facadeMaterial.js'
import { project } from '../../../shared/project.js'
import { roofHeightAt } from '../lib/clearance.js'
import { poseForPlace } from '../lib/flight.js'
import { setLabels } from './labelRegistry.js'

const BBOX = { s: 41.826, w: -87.695, n: 41.952, e: -87.595 }
const HEX = { icon: '#45d8ff', architecture: '#e8eef9', culture: '#b89cff', nature: '#5fd49a', hidden: '#ffb35c' }
const HEIGHT = 180

export function beaconSpots(manifest) {
  return LANDMARKS.filter((l) => inWorld(l, BBOX)).map((l) => {
    const hero = l.heroKey ? manifest?.landmarks?.find((m) => m.key === l.heroKey) : null
    const [x, z] = hero?.beacon ? [hero.beacon[0], hero.beacon[2]] : project(l.lon, l.lat)
    const y = hero?.beacon ? hero.beacon[1] : (roofHeightAt(x, z) || 0) + 8
    return { lm: l, x, y, z, top: hero?.top ?? y }
  })
}

export function openLandmark(spot) {
  const s = useStore.getState()
  s.startFlight(poseForPlace({ x: spot.x, z: spot.z, top: Math.max(40, spot.top) }), spot.lm.name)
  s.select({ kind: 'landmark', id: spot.lm.id, data: { ...spot.lm, x: spot.x, z: spot.z } })
}

export default function Beacons() {
  const on = useStore((s) => s.lens === 'VISIT'), manifest = useStore((s) => s.manifest)
  const spots = useMemo(() => (manifest ? beaconSpots(manifest) : []), [manifest])
  const mesh = useMemo(() => {
    const g = new THREE.PlaneGeometry(2.2, HEIGHT, 1, 8).translate(0, HEIGHT / 2, 0)
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uNight: facadeUniforms.uNight },
      vertexShader: 'varying float vH; varying vec3 vC; void main(){ vH = position.y / ' + HEIGHT.toFixed(1) + '; vC = instanceColor; vec4 w = instanceMatrix * vec4(position, 1.0); vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec3 toCam = normalize(cameraPosition - c); vec3 side = normalize(vec3(-toCam.z, 0.0, toCam.x)); vec3 p = c + side * position.x + vec3(0.0, position.y, 0.0); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float uNight; varying float vH; varying vec3 vC; void main(){ float a = pow(1.0 - vH, 1.6) * mix(0.15, 0.85, uNight); gl_FragColor = vec4(vC * a, a); }',
    })
    const im = new THREE.InstancedMesh(g, m, Math.max(1, LANDMARKS.length))
    im.frustumCulled = false; im.renderOrder = 4
    return im
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose() }, [mesh])
  useEffect(() => {
    const M = new THREE.Matrix4(), C = new THREE.Color()
    spots.forEach((s, i) => { mesh.setMatrixAt(i, M.makeTranslation(s.x, s.y, s.z)); mesh.setColorAt(i, C.set(HEX[s.lm.category] ?? HEX.icon)) })
    mesh.count = spots.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [spots, mesh])
  useEffect(() => {
    setLabels('beacons', on ? spots.map((s) => ({ id: `lm:${s.lm.id}`, x: s.x, y: s.y + 40, z: s.z, priority: s.lm.category === 'icon' ? 3 : 1, text: s.lm.name, color: HEX[s.lm.category], onClick: () => openLandmark(s) })) : [])
    return () => setLabels('beacons', [])
  }, [on, spots])
  return on ? <primitive object={mesh} /> : null
}
