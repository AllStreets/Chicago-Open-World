// app/src/audio/__tests__/rumbleSmooth.test.js — user fixes: following a train sounded choppy. The rail clatter
// pulses gently (a sine under a steady base), never gating the sound fully on and off.
import { describe, it, expect, vi } from 'vitest'
import { createRumble } from '../rumble.js'

const fakeCtx = () => {
  const made = []
  const param = () => ({ value: 0, setTargetAtTime: vi.fn(function (v) { this.value = v }) })
  const node = (kind) => () => { const n = { kind, connect: vi.fn((x) => x), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: param(), gain: param(), Q: param(), type: '' }; made.push(n); return n }
  return { made, ctx: { currentTime: 0, sampleRate: 8000, destination: {}, createBuffer: () => ({ getChannelData: () => new Float32Array(16000) }), createBufferSource: node('src'), createBiquadFilter: node('filter'), createGain: node('gain'), createOscillator: node('osc') } }
}
describe('train rumble', () => {
  it('the clatter pulse is a sine at most half the base, so the sound never cuts out', () => {
    const { ctx, made } = fakeCtx()
    const r = createRumble(ctx)
    r.set(1, 2)
    const osc = made.find((n) => n.kind === 'osc'), gains = made.filter((n) => n.kind === 'gain')
    expect(osc.type).toBe('sine')
    const [, clack, lfoGain] = gains // gain, clack, lfoGain (creation order)
    expect(lfoGain.gain.value).toBeLessThanOrEqual(clack.gain.value * 0.5 + 1e-9)
    expect(clack.gain.value).toBeGreaterThan(0)
  })
})
