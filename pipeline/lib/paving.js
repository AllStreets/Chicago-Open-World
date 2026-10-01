// pipeline/lib/paving.js — plazas and park paths (user, 2026-09-30): Grant Park's brick and red-granite plazas, the
// promenades and paths, laid on the ground. Pedestrian areas and squares are polygons; footways and paths are
// ribbons. Brick-like surfaces get the brick paving layer, the rest the concrete walk layer. Street sidewalks and
// crossings are skipped — the roads already lay those.
const BRICK = /^(paving_stones|bricks|brick|sett|cobblestone|unhewn_cobblestone|granite|stone)$/
const SOFT = /^(grass|dirt|earth|mud|ground|sand|woodchips|wood)$/

export function isPavingArea(t = {}) {
  return (t.highway === 'pedestrian' && t.area === 'yes') || /^(pedestrian|footway)$/.test(t['area:highway'] ?? '') || t.place === 'square'
}

export function pavingKind(t = {}) {
  if (/^(sidewalk|crossing|traffic_island)$/.test(t.footway ?? '')) return null
  if (!isPavingArea(t) && !/^(footway|path|pedestrian|steps)$/.test(t.highway ?? '')) return null
  const s = t.surface ?? ''
  if (SOFT.test(s)) return null
  return BRICK.test(s) ? 'brick' : 'concrete'
}

// Hand-shaped plazas (data/plazas.json) as ground polygons: a disc, or a w × d rectangle turned by a compass bearing.
export function synthPlazas(list, project) {
  return (list ?? []).map((p) => {
    const [cx, cz] = project(p.lon, p.lat)
    let outer
    if (p.shape === 'disc') outer = Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * Math.PI * 2; return [cx + p.r * Math.cos(a), cz + p.r * Math.sin(a)] })
    else {
      const r = ((p.bearingDeg ?? 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r)
      outer = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const x = (u * p.w) / 2, z = (v * p.d) / 2; return [cx + x * c - z * s, cz + x * s + z * c] })
    }
    const xs = outer.map((q) => q[0]), zs = outer.map((q) => q[1])
    return { id: p.key, outer, holes: [], kind: p.kind, tags: {}, bbox: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) } }
  })
}

export function pathHalfWidth(t = {}) {
  const w = parseFloat(t.width ?? '')
  if (w > 0) return Math.min(20, w) / 2
  return t.highway === 'pedestrian' ? 4 : t.highway === 'steps' ? 1.5 : 1.5
}
