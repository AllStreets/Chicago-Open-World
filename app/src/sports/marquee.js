// app/src/sports/marquee.js — the red marquee over the main gate at Clark & Addison (1934): its shaped outline,
// what the message board says, and how the face is lettered. Lettering only — no club or sponsor logos.
import { whenChicago } from './chicagoTime.js'
import { periodLabel } from './scoreboard.js'

export const MARQUEE_RED = '#a3121c'
const CREST_AT = 0.72, SIDE_AT = 0.6, CREST_HALF = 0.34 // fractions of the sign's height / width

// Outline in sign space (x across, y up from the bottom edge), counter-clockwise: flat base, straight sides,
// a scrolled shoulder each side and an arched crest over WRIGLEY FIELD.
export function marqueeOutline(w, h, n = 24) {
  const hw = w / 2, side = h * SIDE_AT, y1 = h * CREST_AT, cx = w * CREST_HALF, curl = w * 0.04
  const pts = [[-hw, 0], [hw, 0], [hw, side]]
  const quad = (a, c, b) => { for (let i = 1; i <= n / 3; i++) { const t = i / (n / 3), u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]) } }
  // right shoulder: a small inward curl, then up and over into the crest
  quad([hw, side], [hw - curl * 0.2, side + curl * 0.9], [hw - curl, side + curl * 0.4])
  quad([hw - curl, side + curl * 0.4], [cx + (hw - curl - cx) * 0.3, y1 + (h - y1) * 0.1], [cx, y1])
  for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI; pts.push([cx * Math.cos(a), y1 + (h - y1) * Math.sin(a)]) }
  pts.push([-cx, y1])
  quad([-cx, y1], [-cx - (hw - curl - cx) * 0.3, y1 + (h - y1) * 0.1], [-(hw - curl), side + curl * 0.4])
  quad([-(hw - curl), side + curl * 0.4], [-hw + curl * 0.2, side + curl * 0.9], [-hw, side])
  return pts
}

// Two lines for the message board.
export function marqueeMessage(st, nowMs = Date.now()) {
  const g = st?.game, vs = g && `${g.away.abbr} @ ${g.home.abbr}`
  // E4: during "Play a game" the board ticks with the score and the inning, on the game's own clock
  if (g?.showcase && st.state === 'live') return ['GO CUBS GO', `${g.away.abbr} ${g.away.score ?? 0} · ${g.home.abbr} ${g.home.score ?? 0} · ${periodLabel(g, nowMs, 'live')}`]
  if (g && st.state === 'live') return ['GO CUBS GO', `${vs} · TODAY`]
  if (g && st.state === 'pregame') return ['GAME TODAY', `${vs} · ${whenChicago(Date.parse(g.start), nowMs).toUpperCase()}`]
  if (g && st.state === 'postgame') {
    const s = g.home.score != null && g.away.score != null ? ` ${g.away.score}-${g.home.score}` : ''
    return ['FINAL', `${vs}${s}`]
  }
  const n = st?.next
  if (n) return ['GO CUBS GO', `NEXT GAME ${n.home.abbr === 'CHC' ? n.away.abbr : n.home.abbr} ${whenChicago(Date.parse(n.start), nowMs).toUpperCase()}`]
  return ['GO CUBS GO', 'WELCOME TO WRIGLEY']
}

// Canvas layout (top-down pixels) of the photographed face: WRIGLEY FIELD in the crest, HOME OF, CHICAGO CUBS,
// then the black LED board.
export function marqueeLayout(W, H) {
  return {
    lines: [
      { text: 'WRIGLEY FIELD', y: H * 0.245, size: H * 0.14, max: W * 0.56 },
      { text: 'HOME OF', y: H * 0.39, size: H * 0.085, max: W * 0.4 },
      { text: 'CHICAGO CUBS', y: H * 0.52, size: H * 0.13, max: W * 0.8 },
    ],
    board: { x: W * 0.085, y: H * 0.615, w: W * 0.83, h: H * 0.3 },
  }
}

export function drawMarquee(ctx, msg, W, H, w = 10, h = 5.8) {
  const out = marqueeOutline(w, h)
  const path = (k) => {
    ctx.beginPath()
    out.forEach(([x, y], i) => { const px = W / 2 + (x / w) * W * k, py = H - ((y - h / 2) * k + h / 2) / h * H; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) })
    ctx.closePath()
  }
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = MARQUEE_RED; path(1); ctx.fill()
  ctx.strokeStyle = '#efe8dc'; ctx.lineWidth = H * 0.012; path(0.95); ctx.stroke()
  const L = marqueeLayout(W, H)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f4efe4'
  for (const l of L.lines) { ctx.font = `bold ${Math.round(l.size)}px Georgia, 'Times New Roman', serif`; ctx.fillText(l.text, W / 2, l.y, l.max) }
  const b = L.board
  ctx.fillStyle = '#efe8dc'; ctx.fillRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12)
  ctx.fillStyle = '#0b0b0d'; ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.fillStyle = '#fff4d6'; ctx.font = `bold ${Math.round(b.h * 0.34)}px 'Courier New', monospace`
  ctx.fillText(msg[0], W / 2, b.y + b.h * 0.3, b.w * 0.92)
  ctx.font = `bold ${Math.round(b.h * 0.26)}px 'Courier New', monospace`
  ctx.fillText(msg[1], W / 2, b.y + b.h * 0.72, b.w * 0.92)
}
