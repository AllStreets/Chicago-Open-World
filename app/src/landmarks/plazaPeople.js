// app/src/landmarks/plazaPeople.js — deterministic crowds on Chicago's plazas, thinning out at night.
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
export const crowdDensity = (hour) => (hour < 6 ? 0.05 : hour < 10 ? 0.4 : hour < 18 ? 1.1 : hour < 23 ? 0.6 : 0.05)
export function plazaPeople(plazas, hour, { cap = 1200, seed = 1 } = {}) {
  const out = []
  plazas.forEach((p, pi) => {
    const n = Math.round(((Math.PI * p.r * p.r) / 100) * crowdDensity(hour))
    for (let i = 0, k = 0; k < n && i < n * 6 && out.length < cap; i++) {
      const a = hash(seed + pi * 1000 + i * 2.1) * Math.PI * 2, d = Math.sqrt(hash(seed + pi * 1000 + i * 3.7)) * p.r
      const x = p.c[0] + Math.cos(a) * d, z = p.c[1] + Math.sin(a) * d
      if ((p.avoid ?? []).some((o) => Math.hypot(x - o.c[0], z - o.c[1]) < o.r)) continue
      out.push({ x, z, yaw: hash(i * 9.1 + pi) * Math.PI * 2, shirt: Math.floor(hash(i * 5.3 + pi) * 8), plaza: p.key }); k++
    }
  })
  return out
}
