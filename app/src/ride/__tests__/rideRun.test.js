// app/src/ride/__tests__/rideRun.test.js — the generic ride engine (P7 Task 1): a path, its stops, its own clock.
import { describe, it, expect } from 'vitest'
import { makePath } from '../../transit/path.js'
import { buildProfile } from '../../transit/profile.js'
import { createRun, stepRun, runState, skipStop, setSpeed, ridePose, exitPose, RIDE_SPEEDS, MAX_STEP_S } from '../rideRun.js'

// a straight 2 km line north (−Z) on an 8 m structure, stops at 0, 1000 and 2000 m
const pts = Array.from({ length: 41 }, (_, i) => [0, 8, -i * 50])
const path = makePath(pts)
const stops = [{ name: 'A', s: 0 }, { name: 'B', s: 1000 }, { name: 'C', s: 2000 }]
const def = { id: 'l:test', kind: 'L', name: 'Test Line', path, stops, profile: buildProfile(path, stops.map((x) => x.s), { vmax: 24, accel: 1.3, brake: 1.3, dwellS: 20 }) }
const run = (r, seconds, dt = 0.1) => { for (let t = 0; t < seconds; t += dt) r = stepRun(def, r, dt); return r }

describe('ride run', () => {
  it('starts dwelling at the first stop, runs to the second, dwells, and ends done at the last', () => {
    let r = createRun(def)
    expect(runState(def, r)).toMatchObject({ dwelling: true, next: { name: 'B' } })
    expect(runState(def, r).s).toBeCloseTo(0, 0)
    r = run(r, 40)
    const mid = runState(def, r)
    expect(mid.s).toBeGreaterThan(50); expect(mid.dwelling).toBe(false); expect(mid.prev.name).toBe('A')
    r = run(r, 400)
    expect(r.done).toBe(true); expect(runState(def, r).s).toBeCloseTo(2000, 0)
  })
  it('pause freezes the ride; ×4 covers about four times the ground', () => {
    const a = run(createRun(def), 30)
    const p = run({ ...a, paused: true }, 10)
    expect(p.tau).toBe(a.tau)
    const one = runState(def, run(a, 5)).s - runState(def, a).s
    const four = runState(def, run(setSpeed(a, 4), 5)).s - runState(def, a).s
    expect(four / one).toBeGreaterThan(2.5)
    expect(RIDE_SPEEDS).toEqual([1, 2, 4])
  })
  it('a long hitch (a tab switch) moves at most one short step', () => {
    const a = run(createRun(def), 30)
    expect(stepRun(def, a, 10).tau - a.tau).toBeCloseTo(MAX_STEP_S, 5)
  })
  it('skips to the next and the previous stop, arriving', () => {
    let r = run(createRun(def), 30)
    r = skipStop(def, r, 1)
    expect(runState(def, r)).toMatchObject({ dwelling: true }); expect(runState(def, r).s).toBeCloseTo(1000, 0)
    r = skipStop(def, r, -1)
    expect(runState(def, r).s).toBeCloseTo(0, 0)
    expect(skipStop(def, skipStop(def, skipStop(def, r, 1), 1), 1).done).toBe(true) // past the last stop: the ride is over
  })
  it('walks without a profile move at their own pace', () => {
    const walk = { id: 'w', kind: 'walk', path, stops: [{ name: 'Start', s: 0 }, { name: 'End', s: 2000 }], paceMps: 1.4 }
    let r = createRun(walk)
    for (let i = 0; i < 100; i++) r = stepRun(walk, r, 0.1)
    expect(runState(walk, r).s).toBeCloseTo(14, 0)
  })
})

describe('ride poses', () => {
  const at = (s) => runState(def, { tau: def.profile.knots.find((k) => k[1] >= s)[0] })
  const none = () => 0
  it('cab: just behind the head, 2.7 m above the rail, looking along the track', () => {
    const st = at(500), p = ridePose(def, st, 'cab', { yaw: 0, pitch: 0 }, { clearance: none })
    expect(p.position[1]).toBeCloseTo(8 + 2.7, 1)
    expect(p.position[2]).toBeGreaterThan(st.head.p[2]) // behind the head (the train runs toward −Z)
    expect(p.target[2]).toBeLessThan(p.position[2] - 50)
  })
  it('a walk eye is 1.7 m above the path, and looking 90° right turns the view east', () => {
    const walk = { kind: 'walk', path: makePath([[0, 0, 0], [0, 0, -500]]), stops: [] }
    const st = runState(walk, { tau: 100 })
    const p = ridePose(walk, st, 'eye', { yaw: 0, pitch: 0 }, { clearance: none })
    expect(p.position[1]).toBeCloseTo(1.7, 5)
    const r = ridePose(walk, st, 'eye', { yaw: -Math.PI / 2, pitch: 0 }, { clearance: none })
    expect(r.target[0] - r.position[0]).toBeGreaterThan(50)
  })
  it('underground: inside the tube when the tunnels exist, 3 m above the street when they do not; side falls back to cab', () => {
    const sub = { ...def, path: makePath([[0, -9, 0], [0, -9, -2000]]) }
    const st = runState(sub, { tau: 0 })
    expect(ridePose(sub, st, 'cab', { yaw: 0, pitch: 0 }, { tunnels: true, clearance: none }).position[1]).toBeCloseTo(-9 + 2.7, 1)
    expect(ridePose(sub, st, 'cab', { yaw: 0, pitch: 0 }, { tunnels: false, clearance: none }).position[1]).toBeCloseTo(3, 1)
    const side = ridePose(sub, st, 'side', { yaw: 0, pitch: 0 }, { tunnels: true, clearance: none })
    expect(side.position[0]).toBeCloseTo(0, 1) // no side camera in the rock
  })
  it('the exit pose clears the roofs', () => {
    const e = exitPose({ position: [0, 1.7, 0], target: [0, 1.7, -80] }, () => 300)
    expect(e.position[1]).toBeGreaterThanOrEqual(325)
    expect(exitPose({ position: [0, 1.7, 0], target: [0, 1.7, -80] }, () => 25).position[1]).toBeGreaterThanOrEqual(120)
  })
})
