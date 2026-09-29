// pipeline/lib/raster.js — world-aligned rasters for baked textures (shore distance, camera heightfield).
// Row 0 is minZ (north), column 0 is minX (west); cell centres are sampled.
export function makeGrid({ minX, minZ, maxX, maxZ }, cell) {
  return { minX, minZ, cell, width: Math.ceil((maxX - minX) / cell), height: Math.ceil((maxZ - minZ) / cell) }
}

export function cellOf(g, x, z) {
  const i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell)
  return i < 0 || j < 0 || i >= g.width || j >= g.height ? -1 : j * g.width + i
}

// Scanline fill, even-odd over all rings (holes stay empty): visit(index) for every cell centre inside.
export function fillPolygon(g, rings, visit) {
  let minZ = Infinity, maxZ = -Infinity
  for (const r of rings) for (const p of r) { if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1] }
  const j0 = Math.max(0, Math.floor((minZ - g.minZ) / g.cell - 0.5)), j1 = Math.min(g.height - 1, Math.ceil((maxZ - g.minZ) / g.cell - 0.5))
  const xs = []
  for (let j = j0; j <= j1; j++) {
    const z = g.minZ + (j + 0.5) * g.cell
    xs.length = 0
    for (const r of rings) for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
      const [xa, za] = r[a], [xb, zb] = r[b]
      if ((za > z) !== (zb > z)) xs.push(xa + ((z - za) * (xb - xa)) / (zb - za))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - g.minX) / g.cell - 0.5)), i1 = Math.min(g.width - 1, Math.floor((xs[k + 1] - g.minX) / g.cell - 0.5))
      for (let i = i0; i <= i1; i++) visit(j * g.width + i)
    }
  }
}

// Distance (in cells) from every cell to the nearest non-zero mask cell — two-pass 8-neighbour chamfer.
export function distanceField(mask, w, h) {
  const d = new Float32Array(w * h), D = Math.SQRT2
  for (let k = 0; k < d.length; k++) d[k] = mask[k] ? 0 : 1e9
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i
    let v = d[k]
    if (i > 0) v = Math.min(v, d[k - 1] + 1)
    if (j > 0) {
      v = Math.min(v, d[k - w] + 1)
      if (i > 0) v = Math.min(v, d[k - w - 1] + D)
      if (i < w - 1) v = Math.min(v, d[k - w + 1] + D)
    }
    d[k] = v
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const k = j * w + i
    let v = d[k]
    if (i < w - 1) v = Math.min(v, d[k + 1] + 1)
    if (j < h - 1) {
      v = Math.min(v, d[k + w] + 1)
      if (i < w - 1) v = Math.min(v, d[k + w + 1] + D)
      if (i > 0) v = Math.min(v, d[k + w - 1] + D)
    }
    d[k] = v
  }
  return d
}

// Heights → 8-bit RGB carrying 16-bit steps of `scale` metres (browsers read PNGs through an 8-bit canvas).
export function encodeHeights(h, scale) {
  const out = new Uint8Array(h.length * 3)
  for (let k = 0; k < h.length; k++) {
    const v = Math.max(0, Math.min(65535, Math.round(h[k] / scale)))
    out[k * 3] = v >> 8
    out[k * 3 + 1] = v & 255
  }
  return out
}
