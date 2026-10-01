// pipeline/lib/imageCompare.js — the X-0f visual-parity metrics on raw RGB buffers: Playwright's pixel test (YIQ colour
// distance over threshold 0.2, as hero-view's toMatchSnapshot counts a differing pixel) and mean SSIM on luma
// (8 × 8 windows, stride 4, the usual C1/C2 constants).
const MAX_YIQ = 35215

function yiqDelta(r1, g1, b1, r2, g2, b2) {
  const y = (r1 - r2) * 0.29889531 + (g1 - g2) * 0.58662247 + (b1 - b2) * 0.11448223
  const i = (r1 - r2) * 0.59597799 - (g1 - g2) * 0.2741761 - (b1 - b2) * 0.32180189
  const q = (r1 - r2) * 0.21147017 - (g1 - g2) * 0.52261711 + (b1 - b2) * 0.31114694
  return 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q
}

// fraction of pixels whose YIQ distance exceeds threshold² × max (pixelmatch / Playwright, without the AA exemption,
// so this count is never lower than the one hero-view's toMatchSnapshot would make)
export function diffRatio(a, b, width, height, threshold = 0.2, channels = 3) {
  const lim = MAX_YIQ * threshold * threshold
  let n = 0
  for (let p = 0; p < width * height; p++) {
    const i = p * channels
    if (yiqDelta(a[i], a[i + 1], a[i + 2], b[i], b[i + 1], b[i + 2]) > lim) n++
  }
  return n / (width * height)
}

const luma = (buf, w, h, channels) => {
  const out = new Float32Array(w * h)
  for (let p = 0; p < w * h; p++) { const i = p * channels; out[p] = 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2] }
  return out
}

export function ssim(a, b, width, height, { channels = 3, win = 8, stride = 4 } = {}) {
  const A = luma(a, width, height, channels), B = luma(b, width, height, channels)
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, n = win * win
  let sum = 0, count = 0
  for (let y = 0; y + win <= height; y += stride) {
    for (let x = 0; x + win <= width; x += stride) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0
      for (let j = 0; j < win; j++) {
        let o = (y + j) * width + x
        for (let i = 0; i < win; i++, o++) { const va = A[o], vb = B[o]; sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb }
      }
      const ma = sa / n, mb = sb / n
      const va = saa / n - ma * ma, vb = sbb / n - mb * mb, cov = sab / n - ma * mb
      sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
      count++
    }
  }
  return sum / count
}
