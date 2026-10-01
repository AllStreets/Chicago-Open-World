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
  return t.highway === 'pedestrian' ? 4 : t.highway === 'cycleway' ? 2.2 : t.highway === 'steps' ? 1.2 : 1.5
}

// ── Walking paths, second pass (2026-09-30): every path drawn in the material it's made of ──
const ASPHALT = /^(asphalt|paved|chipseal|tartan)$/
const GRAVEL = /^(gravel|fine_gravel|compacted|pebblestone|crushed_limestone|unpaved|dirt|earth|ground)$/
const NO_PATH = /^(grass|sand|wood|woodchips|mud|metal|rubber)$/
export const WALK_SURFACES = ['concrete', 'asphalt', 'gravel', 'brick']
// the surface a footway / path / cycleway / pedestrian street / steps is drawn in, or null where it isn't drawn: street
// sidewalks and crossings (the roads lay those), indoor and underground ways, bridges (they'd lie across the water)
export function pathSurface(t = {}) {
  if (!/^(footway|path|pedestrian|steps|cycleway)$/.test(t.highway ?? '') || isPavingArea(t)) return null
  if (/^(sidewalk|crossing|traffic_island)$/.test(t.footway ?? '') || /^(sidewalk|crossing)$/.test(t.cycleway ?? '')) return null
  if (t.indoor === 'yes' || (t.tunnel && t.tunnel !== 'no') || (t.bridge && t.bridge !== 'no') || parseInt(t.layer ?? '0', 10) < 0 || t.covered === 'yes') return null
  const s = t.surface ?? ''
  if (NO_PATH.test(s)) return null
  if (BRICK.test(s)) return 'brick'
  if (ASPHALT.test(s)) return 'asphalt'
  if (GRAVEL.test(s)) return 'gravel'
  if (s) return 'concrete'
  return t.highway === 'cycleway' || t.highway === 'path' ? 'asphalt' : 'concrete' // Chicago's park paths and trails are blacktop
}

// the parts of a path outside building footprints: tested in ≤ `step` m pieces, kept as runs of the outside pieces with
// only the way's own vertices and the cut points (the ribbon stays as light as the uncut one)
export function clipOutside(line, inside, step = 8) {
  const dense = [[line[0][0], line[0][1], true]]
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step))
    for (let k = 1; k <= n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, k === n])
  }
  const runs = []
  let run = null
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i]
    if (inside([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) { run = null; continue }
    if (!run) { run = [a]; runs.push(run) }
    run.push(b)
  }
  return runs.map((r) => r.filter((p, i) => p[2] || i === 0 || i === r.length - 1).map(([x, z]) => [x, z])).filter((r) => r.length >= 2)
}
