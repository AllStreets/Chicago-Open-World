// app/src/sports/arenaCrown.js — the United Center's guide board (E3): which team's colours it wears, the words on its
// ribbon, the Bulls / Blackhawks board face, and the crown's geometry (pure, so it is tested without a GPU).
// The crown is a four-faced LED cube on a short mast at the roof centre (an echo of the centre-hung scoreboard inside),
// with an LED ribbon round the roof parapet and a small ring under the cube. A display added for the guide, not a real
// fixture. Lettering and simple shapes only — no club logos.

export const BULLS_RED = '#CE1141', HAWKS_RED = '#CF0A2C', LED_WHITE = '#F4F4F4' // a step below white, for the bloom
// The board takes the colours of the team whose game it shows: Blackhawks styling only for a Blackhawks game that is
// live or final (within the postgame hour); everything else — idle, the next game, the Sky — is the Bulls (user ask).
export function crownStyle(st) {
  return st?.game?.teams?.includes('blackhawks') && (st.state === 'live' || st.state === 'postgame') ? 'blackhawks' : 'bulls'
}

// The ribbon's running words: "NEXT MIL · TUE 7:00 PM", "LIVE · Q3 · CHI 78–71 MIL", "FINAL · CHI 104–97 MIL".
export function ribbonText(lines, style = 'bulls') {
  const cheer = style === 'blackhawks' ? 'GO HAWKS GO' : 'GO BULLS'
  let say = lines.status
  if (lines.rows.length === 2) {
    const [away, home] = lines.rows
    const score = home.score != null && away.score != null ? `${home.abbr} ${home.score}–${away.score} ${away.abbr}` : `${away.abbr} @ ${home.abbr}`
    say = lines.status === 'FINAL' ? `FINAL · ${score}` : /SOON|STARTS/.test(lines.status) ? `${lines.status} · ${score}` : `LIVE · ${lines.status} · ${score}`
  }
  return `${say}   ◆   ${lines.title}   ◆   ${cheer}   ◆   `
}

// The board face, drawn into (0, 0, W, H) of a canvas. Black LED ground, a red frame and header band with the team's
// name between two geometric horn shapes (Bulls) or white feather stripes (Blackhawks), the matchup and score in
// white, and the status in a band at the foot.
export function drawCrownFace(ctx, lines, style, W, H) {
  const red = style === 'blackhawks' ? HAWKS_RED : BULLS_RED
  const F = (w, px, it = '') => `${it}${w} ${Math.round(px)}px "Helvetica Neue", Arial, sans-serif`
  ctx.save()
  ctx.fillStyle = red; ctx.fillRect(0, 0, W, H)
  const b = H * 0.03
  ctx.fillStyle = '#000'; ctx.fillRect(b, b, W - 2 * b, H - 2 * b)
  // LED pitch: faint rows, so the face reads as a screen up close
  ctx.fillStyle = '#0b0b0d'
  for (let y = b + 3; y < H - b; y += H / 96) ctx.fillRect(b, y, W - 2 * b, 1)
  // header band
  const hb = H * 0.24
  ctx.fillStyle = red; ctx.fillRect(b, b, W - 2 * b, hb)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(b, b + hb - H * 0.012, W - 2 * b, H * 0.012)
  const name = style === 'blackhawks' ? 'BLACKHAWKS' : 'BULLS', cy = b + hb * 0.52
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = LED_WHITE; ctx.font = F(900, hb * 0.74, 'italic ')
  ctx.fillText(name, W / 2, cy, W * 0.56)
  if (style === 'blackhawks') {
    // white and black feather stripes at both ends of the band
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const x0 = W / 2 + side * (W * 0.33 + i * W * 0.032)
      ctx.fillStyle = i % 2 ? '#000' : LED_WHITE
      ctx.beginPath(); ctx.moveTo(x0, b + hb * 0.18); ctx.lineTo(x0 + side * W * 0.022, b + hb * 0.18); ctx.lineTo(x0 + side * W * 0.05, b + hb * 0.82); ctx.lineTo(x0 + side * W * 0.028, b + hb * 0.82); ctx.closePath(); ctx.fill()
    }
  } else {
    // a pair of horns each side: a swept crescent, base inboard, tip curling up and out
    ctx.fillStyle = '#000'
    for (const side of [-1, 1]) {
      const x = W / 2 + side * W * 0.31, y = cy + hb * 0.12, s = hb * 0.95
      ctx.beginPath()
      ctx.moveTo(x, y + s * 0.1)
      ctx.quadraticCurveTo(x + side * s * 0.75, y + s * 0.12, x + side * s * 0.95, y - s * 0.42)
      ctx.quadraticCurveTo(x + side * s * 0.5, y - s * 0.12, x, y - s * 0.16)
      ctx.closePath(); ctx.fill()
    }
  }
  // the venue under the band
  ctx.fillStyle = '#8c8c90'; ctx.font = F(700, H * 0.062); ctx.fillText(lines.title.split('').join(' '), W / 2, b + hb + H * 0.06, W * 0.8)
  // the foot band
  const fy = H - b - H * 0.19
  ctx.fillStyle = '#16020a'; ctx.fillRect(b, fy, W - 2 * b, H * 0.19)
  ctx.fillStyle = red; ctx.fillRect(b, fy, W - 2 * b, H * 0.008)
  if (lines.rows.length) {
    lines.rows.forEach((r, i) => {
      const y = b + hb + H * (0.2 + i * 0.165)
      ctx.fillStyle = LED_WHITE; ctx.font = F(800, H * 0.155)
      ctx.textAlign = 'left'; ctx.fillText(r.abbr, W * 0.09, y, W * 0.5)
      ctx.textAlign = 'right'; ctx.fillText(r.score == null ? '–' : String(r.score), W * 0.91, y)
    })
    ctx.fillStyle = red; ctx.fillRect(W * 0.09, b + hb + H * 0.2825, W * 0.82, H * 0.006)
    const live = !/FINAL|SOON|STARTS/.test(lines.status)
    ctx.textAlign = 'center'; ctx.font = F(800, H * 0.115)
    ctx.fillStyle = live ? '#ff3b5c' : LED_WHITE
    ctx.fillText(live ? `● ${lines.status}` : lines.status, W / 2, fy + H * 0.1, W * 0.86)
  } else {
    const [head, ...rest] = lines.status.split(' · ')
    ctx.textAlign = 'center'; ctx.fillStyle = LED_WHITE; ctx.font = F(900, H * 0.17)
    ctx.fillText(head, W / 2, b + hb + H * 0.27, W * 0.86)
    ctx.font = F(800, H * 0.105); ctx.fillStyle = LED_WHITE
    ctx.fillText(rest.length ? rest.join(' · ') : 'HOME OF THE BULLS AND BLACKHAWKS', W / 2, fy + H * 0.1, W * 0.86)
  }
  ctx.restore()
}

// The two swatches under the face on the crown's canvas (the cube's black body and its red trim sample them), so the
// whole cube is one mesh with one material.
// The face fills v ∈ [faceV0, 1]; the swatches fill v < faceV0 (black on the left half, red on the right).
export const SWATCH_H = 64
export const faceV0For = (faceH) => SWATCH_H / (faceH + SWATCH_H)
export function drawSwatches(ctx, style, W, faceH) {
  ctx.fillStyle = '#060607'; ctx.fillRect(0, faceH, W / 2, SWATCH_H)
  ctx.fillStyle = style === 'blackhawks' ? HAWKS_RED : BULLS_RED; ctx.fillRect(W / 2, faceH, W / 2, SWATCH_H)
}

const TRIM = 0.5, EPS = 0.06
// The cube (four faces + red trim + black caps and mast) → { position, uv, index } for one BufferGeometry.
// faceV0 = where the face starts in v (the swatch strip is below it).
export function crownCubeGeometry(crown, faceV0) {
  const [cx, cz] = crown.center, { w, h } = crown.face, y0 = crown.faceY - h / 2, y1 = crown.faceY + h / 2, hw = w / 2
  const P = [], U = [], I = []
  const quad = (a, b, c, d, ua, ub, uc, ud) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); U.push(...ua, ...ub, ...uc, ...ud); I.push(n, n + 1, n + 2, n, n + 2, n + 3) }
  const sw = (k) => [k === 'red' ? 0.75 : 0.25, faceV0 / 2]
  const NORMALS = [[0, 1], [1, 0], [0, -1], [-1, 0]]
  for (const [nx, nz] of NORMALS) {
    const rx = nz, rz = -nx // the viewer's right, looking at this face from outside
    const at = (s, y, out = hw + EPS) => [cx + nx * out + rx * s * hw, y, cz + nz * out + rz * s * hw]
    quad(at(-1, y0), at(1, y0), at(1, y1), at(-1, y1), [0, faceV0], [1, faceV0], [1, 1], [0, 1]) // the face
    const r = sw('red'), k = sw('black')
    quad(at(-1, y1, hw + EPS * 2), at(1, y1, hw + EPS * 2), at(1, y1 + TRIM, hw + EPS * 2), at(-1, y1 + TRIM, hw + EPS * 2), r, r, r, r) // trim above
    quad(at(-1, y0 - TRIM, hw + EPS * 2), at(1, y0 - TRIM, hw + EPS * 2), at(1, y0, hw + EPS * 2), at(-1, y0, hw + EPS * 2), r, r, r, r) // trim below
    // the mast's side: from the roof to the cube's underside
    const m = 1.4, ma = (s, y) => [cx + nx * m + rx * s * m, y, cz + nz * m + rz * s * m]
    quad(ma(-1, crown.roofY - 0.6), ma(1, crown.roofY - 0.6), ma(1, y0 - TRIM), ma(-1, y0 - TRIM), k, k, k, k)
  }
  const k = sw('black'), c = (sx, sz, y) => [cx + sx * (hw + EPS * 2), y, cz + sz * (hw + EPS * 2)]
  quad(c(-1, 1, y1 + TRIM), c(1, 1, y1 + TRIM), c(1, -1, y1 + TRIM), c(-1, -1, y1 + TRIM), k, k, k, k) // lid
  quad(c(-1, -1, y0 - TRIM), c(1, -1, y0 - TRIM), c(1, 1, y0 - TRIM), c(-1, 1, y0 - TRIM), k, k, k, k) // underside
  return { position: new Float32Array(P), uv: new Float32Array(U), index: I }
}

export const RIBBON_ASPECT = 32 // the ribbon texture is 2048 × 64: one repeat per 32 band-heights of length
// The parapet ribbon (a band round the ring) and the small ring under the cube, sharing the scrolling texture. Each
// ring is walked so the text runs left-to-right for someone outside looking in (clockwise in plan, x east, z south).
export function crownRibbonGeometry(crown) {
  const P = [], U = [], I = []
  const band = (pts, top, h) => {
    let area = 0
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1] }
    const ring = area > 0 ? [...pts].reverse() : pts, tile = h * RIBBON_ASPECT
    let u = 0
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (L < 1e-3) continue
      const n = P.length / 3, u1 = u + L / tile
      P.push(a[0], top - h, a[1], b[0], top - h, b[1], b[0], top, b[1], a[0], top, a[1])
      U.push(u, 0, u1, 0, u1, 1, u, 1)
      I.push(n, n + 1, n + 2, n, n + 2, n + 3)
      u = u1
    }
  }
  if (crown.ribbon?.ring?.length >= 3) band(crown.ribbon.ring, crown.ribbon.top, crown.ribbon.h)
  const [cx, cz] = crown.center, r = crown.face.w * 0.32, yb = crown.faceY - crown.face.h / 2 - TRIM - 0.5
  band([[cx - r, cz - r], [cx + r, cz - r], [cx + r, cz + r], [cx - r, cz + r]], yb, 2.2)
  return { position: new Float32Array(P), uv: new Float32Array(U), index: I }
}

export function drawRibbon(ctx, text, style, W, H) {
  const red = style === 'blackhawks' ? HAWKS_RED : BULLS_RED
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = red; ctx.fillRect(0, 0, W, H * 0.09); ctx.fillRect(0, H * 0.91, W, H * 0.09)
  ctx.fillStyle = LED_WHITE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.round(H * 0.6)}px "Helvetica Neue", Arial, sans-serif`
  // the text repeats across the tile so the band never shows a gap (the tile wraps)
  const n = Math.max(1, Math.round(W / (text.length * H * 0.36)))
  for (let i = 0; i < n; i++) ctx.fillText(text, (i * W) / n + H * 0.2, H * 0.53, W / n - H * 0.3)
}
