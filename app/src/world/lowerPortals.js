// app/src/world/lowerPortals.js — the famous ramps down to Chicago's lower levels (D4-1), from data/lowerPortals.json
// (OSM ramp ends), projected to the world, and the sign atlas lettered on their tunnel headers.
import data from '../data/lowerPortals.json'
import { project } from '../../../shared/project.js'

// [{ key, name, street, text, osm, at: [x, z] }]
export const NAMED_RAMPS = data.ramps.map((r) => ({ ...r, at: project(r.at[1], r.at[0]) }))

export const SIGN = { rowPx: 128, widthPx: 1024, green: '#0f5c3c', border: '#e8efe9', ink: '#f4f7f2' }

// the sign atlas: one row per placed sign (buildPortals signs, in order), then a black row for the tunnel throats.
// A row's sign fills the middle `frac` of it (the panel's width over a full 8:1 row). Returns a canvas, or null where
// there is no 2D canvas (tests).
export function drawSignAtlas(signs, doc = typeof document !== 'undefined' ? document : null) {
  const canvas = doc?.createElement?.('canvas'), g = canvas?.getContext?.('2d')
  if (!g) return null
  const W = SIGN.widthPx, R = SIGN.rowPx, rows = signs.length + 1
  canvas.width = W; canvas.height = R * rows
  g.fillStyle = '#000'; g.fillRect(0, 0, W, R * rows)
  signs.forEach((s, k) => {
    const w = W * s.frac, x0 = (W - w) / 2, y0 = k * R
    g.fillStyle = SIGN.green; g.fillRect(x0, y0, w, R)
    g.strokeStyle = SIGN.border; g.lineWidth = 6; g.strokeRect(x0 + 10, y0 + 10, w - 20, R - 20)
    g.fillStyle = SIGN.ink; g.textAlign = 'center'; g.textBaseline = 'middle'
    let px = 74
    const font = (p) => `600 ${p}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    g.font = font(px)
    while (px > 24 && g.measureText(s.text).width > w - 56) { px -= 2; g.font = font(px) }
    g.fillText(s.text, W / 2, y0 + R / 2 + 3)
  })
  return canvas
}
