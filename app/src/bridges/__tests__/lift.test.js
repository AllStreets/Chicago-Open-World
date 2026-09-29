import { describe, it, expect } from 'vitest'
import { liftAngle, liftPlan, boatRunAt, liftState, runDuration, rotateAboutAxis, LIFT, LIFT_DEMO, MAX_LIFT_DEG } from '../lift.js'
import { packLeaves } from '../leafTexture.js'

const MAX = (MAX_LIFT_DEG * Math.PI) / 180
const order = ['lakeshore', 'columbus', 'dusable']

describe('leaf angle', () => {
  it('rises, holds at 75°, lowers, and rests at 0 before and after', () => {
    expect(liftAngle(-5)).toBe(0)
    expect(liftAngle(LIFT.raiseS / 2)).toBeCloseTo(MAX / 2)
    expect(liftAngle(LIFT.raiseS + 10)).toBeCloseTo(MAX)
    expect(liftAngle(LIFT.raiseS + LIFT.holdS + LIFT.lowerS + 1)).toBe(0)
    for (let t = -10; t < 500; t += 7) { const a = liftAngle(t); expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(MAX + 1e-12) }
  })
  it('bridges lift in sequence, staggered', () => {
    const p = liftPlan(order, LIFT.raiseS, LIFT)
    expect(p.lakeshore).toBeCloseTo(MAX); expect(p.dusable).toBe(0)
  })
})

describe('boat runs (Chicago time)', () => {
  it('a spring Saturday at 08:05 runs upriver; a Monday never runs', () => {
    const r = boatRunAt(new Date('2026-05-02T13:05:00Z'), order)            // Sat May 2, 08:05 CDT
    expect(r.season).toBe('spring'); expect(r.order[0]).toBe('lakeshore'); expect(r.elapsed).toBe(300)
    expect(boatRunAt(new Date('2026-05-04T13:05:00Z'), order)).toBeNull()   // Monday
  })
  it('fall runs go back out to the lake; winter has none', () => {
    const r = boatRunAt(new Date('2026-10-07T14:35:00Z'), order)            // Wed Oct 7, 09:35 CDT
    expect(r.season).toBe('fall'); expect(r.order[0]).toBe('dusable')
    expect(boatRunAt(new Date('2026-01-07T15:35:00Z'), order)).toBeNull()
  })
})

describe('manual lift (B)', () => {
  it('pressing B again restarts from the new press; the run ends with every leaf down', () => {
    const t0 = 1_000_000
    const a = liftState({ now: t0 + 20_000, manualStart: t0, order })
    const b = liftState({ now: t0 + 20_000, manualStart: t0 + 19_000, order })    // pressed again 1 s ago
    expect(a.angles.lakeshore).toBeGreaterThan(b.angles.lakeshore)
    const end = liftState({ now: t0 + runDuration(order.length, LIFT_DEMO) * 1000 + 1, manualStart: t0, order })
    expect(end.done).toBe(true); expect(end.angles).toEqual({})
  })
  it('without a press the schedule decides', () => {
    expect(liftState({ now: Date.parse('2026-05-04T13:05:00Z'), manualStart: null, order }).source).toBe('idle')
  })
})

describe('trunnion rotation', () => {
  it('turning a tip 90° about k = d × up lifts it straight above the pivot, preserving length', () => {
    const pivot = [0, -1, 0], d = [0, 0, 1], k = [-d[2], 0, d[0]]
    const q = rotateAboutAxis([0, -1, 30], pivot, k, Math.PI / 2)
    expect(q[0]).toBeCloseTo(0); expect(q[1]).toBeCloseTo(29); expect(q[2]).toBeCloseTo(0)
  })
  it('packs pivot, angle and axis per leaf', () => {
    const f = packLeaves([{ bridge: 'x', pivot: [1, 2, 3], k: [0, 0, 1] }], { x: 0.5 })
    expect(Array.from(f.slice(0, 8))).toEqual([1, 2, 3, 0.5, 0, 0, 1, 0])
  })
})

describe('leaf texture ownership', () => {
  it('writes into the shared uniform texture (no swap an effect re-run can undo); grows it only when needed', async () => {
    const THREE = await import('three')
    const { leafTextureFor } = await import('../leafTexture.js')
    const base = new THREE.DataTexture(new Float32Array(512 * 4), 512, 1, THREE.RGBAFormat, THREE.FloatType)
    const uniform = { value: base }
    expect(leafTextureFor(uniform, 64)).toBe(base)
    expect(uniform.value).toBe(base)
    const big = leafTextureFor(uniform, 300)
    expect(big).not.toBe(base); expect(uniform.value).toBe(big); expect(big.image.width).toBe(600)
    expect(leafTextureFor(uniform, 300)).toBe(big)
  })
})
