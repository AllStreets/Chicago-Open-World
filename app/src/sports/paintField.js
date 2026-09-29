// app/src/sports/paintField.js — runs fieldMarks ops on a 2D canvas context. Canvas row 0 is the frame's v1 edge
// (the shader samples t = (v1 − v)/(v1 − v0)), so the painted field is not mirrored seen from above.
export const MIN_LINE_PX = 1.5
const scale = (f, W, H) => [W / (f.u1 - f.u0), H / (f.v1 - f.v0)]
export function toPx(f, W, H, [u, v]) { const [sx, sy] = scale(f, W, H); return [(u - f.u0) * sx, (f.v1 - v) * sy] }
function trace(ctx, f, W, H, pts, closed) {
  ctx.beginPath()
  pts.forEach((p, i) => { const [x, y] = toPx(f, W, H, p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
  if (closed) ctx.closePath()
}

export function paintField(ctx, ops, f, W, H) {
  const [sx, sy] = scale(f, W, H), s = Math.sqrt(sx * sy)
  for (const o of ops) {
    if (o.op === 'fill') { ctx.fillStyle = o.color; ctx.fillRect(0, 0, W, H) }
    else if (o.op === 'poly') { ctx.fillStyle = o.color; trace(ctx, f, W, H, o.pts, true); ctx.fill() }
    else if (o.op === 'line') {
      ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(o.width * Math.min(sx, sy), MIN_LINE_PX); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'
      trace(ctx, f, W, H, o.pts, !!o.closed); ctx.stroke()
    }
    else if (o.op === 'clip') { ctx.save(); trace(ctx, f, W, H, o.pts, true); ctx.clip() }
    else if (o.op === 'unclip') ctx.restore()
    else if (o.op === 'text') {
      const [x, y] = toPx(f, W, H, o.at)
      ctx.save(); ctx.translate(x, y)
      ctx.rotate(Math.atan2(-Math.sin(o.angle) * sy, Math.cos(o.angle) * sx))
      ctx.font = `900 ${(o.size * s).toFixed(1)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const mw = o.maxWidth ? o.maxWidth * s : undefined
      if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeWidth * s * 2; if (mw) ctx.strokeText(o.text, 0, 0, mw); else ctx.strokeText(o.text, 0, 0) }
      ctx.fillStyle = o.color
      if (mw) ctx.fillText(o.text, 0, 0, mw); else ctx.fillText(o.text, 0, 0)
      ctx.restore()
    }
  }
}
