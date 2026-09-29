// pipeline/textures/seamless.js — tileable textures + window masks.
const smooth = (t) => t * t * (3 - 2 * t)

export function makeSeamless(data, w, h, ch, border) {
  const out = new Uint8Array(data.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x), ey = Math.min(y, h - 1 - y)
      const m = smooth(Math.max(0, 1 - Math.min(ex, ey) / border))
      const sx = (x + (w >> 1)) % w, sy = (y + (h >> 1)) % h
      for (let c = 0; c < ch; c++) {
        const a = data[(y * w + x) * ch + c], b = data[(sy * w + sx) * ch + c]
        out[(y * w + x) * ch + c] = Math.round(a + (b - a) * m)
      }
    }
  }
  return out
}

export function windowMaskFromLuma(luma, lo, hi) {
  const out = new Uint8Array(luma.length)
  for (let i = 0; i < luma.length; i++) {
    const t = Math.min(1, Math.max(0, (hi - luma[i]) / (hi - lo)))
    out[i] = Math.round(smooth(t) * 255)
  }
  return out
}

// Brick façades: glass is neutral grey, brick is warm (R ≫ B). Chroma = R - B.
export function windowMaskFromChroma(rgb, lo, hi) {
  const out = new Uint8Array(rgb.length / 3)
  for (let i = 0; i < out.length; i++) {
    const t = Math.min(1, Math.max(0, (hi - (rgb[i * 3] - rgb[i * 3 + 2])) / (hi - lo)))
    out[i] = Math.round(smooth(t) * 255)
  }
  return out
}
