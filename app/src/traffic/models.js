// app/src/traffic/models.js — low-poly car, CTA bus and semi-truck, built from boxes with vertex colours (the paint
// is white, so each instance's colour tints it; glass, tyres and trim stay dark), plus the light and signal geometry.
// Local frame: +X forward, origin on the road under the vehicle's centre.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TYPES } from './sim.js'

const PAINT = [1, 1, 1], GLASS = [0.05, 0.06, 0.08], TYRE = [0.035, 0.035, 0.04], TRIM = [0.12, 0.12, 0.13]

function box(w, h, d, x, y, z, colour) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed()
  g.translate(x, y + h / 2, z)
  const n = g.attributes.position.count, c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) c.set(colour, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  g.deleteAttribute('uv')
  return g
}
const wheels = (len, w, r, xs) => xs.flatMap((x) => [-1, 1].map((s) => box(r * 2, r * 2, 0.3, x, 0, s * (w / 2 - 0.12), TYRE)))

export function carGeometry() {
  const { length: L, width: W } = TYPES.car
  return mergeGeometries([
    box(L, 0.62, W, 0, 0.3, 0, PAINT),                              // body
    box(L * 0.5, 0.5, W - 0.14, -L * 0.06, 0.92, 0, GLASS),        // glasshouse
    box(L * 0.42, 0.06, W - 0.2, -L * 0.07, 1.42, 0, PAINT),       // roof
    box(0.1, 0.18, W - 0.3, L / 2, 0.42, 0, TRIM),                 // grille
    ...wheels(L, W, 0.33, [L * 0.32, -L * 0.32]),
  ])
}

export function busGeometry() {
  const { length: L, width: W, height: H } = TYPES.bus
  return mergeGeometries([
    box(L, H - 0.5, W, 0, 0.35, 0, PAINT),
    box(L - 0.6, 1.0, W + 0.02, -0.1, 1.45, 0, GLASS),              // the window band
    box(0.06, 1.3, W - 0.3, L / 2, 1.35, 0, GLASS),                // windscreen
    box(L, 0.16, W + 0.02, 0, 0.75, 0, [0.12, 0.32, 0.72]),        // CTA blue stripe
    ...wheels(L, W, 0.5, [L * 0.33, -L * 0.25]),
  ])
}

export function truckGeometry() {
  const { length: L, width: W, height: H } = TYPES.truck, cab = 2.6
  return mergeGeometries([
    box(cab, 2.5, W - 0.1, L / 2 - cab / 2, 0.55, 0, PAINT),       // tractor cab
    box(0.08, 0.9, W - 0.4, L / 2, 1.9, 0, GLASS),
    box(L - cab - 0.4, H - 1.15, W, -cab / 2 - 0.2, 1.15, 0, [0.86, 0.86, 0.84]), // trailer
    box(L - cab - 0.4, 0.2, W - 0.4, -cab / 2 - 0.2, 0.9, 0, TRIM),
    ...wheels(L, W, 0.5, [L / 2 - 0.7, L / 2 - 2.0, -L / 2 + 1.0, -L / 2 + 2.3]),
  ])
}

// head/tail lamp pairs: a unit quad the shader turns to face the camera (two soft discs and a halo)
export const lampGeometry = () => new THREE.PlaneGeometry(1, 1)

// a traffic-signal pole with its head: facing −X toward the traffic it controls (rotated per approach)
export function signalPoleGeometry() {
  return mergeGeometries([
    box(0.2, 5.2, 0.2, 0, 0, 0, [0.16, 0.17, 0.16]),
    box(0.34, 1.15, 0.38, 0, 3.75, 0, [0.12, 0.12, 0.08]),
    box(0.04, 1.25, 0.6, 0.19, 3.7, 0, [0.06, 0.06, 0.06]),         // backplate, away from the traffic
  ])
}
export const SIGNAL_LAMP_Y = { red: 4.62, amber: 4.32, green: 4.02 }
export const SIGNAL_RGB = { red: [3.2, 0.25, 0.15], amber: [3.0, 1.5, 0.1], green: [0.2, 2.6, 1.3] }
export const PAINTS = ['#e8e8e6', '#1d1f22', '#8a8f96', '#5a1e1e', '#22325a', '#c9c9c4', '#3d4448', '#7a1515', '#2d4a3a', '#b9b2a0', '#0f1013', '#4e5d73']
