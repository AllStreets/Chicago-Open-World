// app/src/lib/quality.js — render quality presets + auto-downgrade.
export const QUALITY = {
  LOW: { dpr: 1, shadows: false, ao: false, bloom: true, shadowMap: 1024, fog: [1500, 9000] },
  HIGH: { dpr: [1, 1.5], shadows: true, ao: true, bloom: true, shadowMap: 4096, fog: [2600, 17000] },
  ULTRA: { dpr: [1, 2], shadows: true, ao: true, bloom: true, shadowMap: 8192, fog: [2600, 17000] },
}
const ORDER = ['LOW', 'HIGH', 'ULTRA']
export const nextQuality = (avgMs, q) => (avgMs > 25 ? ORDER[Math.max(0, ORDER.indexOf(q) - 1)] : q)
export const cycleQuality = (q) => ORDER[(ORDER.indexOf(q) + 1) % ORDER.length]
