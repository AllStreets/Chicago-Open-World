// pipeline/lib/walkRoute.js — a walk leg found on a fine grid of open ground (P7): never inside a building, never on
// the water, and cheapest along the preferred line (the walk graph's paths, or a street's sidewalk), so it follows the
// real paths where OSM has them and steps across the small gaps where it doesn't.
export function gridRoute(from, to, { blocked, preferred = () => false, cell = 3, margin = 150, offPath = 4, snapM = 60 }) {
  const minX = Math.min(from[0], to[0]) - margin, minZ = Math.min(from[1], to[1]) - margin
  const W = Math.ceil((Math.max(from[0], to[0]) + margin - minX) / cell) + 1, H = Math.ceil((Math.max(from[1], to[1]) + margin - minZ) / cell) + 1
  const at = (i, j) => [minX + i * cell, minZ + j * cell]
  const idx = (i, j) => j * W + i
  const cost = new Float32Array(W * H)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const [x, z] = at(i, j); cost[idx(i, j)] = blocked(x, z) ? Infinity : preferred(x, z) ? 1 : offPath }
  // an end on a roof or in the water moves to the nearest open cell (on the preferred line if one is within reach)
  const settle = ([x, z]) => {
    const ci = Math.round((x - minX) / cell), cj = Math.round((z - minZ) / cell)
    let best = null, bd = Infinity
    const R = Math.ceil(snapM / cell)
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj
      if (i < 0 || j < 0 || i >= W || j >= H) continue
      const c = cost[idx(i, j)]
      if (!Number.isFinite(c)) continue
      const d = Math.hypot(di, dj) * cell + (c > 1 ? snapM / 2 : 0)
      if (d < bd) { bd = d; best = [i, j] }
    }
    return best
  }
  const S = settle(from), T = settle(to)
  if (!S || !T) return null
  const [si, sj] = S, [ti, tj] = T
  const s = idx(si, sj), t = idx(ti, tj)
  const g = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1)
  const h = (k) => Math.hypot((k % W) - ti, Math.floor(k / W) - tj)
  const heap = [[h(s), s]]
  g[s] = 0
  const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p } }
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return top }
  const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
  while (heap.length) {
    const [, u] = pop()
    if (u === t) break
    const ui = u % W, uj = Math.floor(u / W)
    for (const [di, dj, dl] of N) {
      const vi = ui + di, vj = uj + dj
      if (vi < 0 || vj < 0 || vi >= W || vj >= H) continue
      const v = idx(vi, vj), c = cost[v]
      if (!Number.isFinite(c)) continue
      if (di && dj && (!Number.isFinite(cost[idx(ui + di, uj)]) || !Number.isFinite(cost[idx(ui, uj + dj)]))) continue // no corner cutting
      const nd = g[u] + dl * (c + cost[u]) / 2
      if (nd < g[v]) { g[v] = nd; prev[v] = u; push([nd + h(v), v]) }
    }
  }
  if (!Number.isFinite(g[t])) return null
  const out = []
  for (let k = t; k !== -1; k = prev[k]) out.push(at(k % W, Math.floor(k / W)))
  out.reverse()
  // the route runs between the settled ends (a waypoint on a roof or in the river is never walked to)
  return out
}

// distance from a point to a polyline
export function distToLine([x, z], pts) {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz
    const f = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0
    best = Math.min(best, Math.hypot(ax + dx * f - x, az + dz * f - z))
  }
  return best
}
