// pipeline/lib/sportsSites.js — the V5 venues sidecar: seeded shuffles, packed anchors, plaza anchors, records.

// Seeded Fisher–Yates (mulberry32). Any prefix is a uniform sample, so the app shows density d
// by drawing the first d·N anchors.
export function shuffled(list, seed = 1) {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
