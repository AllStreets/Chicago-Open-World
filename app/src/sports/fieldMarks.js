// app/src/sports/fieldMarks.js — every field as drawing ops in its local frame (metres).
// Frame: u along the venue axis (football/soccer: centre → north goal; baseball: home → centre field), v to its
// left seen from above (baseball: +v is the left-field side). Angles: radians from +u toward +v.
// Dimensions: NFL Rule 1, IFAB Law 1, MLB Official Rules 2.01–2.03. Colours: club brand guides (see shared/teams.js);
// grass, clay and track sampled from aerial photographs and kept or reverted per the V5 ledger.
export const FIELD_COLORS = {
  grassA: '#4f8f37', grassB: '#44802f', grassBase: '#4a8834', chalk: '#f2f2ec',
  wrigleyClay: '#9a5a3c', soxClay: '#8c573d', track: '#7b4e37',
  bearsNavy: '#0B162A', bearsOrange: '#C83803', cubsBlue: '#0E3386', cubsRed: '#CC3433', soxBlack: '#27251F', soxSilver: '#C4CED4',
}
const C = FIELD_COLORS
const YD = 0.9144
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
const circ = (c, r, n = 48) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i / n) * 2 * Math.PI), c[1] + r * Math.sin((i / n) * 2 * Math.PI)])
const arc = (c, r, a0, a1, n = 32) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] })
const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)]
const ringArc = (c, r0, r1, a0, a1, n = 40) => [...arc(c, r1, a0, a1, n), ...arc(c, r0, a1, a0, n)]

function football() {
  const H = 50 * YD, E = 10 * YD, W = 24.384, B = 1.8288
  const ops = [{ op: 'fill', color: C.grassBase }]
  for (let i = 0; i < 20; i++) { const u = -H + i * 5 * YD; ops.push({ op: 'poly', pts: rect(u, -W, u + 5 * YD, W), color: i % 2 ? C.grassB : C.grassA }) }
  for (const s of [1, -1]) ops.push({ op: 'poly', pts: rect(s * H, -W, s * (H + E), W), color: C.bearsNavy })
  // 6-ft white border outside the sidelines and end lines
  ops.push({ op: 'poly', pts: rect(-H - E - B, W, H + E + B, W + B), color: C.chalk }, { op: 'poly', pts: rect(-H - E - B, -W - B, H + E + B, -W), color: C.chalk },
    { op: 'poly', pts: rect(H + E, -W, H + E + B, W), color: C.chalk }, { op: 'poly', pts: rect(-H - E - B, -W, -H - E, W), color: C.chalk })
  for (let i = 0; i <= 20; i++) { const u = -H + i * 5 * YD; ops.push({ op: 'line', pts: [[u, -W], [u, W]], width: i % 20 === 0 ? 0.2032 : 0.1016, color: C.chalk }) }
  // one-yard marks: hash marks 70 ft 9 in from each sideline, and sideline ticks
  for (let y = 1; y < 100; y++) {
    if (y % 5 === 0) continue
    const u = -H + y * YD
    for (const s of [1, -1]) {
      const hv = s * (W - 21.5646)
      ops.push({ op: 'line', pts: [[u, hv - 0.305], [u, hv + 0.305]], width: 0.1016, color: C.chalk }, { op: 'line', pts: [[u, s * (W - 0.1524)], [u, s * (W - 0.762)]], width: 0.1016, color: C.chalk })
    }
  }
  // yard numbers: tops 9 yd from the sideline, read by someone standing mid-field and facing that sideline
  for (let k = 1; k <= 9; k++) {
    const u = -H + k * 10 * YD, n = String(10 * Math.min(k, 10 - k))
    for (const s of [1, -1]) ops.push({ op: 'text', text: n, at: [u, s * (W - 10 * YD)], size: 1.8288, angle: s > 0 ? 0 : Math.PI, color: C.chalk })
  }
  // midfield "C": navy keyline, orange letter, opening toward −u (reads upright from the west, +v, sideline)
  const gap = 0.75
  ops.push({ op: 'poly', pts: ringArc([0, 0], 2.44, 4.87, -(Math.PI - gap + 0.12), Math.PI - gap + 0.12), color: C.bearsNavy })
  ops.push({ op: 'poly', pts: ringArc([0, 0], 2.74, 4.57, -(Math.PI - gap), Math.PI - gap), color: C.bearsOrange })
  // end-zone wordmarks, across the field, baseline toward the goal line (readable from midfield)
  const word = { size: 6.4, color: '#ffffff', stroke: C.bearsOrange, strokeWidth: 0.35, maxWidth: 2 * W - 6 }
  ops.push({ op: 'text', text: 'BEARS', at: [H + E / 2, 0], angle: -Math.PI / 2, ...word })
  ops.push({ op: 'text', text: 'CHICAGO', at: [-(H + E / 2), 0], angle: Math.PI / 2, ...word })
  return ops
}

function soccer() {
  const L = 52.5, Wd = 34, w = 0.12
  const ops = [{ op: 'fill', color: C.grassBase }]
  for (let i = 0; i < 20; i++) { const u = -L + i * 5.25; ops.push({ op: 'poly', pts: rect(u, -Wd, u + 5.25, Wd), color: i % 2 ? C.grassB : C.grassA }) }
  const line = (pts, closed = false) => ops.push({ op: 'line', pts, width: w, color: C.chalk, closed })
  line(rect(-L, -Wd, L, Wd), true)
  line([[0, -Wd], [0, Wd]])
  line(circ([0, 0], 9.15, 64), true)
  ops.push({ op: 'poly', pts: circ([0, 0], 0.11, 12), color: C.chalk })
  const a = Math.acos(5.5 / 9.15)
  const corner = { '1,1': [Math.PI, 1.5 * Math.PI], '1,-1': [0.5 * Math.PI, Math.PI], '-1,1': [-0.5 * Math.PI, 0], '-1,-1': [0, 0.5 * Math.PI] }
  for (const s of [1, -1]) {
    line(rect(s * L, -20.16, s * (L - 16.5), 20.16), true)
    line(rect(s * L, -9.16, s * (L - 5.5), 9.16), true)
    const spot = [s * (L - 11), 0]
    ops.push({ op: 'poly', pts: circ(spot, 0.11, 12), color: C.chalk })
    line(s > 0 ? arc(spot, 9.15, Math.PI - a, Math.PI + a) : arc(spot, 9.15, -a, a))
    for (const t of [1, -1]) line(arc([s * L, t * Wd], 1, ...corner[`${s},${t}`], 8))
  }
  return ops
}

function baseball(frame, style) {
  const BASE = 27.432, MOUND = 18.44
  const clay = style === 'sox' ? C.soxClay : C.wrigleyClay
  const lf = polar(1, 45), rf = polar(1, -45)
  const along = (d, r) => [d[0] * r, d[1] * r]
  const grass = frame.grassRing ?? frame.ring
  const ops = [{ op: 'fill', color: C.track }, { op: 'poly', pts: grass, color: C.grassBase }, { op: 'clip', pts: grass }]
  if (style === 'wrigley') {
    // Wrigley's crosshatch: 15-ft squares aligned with the foul lines
    const s = 4.572, P = (p, q) => [lf[0] * p + rf[0] * q, lf[1] * p + rf[1] * q]
    for (let i = -3; i < 36; i++) for (let j = -3; j < 36; j++) if (Math.abs(i + j) % 2 === 0) ops.push({ op: 'poly', pts: [P(i * s, j * s), P((i + 1) * s, j * s), P((i + 1) * s, (j + 1) * s), P(i * s, (j + 1) * s)], color: C.grassB })
  } else {
    for (let k = 0; k < 30; k += 2) { const u = frame.u0 + k * 5.2; ops.push({ op: 'poly', pts: rect(u, frame.v0, u + 5.2, frame.v1), color: C.grassB }) }
  }
  ops.push({ op: 'unclip' })
  // skinned infield: the 95-ft arc round the mound, between the foul lines extended 3 ft behind home
  const apex = [-4.24, 0]
  ops.push({ op: 'clip', pts: [apex, [apex[0] + lf[0] * 260, lf[1] * 260], [apex[0] + 368, 0], [apex[0] + rf[0] * 260, rf[1] * 260]] })
  ops.push({ op: 'poly', pts: circ([MOUND, 0], 28.956, 96), color: clay, part: 'infield' })
  ops.push({ op: 'unclip' })
  const home = [0, 0], first = along(rf, BASE), second = [BASE * Math.SQRT2, 0], third = along(lf, BASE)
  const cen = [(home[0] + first[0] + second[0] + third[0]) / 4, 0]
  const shrink = (p) => [cen[0] + (p[0] - cen[0]) * 0.84, cen[1] + (p[1] - cen[1]) * 0.84]
  ops.push({ op: 'poly', pts: [home, first, second, third].map(shrink), color: style === 'wrigley' ? C.grassA : C.grassBase, part: 'infield-grass' })
  ops.push({ op: 'poly', pts: circ([MOUND, 0], 2.743, 32), color: clay, part: 'mound' })
  ops.push({ op: 'poly', pts: circ(home, 3.962, 40), color: clay, part: 'home' })
  for (const b of [first, second, third]) ops.push({ op: 'poly', pts: circ(b, 3.0, 24), color: clay, part: 'basecut' })
  // chalk: foul lines to the wall, bases (15 in, square to the lines), rubber, plate, boxes
  for (const d of [lf, rf]) ops.push({ op: 'line', pts: [[0, 0], along(d, 130)], width: 0.1016, color: C.chalk, part: 'foul' })
  const bq = (c) => [0, 1, 2, 3].map((i) => [c[0] + 0.269 * Math.cos((i * Math.PI) / 2), c[1] + 0.269 * Math.sin((i * Math.PI) / 2)])
  for (const b of [first, second, third]) ops.push({ op: 'poly', pts: bq(b), color: C.chalk, part: 'base' })
  ops.push({ op: 'poly', pts: rect(MOUND - 0.076, -0.305, MOUND + 0.076, 0.305), color: C.chalk, part: 'rubber' })
  ops.push({ op: 'poly', pts: [[0, 0], [0.2159, 0.2159], [0.4318, 0.2159], [0.4318, -0.2159], [0.2159, -0.2159]], color: C.chalk, part: 'plate' })
  for (const s of [1, -1]) ops.push({ op: 'line', pts: rect(0.2159 - 0.9144, s * 0.368, 0.2159 + 0.9144, s * (0.368 + 1.2192)), width: 0.0762, color: C.chalk, closed: true, part: 'box' })
  ops.push({ op: 'line', pts: [[-0.699, 0.546], [-2.438, 0.546], [-2.438, -0.546], [-0.699, -0.546]], width: 0.0762, color: C.chalk, part: 'catcher' })
  // on-deck circles, 5 ft across, between home and each dugout
  const deck = style === 'sox' ? [C.soxBlack, C.soxSilver] : [C.cubsBlue, C.chalk]
  for (const a of [120, -120]) {
    const c = polar(11.28, a)
    ops.push({ op: 'poly', pts: circ(c, 0.762, 24), color: deck[0], part: 'ondeck' })
    ops.push({ op: 'line', pts: circ(c, 0.762, 24), width: 0.08, color: deck[1], closed: true })
  }
  if (style === 'sox') ops.push({ op: 'text', text: 'SOX', at: [-10.5, 0], size: 3.2, angle: Math.PI / 2, color: C.soxBlack, stroke: C.soxSilver, strokeWidth: 0.25 })
  return ops
}

export function fieldMarks(layout, frame) {
  if (layout === 'football') return football()
  if (layout === 'soccer') return soccer()
  if (layout === 'baseball-wrigley') return baseball(frame, 'wrigley')
  if (layout === 'baseball-sox') return baseball(frame, 'sox')
  return [{ op: 'fill', color: C.grassBase }]
}
