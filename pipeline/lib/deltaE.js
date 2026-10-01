// pipeline/lib/deltaE.js — CIEDE2000 colour difference (sRGB 8-bit in), for the V3 texture limits (X-0c): a palette
// image must stay within ΔE2000 ≤ 2 on average and ≤ 5 at worst against its truecolour source.
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)

export function srgbToLab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b)
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const fx = f(X), fy = f(Y), fz = f(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const rad = Math.PI / 180, deg = 180 / Math.PI
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2)
  const hp = (b, ap) => (b === 0 && ap === 0 ? 0 : (Math.atan2(b, ap) * deg + 360) % 360)
  const hp1 = hp(b1, ap1), hp2 = hp(b2, ap2)
  const dL = L2 - L1, dC = Cp2 - Cp1
  let dh = 0
  if (Cp1 * Cp2 !== 0) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360 }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad)
  const Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2
  let hm = hp1 + hp2
  if (Cp1 * Cp2 !== 0) hm = Math.abs(hp1 - hp2) <= 180 ? hm / 2 : hm < 360 ? (hm + 360) / 2 : (hm - 360) / 2
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2))
  const RC = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T
  const RT = -Math.sin(2 * dTheta * rad) * RC
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
}

// average and maximum ΔE2000 between two same-size RGB(A) pixel buffers (channels per pixel given)
export function imageDeltaE(a, b, channels = 3) {
  if (a.length !== b.length) throw new Error('imageDeltaE: buffers differ in size')
  const cache = new Map()
  let sum = 0, max = 0, n = 0
  for (let i = 0; i < a.length; i += channels) {
    const ka = (a[i] << 16) | (a[i + 1] << 8) | a[i + 2], kb = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]
    let d = 0
    if (ka !== kb) {
      const k = ka * 16777216 + kb
      d = cache.get(k)
      if (d === undefined) { d = deltaE2000(srgbToLab(a[i], a[i + 1], a[i + 2]), srgbToLab(b[i], b[i + 1], b[i + 2])); cache.set(k, d) }
    }
    sum += d; if (d > max) max = d; n++
  }
  return { avg: sum / n, max }
}
