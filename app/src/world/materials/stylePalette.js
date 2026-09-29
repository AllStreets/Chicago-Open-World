// app/src/world/materials/stylePalette.js — styles.json rows → a small exact float texture read by the façade shader.
import * as THREE from 'three'

export const STYLE_COLS = 7
const FINISH = ['glass', 'metal', 'granite', 'limestone', 'terracotta', 'concrete']
const KIND = { flood: 1, lantern: 2 }

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
export function hexLinear(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255))
}

export function paletteData(styles) {
  const height = Math.max(1, styles.length)
  const data = new Float32Array(STYLE_COLS * height * 4)
  styles.forEach((s, row) => {
    if (!s.base) return // row 0: no style
    const put = (col, [r, g, b], a) => { const i = (row * STYLE_COLS + col) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a }
    const c = s.crown
    put(0, hexLinear(s.base), FINISH.indexOf(s.finish))
    put(1, hexLinear(s.glass), s.roughness)
    put(2, hexLinear(s.mullion), s.metalness)
    put(3, hexLinear(s.spandrel), 0)
    put(4, hexLinear(s.top ?? s.base), s.topM ?? 0)
    put(5, c ? hexLinear(c.color) : [0, 0, 0], c ? c.intensity : 0)
    put(6, c ? [c.fromM, c.toM, KIND[c.kind]] : [0, 0, 0], s.topFromM ?? 0)
  })
  return { data, width: STYLE_COLS, height }
}

export function createStyleTexture(styles) {
  const { data, width, height } = paletteData(styles)
  const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false
  t.needsUpdate = true
  return t
}
