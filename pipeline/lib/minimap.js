// pipeline/lib/minimap.js — the CHI-palette 2D city for the HUD minimap.
import sharp from 'sharp'

// X-0c (V3): a 256-colour palette PNG was measured (1.19 MB) and rejected — ΔE2000 max 8.4 on antialiased edges, over
// V3's 5. Lossless WebP keeps every pixel (ΔE 0) at 1.39 MB instead of 2.21 MB; the image has no transparency.
export const MINIMAP_FILE = 'minimap.webp'
export const encodeMinimap = (svg) => sharp(Buffer.from(svg), { limitInputPixels: false }).removeAlpha().webp({ lossless: true, effort: 6 }).toBuffer()

const COLORS = { land: '#0a111f', water: '#0b2433', parks: '#0f2a22', buildings: '#243650', roads: '#1a2940' }

export function minimapSvg(layers, b, size) {
  const sx = size / (b.maxX - b.minX), sz = size / (b.maxZ - b.minZ)
  const pt = ([x, z]) => `${((x - b.minX) * sx).toFixed(1)},${((z - b.minZ) * sz).toFixed(1)}`
  const poly = (rings) => rings.map((r) => `M${r.map(pt).join('L')}Z`).join('')
  const line = (lines) => lines.map((l) => `M${l.map(pt).join('L')}`).join('')
  const paths = []
  for (const k of ['land', 'water', 'parks']) if (layers[k]?.length) paths.push(`<path d="${poly(layers[k])}" fill="${COLORS[k]}" fill-rule="evenodd"/>`)
  if (layers.roads?.length) paths.push(`<path d="${line(layers.roads)}" fill="none" stroke="${COLORS.roads}" stroke-width="1.5" stroke-linecap="round"/>`)
  // one path per building keeps each path string short for the SVG renderer
  for (const r of layers.buildings || []) paths.push(`<path d="${poly([r])}" fill="${COLORS.buildings}"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#030509"/>${paths.join('')}</svg>`
}
