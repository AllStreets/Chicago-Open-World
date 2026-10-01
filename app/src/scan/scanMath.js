// app/src/scan/scanMath.js — Scan, the holographic sweep (P5 · I-5.4, spec §7): a 1.2 s front from the camera turns the
// city into near-black massing with cyan edges; the same front runs back out when Scan is turned off. Pure.
export const SCAN_SECONDS = 1.2
export const SCAN_MAX_R = 9000
const FADE_S = 0.4

const easeOutCubic = (t) => 1 - (1 - t) ** 3
export function scanRadiusAt(tSec, maxR = SCAN_MAX_R) {
  if (tSec >= SCAN_SECONDS) return maxR
  return maxR * easeOutCubic(Math.max(0, tSec) / SCAN_SECONDS)
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
// 1 well behind the front (inside), 0 ahead of it, smooth across the band
export function scanBlend(distM, radiusM, band = 80) {
  return 1 - smooth(radiusM - band, radiusM + band, distM)
}

// Uniforms for this instant. The scanned part of the city is the disc of radius uScanRadius around uScanOrigin: turning
// Scan on grows it out to the horizon in 1.2 s, turning it off draws it back in to the camera. A re-toggle mid-sweep
// starts from the radius the disc had reached (`prevRadius`, kept by the controller), so nothing jumps or strobes.
// uScanMode says which way the front is heading (1 out, 0 back in).
export function scanUniformsAt({ on, changedAt, now, origin, reducedMotion = false, prevRadius = 0, maxR = SCAN_MAX_R }) {
  const t = Number.isFinite(changedAt) ? Math.max(0, (now - changedAt) / 1000) : Infinity
  if (reducedMotion) {
    const f = Math.min(1, t / FADE_S)
    return { uScanMode: on ? 1 : 0, uScanRadius: Infinity, uScanOrigin: origin, uScan: on ? f : 1 - f }
  }
  const start = Math.max(0, Math.min(prevRadius, maxR)), k = Math.min(1, t / SCAN_SECONDS)
  const radius = on ? start + (maxR - start) * easeOutCubic(k) : start * (1 - k) ** 3
  return { uScanMode: on ? 1 : 0, uScanRadius: radius, uScanOrigin: origin, uScan: radius > 0.5 ? 1 : 0 }
}

// VISIT under Scan: where the landmarks cluster, as a normalised grid (gaussian, sigma 400 m).
export function landmarkHeat(points, bounds, cell = 100, sigmaM = 400) {
  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell)), rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell))
  const data = new Float32Array(cols * rows), reach = Math.ceil((3 * sigmaM) / cell), s2 = 2 * sigmaM * sigmaM
  for (const [x, z] of points) {
    const ci = Math.floor((x - bounds.minX) / cell), ri = Math.floor((z - bounds.minZ) / cell)
    for (let r = Math.max(0, ri - reach); r <= Math.min(rows - 1, ri + reach); r++) {
      for (let c = Math.max(0, ci - reach); c <= Math.min(cols - 1, ci + reach); c++) {
        const cx = bounds.minX + (c + 0.5) * cell, cz = bounds.minZ + (r + 0.5) * cell
        data[r * cols + c] += Math.exp(-((cx - x) ** 2 + (cz - z) ** 2) / s2)
      }
    }
  }
  let max = 0
  for (const v of data) if (v > max) max = v
  if (max > 0) for (let i = 0; i < data.length; i++) data[i] /= max
  return { cols, rows, data, cell, bounds }
}

export const SCAN_METRICS = [['transit', 'Transit'], ['nightlife', 'Nightlife'], ['green', 'Green space'], ['rent', 'Rent (1BR)']]
// LIVE under Scan: one light column per neighbourhood, its height the chosen metric (0..1; no data → 0).
export function columnHeights(zones, metric) {
  const raw = zones.map((z) => [z.id, metric === 'rent' ? z.rent?.oneBr ?? null : z.feel?.[metric] ?? null])
  const max = Math.max(0, ...raw.map(([, v]) => v ?? 0))
  return new Map(raw.map(([id, v]) => [id, v == null || max <= 0 ? 0 : v / max]))
}
