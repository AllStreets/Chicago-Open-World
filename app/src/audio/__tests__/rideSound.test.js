// app/src/audio/__tests__/rideSound.test.js — F-7 (2026-10-01): a ride is never silent with Sound on. The L ride's own
// train reports its real speed (it was hard-coded 0, so the rumble fell silent); in the front window it plays at
// in-car level; the bus has its engine and road, the glide its wind by speed, a walk the city around you.
import { describe, it, expect, vi } from 'vitest'
import { makePath } from '../../transit/path.js'
import { buildProfile } from '../../transit/profile.js'
import { createRun, runState } from '../../ride/rideRun.js'
import { rideSpeedMps } from '../../ride/rideSession.js'
import { trainSoundLevel, rideSoundLevels, createRideSound, chimeAt } from '../rideSound.js'

const path = makePath([[0, 0, 0], [3000, 0, 0]])
const stops = [0, 1500, 3000]
const def = { kind: 'L', path, stops: stops.map((s, i) => ({ name: `S${i}`, s })), profile: buildProfile(path, stops, { vmax: 25, accel: 1, brake: 1.2, dwellS: 20 }) }
const at = (tau, extra = {}) => ({ ...createRun(def), tau, ...extra })

describe('F-7 the ride train has a real speed', () => {
  it('moving between stations: speed > 0; dwelling, paused or done: 0; ×2 doubles it', () => {
    const mid = def.profile.duration * 0.25
    const v = rideSpeedMps(def, at(mid))
    expect(v).toBeGreaterThan(5)
    expect(rideSpeedMps(def, at(0))).toBeLessThan(0.5) // at the first stop, doors open
    expect(rideSpeedMps(def, at(mid, { paused: true }))).toBe(0)
    expect(rideSpeedMps(def, at(mid, { done: true }))).toBe(0)
    expect(rideSpeedMps(def, at(mid, { speed: 2 }))).toBeCloseTo(v * 2, 5)
  })
  it('runState carries the speed too', () => {
    expect(runState(def, at(def.profile.duration * 0.25)).v).toBeGreaterThan(5)
  })
})

describe('F-7 levels', () => {
  it('the ride train at 0 m: heard when moving, silent stopped or with Sound off; the cab is the in-car level', () => {
    expect(trainSoundLevel(0, 15, { soundOn: true })).toBeGreaterThan(0)
    expect(trainSoundLevel(0, 15, { soundOn: true, cab: true })).toBeGreaterThanOrEqual(trainSoundLevel(0, 15, { soundOn: true }))
    expect(trainSoundLevel(0, 0, { soundOn: true, cab: true })).toBe(0)
    expect(trainSoundLevel(0, 15, { soundOn: false, cab: true })).toBe(0)
    expect(trainSoundLevel(300, 15, { soundOn: true })).toBeLessThan(trainSoundLevel(20, 15, { soundOn: true }))
  })
  it('bus: engine idles at a stop and rises with speed, road noise only when moving', () => {
    const idle = rideSoundLevels('bus', { speedMps: 0, soundOn: true }), run = rideSoundLevels('bus', { speedMps: 10, soundOn: true })
    expect(idle.engine).toBeGreaterThan(0); expect(idle.road).toBe(0)
    expect(run.engine).toBeGreaterThan(idle.engine); expect(run.road).toBeGreaterThan(0); expect(run.engineHz).toBeGreaterThan(idle.engineHz)
  })
  it('glide: the wind grows with speed', () => {
    const slow = rideSoundLevels('glide', { speedMps: 20, soundOn: true }).wind, fast = rideSoundLevels('glide', { speedMps: 70, soundOn: true }).wind
    expect(slow).toBeGreaterThan(0); expect(fast).toBeGreaterThan(slow); expect(fast).toBeLessThanOrEqual(1)
  })
  it('walk: a light city ambience; nothing for anything with Sound off', () => {
    expect(rideSoundLevels('walk', { speedMps: 1.4, soundOn: true }).ambience).toBeGreaterThan(0)
    for (const k of ['bus', 'glide', 'walk']) {
      const off = rideSoundLevels(k, { speedMps: 10, soundOn: false })
      expect(Math.max(off.engine, off.road, off.wind, off.ambience)).toBe(0)
    }
  })
  it('a door chime when the ride train comes to a stop (once per stop)', () => {
    expect(chimeAt({ dwelling: false }, { dwelling: true, at: 'Clark/Lake' })).toBe(true)
    expect(chimeAt({ dwelling: true }, { dwelling: true })).toBe(false)
    expect(chimeAt(null, { dwelling: true })).toBe(false) // boarding: no chime on the first frame
  })
})

describe('F-7 the synth', () => {
  it('createRideSound drives a context with no files and stops cleanly', () => {
    const param = () => ({ value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
    const node = () => ({ connect: vi.fn((n) => n), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: param(), gain: param(), Q: param(), detune: param(), type: '', buffer: null, loop: false })
    const ctx = { sampleRate: 8000, currentTime: 0, destination: node(), createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
      createBufferSource: node, createBiquadFilter: node, createOscillator: node, createGain: node }
    const s = createRideSound(ctx)
    expect(() => s.set({ engine: 0.5, engineHz: 60, road: 0.3, wind: 0.2, ambience: 0.1 })).not.toThrow()
    expect(() => s.chime()).not.toThrow()
    expect(() => s.stop()).not.toThrow()
  })
})
