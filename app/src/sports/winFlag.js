// app/src/sports/winFlag.js — the flag over Wrigley's scoreboard: white with a blue W after a win,
// blue with a white L after a loss (a Wrigley tradition since 1937).
export const FLAG_COLORS = { blue: '#0E3386', white: '#FFFFFF' }
export const flagKind = (st) => (st?.winDay ? 'W' : st?.lossDay ? 'L' : null)
export function drawFlag(ctx, kind, W, H) {
  const [bg, fg] = kind === 'W' ? [FLAG_COLORS.white, FLAG_COLORS.blue] : [FLAG_COLORS.blue, FLAG_COLORS.white]
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.round(H * 0.82)}px "Helvetica Neue", Arial, sans-serif`
  ctx.fillText(kind, W / 2, H * 0.53)
}
