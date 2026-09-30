// app/src/landmarks/fireworksBuffers.js — a fireworks show (fireworksChoreo.js) as one static particle buffer: every
// star's start time, origin, initial velocity, colour and physics, so the GPU animates the whole show from a single
// time uniform (one draw call, nothing per frame on the CPU). Motion: exponential drag toward a terminal velocity
// plus gravity — p(τ) = o + v·(1−e^(−dτ))/d − ĝ·(τ − (1−e^(−dτ))/d)/d.
import { BARGE } from './fireworksSchedule.js'
import { STARS } from './fireworksChoreo.js'

// kind → [speed m/s, drag 1/s, gravity m/s², life s, star size m, glitter]
// (a peony opens to ~speed/drag ≈ 100 m radius, like a real 8–10 inch shell)
export const PHYSICS = {
  peony: [165, 1.6, 9.8, 2.4, 2.4, 0], chrysanthemum: [175, 1.4, 9.8, 3.0, 2.1, 0], willow: [105, 0.9, 13, 5.0, 2.0, 0],
  ring: [160, 1.6, 9.8, 2.3, 2.4, 0], crossette: [120, 1.5, 9.8, 1.1, 2.5, 0], crackle: [120, 1.8, 9.8, 2.5, 1.8, 1],
}
const FLAG = { star: 0, glitter: 1, rise: 2 }
const RISE_SPARKS = 8

export function starPosition([ox, oy, oz], [vx, vy, vz], drag, g, tau) {
  const e = (1 - Math.exp(-drag * tau)) / drag, fall = (g * (tau - e)) / drag
  return [ox + vx * e, oy + vy * e - fall, oz + vz * e]
}

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296 } }
const unit = (r) => { const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a)] }

// fraction < 1 keeps every n-th shell (LOW quality)
export function showBuffers(show, { fraction = 1 } = {}) {
  const shells = fraction >= 1 ? show.shells : show.shells.filter((_, i) => (i * fraction) % 1 < fraction)
  const out = { start: [], origin: [], vel: [], color: [], params: [] } // params: life, drag, gravity, flag·10 + size
  const push = (t0, o, v, c, life, drag, g, flag, size) => { out.start.push(t0); out.origin.push(...o); out.vel.push(...v); out.color.push(...c); out.params.push(life, drag, g, flag * 10 + size) }
  for (const s of shells) {
    const r = rng(s.seed), [speed, drag, g, life, size, glitter] = PHYSICS[s.kind], n = STARS[s.kind]
    // the rising trail: sparks easing up from the barge to the burst point, each a little behind the last
    const launch = [BARGE[0] + (r() - 0.5) * 30, 3, BARGE[2] + (r() - 0.5) * 20]
    for (let k = 0; k < RISE_SPARKS; k++) push(s.t - s.rise + k * 0.045, launch, s.burst, [1, 0.75, 0.45].map((c) => c * (1 - k / RISE_SPARKS)), s.rise, 0, 0, FLAG.rise, 1.8)
    // the ring lies in a tilted plane; everything else is a sphere of stars
    const tilt = r() * Math.PI, ax = [Math.cos(tilt), Math.sin(tilt) * 0.3, Math.sin(tilt)]
    for (let i = 0; i < n; i++) {
      let d
      if (s.kind === 'ring') { const a = (i / n) * Math.PI * 2, u = [-ax[2], 0, ax[0]]; d = [u[0] * Math.cos(a), Math.sin(a), u[2] * Math.cos(a)] } else d = unit(r)
      const v = d.map((x) => x * speed * s.size * (0.85 + 0.3 * r())), c = i % 2 ? s.c1 : s.c2
      push(s.t, s.burst, v, c, life * (0.85 + 0.3 * r()), drag, g, glitter ? FLAG.glitter : FLAG.star, size)
      if (s.kind === 'crossette') { // each star splits in four at the end of its short flight
        const p = starPosition(s.burst, v, drag, g, life), vv = [v[0] * Math.exp(-drag * life), v[1] * Math.exp(-drag * life), v[2] * Math.exp(-drag * life)]
        for (let q = 0; q < 4; q++) { const dd = unit(r); push(s.t + life, p, [vv[0] + dd[0] * 45, vv[1] + dd[1] * 45, vv[2] + dd[2] * 45], s.c2, 1.6, 1.5, 9.8, FLAG.star, 2.0) }
      }
    }
  }
  return { count: out.start.length, start: new Float32Array(out.start), origin: new Float32Array(out.origin), vel: new Float32Array(out.vel), color: new Float32Array(out.color), params: new Float32Array(out.params) }
}
