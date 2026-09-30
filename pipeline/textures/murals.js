// pipeline/textures/murals.js — four original, abstract mural designs in the saturated palette of Pilsen's painted
// walls (ruling: no existing mural is reproduced). Pure per-pixel functions of (u, v) ∈ [0, 1)², v down;
// `node textures/murals.js` writes them to app/public/textures/murals/mural-<k>.jpg (1024², one array layer each).
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const MURAL_COUNT = 4
const PAL = {
  magenta: [214, 32, 122], turquoise: [22, 170, 170], marigold: [250, 170, 20], cobalt: [30, 60, 160], lime: [150, 200, 40],
  coral: [240, 96, 76], cream: [246, 232, 200], ink: [34, 26, 46], violet: [110, 50, 150], red: [200, 36, 40],
}
const TAU = Math.PI * 2
const fr = (x) => x - Math.floor(x)

const DESIGNS = [
  // 0 · sunrise over stepped mountains: rays and rings in the sky, terraces below
  (u, v) => {
    const sx = u - 0.5, sy = v - 0.62, r = Math.hypot(sx, sy * 1.6), a = Math.atan2(sy, sx)
    const terrace = 0.62 + 0.18 * Math.abs(fr(u * 3) - 0.5) * 2
    if (v > terrace) return Math.floor((v - terrace) * 30) % 2 ? PAL.cobalt : PAL.violet
    if (r < 0.13) return PAL.marigold
    if (r < 0.2) return Math.floor(r * 90) % 2 ? PAL.coral : PAL.marigold
    return Math.floor(((a + Math.PI) / TAU) * 28) % 2 ? PAL.magenta : PAL.coral
  },
  // 1 · marigold blossoms on a cobalt ground, a turquoise border
  (u, v) => {
    if (u < 0.04 || u > 0.96 || v < 0.06 || v > 0.94) return Math.floor((u + v) * 40) % 2 ? PAL.turquoise : PAL.cream
    const cx = fr(u * 4) - 0.5, cy = fr(v * 3 + (Math.floor(u * 4) % 2) * 0.5) - 0.5, r = Math.hypot(cx, cy), a = Math.atan2(cy, cx)
    const petal = 0.33 + 0.1 * Math.cos(a * 8)
    if (r < 0.1) return PAL.red
    if (r < petal) return r < petal - 0.06 ? PAL.marigold : PAL.coral
    return Math.floor(fr(u * 24 + v * 18) * 2) ? PAL.cobalt : [40, 74, 176]
  },
  // 2 · papel picado banners: strung flags with cut-out diamonds, swaying across a lime sky
  (u, v) => {
    const row = Math.floor(v * 3), ry = fr(v * 3), sag = 0.12 * Math.sin(u * Math.PI * 2 + row)
    const flagY = ry - 0.1 - sag
    if (flagY > 0 && flagY < 0.62) {
      const col = Math.floor(u * 10), fx = fr(u * 10)
      if (fx < 0.06 || fx > 0.94) return PAL.lime
      const colours = [PAL.magenta, PAL.turquoise, PAL.marigold, PAL.violet, PAL.coral]
      const d = Math.abs(fx - 0.5) + Math.abs(fr(flagY * 4) - 0.5)
      if (d < 0.22 && flagY > 0.1) return PAL.lime // the cut-outs show the sky
      if (flagY > 0.55 && fr(fx * 8) < 0.5) return PAL.lime // the scalloped hem
      return colours[(col + row * 2) % colours.length]
    }
    return Math.abs(flagY) < 0.01 ? PAL.ink : PAL.lime
  },
  // 3 · birds over a lake: bold chevrons in flight above turquoise and coral waves
  (u, v) => {
    if (v > 0.6) {
      const w = Math.sin(u * TAU * 5 + v * 30) * 0.03
      return Math.floor((v + w) * 22) % 2 ? PAL.turquoise : PAL.cream
    }
    for (let i = 0; i < 9; i++) {
      const bx = fr(i * 0.618 + 0.1), by = 0.1 + 0.45 * fr(i * 0.382 + 0.2), s = 0.05 + 0.03 * (i % 3)
      const dx = (u - bx) / s, dy = (v - by) / s
      if (Math.abs(dx) < 1 && dy > Math.abs(dx) * 0.6 - 0.25 && dy < Math.abs(dx) * 0.6 + 0.05) return PAL.ink
    }
    return mixc(PAL.coral, PAL.magenta, v / 0.6)
  },
]
function mixc(a, b, t) { return a.map((x, i) => Math.round(x + (b[i] - x) * Math.max(0, Math.min(1, t)))) }

export function muralPixel(k, u, v) { return DESIGNS[k](u, v) }

async function main() {
  const sharp = (await import('sharp')).default
  const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/textures/murals')
  mkdirSync(out, { recursive: true })
  const N = 1024
  for (let k = 0; k < MURAL_COUNT; k++) {
    const buf = Buffer.alloc(N * N * 3)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      // 2 × 2 supersampling keeps the hard shapes clean when mipmapped
      let c = [0, 0, 0]
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const p = muralPixel(k, (x + ox) / N, (y + oy) / N); c = c.map((s, i) => s + p[i] / 4) }
      buf.set(c.map(Math.round), (y * N + x) * 3)
    }
    await sharp(buf, { raw: { width: N, height: N, channels: 3 } }).jpeg({ quality: 86 }).toFile(join(out, `mural-${k}.jpg`))
    console.log(`mural-${k}.jpg`)
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main()
