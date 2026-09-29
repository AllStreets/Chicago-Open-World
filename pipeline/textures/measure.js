// pipeline/textures/measure.js — find the window repeat (period, phase) of a façade image.
import sharp from 'sharp'

function period(profile, minP, maxP) {
  const n = profile.length, mean = profile.reduce((a, b) => a + b, 0) / n
  const p = profile.map((v) => v - mean)
  let best = minP, bestR = -Infinity
  for (let lag = minP; lag <= maxP; lag++) {
    let r = 0
    for (let i = 0; i + lag < n; i++) r += p[i] * p[i + lag]
    r /= n - lag
    if (r > bestR) { bestR = r; best = lag }
  }
  return best
}

export async function measure(file, { minP = 80, maxP = 420 } = {}) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height
  // use the middle 70% to avoid cornices/bases at the image edges
  const x0 = Math.round(W * 0.15), x1 = Math.round(W * 0.85), y0 = Math.round(H * 0.15), y1 = Math.round(H * 0.85)
  const col = [], row = []
  for (let x = 0; x < W; x++) { let s = 0; for (let y = y0; y < y1; y++) s += data[y * W + x]; col.push(s / (y1 - y0)) }
  for (let y = 0; y < H; y++) { let s = 0; for (let x = x0; x < x1; x++) s += data[y * W + x]; row.push(s / (x1 - x0)) }
  const px = period(col, minP, maxP), py = period(row, minP, maxP)
  // phase: brightest column/row (pier / spandrel) inside the first period after the margin
  const argmax = (a, from, len) => { let b = from; for (let i = from; i < from + len; i++) if (a[i] > a[b]) b = i; return b }
  return { W, H, px, py, sx: argmax(col, x0, px), sy: argmax(row, y0, py) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2)) console.log(f.split('/').pop(), JSON.stringify(await measure(f)))
}
