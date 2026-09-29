// pipeline/lib/height.js — metres for a building from OSM tags or city stories.
export const FLOOR_M = 3.8
export const MAX_HEIGHT_M = 530
const DEFAULT_M = 10

export function parseHeightTag(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim().replace(/^~/, '')
  const m = s.match(/^(\d+(?:\.\d+)?)\s*('|ft|feet)?\s*(m)?$/i)
  if (!m) return null
  let n = parseFloat(m[1])
  if (m[2]) n *= 0.3048
  return n > 0 ? n : null
}

const positiveInt = (v) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function resolveHeight({ osmHeight, osmLevels, stories } = {}) {
  const h = parseHeightTag(osmHeight)
    ?? (positiveInt(osmLevels) && positiveInt(osmLevels) * FLOOR_M)
    ?? (positiveInt(stories) && positiveInt(stories) * FLOOR_M)
    ?? DEFAULT_M
  return Math.min(h, MAX_HEIGHT_M)
}
