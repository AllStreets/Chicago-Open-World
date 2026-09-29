// pipeline/textures/procedural.js — seeded, tileable ground materials (periodic value-noise fBm).
export const PROCEDURAL_KINDS = ['grass', 'asphalt', 'sidewalk', 'concrete', 'gravel', 'sand', 'pitch']

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const fade = (t) => t * t * (3 - 2 * t)

// value noise with integer period `p` lattice cells across the texture → tiles exactly
function noise(u, v, p, seed) {
  const x = u * p, y = v * p
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = fade(x - x0), fy = fade(y - y0)
  const g = (i, j) => hash(((i % p) + p) % p, ((j % p) + p) % p, seed)
  const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
function fbm(u, v, base, octaves, seed) {
  let s = 0, amp = 0.5, tot = 0
  for (let o = 0; o < octaves; o++) { s += amp * noise(u, v, base << o, seed + o * 17); tot += amp; amp *= 0.5 }
  return s / tot
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

const KINDS = {
  grass: (u, v) => {
    const n = fbm(u, v, 4, 5, 11), blade = noise(u, v, 256, 12), clump = fbm(u, v, 16, 3, 13)
    return mix(mix([56, 92, 38], [96, 132, 58], n), [40, 70, 30], (1 - blade) * 0.35 * clump)
  },
  asphalt: (u, v) => {
    const n = fbm(u, v, 3, 4, 21), grit = noise(u, v, 256, 22), patch = fbm(u, v, 2, 3, 23)
    const base = mix([48, 50, 53], [66, 68, 70], n)
    return mix(base, grit > 0.82 ? [110, 110, 108] : [34, 35, 37], patch > 0.62 ? 0.35 : grit > 0.82 ? 0.5 : 0.08)
  },
  sidewalk: (u, v) => {
    const slabs = 4, su = u * slabs, sv = v * slabs
    const joint = Math.min(su - Math.floor(su), 1 - (su - Math.floor(su)), sv - Math.floor(sv), 1 - (sv - Math.floor(sv)))
    const tint = hash(Math.floor(su), Math.floor(sv), 31) * 14
    const n = fbm(u, v, 8, 4, 32)
    const c = mix([176 + tint, 173 + tint, 166 + tint], [196 + tint, 193 + tint, 186 + tint], n)
    return joint < 0.012 ? mix(c, [96, 94, 90], 0.8) : c
  },
  concrete: (u, v) => {
    const n = fbm(u, v, 3, 5, 41), stain = fbm(u, v, 2, 3, 42)
    return mix(mix([160, 156, 148], [184, 180, 172], n), [120, 116, 108], Math.max(0, stain - 0.6) * 1.5)
  },
  gravel: (u, v) => {
    const n = noise(u, v, 192, 51), m = noise(u, v, 96, 52), f = fbm(u, v, 4, 3, 53)
    return mix(mix([118, 116, 112], [160, 158, 152], n), [84, 82, 80], (m > 0.7 ? 0.5 : 0) + f * 0.1)
  },
  pitch: (u, v) => {                                     // ball-field turf with mowing stripes (8 bands per tile)
    const band = Math.floor(v * 8) % 2, n = fbm(u, v, 8, 3, 71)
    return mix(band ? [66, 118, 48] : [88, 142, 60], [52, 96, 40], n * 0.35)
  },
  sand: (u, v) => {
    const n = fbm(u, v, 4, 4, 61), fine = noise(u, v, 256, 62)
    const ripple = 0.5 + 0.5 * Math.sin((v * 24 + fbm(u, v, 3, 2, 63) * 3) * Math.PI * 2)
    return mix(mix([214, 196, 158], [230, 216, 184], n), [196, 176, 138], fine * 0.25 + ripple * 0.08)
  },
}

export function proceduralTexture(kind, size) {
  const f = KINDS[kind]
  if (!f) throw new Error(`unknown procedural texture: ${kind}`)
  const out = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = f(x / size, y / size)
    for (let k = 0; k < 3; k++) out[(y * size + x) * 3 + k] = Math.max(0, Math.min(255, Math.round(c[k])))
  }
  return out
}
