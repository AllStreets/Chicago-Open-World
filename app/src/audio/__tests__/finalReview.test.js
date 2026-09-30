// Final whole-pass review fixes (show music): each test reproduces one finding.
import { describe, it, expect, vi } from 'vitest'
import { fountainShow } from '../../landmarks/fountainSchedule.js'
import { boatRunAt } from '../../bridges/lift.js'
import { createShowMusic } from '../showMusic.js'
import { SCORES } from '../score.js'

const fakeCtx = () => {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
  const node = () => ({ connect: vi.fn((n) => n), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: param(), detune: param(), gain: param(), Q: param(), type: '', positionX: param(), positionY: param(), positionZ: param() })
  return { currentTime: 5, sampleRate: 8000, destination: node(), createOscillator: node, createGain: node, createBiquadFilter: node, createPanner: node }
}

describe('final review: show clocks and music', () => {
  it('#1 a scheduled show clock advances smoothly through a second boundary (no whole-second steps)', () => {
    const t0 = Date.parse('2026-07-01T12:05:00.000-05:00') // in season, during the 12:00 show
    let prev = null
    for (let ms = 0; ms < 2000; ms += 16) {
      const m = fountainShow(new Date(t0 + ms)).minute * 60
      if (prev != null) { expect(m - prev).toBeGreaterThan(0.005); expect(m - prev).toBeLessThan(0.03) }
      prev = m
    }
  })
  it('#1 a boat run elapses with sub-second precision too', () => {
    const d = new Date('2026-05-02T08:00:10.500-05:00') // a Saturday spring run starts at 08:00
    const r = boatRunAt(d, ['a', 'b'])
    expect(r).not.toBeNull()
    expect(r.elapsed).toBeCloseTo(10.5, 3)
  })
  it('#2 the first frame after pressing B (show time a few ms in) still plays the ship horn and the opening chord', () => {
    const m = createShowMusic(fakeCtx(), SCORES.bridge, { bells: true })
    m.tick(0.016)
    expect(m.played.has('horn')).toBe(true); expect(m.played.has('pad')).toBe(true)
  })
  it('#4 the played-voice record stays bounded over a long show', () => {
    const m = createShowMusic(fakeCtx(), SCORES.fountain)
    for (let t = 0; t < 600; t += 5) m.tick(t) // ten minutes of the show
    expect(m.played.size).toBeLessThanOrEqual(8)
  }, 20000)
})

import { gateActive } from '../../landmarks/showClock.js'
import { LIFT, LIFT_DEMO, liftState } from '../../bridges/lift.js'
import { useStore } from '../../state/store.js'
import { FOUNTAIN_SCHEDULE } from '../../landmarks/fountainSchedule.js'

describe('final review #3 — real boat runs keep real timings', () => {
  it('the second bridge of a real run warns 4 s before its own leaves start, 150 s in', () => {
    expect(gateActive(1, LIFT.staggerS - 4, 0, LIFT)).toBe(true)
    expect(gateActive(1, LIFT_DEMO.staggerS + 30, 0, LIFT)).toBe(false)
  })
  it('liftState names the timing table it ran on', () => {
    expect(liftState({ now: 1e6, manualStart: 1e6 - 1000, order: ['a'] }).T).toBe(LIFT_DEMO)
    expect(liftState({ now: Date.UTC(2026, 0, 5), order: ['a'] }).T).toBe(LIFT)
  })
})

describe('final review #5 — the fountain preview ends on its own', () => {
  it('expireFountainPreview clears a preview older than one show', () => {
    useStore.setState({ fountainPreview: 0 })
    useStore.getState().expireFountainPreview(FOUNTAIN_SCHEDULE.showMinutes * 60000 - 1)
    expect(useStore.getState().fountainPreview).toBe(0)
    useStore.getState().expireFountainPreview(FOUNTAIN_SCHEDULE.showMinutes * 60000 + 1)
    expect(useStore.getState().fountainPreview).toBe(null)
  })
})

import { createDrawProbe } from '../../lib/drawProbe.js'
describe('final review #7 — the perf probe starts clean each time', () => {
  it('turning the probe off and on again forgets the old frames', () => {
    const info = { autoReset: true, render: { calls: 500, triangles: 9 }, reset: () => {} }
    const p = createDrawProbe(info)
    p.start(); p.frame(); p.tick(0.016); p.stop(); p.start()
    expect(p.stats().frames).toBe(0)
    expect(p.stats().maxCalls).toBe(0)
  })
})

describe('final review #8 — the perf budget checks the worst frame', () => {
  it('stats() reports the heaviest frame\'s triangles', () => {
    const info = { autoReset: true, render: { calls: 1, triangles: 100 }, reset: () => {} }
    const p = createDrawProbe(info)
    p.start(); p.frame(); info.render.triangles = 5_000_000; p.frame(); info.render.triangles = 100; p.frame()
    expect(p.stats().maxTriangles).toBe(5_000_000)
  })
})
