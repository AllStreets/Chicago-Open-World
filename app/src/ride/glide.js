// app/src/ride/glide.js — the hang-glider (P7 · I-7.1): energy flight — dive to gain speed, climb to trade it away —
// that reads the roof heightfield ahead and below, so it lifts, turns and slides instead of passing through a tower.
// Pure and deterministic; a long frame is sub-stepped (a 2 s hitch equals twenty 0.1 s steps).
export const GLIDE = { MIN_V: 18, MAX_V: 75, V_TRIM: 32, DRAG: 0.08, G: 9.81, CLEAR_M: 12, LOOKAHEAD_S: 1.5, MAX_BANK: 0.7, PITCH_DOWN: -0.44, PITCH_UP: 0.35, PITCH_NEUTRAL: -0.05, PITCH_RATE: 1.2, BOOST_A: 6, BOOST_DRAIN: 0.2, BOOST_RECHARGE: 0.1, MAX_ALT: 1500, MAX_DT: 0.1 }
const BANK_RATE = 1.5, WALL_M = 25, AVOID_TURN = 1.0

// heading follows camera-controls' azimuth: 0 = north (−Z), increasing turns left (west)
export const forward = (h) => [-Math.sin(h), -Math.cos(h)]

export function createGlider({ position, heading = 0, speed = 35 }) {
  return { pos: position.slice(), heading, pitch: GLIDE.PITCH_NEUTRAL, bank: 0, speed, boost: 1 }
}

const toward = (v, target, maxStep) => v + Math.max(-maxStep, Math.min(maxStep, target - v))

function sub(g, input, h, env) {
  const C = GLIDE, clr = env.clearanceAt
  const [fx, fz] = forward(g.heading)
  let pitchTarget = input.pitch > 0 ? C.PITCH_DOWN : input.pitch < 0 ? C.PITCH_UP : C.PITCH_NEUTRAL
  if (g.speed < C.MIN_V + 2) pitchTarget = C.PITCH_DOWN / 2 // stall: the nose drops
  const ahead = [g.pos[0] + fx * g.speed * C.LOOKAHEAD_S, g.pos[2] + fz * g.speed * C.LOOKAHEAD_S]
  if (g.pos[1] < clr(ahead[0], ahead[1]) + C.CLEAR_M + 10) pitchTarget = C.PITCH_UP // a roof ahead: climb
  const pitch = toward(g.pitch, pitchTarget, C.PITCH_RATE * h)
  const bank = toward(g.bank, (input.turn ?? 0) * C.MAX_BANK, BANK_RATE * h)
  const boosting = input.boost && g.boost > 0
  const boost = boosting ? Math.max(0, g.boost - C.BOOST_DRAIN * h) : input.boost ? g.boost : Math.min(1, g.boost + C.BOOST_RECHARGE * h)
  let speed = g.speed + (-C.G * Math.sin(pitch) - C.DRAG * (g.speed - C.V_TRIM) + (boosting ? C.BOOST_A : 0)) * h
  speed = Math.max(C.MIN_V, Math.min(C.MAX_V, speed))
  let heading = g.heading - (C.G * Math.tan(bank) / speed) * h // bank right (turn +1) turns right
  const hv = speed * Math.cos(pitch), vv = speed * Math.sin(pitch)
  const [nfx, nfz] = forward(heading)
  let x = g.pos[0] + nfx * hv * h, z = g.pos[2] + nfz * hv * h, y = g.pos[1] + vv * h
  // a wall far above us: don't fly into it — slide along it on one axis, or hold and turn away (never stop dead)
  if (clr(x, z) + C.CLEAR_M - y > WALL_M) {
    heading -= AVOID_TURN * h // and veer away, so a head-on approach never pins the glider to the wall
    if (clr(x, g.pos[2]) + C.CLEAR_M - y <= WALL_M) z = g.pos[2]
    else if (clr(g.pos[0], z) + C.CLEAR_M - y <= WALL_M) x = g.pos[0]
    else { x = g.pos[0]; z = g.pos[2] }
  }
  if (env.clamp) {
    const [cx, cz] = env.clamp([x, z])
    if (cx !== x || cz !== z) { // the edge of the built world: bank back toward its middle
      const want = Math.atan2(cx, cz), diff = Math.atan2(Math.sin(want - heading), Math.cos(want - heading))
      heading += Math.max(-h, Math.min(h, diff)); x = cx; z = cz
    }
  }
  y = Math.min(C.MAX_ALT, Math.max(y, clr(x, z) + C.CLEAR_M)) // the hard floor: vertical motion into it is removed
  return { pos: [x, y, z], heading, pitch, bank, speed, boost }
}

export function glideStep(g, input, dt, env) {
  const n = Math.max(1, Math.ceil(dt / GLIDE.MAX_DT - 1e-9)), h = dt / n
  let s = g
  for (let i = 0; i < n; i++) s = sub(s, input, h, env)
  return s
}

export function chasePose(g, { back = 18, up = 5, reducedMotion = false } = {}) {
  const [fx, fz] = forward(g.heading)
  return {
    position: [g.pos[0] - fx * back, g.pos[1] + up, g.pos[2] - fz * back],
    target: [g.pos[0] + fx * 40, g.pos[1] + Math.sin(g.pitch) * 40, g.pos[2] + fz * 40],
    roll: reducedMotion ? 0 : g.bank * 0.5,
  }
}

const has = (keys, ...codes) => codes.some((c) => keys.has(c))
export function glideInput(keys) {
  return {
    pitch: (has(keys, 'ArrowUp', 'KeyW') ? 1 : 0) - (has(keys, 'ArrowDown', 'KeyS') ? 1 : 0),
    turn: (has(keys, 'ArrowRight', 'KeyD') ? 1 : 0) - (has(keys, 'ArrowLeft', 'KeyA') ? 1 : 0),
    boost: has(keys, 'ShiftLeft', 'ShiftRight'),
  }
}
