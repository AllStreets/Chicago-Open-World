// app/src/landmarks/fireworksChoreo.js — a fireworks show as data (user request 2026-09-29): every shell's launch,
// burst time, height, kind and colours, deterministic from a seed, with a shape like the real thing — a few big
// opening shells, a theme, a build with salvos, a breath of gold willows, then a finale barrage. The renderer turns
// this into one static particle buffer; the flash, sound and music all read the same list.
import { BARGE } from './fireworksSchedule.js'

export const SHOW_S = 780 // 13 minutes
export const KINDS = ['peony', 'chrysanthemum', 'willow', 'ring', 'crossette', 'crackle']
export const STARS = { peony: 130, chrysanthemum: 140, willow: 160, ring: 90, crossette: 44, crackle: 100 } // crossette stars split in 4
const PALETTE = {
  red: [1.0, 0.16, 0.1], gold: [1.0, 0.68, 0.22], green: [0.22, 1.0, 0.38], blue: [0.26, 0.46, 1.0], purple: [0.78, 0.3, 1.0],
  white: [1.0, 0.96, 0.9], silver: [0.84, 0.9, 1.0], orange: [1.0, 0.46, 0.1], teal: [0.2, 0.95, 0.85], pink: [1.0, 0.4, 0.75],
}
const SECTIONS = [ // [from s, shells per second, kinds weighting]
  [0, 0.3, ['peony', 'chrysanthemum', 'peony']],
  [60, 0.42, KINDS],
  [300, 0.8, [...KINDS, 'ring', 'crossette']],
  [600, 0.25, ['willow', 'willow', 'chrysanthemum']],
  [660, 0.8, KINDS],
  [735, 4.6, ['peony', 'chrysanthemum', 'crackle', 'willow', 'crossette', 'peony']],
]

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296 } }

export function buildShow(seed = 1) {
  const r = rng(seed), shells = []
  const cols = Object.keys(PALETTE)
  for (let si = 0; si < SECTIONS.length; si++) {
    const [from, rate, kinds] = SECTIONS[si], to = SECTIONS[si + 1]?.[0] ?? SHOW_S - 4
    for (let t = from + 1.5; t < to; ) {
      const salvo = si === 2 && r() < 0.12 ? 5 : 1 // the build fires the odd salvo
      for (let k = 0; k < salvo; k++) {
        const kind = kinds[Math.floor(r() * kinds.length)]
        const big = si === 0 || si === 5 || r() < 0.2
        const c1 = kind === 'willow' ? 'gold' : cols[Math.floor(r() * cols.length)], c2 = r() < 0.5 ? c1 : cols[Math.floor(r() * cols.length)]
        const a = r() * Math.PI * 2, d = 40 + r() * 190
        shells.push({
          t: +(t + k * 0.35).toFixed(3), rise: 2.2 + r() * 1.0, kind,
          burst: [BARGE[0] + Math.cos(a) * d, 110 + r() * (big ? 140 : 90), BARGE[2] + Math.sin(a) * d * 0.7],
          size: (big ? 1.25 : 0.85) + r() * 0.35, c1: PALETTE[c1], c2: PALETTE[c2], seed: Math.floor(r() * 1e9),
        })
      }
      t += (1 / rate) * (0.6 + r() * 0.8)
    }
  }
  shells.sort((a, b) => a.t - b.t)
  const particles = shells.reduce((n, s) => n + STARS[s.kind] * (s.kind === 'crossette' ? 5 : 1) + 8, 0)
  return { shells, particles, duration: SHOW_S }
}

// The light of the bursts on the water and the towers: strongest just after a burst, gone in about a second.
export function flashAt(show, t) {
  let lo = 0, hi = show.shells.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (show.shells[m].t < t - 1.4) lo = m + 1; else hi = m } // the first shell that can still light
  let w = 0, col = [0, 0, 0], pos = [0, 0, 0]
  for (let i = lo; i < show.shells.length && show.shells[i].t <= t; i++) {
    const s = show.shells[i], k = Math.exp(-(t - s.t) * 3.2) * s.size
    w += k
    for (let j = 0; j < 3; j++) { col[j] += s.c1[j] * k; pos[j] += s.burst[j] * k }
  }
  if (w <= 0) return { intensity: 0, color: [0, 0, 0], pos: [...BARGE] }
  return { intensity: Math.min(1.6, w), color: col.map((c) => c / w), pos: pos.map((p) => p / w) }
}
