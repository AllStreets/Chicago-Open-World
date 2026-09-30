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
