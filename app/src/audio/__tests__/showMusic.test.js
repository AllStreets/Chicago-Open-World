import { describe, it, expect, vi } from 'vitest'
import { createShowMusic, LOOKAHEAD_S } from '../showMusic.js'
import { SCORES } from '../score.js'

function fakeCtx() {
  const started = []
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
  const node = (kind) => ({ kind, connect: vi.fn((n) => n), disconnect: vi.fn(), start: vi.fn((t) => started.push({ kind, t })), stop: vi.fn(), frequency: param(), detune: param(), gain: param(), Q: param(), type: '', positionX: param(), positionY: param(), positionZ: param() })
  const ctx = { currentTime: 10, sampleRate: 8000, destination: node('dest'), createOscillator: () => node('osc'), createGain: () => node('gain'), createBiquadFilter: () => node('filter'), createPanner: () => node('panner'), createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: () => node('noise') }
  return { ctx, started }
}

describe('show music engine', () => {
  it('schedules each beat once, ahead of time, at the right audio-clock time', () => {
    const { ctx, started } = fakeCtx(), m = createShowMusic(ctx, SCORES.fountain)
    m.tick(0)
    const n1 = started.length
    expect(n1).toBeGreaterThan(0)
    expect(Math.min(...started.map((s) => s.t))).toBeCloseTo(10, 6)          // beat 0 lands at ctx.currentTime
    m.tick(0.01)
    expect(started.length).toBe(n1)                                           // not scheduled twice
    const beat = 60 / SCORES.fountain.bpm
    m.tick(beat - LOOKAHEAD_S / 2)
    expect(started.length).toBeGreaterThan(n1)                                // the next beat, within the lookahead
    expect(Math.max(...started.map((s) => s.t))).toBeLessThanOrEqual(10 + beat + 1e-6)
  })
  it('the bridge score opens with the ship horn and rings the gate bells', () => {
    const { ctx, started } = fakeCtx(), m = createShowMusic(ctx, SCORES.bridge, { bells: true })
    m.tick(0)
    expect(m.played).toContain('horn'); expect(m.played).toContain('bell')
  })
  it('jumping ahead (a preview started mid-show, or a dropped tab) does not replay the skipped beats', () => {
    const { ctx, started } = fakeCtx(), m = createShowMusic(ctx, SCORES.fountain)
    m.tick(300)
    const t = started.map((s) => s.t)
    expect(Math.min(...t)).toBeGreaterThanOrEqual(10 - 1e-6)
    expect(Math.max(...t)).toBeLessThanOrEqual(10 + 1.5)
  })
  it('stop fades out, then disconnects; level and position are settable', () => {
    vi.useFakeTimers()
    const { ctx } = fakeCtx(), m = createShowMusic(ctx, SCORES.fountain)
    m.setLevel(0.5); m.setPosition([1, 2, 3]); m.tick(0)
    expect(() => m.stop()).not.toThrow()
    expect(m.out.disconnect).not.toHaveBeenCalled()   // still fading
    vi.advanceTimersByTime(1600)
    expect(m.out.disconnect).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
