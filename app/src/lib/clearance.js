// app/src/lib/clearance.js — how high the camera must stay: the pipeline's roof heightfield (max per 8 m cell,
// decimetres in R/G of heightfield.png) plus 25 m. Used by flights, free flight, and later the follow and venue cams.
export const CLEARANCE_M = 25
let field = null // { minX, minZ, cell, width, height, scale, dm: Uint16Array }

export function decodeHeightfield(rgba, { width, height }) {
  const dm = new Uint16Array(width * height)
  for (let k = 0; k < dm.length; k++) dm[k] = (rgba[k * 4] << 8) | rgba[k * 4 + 1]
  return dm
}

export function setHeightfield(grid, dm) {
  field = dm ? { ...grid, scale: grid.scale ?? 0.1, dm } : null
}

// Max of the four cells around (x, z): conservative within one cell of a façade.
export function roofHeightAt(x, z) {
  if (!field) return 0
  const fx = (x - field.minX) / field.cell - 0.5, fz = (z - field.minZ) / field.cell - 0.5
  const i0 = Math.floor(fx), j0 = Math.floor(fz)
  let m = 0
  for (let j = j0; j <= j0 + 1; j++) for (let i = i0; i <= i0 + 1; i++) {
    if (i < 0 || j < 0 || i >= field.width || j >= field.height) continue
    m = Math.max(m, field.dm[j * field.width + i])
  }
  return m * field.scale
}

export const clearanceAt = (x, z) => roofHeightAt(x, z) + CLEARANCE_M

export async function loadHeightfield(url, grid) {
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = grid.width; c.height = grid.height
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    setHeightfield(grid, decodeHeightfield(ctx.getImageData(0, 0, grid.width, grid.height).data, grid))
  } catch (e) {
    console.warn('heightfield unavailable — camera clearance falls back to 25 m', e)
    setHeightfield(grid, null)
  }
}
