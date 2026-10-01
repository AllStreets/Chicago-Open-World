// app/src/lib/neighborhoods.js — the LIVE lens's helpers (P4 · I-4.3): which zone a point is in, honest rent labels,
// and the five feel bars.
const inRing = ([x, z], ring) => {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c
  }
  return c
}
export function zoneAt(x, z, zones) { return (zones ?? []).find((zn) => inRing([x, z], zn.ring)) ?? null }

const k = (v) => `$${(v / 1000).toFixed(1)}k`
export function rentRangeLabel(rent) {
  if (!rent) return 'Rent data unavailable'
  const parts = [['Studio', rent.studio], ['1BR', rent.oneBr], ['2BR', rent.twoBr]].filter(([, v]) => v > 0)
  if (!parts.length) return 'Rent data unavailable'
  if (parts.length === 1) return `${parts[0][0]} ≈ ${k(parts[0][1])} (indicative)`
  return parts.map(([n, v]) => `${n} ${k(v)}`).join(' · ')
}

export const FEEL_KEYS = [['walk', 'Walkable'], ['transit', 'Transit'], ['nightlife', 'Nightlife'], ['green', 'Green'], ['quiet', 'Quiet']]
export function scoreBars(feel) { return FEEL_KEYS.map(([key, label]) => ({ key, label, value: Number(feel?.[key]) || 0 })) }

// A ⌘K neighbourhood row's zone: exact, then ignoring "The", then one name contained in the other
const plain = (s) => String(s ?? '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim()
export function zoneForName(name, zones) {
  const n = plain(name), list = zones ?? []
  return list.find((z) => plain(z.name) === n) ?? list.find((z) => { const p = plain(z.name); return n.length > 3 && (p.startsWith(n) || n.startsWith(p)) }) ?? null
}
