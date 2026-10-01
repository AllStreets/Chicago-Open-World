// app/src/sports/scoreboard.js — what each board says, and how it is drawn (a 1024 × 512 canvas).
import { gameWindow } from './gameState.js'
import { hashFrac } from './simSchedule.js'
import { whenChicago } from './chicagoTime.js'
import { teamByKey } from '../../../shared/teams.js'
import { useSports } from './sportsStore.js'
import { drawCrownFace } from './arenaCrown.js'

const frac = (g, nowMs) => { const w = gameWindow(g); return Math.max(0, Math.min(1, (nowMs - w.start) / (w.end - w.start))) }

// Each run/point of the final arrives at a fixed, hashed moment, so the score only rises.
export function simScore(game, nowMs) {
  if (game?.home?.score == null || game?.away?.score == null) return null
  const f = frac(game, nowMs)
  const upTo = (total, salt) => { let s = 0; for (let i = 0; i < total; i++) if (hashFrac(`${game.id}:${salt}:${i}`) < f) s++; return s }
  if (f >= 1) return { home: game.home.score, away: game.away.score }
  return { home: upTo(game.home.score, 'h'), away: upTo(game.away.score, 'a') }
}

export const ordinal = (n) => { const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'; return `${n}${s}` }

export function periodLabel(game, nowMs, state) {
  if (state === 'postgame') return 'FINAL'
  if (state === 'pregame') return `STARTS ${whenChicago(Date.parse(game.start), nowMs).toUpperCase()}`
  if (state !== 'live') return ''
  const f = frac(game, nowMs)
  if (game.sport === 'baseball') { const h = Math.min(17, Math.floor(f * 18)); return `${h % 2 ? 'BOT' : 'TOP'} ${ordinal(Math.floor(h / 2) + 1).toUpperCase()}` }
  if (game.sport === 'football' || game.sport === 'basketball') return `Q${Math.min(4, Math.floor(f * 4) + 1)}`
  if (game.sport === 'hockey') return `P${Math.min(3, Math.floor(f * 3) + 1)}`
  if (game.sport === 'soccer') return `${Math.min(90, Math.floor(f * 97))}'`
  return 'LIVE'
}

export function boardLines(venue, st, nowMs, override = null) {
  const title = venue.name.toUpperCase(), g = st?.game
  if (!g || !st || st.state === 'idle') {
    const n = st?.next
    // the visitor relative to THIS venue's team (a merged Crosstown record may carry the other club's chicagoHome)
    const homeHere = n && (venue.teams?.length ? venue.teams.some((k) => teamByKey(k)?.abbr === n.home.abbr) : n.chicagoHome !== false)
    return { title, rows: [], status: n ? `NEXT ${homeHere ? n.away.abbr : n.home.abbr} · ${whenChicago(Date.parse(n.start), nowMs).toUpperCase()}` : 'WELCOME' }
  }
  let score = null
  if (override) score = { home: override.home, away: override.away }
  else if (g.simulated) score = st.state === 'live' ? simScore(g, nowMs) : st.state === 'postgame' ? { home: g.home.score, away: g.away.score } : null
  else if (g.home.score != null && g.away.score != null) score = { home: g.home.score, away: g.away.score }
  const liveStatus = st.state === 'live' && g.live?.status ? String(g.live.status).toUpperCase() : null // P5: ESPN's own words ("TOP 3RD")
  const showStatus = st.state === 'pregame' && g.pregameStatus ? g.pregameStatus : null // E4: a showcase's warm-up ("FIRST PITCH SOON")
  return { title, rows: [{ abbr: g.away.abbr, score: score?.away ?? null }, { abbr: g.home.abbr, score: score?.home ?? null }], status: override?.status ?? liveStatus ?? showStatus ?? periodLabel(g, nowMs, st.state) }
}

// Phase 5 hook: live numbers from the CHI API replace the board's numbers until cleared with null.
export function setScoreboard(venueKey, lines) { useSports.getState().setBoardOverride(venueKey, lines) }

export function drawBoard(ctx, lines, style, W, H) {
  if (style === 'bulls' || style === 'blackhawks') { drawCrownFace(ctx, lines, style, W, H); return } // E3: the United Center board
  const manual = style === 'manual'
  ctx.fillStyle = manual ? '#1F4D33' : '#050608'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = manual ? '#F2F2EC' : '#FFB347'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(H * 0.1)}px "Helvetica Neue", Arial, sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(lines.title, W / 2, H * 0.1)
  ctx.font = `800 ${Math.round(H * 0.22)}px "Helvetica Neue", Arial, sans-serif`
  lines.rows.forEach((r, i) => {
    const y = H * (0.34 + i * 0.28)
    ctx.fillStyle = manual ? '#F2F2EC' : '#FFFFFF'; ctx.textAlign = 'left'; ctx.fillText(r.abbr, W * 0.08, y)
    ctx.textAlign = 'right'; ctx.fillText(r.score == null ? '–' : String(r.score), W * 0.92, y)
  })
  ctx.fillStyle = manual ? '#F2F2EC' : '#FFB347'; ctx.textAlign = 'center'
  ctx.font = `700 ${Math.round(H * 0.12)}px "Helvetica Neue", Arial, sans-serif`
  ctx.fillText(lines.status, W / 2, lines.rows.length ? H * 0.9 : H * 0.55)
}
