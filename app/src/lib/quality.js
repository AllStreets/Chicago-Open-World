// app/src/lib/quality.js — render quality presets + auto-downgrade.
export const QUALITY = {
  LOW: { dpr: 1, shadows: false, ao: false, bloom: true, shadowMap: 1024 },
  HIGH: { dpr: [1, 1.5], shadows: true, ao: true, bloom: true, shadowMap: 4096 },
  ULTRA: { dpr: [1, 2], shadows: true, ao: true, bloom: true, shadowMap: 8192 },
}
const ORDER = ['LOW', 'HIGH', 'ULTRA']
export const nextQuality = (avgMs, q) => (avgMs > 25 ? ORDER[Math.max(0, ORDER.indexOf(q) - 1)] : q)
export const cycleQuality = (q) => ORDER[(ORDER.indexOf(q) + 1) % ORDER.length]
