// app/src/ride/__tests__/glide.test.js — glide physics (P7 Task 5; the original plan's eight properties).
import { describe, it, expect } from 'vitest'
import { GLIDE, createGlider, glideStep, chasePose, glideInput } from '../glide.js'

const flat = { clearanceAt: () => 0 }
// A 440 m tower occupying x ∈ [-40, 40], z ∈ [-1040, -960] (north of the start)
const tower = { clearanceAt: (x, z) => (Math.abs(x) <= 40 && z >= -1040 && z <= -960 ? 440 : 0) }
const run = (g, input, seconds, env, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) g = glideStep(g, input, dt, env); return g }
const none = { pitch: 0, turn: 0, boost: false }

describe('glide physics', () => {
  it('neutral flight sinks gently (0.5–3 m/s) at a steady trim speed', () => {
    const g0 = createGlider({ position: [0, 800, 0], heading: 0, speed: 35 })
    const g = run(g0, none, 20, flat)
    const sink = (g0.pos[1] - g.pos[1]) / 20
    expect(sink).toBeGreaterThan(0.5); expect(sink).toBeLessThan(3)
    expect(g.speed).toBeGreaterThan(30); expect(g.speed).toBeLessThan(45)
  })
  it('diving gains speed; climbing trades it away', () => {
    const g0 = createGlider({ position: [0, 900, 0], heading: 0, speed: 35 })
    expect(run(g0, { ...none, pitch: 1 }, 5, flat).speed).toBeGreaterThan(45)
    expect(run(g0, { ...none, pitch: -1 }, 5, flat).speed).toBeLessThan(30)
  })
  it('speed stays within [MIN_V, MAX_V]', () => {
    const g0 = createGlider({ position: [0, 1400, 0], heading: 0, speed: 35 })
    for (const p of [1, -1]) { const g = run(g0, { ...none, pitch: p, boost: p > 0 }, 30, flat); expect(g.speed).toBeGreaterThanOrEqual(GLIDE.MIN_V); expect(g.speed).toBeLessThanOrEqual(GLIDE.MAX_V) }
  })
  it('flying straight at a 440 m tower never goes inside it, and never stops dead', () => {
    let g = createGlider({ position: [0, 300, 0], heading: 0, speed: 60 })
    for (let t = 0; t < 30; t += 1 / 60) {
      g = glideStep(g, { ...none, pitch: 1 }, 1 / 60, tower)
      expect(g.pos[1]).toBeGreaterThanOrEqual(tower.clearanceAt(g.pos[0], g.pos[2]) + GLIDE.CLEAR_M - 1e-6)
    }
    expect(Math.hypot(g.pos[0], g.pos[2])).toBeGreaterThan(1200) // it got round or over the tower
  })
  it('a 2 s hitch equals 20 × 0.1 s steps and stays above clearance (no tunnelling)', () => {
    const g0 = createGlider({ position: [0, 460, -900], heading: 0, speed: 60 })
    const big = glideStep(g0, none, 2, tower)
    let small = g0; for (let i = 0; i < 20; i++) small = glideStep(small, none, 0.1, tower)
    for (let k = 0; k < 3; k++) expect(big.pos[k]).toBeCloseTo(small.pos[k], 3)
    expect(big.pos[1]).toBeGreaterThanOrEqual(440 + GLIDE.CLEAR_M - 1e-6)
  })
  it('banking turns the glider (right turns right)', () => {
    const g = run(createGlider({ position: [0, 800, 0], heading: 0, speed: 35 }), { ...none, turn: 1 }, 5, flat)
    expect(g.heading).toBeLessThan(-0.3)
  })
  it('boost is limited by its meter', () => {
    const g = run(createGlider({ position: [0, 800, 0], heading: 0, speed: 35 }), { ...none, boost: true }, 10, flat)
    expect(g.boost).toBe(0)
  })
  it('the world clamp keeps the glider inside the built city', () => {
    const clamp = ([x, z]) => [Math.max(-1000, Math.min(1000, x)), Math.max(-1000, Math.min(1000, z))]
    const g = run(createGlider({ position: [900, 800, 0], heading: -Math.PI / 2, speed: 50 }), none, 20, { ...flat, clamp })
    expect(Math.abs(g.pos[0])).toBeLessThanOrEqual(1000); expect(Math.abs(g.pos[2])).toBeLessThanOrEqual(1000)
  })
  it('reduced motion keeps the horizon level', () => {
    const g = { ...createGlider({ position: [0, 500, 0], heading: 0 }), bank: 0.6 }
    expect(chasePose(g, { reducedMotion: true }).roll).toBe(0); expect(chasePose(g).roll).toBeCloseTo(0.3)
  })
  it('maps familiar keys', () => {
    expect(glideInput(new Set(['ArrowUp']))).toEqual({ pitch: 1, turn: 0, boost: false })
    expect(glideInput(new Set(['KeyS', 'KeyD', 'ShiftLeft']))).toEqual({ pitch: -1, turn: 1, boost: true })
    expect(glideInput(new Set(['ArrowLeft', 'ArrowRight']))).toEqual({ pitch: 0, turn: 0, boost: false })
  })
})
