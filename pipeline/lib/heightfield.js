// pipeline/lib/heightfield.js — the tallest thing in every 8 m cell (roofs, crowns, stands), for camera clearance.
import { makeGrid, fillPolygon, cellOf } from './raster.js'

export const HEIGHTFIELD = { cell: 8, scale: 0.1 }

export function bakeHeightfield({ pieces, points }, bounds) {
  const g = makeGrid(bounds, HEIGHTFIELD.cell)
  const h = new Float32Array(g.width * g.height)
  const put = (k, y) => { if (k >= 0 && y > h[k]) h[k] = y }
  for (const pc of pieces) {
    fillPolygon(g, [pc.outer], (k) => put(k, pc.top)) // courtyards count as roof: conservative
    for (const [x, z] of pc.outer) put(cellOf(g, x, z), pc.top) // footprints thinner than a cell
  }
  for (const [x, y, z] of points) put(cellOf(g, x, z), y)
  return { grid: g, heights: h }
}

export function meshPoints(buildings) {
  const out = []
  for (const b of buildings) for (const m of [...(b.extraMeshes || []), ...(b.venueMeshes || []).map((v) => v.mesh)]) {
    for (let i = 0; i < m.positions.length; i += 3) out.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]])
  }
  return out
}

export function boundsUnion(list) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (const b of list) { minX = Math.min(minX, b.minX); minZ = Math.min(minZ, b.minZ); maxX = Math.max(maxX, b.maxX); maxZ = Math.max(maxZ, b.maxZ) }
  return { minX, minZ, maxX, maxZ }
}
