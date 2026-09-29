// app/src/lib/skyPalette.js — every lighting value as a function of sun elevation.
import * as THREE from 'three'

const C = (h) => new THREE.Color(h)
// elev, fog, hemiSky, hemiGround, hemiI, sunColor, sunI, night, stars, exposure, water
const KEYS = [
  [-18, C('#161a2b'), C('#2c3a5e'), C('#2a2018'), 0.6, C('#8fa6d6'), 0.00, 1.0, 1.0, 0.84, C('#050d16')],
  [-12, C('#161a2b'), C('#2c3a5e'), C('#2a2018'), 0.6, C('#8fa6d6'), 0.00, 1.0, 1.0, 0.84, C('#050d16')],
  [-8,  C('#1a1f33'), C('#34416a'), C('#2a2018'), 0.62, C('#8fa6d6'), 0.00, 0.9, 0.7, 0.8, C('#081624')],
  [-2,  C('#3a3450'), C('#5a5f8c'), C('#2a2220'), 0.68, C('#ff8a5c'), 0.15, 0.55, 0.15, 0.76, C('#132437')],
  [3,   C('#e0a27c'), C('#8fa4cc'), C('#3a302a'), 0.80, C('#ff9a5a'), 1.40, 0.15, 0.0, 0.76, C('#1d3a4d')],
  [10,  C('#d8c2ae'), C('#a9c1e0'), C('#4a4238'), 0.95, C('#ffd2a0'), 2.40, 0.0, 0.0, 0.74, C('#1f4a5c')],
  [25,  C('#bccbd8'), C('#c3d7ee'), C('#58524a'), 1.05, C('#fff0dc'), 3.00, 0.0, 0.0, 0.72, C('#21536a')],
  [60,  C('#b4c6d6'), C('#cfe1f5'), C('#5e5850'), 1.10, C('#fff7ee'), 3.30, 0.0, 0.0, 0.7, C('#22586f')],
]

export function paletteFor(elev) {
  const e = Math.min(60, Math.max(-18, Number.isFinite(elev) ? elev : -18))
  let i = 0
  while (i < KEYS.length - 2 && e > KEYS[i + 1][0]) i++
  const a = KEYS[i], b = KEYS[i + 1]
  const t = (e - a[0]) / (b[0] - a[0])
  const col = (k) => a[k].clone().lerp(b[k], t)
  const num = (k) => a[k] + (b[k] - a[k]) * t
  return {
    fog: col(1), skyTint: col(2), hemiSky: col(2), hemiGround: col(3), hemiIntensity: num(4),
    sunColor: col(5), sunIntensity: num(6), night: num(7), stars: num(8), exposure: num(9), water: col(10),
  }
}

export function phaseFor(elevDeg, dirX) {
  if (elevDeg < -6) return 'NIGHT'
  if (elevDeg < 12) return dirX >= 0 ? 'DAWN' : 'DUSK'
  return 'DAY'
}
