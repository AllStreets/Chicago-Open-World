// app/src/sports/formations.js — who stands where, in field-frame metres (see fieldMarks.js for the frame).
export const HALF_INNING_S = 720
export const PLAY_S = 35
const NFL_HALF = 54.864, NFL_W = 24.384
const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)]
const h01 = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

const FIELDERS = [['P', 18.44, 0], ['C', -1.3, 0], ['1B', 29, -38], ['2B', 40, -14], ['SS', 40, 14], ['3B', 29, 38], ['LF', 88, 28], ['CF', 97, 0], ['RF', 88, -28]]
const BASES = [[27.432, -45], [38.795, 0], [27.432, 45]]
function baseball(t) {
  const half = Math.floor(t / HALF_INNING_S), def = half % 2 === 0 ? 'home' : 'away', off = def === 'home' ? 'away' : 'home'
  const out = FIELDERS.map(([role, r, deg], i) => {
    const [u, v] = role === 'C' ? [r, 0] : polar(r, deg), still = role === 'P' || role === 'C'
    return { u: u + (still ? 0 : 0.4 * Math.sin(t * 0.7 + i * 1.9)), v: v + (still ? 0 : 0.4 * Math.sin(t * 0.6 + i * 2.3)), side: def, role }
  })
  out.push({ u: 0.2, v: 0.95, side: off, role: 'B' })
  const ab = Math.floor(t / 150)
  BASES.forEach(([r, deg], i) => { if (h01(ab * 3 + i + half * 17) < 0.3) { const [u, v] = polar(r, deg); out.push({ u: u - 1.2, v, side: off, role: `R${i + 1}` }) } })
  for (const [r, deg] of [[-2.4, 0], [31, -52], [44, 10], [31, 52]]) { const [u, v] = r < 0 ? [r, 0] : polar(r, deg); out.push({ u, v, side: 'official', role: 'U' }) }
  return out
}

function footballState(t) {
  const series = Math.floor(t / 300), dir = series % 2 === 0 ? 1 : -1
  const k = t % PLAY_S, run = k > 8 && k < 14 ? (k - 8) / 6 : k >= 14 ? 1 - Math.min(1, (k - 14) / 6) : 0
  return { dir, offence: series % 2 === 0 ? 'home' : 'away', los: dir * (-30 + ((t % 300) / 300) * 55), run }
}
const O = [['C', -0.6, 0], ['LG', -0.6, 1.3], ['RG', -0.6, -1.3], ['LT', -0.6, 2.6], ['RT', -0.6, -2.6], ['TE', -0.6, 3.9], ['WR', -0.6, 16], ['WR', -0.6, -16], ['QB', -1.5, 0], ['FB', -4.5, 0], ['RB', -7, 0]]
const D = [['DT', 1, 0.7], ['DT', 1, -0.7], ['DE', 1, 3.2], ['DE', 1, -3.2], ['MLB', 5, 0], ['OLB', 5, 4.5], ['OLB', 5, -4.5], ['CB', 7, 16], ['CB', 7, -16], ['S', 12, 6], ['S', 12, -6]]
const MOVE = { WR: 14, QB: -5, CB: 12, S: 6 }
function football(t) {
  const { dir, offence, los, run } = footballState(t), defence = offence === 'home' ? 'away' : 'home'
  const at = (a, v, role, side) => ({ u: clamp(los + dir * (a + (MOVE[role] ?? 1.2) * run), -NFL_HALF, NFL_HALF), v: clamp(v, -NFL_W, NFL_W), side, role })
  return [
    ...O.map(([role, a, v]) => at(a, v, role, offence)), ...D.map(([role, a, v]) => at(a, v, role, defence)),
    { u: clamp(los - dir * 12, -NFL_HALF, NFL_HALF), v: 3, side: 'official', role: 'R' }, { u: clamp(los + dir * 6, -NFL_HALF, NFL_HALF), v: 0, side: 'official', role: 'U' },
    { u: los, v: NFL_W + 1, side: 'official', role: 'HL' }, { u: los, v: -NFL_W - 1, side: 'official', role: 'LJ' }, { u: clamp(los + dir * 22, -NFL_HALF, NFL_HALF), v: 0, side: 'official', role: 'BJ' },
  ]
}

const F442 = [['GK', -48, 0], ['D', -35, 8], ['D', -35, -8], ['D', -33, 22], ['D', -33, -22], ['M', -18, 8], ['M', -18, -8], ['M', -16, 24], ['M', -16, -24], ['F', -4, 7], ['F', -4, -7]]
function soccer(t) {
  const drift = 8 * Math.sin(t / 40)
  const place = (s, side) => F442.map(([role, u, v], i) => ({ u: clamp(s * (u + (role === 'GK' ? 0 : drift)), -52.5, 52.5), v: clamp(v + 1.5 * Math.sin(t / 7 + i), -34, 34), side, role }))
  return [...place(1, 'home'), ...place(-1, 'away'), { u: clamp(20 * Math.sin(t / 25), -52.5, 52.5), v: 5, side: 'official', role: 'REF' }]
}

export function formation(sport, t) {
  if (sport === 'baseball') return baseball(t)
  if (sport === 'football') return football(t)
  if (sport === 'soccer') return soccer(t)
  return []
}

export function ballAt(sport, t) {
  if (sport === 'baseball') {
    const k = t % 22, n = Math.floor(t / 22)
    if (k < 0.45) { const f = k / 0.45; return [17.5 * (1 - f) + 0.3 * f, 1.9 - 1.0 * f, 0.1] }
    if (n % 5 === 0 && k < 4.45) { const f = (k - 0.45) / 4, [eu, ev] = polar(82, 22); return [eu * f, 1 + 4 * 30 * f * (1 - f), ev * f] }
    return [18.0, 1.5, 0.35]
  }
  if (sport === 'football') {
    const k = t % PLAY_S
    if (k > 9 && k < 12) {
      const qb = formation('football', t - k + 9).find((p) => p.role === 'QB'), wr = formation('football', t - k + 12).find((p) => p.role === 'WR')
      const f = (k - 9) / 3
      return [qb.u + (wr.u - qb.u) * f, 2 + 4 * 12 * f * (1 - f), qb.v + (wr.v - qb.v) * f]
    }
    const { los } = footballState(t)
    return [los, 0.15, 0]
  }
  if (sport === 'soccer') {
    const k = t % 4, n = Math.floor(t / 4), f = k / 4, pl = formation('soccer', n * 4)
    const a = pl[Math.floor(h01(n) * 22)], b = pl[Math.floor(h01(n + 0.5) * 22)]
    return [a.u + (b.u - a.u) * f, 0.11 + 4 * 3 * f * (1 - f), a.v + (b.v - a.v) * f]
  }
  return null
}

// Kits: MLB home whites and road greys; NFL/MLS home teams in their colour (the Bears wear navy at home).
export function uniformColors(sport, homeTeam) {
  if (sport === 'baseball') return { home: '#F4F4F0', away: '#9A9CA0', official: '#1F2530' }
  if (sport === 'soccer') return { home: homeTeam?.colors?.[0] ?? '#FF0000', away: '#F4F4F0', official: '#F2D21B' }
  return { home: homeTeam?.colors?.[0] ?? '#0B162A', away: '#F4F4F0', official: '#E6E6E6' }
}
